import base64
import cv2
import numpy as np
import logging
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field
from typing import Optional, List

from detection import FaceDetector, BiometricFaceRecognizer, AudioActivityDetector, PhoneDetector, MalpracticeDetector
from sessions.session_manager import SessionManager
from config import SPRING_BOOT_URL

logger = logging.getLogger("ai-proctoring.routes")

router = APIRouter()

# Instantiate singletons
face_detector = FaceDetector()
face_recognizer = BiometricFaceRecognizer()
audio_detector = AudioActivityDetector()
phone_detector = PhoneDetector()
malpractice_detector = MalpracticeDetector()
session_manager = SessionManager()

def decode_base64_image(base64_str: str) -> Optional[np.ndarray]:
    try:
        if "," in base64_str:
            base64_str = base64_str.split(",", 1)[1]
        img_bytes = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        logger.error("Failed to decode base64 image: %s", e)
        return None

# Request / Response Schemas
class StartSessionRequest(BaseModel):
    attemptId: int
    studentId: str
    testCode: str
    referenceImage: str
    authToken: Optional[str] = None
    springBootUrl: Optional[str] = SPRING_BOOT_URL

class StartSessionResponse(BaseModel):
    sessionId: str
    status: str
    faceDetected: bool
    referenceRegistered: bool
    message: str

class AnalyzeFrameRequest(BaseModel):
    sessionId: str
    frame: Optional[str] = None
    audio: Optional[List[float]] = None

class AnalyzeFrameResponse(BaseModel):
    status: str
    faceDetected: bool
    numFaces: int
    identityVerified: bool
    similarityScore: float
    phoneDetected: bool
    micLevel: float
    voiceActive: bool
    loudVoice: bool
    warningCount: int
    malpracticeEvent: Optional[str] = None
    eventMessage: Optional[str] = None
    autoSubmitted: bool = False

class StopSessionRequest(BaseModel):
    sessionId: str

class StopSessionResponse(BaseModel):
    status: str
    totalVerifications: int
    identityMatches: int
    identityMismatches: int
    totalWarnings: int

@router.get("/health")
def health_check():
    return {
        "status": "UP",
        "service": "ai-proctoring",
        "models": {
            "yunet": face_detector.detector is not None,
            "sface": face_recognizer.recognizer is not None,
            "yolo": phone_detector.model is not None
        }
    }

@router.post("/proctor/start", response_model=StartSessionResponse)
def start_proctoring_session(req: StartSessionRequest):
    img = decode_base64_image(req.referenceImage)
    if img is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="INVALID_IMAGE: Could not decode base64 reference image."
        )

    faces_data, raw_faces = face_detector.detect_faces(img)
    if not faces_data or len(faces_data) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="NO_FACE_DETECTED: No clear face detected in reference photo. Please face the camera directly in good lighting."
        )

    if len(faces_data) > 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="MULTIPLE_FACES_DETECTED: Multiple faces found in reference photo. Ensure only you are in frame."
        )

    # Extract 128-d biometric embedding
    ref_embedding = None
    if raw_faces is not None and len(raw_faces) > 0:
        ref_embedding = face_recognizer.extract_embedding(img, raw_faces[0])

    if ref_embedding is None:
        logger.warning("DNN biometric embedding extraction failed, falling back to cropped template")

    session = session_manager.create_session(
        attempt_id=req.attemptId,
        student_id=req.studentId,
        test_code=req.testCode,
        reference_embedding=ref_embedding,
        reference_image_b64=req.referenceImage,
        spring_boot_url=req.springBootUrl or SPRING_BOOT_URL,
        auth_token=req.authToken
    )

    return StartSessionResponse(
        sessionId=session.session_id,
        status="INITIALIZED",
        faceDetected=True,
        referenceRegistered=True,
        message="Reference biometric identity registered successfully."
    )

@router.post("/proctor/analyze-frame", response_model=AnalyzeFrameResponse)
async def analyze_frame(req: AnalyzeFrameRequest):
    session = session_manager.get_session(req.sessionId)
    if not session or not session.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found or already closed."
        )

    faces_count = 0
    identity_match = True
    similarity_score = 1.0
    phone_detected = False

    # 1. Image Frame Processing
    if req.frame:
        img = decode_base64_image(req.frame)
        if img is not None:
            faces_data, raw_faces = face_detector.detect_faces(img)
            faces_count = len(faces_data)

            # Phone detection
            phone_detected, _ = phone_detector.detect_phone(img)

            # Biometric Identity matching
            if faces_count == 1 and session.reference_embedding is not None and raw_faces is not None:
                live_emb = face_recognizer.extract_embedding(img, raw_faces[0])
                if live_emb is not None:
                    identity_match, similarity_score = face_recognizer.match(session.reference_embedding, live_emb)
                    session_manager.record_verification(session.session_id, identity_match)
            elif faces_count != 1:
                identity_match = False
                similarity_score = 0.0

    # 2. Audio Processing
    audio_res = {"mic_level": 0.0, "is_speech": False, "is_loud": False}
    if req.audio:
        audio_res = audio_detector.analyze_pcm_samples(req.audio)

    # 3. Malpractice Evaluation & Authoritative Spring Boot Dispatch
    eval_res = await malpractice_detector.evaluate_frame(
        session=session,
        faces_count=faces_count,
        identity_match=identity_match,
        similarity_score=similarity_score,
        phone_detected=phone_detected,
        is_speech=audio_res["is_speech"],
        is_loud=audio_res["is_loud"],
        mic_level=audio_res["mic_level"]
    )

    return AnalyzeFrameResponse(
        status="ACTIVE",
        faceDetected=(faces_count > 0),
        numFaces=faces_count,
        identityVerified=identity_match,
        similarityScore=similarity_score,
        phoneDetected=phone_detected,
        micLevel=audio_res["mic_level"],
        voiceActive=audio_res["is_speech"],
        loudVoice=audio_res["is_loud"],
        warningCount=eval_res["warning_count"],
        malpracticeEvent=eval_res["confirmed_event"],
        eventMessage=eval_res["event_message"],
        autoSubmitted=eval_res["auto_submitted"]
    )

@router.post("/proctor/stop", response_model=StopSessionResponse)
def stop_session(req: StopSessionRequest):
    session = session_manager.end_session(req.sessionId)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )

    return StopSessionResponse(
        status="STOPPED",
        totalVerifications=session.total_verifications,
        identityMatches=session.identity_matches,
        identityMismatches=session.identity_mismatches,
        totalWarnings=session.warning_count
    )

@router.get("/proctor/session/{session_id}")
def get_session_details(session_id: str):
    session = session_manager.get_session(session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found."
        )
    return {
        "sessionId": session.session_id,
        "attemptId": session.attempt_id,
        "studentId": session.student_id,
        "isActive": session.is_active,
        "totalVerifications": session.total_verifications,
        "identityMatches": session.identity_matches,
        "identityMismatches": session.identity_mismatches,
        "warningCount": session.warning_count,
        "events": session.events_log
    }

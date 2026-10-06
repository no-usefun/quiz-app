import base64
import cv2
import numpy as np
import logging
from fastapi import APIRouter, HTTPException, status, Header, Query
from pydantic import BaseModel
from typing import Optional, List

from detection import (
    FaceDetector,
    BiometricFaceRecognizer,
    AudioActivityDetector,
    PhoneDetector,
    PersonDetector,
    GazeDetector,
    MalpracticeDetector
)
from sessions.session_manager import SessionManager
from config import SPRING_BOOT_URL, is_trusted_backend_url

logger = logging.getLogger("ai-proctoring.routes")

router = APIRouter()

# Instantiate singletons
face_detector = FaceDetector()
face_recognizer = BiometricFaceRecognizer()
audio_detector = AudioActivityDetector()
phone_detector = PhoneDetector()
person_detector = PersonDetector()
gaze_detector = GazeDetector()
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
    studentId: Optional[str] = None
    testCode: Optional[str] = None
    referenceImage: str
    authToken: Optional[str] = None
    springBootUrl: Optional[str] = SPRING_BOOT_URL

class StartSessionResponse(BaseModel):
    sessionId: str
    wsTicket: str
    status: str
    faceDetected: bool
    referenceRegistered: bool
    biometricReady: bool
    message: str

class AnalyzeFrameRequest(BaseModel):
    sessionId: str
    frame: Optional[str] = None
    audio: Optional[List[float]] = None
    ticket: Optional[str] = None
    authToken: Optional[str] = None
    studentId: Optional[str] = None
    attemptId: Optional[int] = None

class AnalyzeFrameResponse(BaseModel):
    status: str
    faceDetected: bool
    numFaces: int
    numPersons: int
    identityVerified: bool
    similarityScore: float
    gazeDirection: str
    yaw: float
    pitch: float
    isLookingAway: bool
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
    ticket: Optional[str] = None
    authToken: Optional[str] = None
    studentId: Optional[str] = None
    attemptId: Optional[int] = None

class StopSessionResponse(BaseModel):
    status: str
    totalVerifications: int
    identityMatches: int
    identityMismatches: int
    totalWarnings: int

@router.get("/health")
def health_check():
    sface_ready = face_recognizer.recognizer is not None
    yunet_ready = face_detector.detector is not None
    phone_ready = phone_detector.model is not None
    person_ready = person_detector.model is not None
    overall_status = "UP" if (sface_ready and yunet_ready) else "DEGRADED"

    return {
        "status": overall_status,
        "service": "ai-proctoring",
        "biometricAvailable": sface_ready,
        "models": {
            "yunet": yunet_ready,
            "sface": sface_ready,
            "yolo_phone": phone_ready,
            "yolo_person": person_ready
        }
    }

@router.post("/proctor/start", response_model=StartSessionResponse)
async def start_proctoring_session(
    req: StartSessionRequest,
    authorization: Optional[str] = Header(None)
):
    # Resolve auth token from header or body
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
    elif authorization:
        token = authorization.strip()
    elif req.authToken:
        token = req.authToken.strip()

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="MISSING_AUTH_TOKEN: Authorization token is required to start a proctoring session."
        )

    # 1. Authoritative Backend Validation against Spring Boot
    if req.springBootUrl and not is_trusted_backend_url(req.springBootUrl):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="UNTRUSTED_BACKEND_URL: Browser-supplied springBootUrl points to an untrusted host."
        )
    spring_url = req.springBootUrl.strip() if req.springBootUrl else SPRING_BOOT_URL
    validation_res = await malpractice_detector.verify_backend_attempt_access(
        spring_boot_url=spring_url,
        attempt_id=req.attemptId,
        auth_token=token
    )

    if not validation_res.get("success"):
        status_code = validation_res.get("status_code", 400)
        err_code = validation_res.get("error", "BACKEND_VALIDATION_FAILED")
        detail_msg = validation_res.get("detail", "Backend validation failed.")
        raise HTTPException(status_code=status_code, detail=f"{err_code}: {detail_msg}")

    if not validation_res.get("valid") or validation_res.get("status") != "IN_PROGRESS":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"ATTEMPT_INACTIVE: Attempt is {validation_res.get('status')}, cannot initialize proctoring."
        )

    auth_student_id = str(validation_res.get("studentId", "")).strip()
    auth_test_code = str(validation_res.get("testCode", "")).strip()

    # Consistency checks
    if req.studentId and auth_student_id and str(req.studentId).strip() != auth_student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="STUDENT_ID_MISMATCH: Provided student ID does not match authenticated user record."
        )

    if req.testCode and auth_test_code and str(req.testCode).strip() != auth_test_code:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="TEST_CODE_MISMATCH: Provided test code does not match attempt record."
        )

    authoritative_student_id = auth_student_id or str(req.studentId or "")
    authoritative_test_code = auth_test_code or str(req.testCode or "")

    # 2. Biometric Model Check - Strictly reject fake fallbacks
    if face_recognizer.recognizer is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="BIOMETRIC_UNAVAILABLE: SFace biometric recognition model is offline or unavailable. Cannot establish biometric identity baseline."
        )

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
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="EMBEDDING_EXTRACTION_FAILED: Failed to extract biometric facial embedding from reference image. Ensure clear lighting and facing camera directly."
        )

    session = session_manager.create_session(
        attempt_id=req.attemptId,
        student_id=authoritative_student_id,
        test_code=authoritative_test_code,
        reference_embedding=ref_embedding,
        reference_image_b64=req.referenceImage,
        spring_boot_url=spring_url,
        auth_token=token
    )

    return StartSessionResponse(
        sessionId=session.session_id,
        wsTicket=session.ws_ticket,
        status="INITIALIZED",
        faceDetected=True,
        referenceRegistered=True,
        biometricReady=True,
        message="Reference biometric identity registered successfully."
    )

@router.post("/proctor/analyze-frame", response_model=AnalyzeFrameResponse)
async def analyze_frame(
    req: AnalyzeFrameRequest,
    authorization: Optional[str] = Header(None),
    x_proctor_ticket: Optional[str] = Header(None)
):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
    elif authorization:
        token = authorization.strip()
    elif req.authToken:
        token = req.authToken.strip()

    ticket = req.ticket or x_proctor_ticket

    # Pre-inference Authentication & Authorization Check
    is_auth, auth_err = session_manager.validate_session_auth(
        session_id=req.sessionId,
        ticket=ticket,
        auth_token=token,
        student_id=req.studentId,
        attempt_id=req.attemptId,
        allow_inactive=False
    )

    if not is_auth:
        if auth_err == "SESSION_NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="SESSION_NOT_FOUND: Session not found."
            )
        elif auth_err == "SESSION_INACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="SESSION_INACTIVE: Session is inactive or already closed."
            )
        elif auth_err in ("STUDENT_MISMATCH", "ATTEMPT_MISMATCH"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"FORBIDDEN: {auth_err}"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"UNAUTHORIZED: {auth_err}"
            )

    session = session_manager.get_session(req.sessionId)

    faces_count = 0
    persons_count = 0
    gaze_res = {"gaze_direction": "CENTER", "yaw": 0.0, "pitch": 0.0, "is_looking_away": False}
    identity_match = False  # Strict: Never default to True
    similarity_score = 0.0  # Strict: Never default to 1.0
    phone_detected = False

    # 1. Image Frame Processing
    if req.frame:
        img = decode_base64_image(req.frame)
        if img is not None:
            # Face Detection
            faces_data, raw_faces = face_detector.detect_faces(img)
            faces_count = len(faces_data)

            # Person Detection (YOLO)
            persons_count, _ = person_detector.detect_persons(img)

            # Gaze / Head Pose Estimation
            if faces_count > 0 and len(faces_data) > 0:
                gaze_res = gaze_detector.estimate_gaze(faces_data[0].get("landmarks", []), img.shape)

            # Phone detection
            phone_detected, _ = phone_detector.detect_phone(img)

            # Biometric Identity matching (Strict real embedding comparison only)
            if faces_count == 1 and session.reference_embedding is not None and raw_faces is not None:
                live_emb = face_recognizer.extract_embedding(img, raw_faces[0])
                if live_emb is not None:
                    identity_match, similarity_score = face_recognizer.match(session.reference_embedding, live_emb)
                    session_manager.record_verification(session.session_id, identity_match)
                else:
                    identity_match = False
                    similarity_score = 0.0
            else:
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
        persons_count=persons_count,
        gaze_direction=gaze_res["gaze_direction"],
        yaw=gaze_res["yaw"],
        pitch=gaze_res["pitch"],
        is_looking_away=gaze_res["is_looking_away"],
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
        numPersons=persons_count,
        identityVerified=identity_match,
        similarityScore=similarity_score,
        gazeDirection=gaze_res["gaze_direction"],
        yaw=gaze_res["yaw"],
        pitch=gaze_res["pitch"],
        isLookingAway=gaze_res["is_looking_away"],
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
async def stop_session(
    req: StopSessionRequest,
    authorization: Optional[str] = Header(None),
    x_proctor_ticket: Optional[str] = Header(None)
):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
    elif authorization:
        token = authorization.strip()
    elif req.authToken:
        token = req.authToken.strip()

    ticket = req.ticket or x_proctor_ticket

    is_auth, auth_err = session_manager.validate_session_auth(
        session_id=req.sessionId,
        ticket=ticket,
        auth_token=token,
        student_id=req.studentId,
        attempt_id=req.attemptId,
        allow_inactive=True  # Idempotent stop allowed for authorized owner
    )

    if not is_auth:
        if auth_err == "SESSION_NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found."
            )
        elif auth_err in ("STUDENT_MISMATCH", "ATTEMPT_MISMATCH"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: {auth_err}"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Unauthorized: {auth_err}"
            )

    session = session_manager.get_session(req.sessionId)
    already_ended = not session.is_active
    session = session_manager.end_session(req.sessionId)

    # Dispatch final real verification metrics to Spring Boot only once
    if not already_ended:
        await malpractice_detector.dispatch_session_summary(session)

    return StopSessionResponse(
        status="STOPPED",
        totalVerifications=session.total_verifications,
        identityMatches=session.identity_matches,
        identityMismatches=session.identity_mismatches,
        totalWarnings=session.warning_count
    )

@router.get("/proctor/session/{session_id}")
def get_session_details(
    session_id: str,
    authorization: Optional[str] = Header(None),
    ticket: Optional[str] = Query(None),
    x_proctor_ticket: Optional[str] = Header(None),
    student_id: Optional[str] = Query(None),
    attempt_id: Optional[int] = Query(None)
):
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
    elif authorization:
        token = authorization.strip()

    auth_ticket = ticket or x_proctor_ticket

    is_auth, auth_err = session_manager.validate_session_auth(
        session_id=session_id,
        ticket=auth_ticket,
        auth_token=token,
        student_id=student_id,
        attempt_id=attempt_id,
        allow_inactive=True
    )

    if not is_auth:
        if auth_err == "SESSION_NOT_FOUND":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Session not found."
            )
        elif auth_err in ("STUDENT_MISMATCH", "ATTEMPT_MISMATCH"):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Forbidden: {auth_err}"
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Unauthorized: {auth_err}"
            )

    session = session_manager.get_session(session_id)
    # Strictly sanitize: Never return wsTicket, authToken, referenceImage, or embeddings
    return {
        "sessionId": session.session_id,
        "attemptId": session.attempt_id,
        "studentId": session.student_id,
        "testCode": session.test_code,
        "isActive": session.is_active,
        "totalVerifications": session.total_verifications,
        "identityMatches": session.identity_matches,
        "identityMismatches": session.identity_mismatches,
        "warningCount": session.warning_count,
        "events": session.events_log
    }

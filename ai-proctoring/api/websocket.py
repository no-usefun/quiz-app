import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from api.routes import (
    session_manager,
    face_detector,
    face_recognizer,
    audio_detector,
    phone_detector,
    malpractice_detector,
    decode_base64_image
)

logger = logging.getLogger("ai-proctoring.websocket")

ws_router = APIRouter()

@ws_router.websocket("/ws/proctor/{session_id}")
async def proctoring_websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    session = session_manager.get_session(session_id)
    if not session or not session.is_active:
        logger.warning("WebSocket connection rejected: invalid or inactive session %s", session_id)
        await websocket.send_json({"error": "SESSION_NOT_FOUND", "message": "Session not found or inactive."})
        await websocket.close(code=4004)
        return

    logger.info("WebSocket client connected for proctoring session %s", session_id)

    try:
        while True:
            data_text = await websocket.receive_text()
            if not data_text:
                continue

            try:
                msg = json.loads(data_text)
            except json.JSONDecodeError:
                continue

            # Heartbeat ping
            if msg.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
                continue

            frame_b64 = msg.get("frame")
            audio_samples = msg.get("audio")

            faces_count = 0
            identity_match = True
            similarity_score = 1.0
            phone_detected = False

            # Frame processing
            if frame_b64:
                img = decode_base64_image(frame_b64)
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

            # Audio processing
            audio_res = {"mic_level": 0.0, "is_speech": False, "is_loud": False}
            if audio_samples:
                audio_res = audio_detector.analyze_pcm_samples(audio_samples)

            # Malpractice Evaluation & Authoritative Spring Boot Dispatch
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

            response_payload = {
                "type": "telemetry",
                "status": "ACTIVE",
                "faceDetected": (faces_count > 0),
                "numFaces": faces_count,
                "identityVerified": identity_match,
                "similarityScore": similarity_score,
                "phoneDetected": phone_detected,
                "micLevel": audio_res["mic_level"],
                "voiceActive": audio_res["is_speech"],
                "loudVoice": audio_res["is_loud"],
                "warningCount": eval_res["warning_count"],
                "malpracticeEvent": eval_res["confirmed_event"],
                "eventMessage": eval_res["event_message"],
                "autoSubmitted": eval_res["auto_submitted"]
            }

            await websocket.send_json(response_payload)

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected for session %s", session_id)
    except Exception as e:
        logger.error("WebSocket processing error for session %s: %s", session_id, e)

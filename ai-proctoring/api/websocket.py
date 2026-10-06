import json
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from api.routes import (
    session_manager,
    face_detector,
    face_recognizer,
    audio_detector,
    phone_detector,
    person_detector,
    gaze_detector,
    malpractice_detector,
    decode_base64_image
)

logger = logging.getLogger("ai-proctoring.websocket")

ws_router = APIRouter()

@ws_router.websocket("/ws/proctor/{session_id}")
async def proctoring_websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    session = session_manager.get_session(session_id)
    if not session:
        logger.warning("WebSocket connection rejected: session not found %s", session_id)
        await websocket.send_json({"error": "SESSION_NOT_FOUND", "message": "Session not found."})
        await websocket.close(code=4004)
        return

    if not session.is_active:
        logger.warning("WebSocket connection rejected: inactive session %s", session_id)
        await websocket.send_json({"error": "SESSION_INACTIVE", "message": "Session is inactive or already closed."})
        await websocket.close(code=4003)
        return

    # Mandatory Authentication Handshake Phase (Must authenticate as first message)
    try:
        data_auth = await websocket.receive_text()
        if not data_auth:
            await websocket.send_json({"error": "MISSING_AUTH", "message": "Empty authentication message."})
            await websocket.close(code=4001)
            return

        try:
            auth_msg = json.loads(data_auth)
        except json.JSONDecodeError:
            await websocket.send_json({"error": "INVALID_JSON", "message": "Malformed JSON in auth handshake."})
            await websocket.close(code=4001)
            return

        if auth_msg.get("type") != "auth":
            logger.warning("WebSocket rejected: first message was not auth for session %s", session_id)
            await websocket.send_json({"error": "UNAUTHORIZED", "message": "Authentication handshake required as first message."})
            await websocket.close(code=4001)
            return

        is_auth, auth_err = session_manager.validate_session_auth(
            session_id=session_id,
            ticket=auth_msg.get("ticket"),
            auth_token=auth_msg.get("authToken") or auth_msg.get("token"),
            student_id=auth_msg.get("studentId"),
            attempt_id=auth_msg.get("attemptId")
        )

        if not is_auth:
            logger.warning("WebSocket authentication failed for session %s: %s", session_id, auth_err)
            await websocket.send_json({"error": "UNAUTHORIZED", "message": f"Authentication failed: {auth_err}"})
            await websocket.close(code=4001)
            return

        # Send authentication confirmation
        await websocket.send_json({
            "type": "authenticated",
            "status": "ACTIVE",
            "sessionId": session_id
        })
        logger.info("WebSocket client authenticated successfully for proctoring session %s", session_id)

    except Exception as e:
        logger.error("Error during WebSocket auth handshake for session %s: %s", session_id, e)
        try:
            await websocket.close(code=4001)
        except Exception:
            pass
        return

    try:
        while session.is_active:
            data_text = await websocket.receive_text()
            if not data_text:
                continue

            if not session.is_active:
                break

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
            persons_count = 0
            gaze_res = {"gaze_direction": "CENTER", "yaw": 0.0, "pitch": 0.0, "is_looking_away": False}
            identity_match = False  # Strict: Never default to True
            similarity_score = 0.0  # Strict: Never default to 1.0
            phone_detected = False

            # Frame processing
            if frame_b64:
                img = decode_base64_image(frame_b64)
                if img is not None:
                    faces_data, raw_faces = face_detector.detect_faces(img)
                    faces_count = len(faces_data)

                    # Person detection (YOLO)
                    persons_count, _ = person_detector.detect_persons(img)

                    # Gaze / Head Pose estimation
                    if faces_count > 0 and len(faces_data) > 0:
                        gaze_res = gaze_detector.estimate_gaze(faces_data[0].get("landmarks", []), img.shape)

                    # Phone detection
                    phone_detected, _ = phone_detector.detect_phone(img)

                    # Biometric Identity matching
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

            # Audio processing
            audio_res = {"mic_level": 0.0, "is_speech": False, "is_loud": False}
            if audio_samples:
                audio_res = audio_detector.analyze_pcm_samples(audio_samples)

            # Malpractice Evaluation & Authoritative Spring Boot Dispatch
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

            response_payload = {
                "type": "telemetry",
                "status": "ACTIVE",
                "faceDetected": (faces_count > 0),
                "numFaces": faces_count,
                "numPersons": persons_count,
                "identityVerified": identity_match,
                "similarityScore": similarity_score,
                "gazeDirection": gaze_res["gaze_direction"],
                "yaw": gaze_res["yaw"],
                "pitch": gaze_res["pitch"],
                "isLookingAway": gaze_res["is_looking_away"],
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

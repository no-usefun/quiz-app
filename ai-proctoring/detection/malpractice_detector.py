import asyncio
import time
import uuid
import httpx
import logging
from typing import Optional, Dict
from config import (
    STREAK_NO_FACE,
    STREAK_MULTIPLE_FACES,
    STREAK_MULTIPLE_PERSONS,
    STREAK_LOOKING_AWAY,
    STREAK_PHONE,
    STREAK_IDENTITY_MISMATCH,
    STREAK_VOICE
)
from sessions.session_manager import ProctoringSession

logger = logging.getLogger("ai-proctoring.malpractice_detector")

class MalpracticeDetector:
    def __init__(self):
        self.http_client = httpx.AsyncClient(timeout=4.0)

    async def evaluate_frame(
        self,
        session: ProctoringSession,
        faces_count: int,
        persons_count: int,
        gaze_direction: str,
        yaw: float,
        pitch: float,
        is_looking_away: bool,
        identity_match: bool,
        similarity_score: float,
        phone_detected: bool,
        is_speech: bool,
        is_loud: bool,
        mic_level: float,
        gaze_valid: bool = True,
        gaze_confidence: float = 1.0,
        frame_timestamp: Optional[float] = None
    ) -> dict:
        """
        Evaluates detection metrics over temporal sliding windows.
        If a violation is confirmed, authoritatively dispatches the event directly to Spring Boot.
        """
        now = time.time()
        session.last_seen_at = now
        confirmed_event = None
        event_message = None
        severity = "MEDIUM"
        confidence = 0.90

        # 1. Evaluate Face Absence
        if faces_count == 0:
            session.streaks["no_face"] += 1
            session.streaks["multiple_faces"] = 0
            session.streaks["looking_away"] = 0
            session.streaks["identity_mismatch"] = 0
            if session.streaks["no_face"] >= STREAK_NO_FACE:
                confirmed_event = "FACE_NOT_DETECTED"
                event_message = "No face detected in camera feed"
                severity = "HIGH"
                confidence = 0.95
        else:
            session.streaks["no_face"] = 0

        # 2. Evaluate Multiple Faces
        if faces_count > 1:
            session.streaks["multiple_faces"] += 1
            session.streaks["looking_away"] = 0
            session.streaks["identity_mismatch"] = 0
            if session.streaks["multiple_faces"] >= STREAK_MULTIPLE_FACES:
                confirmed_event = "MULTIPLE_FACES"
                event_message = f"Multiple faces ({faces_count}) detected in camera feed"
                severity = "HIGH"
                confidence = 0.98
        else:
            session.streaks["multiple_faces"] = 0

        # 3. Evaluate Multiple Persons (YOLO body detection)
        if persons_count > 1:
            session.streaks["multiple_persons"] += 1
            if session.streaks["multiple_persons"] >= STREAK_MULTIPLE_PERSONS:
                confirmed_event = "MULTIPLE_PERSONS"
                event_message = f"Multiple persons ({persons_count}) detected in room"
                severity = "HIGH"
                confidence = 0.95
        else:
            session.streaks["multiple_persons"] = 0

        # 4. Evaluate Gaze / Looking Away (~2.8 seconds sustained validated deviation)
        # Gating: Requires single face, confirmed looking away, and validated landmark geometry
        if faces_count == 1 and is_looking_away and gaze_valid:
            session.streaks["looking_away"] += 1
            logger.debug(
                "Attempt %d gaze streak %d/%d (dir=%s, yaw=%.1f, pitch=%.1f, conf=%.2f)",
                session.attempt_id,
                session.streaks["looking_away"],
                STREAK_LOOKING_AWAY,
                gaze_direction,
                yaw,
                pitch,
                gaze_confidence
            )
            if session.streaks["looking_away"] >= STREAK_LOOKING_AWAY:
                confirmed_event = "LOOKING_AWAY"
                event_message = f"Sustained gaze deviation: Looking {gaze_direction} (yaw: {yaw}°, pitch: {pitch}°)"
                severity = "HIGH"
                confidence = max(0.85, min(0.95, gaze_confidence))
        else:
            session.streaks["looking_away"] = 0

        # 5. Evaluate Phone Detection
        if phone_detected:
            session.streaks["phone"] += 1
            if session.streaks["phone"] >= STREAK_PHONE:
                confirmed_event = "PHONE_DETECTED"
                event_message = "Mobile phone or electronic device detected"
                severity = "CRITICAL"
                confidence = 0.95
        else:
            session.streaks["phone"] = 0

        # 6. Evaluate Biometric Identity Mismatch
        if faces_count == 1:
            # Identity mismatch is evaluated only when single face is present, embedding was successfully extracted,
            # and similarity score is strictly positive but below verification threshold
            if not identity_match and similarity_score > 0.0:
                session.streaks["identity_mismatch"] += 1
                if session.streaks["identity_mismatch"] >= STREAK_IDENTITY_MISMATCH:
                    confirmed_event = "IDENTITY_MISMATCH"
                    event_message = f"Biometric identity mismatch (similarity: {similarity_score:.2f})"
                    severity = "CRITICAL"
                    confidence = 0.92
            else:
                session.streaks["identity_mismatch"] = 0
        else:
            session.streaks["identity_mismatch"] = 0

        # 7. Evaluate Voice Activity
        if is_loud:
            confirmed_event = "LOUD_VOICE"
            event_message = f"Loud voice detected (level: {mic_level:.2f})"
            severity = "HIGH"
            confidence = 0.90
        elif is_speech:
            session.streaks["voice"] += 1
            if session.streaks["voice"] >= STREAK_VOICE:
                confirmed_event = "VOICE_ACTIVITY"
                event_message = "Continuous speech / voice detected"
                severity = "MEDIUM"
                confidence = 0.85
        else:
            session.streaks["voice"] = 0

        # If an event is confirmed, dispatch authoritatively to Spring Boot
        auto_submitted = False
        dispatched_event = None
        dispatched_message = None

        if confirmed_event and not session.attempt_terminated:
            last_time = session.last_dispatched.get(confirmed_event, 0.0)
            if (now - last_time) >= 4.0:  # Debounce per event type
                session.last_dispatched[confirmed_event] = now
                logger.warning("Confirmed malpractice %s for attempt %d: %s", confirmed_event, session.attempt_id, event_message)
                
                # Create one durable ID per logical event. The exact payload (including this ID)
                # is reused for every retry in _dispatch_to_spring_boot.
                event_id = f"{session.attempt_id}:{confirmed_event}:{uuid.uuid4().hex}"
                dispatch_res = await self._dispatch_to_spring_boot(
                    session=session,
                    event_type=confirmed_event,
                    details=event_message,
                    severity=severity,
                    confidence=confidence,
                    event_id=event_id,
                    frame_timestamp=frame_timestamp
                )
                if dispatch_res is not None:
                    session.warning_count = dispatch_res.get("warningCount", session.warning_count + 1)
                    auto_submitted = dispatch_res.get("autoSubmitted", False)
                    if auto_submitted:
                        # Backend is authoritative: stop creating further violations for this attempt.
                        session.attempt_terminated = True
                else:
                    # Backend is authoritative for warning counts and auto-submission.
                    # A failed delivery must not invent a warning or close the attempt locally.
                    # The failed event is reported in logs after bounded retries are exhausted.

                dispatched_event = confirmed_event
                dispatched_message = event_message

                # Immediately reset the streak that triggered this strike so it does not repeat every frame
                if confirmed_event == "FACE_NOT_DETECTED":
                    session.streaks["no_face"] = 0
                elif confirmed_event == "MULTIPLE_FACES":
                    session.streaks["multiple_faces"] = 0
                elif confirmed_event == "MULTIPLE_PERSONS":
                    session.streaks["multiple_persons"] = 0
                elif confirmed_event == "LOOKING_AWAY":
                    session.streaks["looking_away"] = 0
                elif confirmed_event == "PHONE_DETECTED":
                    session.streaks["phone"] = 0
                elif confirmed_event == "IDENTITY_MISMATCH":
                    session.streaks["identity_mismatch"] = 0
                elif confirmed_event in ("VOICE_ACTIVITY", "LOUD_VOICE"):
                    session.streaks["voice"] = 0

        return {
            "confirmed_event": dispatched_event,
            "event_message": dispatched_message,
            "warning_count": session.warning_count,
            "auto_submitted": auto_submitted,
            "looking_away_streak": session.streaks.get("looking_away", 0)
        }

    async def _dispatch_to_spring_boot(
        self,
        session: ProctoringSession,
        event_type: str,
        details: str,
        severity: str,
        confidence: float,
        event_id: str,
        frame_timestamp: Optional[float] = None
    ) -> dict | None:
        """
        Sends the confirmed malpractice event directly to Spring Boot backend.
        Architecture: Python AI -> Spring Boot -> PostgreSQL
        """
        url = f"{session.spring_boot_url.rstrip('/')}/api/v1/attempts/{session.attempt_id}/events"
        headers = {
            "Content-Type": "application/json"
        }
        if session.auth_token:
            clean_tok = session.auth_token.strip()
            headers["Authorization"] = clean_tok if clean_tok.startswith("Bearer ") else f"Bearer {clean_tok}"

        payload = {
            "eventType": event_type,
            "details": details,
            "severity": severity,
            "confidence": max(0.0, min(1.0, float(confidence))),
            "eventId": event_id
        }

        # Only forward a real source timestamp supplied with the frame. Never manufacture one
        # or accidentally send millisecond timestamps to the backend.
        if frame_timestamp is not None:
            try:
                source_timestamp = float(frame_timestamp)
                if 0 < source_timestamp < 100_000_000_000 and source_timestamp <= time.time() + 60:
                    payload["frameTimestamp"] = source_timestamp
                else:
                    logger.warning("Ignoring invalid frame timestamp for event %s", event_id)
            except (TypeError, ValueError):
                logger.warning("Ignoring invalid frame timestamp for event %s", event_id)

        # Retry only transient HTTP/network failures. Payload and eventId stay identical.
        max_attempts = 3
        transient_statuses = {408, 425, 429}
        for attempt in range(max_attempts):
            try:
                resp = await self.http_client.post(url, json=payload, headers=headers)
                if resp.status_code in (200, 201):
                    try:
                        data = resp.json()
                    except (ValueError, TypeError):
                        data = {}
                    logger.info(
                        "Spring Boot event dispatch completed for type %s (status %d)",
                        event_type, resp.status_code
                    )
                    session.events_log.append({
                        "type": event_type,
                        "details": details,
                        "timestamp": payload.get("frameTimestamp", time.time()),
                        "eventId": event_id,
                        "warningCount": data.get("warningCount")
                    })
                    return data

                is_transient = resp.status_code in transient_statuses or 500 <= resp.status_code <= 599
                if not is_transient:
                    # Do not log response bodies or request headers: they may contain sensitive data.
                    logger.warning(
                        "Permanent backend event rejection for type %s (status %d)",
                        event_type, resp.status_code
                    )
                    return None
                logger.warning(
                    "Transient backend event failure for type %s (status %d, attempt %d/%d)",
                    event_type, resp.status_code, attempt + 1, max_attempts
                )
            except httpx.RequestError as exc:
                logger.warning(
                    "Transient backend network failure for event type %s (%s, attempt %d/%d)",
                    event_type, type(exc).__name__, attempt + 1, max_attempts
                )

            if attempt < max_attempts - 1:
                await asyncio.sleep(0.25 * (2 ** attempt))

        logger.error("Backend event delivery exhausted retries for type %s", event_type)
        return None

    async def verify_backend_attempt_access(
        self,
        spring_boot_url: str,
        attempt_id: int,
        auth_token: Optional[str]
    ) -> dict:
        """
        Validates attempt access against Spring Boot authoritative endpoint:
        GET /api/v1/attempts/{attempt_id}/verify-access
        """
        if not auth_token or not auth_token.strip():
            return {
                "success": False,
                "status_code": 401,
                "error": "MISSING_AUTH_TOKEN",
                "detail": "Authorization token is required to initialize proctoring session."
            }

        clean_token = auth_token.strip()
        auth_header = clean_token if clean_token.startswith("Bearer ") else f"Bearer {clean_token}"
        url = f"{spring_boot_url.rstrip('/')}/api/v1/attempts/{attempt_id}/verify-access"

        try:
            resp = await self.http_client.get(
                url,
                headers={"Authorization": auth_header, "Accept": "application/json"}
            )
        except Exception as e:
            logger.error("Failed to reach Spring Boot for attempt validation (%s): %s", url, e)
            return {
                "success": False,
                "status_code": 503,
                "error": "BACKEND_UNAVAILABLE",
                "detail": f"Could not contact authoritative backend for session validation: {e}"
            }

        if resp.status_code == 401:
            return {
                "success": False,
                "status_code": 401,
                "error": "INVALID_AUTH_TOKEN",
                "detail": "Provided authorization token was rejected by authoritative backend."
            }
        elif resp.status_code == 403:
            return {
                "success": False,
                "status_code": 403,
                "error": "UNAUTHORIZED_ATTEMPT",
                "detail": "Authenticated user does not have permission for this attempt."
            }
        elif resp.status_code == 404:
            return {
                "success": False,
                "status_code": 404,
                "error": "ATTEMPT_NOT_FOUND",
                "detail": "Attempt not found on authoritative backend."
            }
        elif resp.status_code != 200:
            return {
                "success": False,
                "status_code": resp.status_code,
                "error": "BACKEND_VALIDATION_FAILED",
                "detail": f"Backend returned status {resp.status_code}: {resp.text}"
            }

        try:
            data = resp.json()
            data["success"] = True
            data["status_code"] = 200
            return data
        except Exception as e:
            logger.error("Failed to parse Spring Boot validation response: %s", e)
            return {
                "success": False,
                "status_code": 502,
                "error": "INVALID_BACKEND_RESPONSE",
                "detail": "Could not parse response from authoritative backend."
            }

    async def dispatch_session_summary(self, session: ProctoringSession):
        """
        Sends the final real verification counts to Spring Boot backend.
        """
        url = f"{session.spring_boot_url.rstrip('/')}/api/v1/attempts/{session.attempt_id}/proctoring-summary"
        headers = {
            "Content-Type": "application/json"
        }
        if session.auth_token:
            clean_tok = session.auth_token.strip()
            headers["Authorization"] = clean_tok if clean_tok.startswith("Bearer ") else f"Bearer {clean_tok}"

        payload = {
            "totalFaceChecks": session.total_verifications,
            "identityMatches": session.identity_matches,
            "identityMismatches": session.identity_mismatches
        }

        try:
            resp = await self.http_client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                logger.info("Successfully posted proctoring summary to Spring Boot for attempt %d: checks=%d, matches=%d",
                            session.attempt_id, session.total_verifications, session.identity_matches)
            else:
                logger.warning("Spring Boot proctoring summary returned %d: %s", resp.status_code, resp.text)
        except Exception as e:
            logger.error("Failed to post proctoring summary to Spring Boot: %s", e)

    async def close(self):
        """Closes the underlying HTTP client cleanly."""
        try:
            if not self.http_client.is_closed:
                await self.http_client.aclose()
        except Exception as e:
            logger.error("Error closing MalpracticeDetector HTTP client: %s", e)


import time
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
        mic_level: float
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

        # 4. Evaluate Gaze / Looking Away (~2 seconds sustained deviation)
        if faces_count == 1 and is_looking_away:
            session.streaks["looking_away"] += 1
            if session.streaks["looking_away"] >= STREAK_LOOKING_AWAY:
                confirmed_event = "LOOKING_AWAY"
                event_message = f"Sustained gaze deviation: Looking {gaze_direction} (yaw: {yaw}°, pitch: {pitch}°)"
                severity = "HIGH"
                confidence = 0.90
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
            # Identity mismatch is evaluated only when face is present and match is False
            if not identity_match and similarity_score > 0.0:
                session.streaks["identity_mismatch"] += 1
                if session.streaks["identity_mismatch"] >= STREAK_IDENTITY_MISMATCH:
                    confirmed_event = "IDENTITY_MISMATCH"
                    event_message = f"Biometric identity mismatch (similarity: {similarity_score:.2f})"
                    severity = "CRITICAL"
                    confidence = 0.92
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
        if confirmed_event:
            last_time = session.last_dispatched.get(confirmed_event, 0.0)
            if (now - last_time) >= 4.0:  # Debounce per event type
                session.last_dispatched[confirmed_event] = now
                logger.warning("Confirmed malpractice %s for attempt %d: %s", confirmed_event, session.attempt_id, event_message)
                
                # Direct Authoritative Dispatch to Spring Boot
                dispatch_res = await self._dispatch_to_spring_boot(
                    session=session,
                    event_type=confirmed_event,
                    details=event_message,
                    severity=severity,
                    confidence=confidence
                )
                if dispatch_res:
                    session.warning_count = dispatch_res.get("warningCount", session.warning_count + 1)
                    auto_submitted = dispatch_res.get("autoSubmitted", False)

        return {
            "confirmed_event": confirmed_event,
            "event_message": event_message,
            "warning_count": session.warning_count,
            "auto_submitted": auto_submitted
        }

    async def _dispatch_to_spring_boot(
        self,
        session: ProctoringSession,
        event_type: str,
        details: str,
        severity: str,
        confidence: float
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
            "confidence": confidence
        }

        try:
            resp = await self.http_client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                data = resp.json()
                logger.info("Spring Boot recorded event %s. Warning count: %s", event_type, data.get("warningCount"))
                session.events_log.append({
                    "type": event_type,
                    "details": details,
                    "timestamp": time.time(),
                    "warningCount": data.get("warningCount")
                })
                return data
            else:
                logger.warning("Spring Boot event dispatch returned status %d: %s", resp.status_code, resp.text)
        except Exception as e:
            logger.error("Failed to dispatch event to Spring Boot: %s", e)

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


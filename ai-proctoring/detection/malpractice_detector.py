import time
import httpx
import logging
from config import (
    STREAK_NO_FACE,
    STREAK_MULTIPLE_FACES,
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

        # 3. Evaluate Phone Detection
        if phone_detected:
            session.streaks["phone"] += 1
            if session.streaks["phone"] >= STREAK_PHONE:
                confirmed_event = "PHONE_DETECTED"
                event_message = "Mobile phone or electronic device detected"
                severity = "CRITICAL"
                confidence = 0.95
        else:
            session.streaks["phone"] = 0

        # 4. Evaluate Biometric Identity Mismatch
        if faces_count == 1:
            if not identity_match and similarity_score > 0.0:
                session.streaks["identity_mismatch"] += 1
                if session.streaks["identity_mismatch"] >= STREAK_IDENTITY_MISMATCH:
                    confirmed_event = "IDENTITY_MISMATCH"
                    event_message = f"Biometric identity mismatch (similarity: {similarity_score:.2f})"
                    severity = "CRITICAL"
                    confidence = 0.92
            else:
                session.streaks["identity_mismatch"] = 0

        # 5. Evaluate Voice Activity
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
            headers["Authorization"] = f"Bearer {session.auth_token}"

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

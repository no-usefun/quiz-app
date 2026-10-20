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
        gaze_confidence: float = 1.0
    ) -> dict:
        """
        Evaluates detection metrics over temporal sliding windows.
        If a violation is confirmed, authoritatively dispatches the event directly to Spring Boot.
        """
        now = time.time()
        session.last_seen_at = now
        confirmed_events = []

        # 1. Evaluate Face Absence
        if faces_count == 0:
            session.streaks["no_face"] += 1
            session.streaks["multiple_faces"] = 0
            session.streaks["looking_away"] = 0
            session.streaks["identity_mismatch"] = 0
            if session.streaks["no_face"] >= STREAK_NO_FACE:
                confirmed_events.append({"event_type": "FACE_NOT_DETECTED", "details": "No face detected in camera feed", "severity": "HIGH", "confidence": 0.95})
        else:
            session.streaks["no_face"] = 0

        # 2. Evaluate Multiple Faces
        if faces_count > 1:
            session.streaks["multiple_faces"] += 1
            session.streaks["looking_away"] = 0
            session.streaks["identity_mismatch"] = 0
            if session.streaks["multiple_faces"] >= STREAK_MULTIPLE_FACES:
                confirmed_events.append({"event_type": "MULTIPLE_FACES", "details": f"Multiple faces ({faces_count}) detected in camera feed", "severity": "HIGH", "confidence": 0.98})
        else:
            session.streaks["multiple_faces"] = 0

        # 3. Evaluate Multiple Persons (YOLO body detection)
        if persons_count > 1:
            session.streaks["multiple_persons"] += 1
            if session.streaks["multiple_persons"] >= STREAK_MULTIPLE_PERSONS:
                confirmed_events.append({"event_type": "MULTIPLE_PERSONS", "details": f"Multiple persons ({persons_count}) detected in room", "severity": "HIGH", "confidence": 0.95})
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
                confirmed_events.append({"event_type": "LOOKING_AWAY", "details": f"Sustained gaze deviation: Looking {gaze_direction} (yaw: {yaw}°, pitch: {pitch}°)", "severity": "HIGH", "confidence": max(0.85, min(0.95, gaze_confidence))})
        else:
            session.streaks["looking_away"] = 0

        # 5. Evaluate Phone Detection
        if phone_detected:
            session.streaks["phone"] += 1
            if session.streaks["phone"] >= STREAK_PHONE:
                confirmed_events.append({"event_type": "PHONE_DETECTED", "details": "Mobile phone or electronic device detected", "severity": "CRITICAL", "confidence": 0.95})
        else:
            session.streaks["phone"] = 0

        # 6. Evaluate Biometric Identity Mismatch
        if faces_count == 1:
            # Identity mismatch is evaluated only when single face is present, embedding was successfully extracted,
            # and similarity score is strictly positive but below verification threshold
            if not identity_match and similarity_score > 0.0:
                session.streaks["identity_mismatch"] += 1
                if session.streaks["identity_mismatch"] >= STREAK_IDENTITY_MISMATCH:
                    confirmed_events.append({"event_type": "IDENTITY_MISMATCH", "details": f"Biometric identity mismatch (similarity: {similarity_score:.2f})", "severity": "CRITICAL", "confidence": 0.92})
            else:
                session.streaks["identity_mismatch"] = 0
        else:
            session.streaks["identity_mismatch"] = 0

        # 7. Evaluate Voice Activity
        if is_loud:
            confirmed_events.append({"event_type": "LOUD_VOICE", "details": f"Loud voice detected (level: {mic_level:.2f})", "severity": "HIGH", "confidence": 0.90})
        elif is_speech:
            session.streaks["voice"] += 1
            if session.streaks["voice"] >= STREAK_VOICE:
                confirmed_events.append({"event_type": "VOICE_ACTIVITY", "details": "Continuous speech / voice detected", "severity": "MEDIUM", "confidence": 0.85})
        else:
            session.streaks["voice"] = 0

        # Persist every independently confirmed signal; never overwrite one event with another.
        auto_submitted = False
        dispatched_events = []
        for event in confirmed_events:
            event_type = event["event_type"]
            event_details = event["details"]
            last_time = session.last_dispatched.get(event_type, 0.0)
            if (now - last_time) < 4.0:
                continue

            session.last_dispatched[event_type] = now
            event_id = f"{session.attempt_id}:{event_type}:{uuid.uuid4().hex}"
            logger.warning("Confirmed malpractice %s for attempt %d: %s", event_type, session.attempt_id, event_details)
            dispatch_res = await self._dispatch_to_spring_boot(
                session=session,
                event_type=event_type,
                details=event_details,
                severity=event["severity"],
                confidence=event["confidence"],
                detection_timestamp=now,
                event_id=event_id,
            )
            persisted = dispatch_res is not None and dispatch_res.get("recorded", True)
            if not dispatch_res:
                logger.error("PROCTORING_EVENT_NOT_PERSISTED attempt=%s event=%s eventId=%s", session.attempt_id, event_type, event_id)
                dispatched_events.append({
                    "eventType": event_type, "details": event_details,
                    "severity": event["severity"], "confidence": event["confidence"],
                    "timestamp": now, "persisted": False, "eventId": event_id,
                })
                continue

            session.warning_count = int(dispatch_res.get("warningCount", session.warning_count))
            auto_submitted = auto_submitted or bool(dispatch_res.get("autoSubmitted", False))
            dispatched_events.append({
                "eventType": event_type, "details": event_details,
                "severity": event["severity"], "confidence": event["confidence"],
                "timestamp": now, "persisted": persisted,
                "warningCount": session.warning_count,
                "autoSubmitted": bool(dispatch_res.get("autoSubmitted", False)),
                "eventId": event_id,
            })

            streak_by_event = {
                "FACE_NOT_DETECTED": "no_face", "MULTIPLE_FACES": "multiple_faces",
                "MULTIPLE_PERSONS": "multiple_persons", "LOOKING_AWAY": "looking_away",
                "PHONE_DETECTED": "phone", "IDENTITY_MISMATCH": "identity_mismatch",
                "VOICE_ACTIVITY": "voice", "LOUD_VOICE": "voice",
            }
            streak_name = streak_by_event.get(event_type)
            if streak_name:
                session.streaks[streak_name] = 0

        first_event = dispatched_events[0] if dispatched_events else None
        return {
            "confirmed_event": first_event.get("eventType") if first_event else None,
            "event_message": first_event.get("details") if first_event else None,
            "confirmed_events": dispatched_events,
            "event_persistence_failed": any(not event.get("persisted", False) for event in dispatched_events),
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
        detection_timestamp: float,
        event_id: str,
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
            "confidence": confidence,
            "frameTimestamp": detection_timestamp,
            "eventId": event_id,
        }

        try:
            resp = await self.http_client.post(url, json=payload, headers=headers)
            if resp.status_code in (200, 201):
                data = resp.json()
                logger.info("Spring Boot recorded event %s. Warning count: %s", event_type, data.get("warningCount"))
                session.events_log.append({
                    "eventId": event_id,
                    "type": event_type,
                    "details": details,
                    "severity": severity,
                    "confidence": confidence,
                    "timestamp": detection_timestamp,
                    "persisted": bool(data.get("recorded", True)),
                    "warningCount": data.get("warningCount")
                })
                return data
            else:
                logger.error("Spring Boot event dispatch failed status=%d attempt=%s event=%s eventId=%s body=%s", resp.status_code, session.attempt_id, event_type, event_id, resp.text[:500])
        except Exception as e:
            logger.error("Failed to dispatch event to Spring Boot attempt=%s event=%s eventId=%s error=%s", session.attempt_id, event_type, event_id, e)

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


import time
import uuid
import secrets
import numpy as np
import logging
from dataclasses import dataclass, field
from typing import Optional, Dict

logger = logging.getLogger("ai-proctoring.session_manager")

@dataclass
class ProctoringSession:
    session_id: str
    attempt_id: int
    student_id: str
    test_code: str
    ws_ticket: str = field(default_factory=lambda: secrets.token_urlsafe(32))
    reference_embedding: Optional[np.ndarray] = None
    reference_image_b64: Optional[str] = None
    spring_boot_url: str = "http://localhost:8080"
    auth_token: Optional[str] = None
    is_active: bool = True
    created_at: float = field(default_factory=time.time)
    last_seen_at: float = field(default_factory=time.time)
    total_verifications: int = 0
    identity_matches: int = 0
    identity_mismatches: int = 0
    warning_count: int = 0
    streaks: Dict[str, int] = field(default_factory=lambda: {
        "no_face": 0,
        "multiple_faces": 0,
        "multiple_persons": 0,
        "looking_away": 0,
        "phone": 0,
        "identity_mismatch": 0,
        "voice": 0
    })
    last_dispatched: Dict[str, float] = field(default_factory=dict)
    events_log: list = field(default_factory=list)

class SessionManager:
    def __init__(self):
        self.sessions: Dict[str, ProctoringSession] = {}

    def create_session(
        self,
        attempt_id: int,
        student_id: str,
        test_code: str,
        reference_embedding: Optional[np.ndarray] = None,
        reference_image_b64: Optional[str] = None,
        spring_boot_url: str = "http://localhost:8080",
        auth_token: Optional[str] = None
    ) -> ProctoringSession:
        session_id = str(uuid.uuid4())
        ws_ticket = secrets.token_urlsafe(32)
        session = ProctoringSession(
            session_id=session_id,
            attempt_id=attempt_id,
            student_id=student_id,
            test_code=test_code,
            ws_ticket=ws_ticket,
            reference_embedding=reference_embedding,
            reference_image_b64=reference_image_b64,
            spring_boot_url=spring_boot_url,
            auth_token=auth_token
        )
        self.sessions[session_id] = session
        logger.info("Created proctoring session %s for attempt %d (student %s)", session_id, attempt_id, student_id)
        return session

    def validate_session_auth(
        self,
        session_id: str,
        ticket: Optional[str] = None,
        auth_token: Optional[str] = None,
        student_id: Optional[str] = None,
        attempt_id: Optional[int] = None,
        allow_inactive: bool = False
    ) -> tuple[bool, str]:
        session = self.get_session(session_id)
        if not session:
            return False, "SESSION_NOT_FOUND"

        # Check credentials (ticket or auth_token)
        ticket_match = bool(ticket and session.ws_ticket and ticket.strip() == session.ws_ticket)

        clean_token = auth_token.replace("Bearer ", "").strip() if auth_token else None
        clean_session_token = session.auth_token.replace("Bearer ", "").strip() if session.auth_token else None
        token_match = bool(clean_token and clean_session_token and clean_token == clean_session_token)

        if not ticket_match and not token_match:
            return False, "INVALID_CREDENTIALS"

        if student_id is not None and str(student_id).strip() != str(session.student_id).strip():
            return False, "STUDENT_MISMATCH"

        if attempt_id is not None and int(attempt_id) != int(session.attempt_id):
            return False, "ATTEMPT_MISMATCH"

        if not allow_inactive and not session.is_active:
            return False, "SESSION_INACTIVE"

        return True, "AUTHORIZED"

    def get_session(self, session_id: str) -> Optional[ProctoringSession]:
        return self.sessions.get(session_id)

    def record_verification(self, session_id: str, is_match: bool):
        session = self.get_session(session_id)
        if session and session.is_active:
            session.total_verifications += 1
            if is_match:
                session.identity_matches += 1
            else:
                session.identity_mismatches += 1

    def end_session(self, session_id: str) -> Optional[ProctoringSession]:
        session = self.get_session(session_id)
        if session:
            session.is_active = False
            session.last_seen_at = time.time()
            logger.info("Ended proctoring session %s. Verifications: %d, Matches: %d, Mismatches: %d, Warnings: %d",
                        session_id, session.total_verifications, session.identity_matches, session.identity_mismatches, session.warning_count)
        return session

    def cleanup_old_sessions(self, max_age_seconds: int = 14400):
        now = time.time()
        to_delete = [
            sid for sid, sess in self.sessions.items()
            if (now - sess.last_seen_at) > max_age_seconds
        ]
        for sid in to_delete:
            del self.sessions[sid]

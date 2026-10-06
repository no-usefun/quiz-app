import time
import uuid
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
        session = ProctoringSession(
            session_id=session_id,
            attempt_id=attempt_id,
            student_id=student_id,
            test_code=test_code,
            reference_embedding=reference_embedding,
            reference_image_b64=reference_image_b64,
            spring_boot_url=spring_boot_url,
            auth_token=auth_token
        )
        self.sessions[session_id] = session
        logger.info("Created proctoring session %s for attempt %d (student %s)", session_id, attempt_id, student_id)
        return session

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

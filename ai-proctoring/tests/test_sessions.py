import pytest
import numpy as np
from sessions.session_manager import SessionManager

def test_session_lifecycle():
    manager = SessionManager()
    session = manager.create_session(
        attempt_id=101,
        student_id="student-test-1",
        test_code="CS101",
        reference_embedding=np.zeros((1, 128), dtype=np.float32)
    )
    
    assert session.session_id is not None
    assert session.is_active is True
    assert session.total_verifications == 0
    
    # Record matches
    manager.record_verification(session.session_id, True)
    manager.record_verification(session.session_id, True)
    manager.record_verification(session.session_id, False)
    
    sess = manager.get_session(session.session_id)
    assert sess.total_verifications == 3
    assert sess.identity_matches == 2
    assert sess.identity_mismatches == 1
    
    # End session
    ended = manager.end_session(session.session_id)
    assert ended.is_active is False

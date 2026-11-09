from concurrent.futures import ThreadPoolExecutor

import numpy as np

from sessions.session_manager import SessionManager


def test_two_students_can_create_and_use_independent_sessions_concurrently():
    manager = SessionManager()

    def start_student(student_number: int):
        return manager.create_session(
            attempt_id=1000 + student_number,
            student_id=f"student-{student_number}",
            test_code="SHARED-TEST",
            reference_embedding=np.full((1, 128), student_number, dtype=np.float32),
            auth_token=f"token-{student_number}",
        )

    with ThreadPoolExecutor(max_workers=2) as executor:
        first_future = executor.submit(start_student, 1)
        second_future = executor.submit(start_student, 2)
        first = first_future.result(timeout=5)
        second = second_future.result(timeout=5)

    assert first.session_id != second.session_id
    assert first.attempt_id != second.attempt_id
    assert first.student_id != second.student_id
    assert manager.get_session(first.session_id) is first
    assert manager.get_session(second.session_id) is second

    # Mutating one student's state must not affect the other student's session.
    first.warning_count = 2
    first.streaks["no_face"] = 6
    first.reference_embedding[0, 0] = 999

    assert second.warning_count == 0
    assert second.streaks["no_face"] == 0
    assert second.reference_embedding[0, 0] == 2


def test_session_credentials_cannot_be_used_across_students():
    manager = SessionManager()
    first = manager.create_session(
        attempt_id=101,
        student_id="student-1",
        test_code="SHARED-TEST",
        auth_token="token-1",
    )
    second = manager.create_session(
        attempt_id=102,
        student_id="student-2",
        test_code="SHARED-TEST",
        auth_token="token-2",
    )

    assert manager.validate_session_auth(
        first.session_id, ticket=first.ws_ticket, student_id="student-1", attempt_id=101
    ) == (True, "AUTHORIZED")
    assert manager.validate_session_auth(
        second.session_id, ticket=first.ws_ticket, student_id="student-2", attempt_id=102
    ) == (False, "INVALID_CREDENTIALS")

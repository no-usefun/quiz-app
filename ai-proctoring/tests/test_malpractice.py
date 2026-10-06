import pytest
import numpy as np
from detection.malpractice_detector import MalpracticeDetector
from sessions.session_manager import SessionManager

@pytest.mark.asyncio
async def test_streak_face_absence():
    detector = MalpracticeDetector()
    manager = SessionManager()
    session = manager.create_session(
        attempt_id=202,
        student_id="student-202",
        test_code="PHY101"
    )

    # 1 to 5 frames with 0 faces (below streak threshold 6)
    for _ in range(5):
        res = await detector.evaluate_frame(
            session=session,
            faces_count=0,
            identity_match=False,
            similarity_score=0.0,
            phone_detected=False,
            is_speech=False,
            is_loud=False,
            mic_level=0.0
        )
        assert res["confirmed_event"] is None

    # 6th frame with 0 faces triggers FACE_NOT_DETECTED
    res = await detector.evaluate_frame(
        session=session,
        faces_count=0,
        identity_match=False,
        similarity_score=0.0,
        phone_detected=False,
        is_speech=False,
        is_loud=False,
        mic_level=0.0
    )
    assert res["confirmed_event"] == "FACE_NOT_DETECTED"

@pytest.mark.asyncio
async def test_streak_phone_detection():
    detector = MalpracticeDetector()
    manager = SessionManager()
    session = manager.create_session(
        attempt_id=203,
        student_id="student-203",
        test_code="MTH101"
    )

    # 1 frame with phone (streak threshold is 2)
    res = await detector.evaluate_frame(
        session=session,
        faces_count=1,
        identity_match=True,
        similarity_score=0.9,
        phone_detected=True,
        is_speech=False,
        is_loud=False,
        mic_level=0.0
    )
    assert res["confirmed_event"] is None

    # 2nd frame with phone triggers PHONE_DETECTED
    res = await detector.evaluate_frame(
        session=session,
        faces_count=1,
        identity_match=True,
        similarity_score=0.9,
        phone_detected=True,
        is_speech=False,
        is_loud=False,
        mic_level=0.0
    )
    assert res["confirmed_event"] == "PHONE_DETECTED"

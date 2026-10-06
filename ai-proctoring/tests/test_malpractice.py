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
            persons_count=0,
            gaze_direction="CENTER",
            yaw=0.0,
            pitch=0.0,
            is_looking_away=False,
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
        persons_count=0,
        gaze_direction="CENTER",
        yaw=0.0,
        pitch=0.0,
        is_looking_away=False,
        identity_match=False,
        similarity_score=0.0,
        phone_detected=False,
        is_speech=False,
        is_loud=False,
        mic_level=0.0
    )
    assert res["confirmed_event"] == "FACE_NOT_DETECTED"

@pytest.mark.asyncio
async def test_streak_looking_away():
    detector = MalpracticeDetector()
    manager = SessionManager()
    session = manager.create_session(
        attempt_id=205,
        student_id="student-205",
        test_code="BIO101"
    )

    # 5 frames looking left (threshold is 6 frames ~ 2.1s)
    for _ in range(5):
        res = await detector.evaluate_frame(
            session=session,
            faces_count=1,
            persons_count=1,
            gaze_direction="LEFT",
            yaw=-25.0,
            pitch=2.0,
            is_looking_away=True,
            identity_match=True,
            similarity_score=0.9,
            phone_detected=False,
            is_speech=False,
            is_loud=False,
            mic_level=0.0
        )
        assert res["confirmed_event"] is None

    # 6th sustained frame looking left triggers LOOKING_AWAY
    res = await detector.evaluate_frame(
        session=session,
        faces_count=1,
        persons_count=1,
        gaze_direction="LEFT",
        yaw=-25.0,
        pitch=2.0,
        is_looking_away=True,
        identity_match=True,
        similarity_score=0.9,
        phone_detected=False,
        is_speech=False,
        is_loud=False,
        mic_level=0.0
    )
    assert res["confirmed_event"] == "LOOKING_AWAY"

@pytest.mark.asyncio
async def test_streak_multiple_persons():
    detector = MalpracticeDetector()
    manager = SessionManager()
    session = manager.create_session(
        attempt_id=206,
        student_id="student-206",
        test_code="CS101"
    )

    # 3 frames with 2 persons (threshold is 4 frames)
    for _ in range(3):
        res = await detector.evaluate_frame(
            session=session,
            faces_count=1,
            persons_count=2,
            gaze_direction="CENTER",
            yaw=0.0,
            pitch=0.0,
            is_looking_away=False,
            identity_match=True,
            similarity_score=0.9,
            phone_detected=False,
            is_speech=False,
            is_loud=False,
            mic_level=0.0
        )
        assert res["confirmed_event"] is None

    # 4th frame with 2 persons triggers MULTIPLE_PERSONS
    res = await detector.evaluate_frame(
        session=session,
        faces_count=1,
        persons_count=2,
        gaze_direction="CENTER",
        yaw=0.0,
        pitch=0.0,
        is_looking_away=False,
        identity_match=True,
        similarity_score=0.9,
        phone_detected=False,
        is_speech=False,
        is_loud=False,
        mic_level=0.0
    )
    assert res["confirmed_event"] == "MULTIPLE_PERSONS"

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
        persons_count=1,
        gaze_direction="CENTER",
        yaw=0.0,
        pitch=0.0,
        is_looking_away=False,
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
        persons_count=1,
        gaze_direction="CENTER",
        yaw=0.0,
        pitch=0.0,
        is_looking_away=False,
        identity_match=True,
        similarity_score=0.9,
        phone_detected=True,
        is_speech=False,
        is_loud=False,
        mic_level=0.0
    )
    assert res["confirmed_event"] == "PHONE_DETECTED"

import pytest
import numpy as np
import cv2
from detection.gaze_detector import GazeDetector
from config import (
    YAW_LEFT_THRESHOLD,
    YAW_RIGHT_THRESHOLD,
    PITCH_UP_THRESHOLD,
    PITCH_DOWN_THRESHOLD
)

def test_gaze_detector_init():
    detector = GazeDetector()
    assert detector is not None
    assert detector.model_points.shape == (5, 3)
    # Nose tip must be forward (Z=0), eyes recessed deeper (Z>0)
    assert detector.model_points[0, 2] == 0.0
    assert detector.model_points[1, 2] > 0.0
    assert detector.model_points[2, 2] > 0.0

def test_gaze_detector_centered_frontal():
    detector = GazeDetector()
    # Centered symmetric landmarks for 640x480 webcam image
    # right_eye, left_eye, nose_tip, right_mouth, left_mouth
    landmarks = [
        (280, 200),  # right eye (image left)
        (360, 200),  # left eye (image right)
        (320, 240),  # nose tip
        (290, 290),  # right mouth corner
        (350, 290)   # left mouth corner
    ]
    res = detector.estimate_gaze(landmarks, (480, 640, 3))
    assert res["is_valid"] is True
    assert res["gaze_direction"] == "CENTER"
    assert res["is_looking_away"] is False
    assert abs(res["yaw"]) < 10.0
    assert abs(res["pitch"]) < 15.0
    assert res["confidence"] >= 0.70

def test_gaze_detector_normal_screen_viewing_reading_top():
    detector = GazeDetector()
    # Candidate reading quiz questions or instructions near top of screen
    # Pitch is modestly upward (-10 deg), but well within screen boundaries
    landmarks = [
        (280, 185),
        (360, 185),
        (320, 215),
        (290, 260),
        (350, 260)
    ]
    res = detector.estimate_gaze(landmarks, (480, 640, 3))
    assert res["is_valid"] is True
    assert res["gaze_direction"] == "CENTER"
    assert res["is_looking_away"] is False
    assert PITCH_UP_THRESHOLD <= res["pitch"] <= 15.0

def test_gaze_detector_normal_screen_viewing_reading_bottom():
    detector = GazeDetector()
    # Candidate reading answer options or timer near bottom of screen
    # Pitch is modestly downward (+12 deg), but well within screen boundaries
    landmarks = [
        (280, 215),
        (360, 215),
        (320, 260),
        (290, 305),
        (350, 305)
    ]
    res = detector.estimate_gaze(landmarks, (480, 640, 3))
    assert res["is_valid"] is True
    assert res["gaze_direction"] == "CENTER"
    assert res["is_looking_away"] is False
    assert -15.0 <= res["pitch"] <= PITCH_DOWN_THRESHOLD

def test_gaze_detector_modest_natural_horizontal_glances():
    detector = GazeDetector()
    # Natural head saccades when scanning left and right margins of wide screen (yaw ~12 deg)
    landmarks_left_glance = [
        (275, 200),
        (355, 200),
        (305, 240),  # nose slightly shifted left
        (285, 290),
        (345, 290)
    ]
    res_l = detector.estimate_gaze(landmarks_left_glance, (480, 640, 3))
    assert res_l["gaze_direction"] == "CENTER"
    assert res_l["is_looking_away"] is False

    landmarks_right_glance = [
        (285, 200),
        (365, 200),
        (335, 240),  # nose slightly shifted right
        (295, 290),
        (355, 290)
    ]
    res_r = detector.estimate_gaze(landmarks_right_glance, (480, 640, 3))
    assert res_r["gaze_direction"] == "CENTER"
    assert res_r["is_looking_away"] is False

def test_gaze_detector_looking_away_left():
    detector = GazeDetector()
    # Candidate turning head far to the left (yaw < -28 deg)
    landmarks = [
        (255, 200),
        (365, 200),
        (260, 240),  # nose shifted far left past right eye
        (265, 290),
        (345, 290)
    ]
    res = detector.estimate_gaze(landmarks, (480, 640, 3))
    assert res["is_valid"] is True
    assert res["yaw"] < YAW_LEFT_THRESHOLD
    assert res["gaze_direction"] == "LEFT"
    assert res["is_looking_away"] is True

def test_gaze_detector_looking_away_right():
    detector = GazeDetector()
    # Candidate turning head far to the right (yaw > 28 deg)
    landmarks = [
        (275, 200),
        (385, 200),
        (380, 240),  # nose shifted far right past left eye
        (295, 290),
        (375, 290)
    ]
    res = detector.estimate_gaze(landmarks, (480, 640, 3))
    assert res["is_valid"] is True
    assert res["yaw"] > YAW_RIGHT_THRESHOLD
    assert res["gaze_direction"] == "RIGHT"
    assert res["is_looking_away"] is True

def test_gaze_detector_looking_away_up():
    detector = GazeDetector()
    # Candidate looking up at the ceiling (pitch < -25 deg)
    landmarks = [
        (280, 200),
        (360, 200),
        (320, 210),  # nose compressed very close to eye level
        (290, 290),
        (350, 290)
    ]
    res = detector.estimate_gaze(landmarks, (480, 640, 3))
    assert res["is_valid"] is True
    assert res["pitch"] < PITCH_UP_THRESHOLD
    assert res["gaze_direction"] == "UP"
    assert res["is_looking_away"] is True

def test_gaze_detector_looking_away_down():
    detector = GazeDetector()
    # Candidate looking down at phone/desk (pitch > 30 deg)
    landmarks = [
        (280, 180),
        (360, 180),
        (320, 260),  # nose pushed far down toward mouth
        (290, 275),
        (350, 275)
    ]
    res = detector.estimate_gaze(landmarks, (480, 640, 3))
    assert res["is_valid"] is True
    assert res["pitch"] > PITCH_DOWN_THRESHOLD
    assert res["gaze_direction"] == "DOWN"
    assert res["is_looking_away"] is True

def test_gaze_detector_real_user_screenshot_fixtures():
    """
    Validates against the actual facial landmark detections captured from user test sessions.
    Must never trigger false-positive looking-away warnings on normal screen viewing.
    """
    detector = GazeDetector()

    # Fixture 1: The exact screenshot where the user reported false-positive Warning 2/3 (media_1791715043375)
    fixture_user_reported = [(914, 164), (934, 164), (925, 174), (916, 183), (930, 184)]
    res1 = detector.estimate_gaze(fixture_user_reported, (537, 1024, 3))
    assert res1["is_valid"] is True
    assert res1["gaze_direction"] == "CENTER"
    assert res1["is_looking_away"] is False
    assert abs(res1["yaw"]) < 15.0
    assert abs(res1["pitch"]) < 20.0

    # Fixture 2: User assessment test session (media_1791301909965)
    fixture_session_2 = [(436, 220), (494, 218), (464, 251), (440, 272), (493, 270)]
    res2 = detector.estimate_gaze(fixture_session_2, (589, 1024, 3))
    assert res2["is_valid"] is True
    assert res2["gaze_direction"] == "CENTER"
    assert res2["is_looking_away"] is False

    # Fixture 3: User assessment test session (media_1790951563905)
    fixture_session_3 = [(848, 146), (876, 145), (864, 161), (852, 171), (875, 172)]
    res3 = detector.estimate_gaze(fixture_session_3, (575, 1024, 3))
    assert res3["is_valid"] is True
    assert res3["gaze_direction"] == "CENTER"
    assert res3["is_looking_away"] is False

    # Fixture 4: User assessment test session (media_1790960269547)
    fixture_session_4 = [(357, 198), (387, 199), (373, 217), (359, 230), (386, 229)]
    res4 = detector.estimate_gaze(fixture_session_4, (623, 1024, 3))
    assert res4["is_valid"] is True
    assert res4["gaze_direction"] == "CENTER"
    assert res4["is_looking_away"] is False

def test_gaze_detector_invalid_and_degenerate_landmarks():
    detector = GazeDetector()

    # 1. Empty landmarks
    res = detector.estimate_gaze([], (480, 640, 3))
    assert res["is_valid"] is False
    assert res["gaze_direction"] == "CENTER"
    assert res["is_looking_away"] is False

    # 2. Fewer than 5 points
    res = detector.estimate_gaze([(100, 100), (200, 100)], (480, 640, 3))
    assert res["is_valid"] is False
    assert res["is_looking_away"] is False

    # 3. None / zero shape
    res = detector.estimate_gaze([(280, 200), (360, 200), (320, 240), (290, 290), (350, 290)], (0, 0, 3))
    assert res["is_valid"] is False
    assert res["is_looking_away"] is False

    # 4. Vertically inverted geometry (eyes placed below mouth)
    inverted_landmarks = [
        (280, 300),  # eyes below mouth
        (360, 300),
        (320, 250),
        (290, 150),  # mouth above eyes
        (350, 150)
    ]
    res = detector.estimate_gaze(inverted_landmarks, (480, 640, 3))
    assert res["is_valid"] is False
    assert res["is_looking_away"] is False

    # 5. Collapsed face scale (interocular distance < 12px)
    tiny_landmarks = [
        (300, 200),
        (305, 200),  # eye dist = 5px
        (302, 205),
        (301, 210),
        (304, 210)
    ]
    res = detector.estimate_gaze(tiny_landmarks, (480, 640, 3))
    assert res["is_valid"] is False
    assert res["is_looking_away"] is False

    # 6. Out-of-bounds coordinates
    oob_landmarks = [
        (99999, 99999),
        (100050, 99999),
        (100025, 100025),
        (100010, 100060),
        (100040, 100060)
    ]
    res = detector.estimate_gaze(oob_landmarks, (480, 640, 3))
    assert res["is_valid"] is False
    assert res["is_looking_away"] is False

def test_gaze_detector_controlled_synthetic_3d_geometry():
    """
    Validates synthetic 3D perspective projection across a sweep of known ground truth rotations.
    Testing limits: Assumes rigid 5-point pinhole projection with nominal focal length.
    """
    detector = GazeDetector()
    focal = 640.0
    cam = np.array([[focal, 0, 320.0], [0, focal, 240.0], [0, 0, 1]], dtype=np.float64)
    dist = np.zeros((4, 1), dtype=np.float64)
    tvec = np.array([[0.0], [0.0], [500.0]], dtype=np.float64)

    test_poses = [
        (0.0, 0.0, "CENTER", False),
        (0.0, -35.0, "LEFT", True),
        (0.0, 35.0, "RIGHT", True),
        (-32.0, 0.0, "UP", True),
        (35.0, 0.0, "DOWN", True),
    ]

    for p_gt, y_gt, expected_dir, expected_away in test_poses:
        rx = np.radians(p_gt)
        ry = np.radians(-y_gt)  # OpenCV camera Y-rotation
        Rx = np.array([[1, 0, 0], [0, np.cos(rx), -np.sin(rx)], [0, np.sin(rx), np.cos(rx)]])
        Ry = np.array([[np.cos(ry), 0, np.sin(ry)], [0, 1, 0], [-np.sin(ry), 0, np.cos(ry)]])
        R = Rx @ Ry
        rvec, _ = cv2.Rodrigues(R)
        proj_pts, _ = cv2.projectPoints(detector.model_points, rvec, tvec, cam, dist)
        lms = [
            (proj_pts[1, 0, 0], proj_pts[1, 0, 1]), # right eye
            (proj_pts[2, 0, 0], proj_pts[2, 0, 1]), # left eye
            (proj_pts[0, 0, 0], proj_pts[0, 0, 1]), # nose tip
            (proj_pts[3, 0, 0], proj_pts[3, 0, 1]), # right mouth
            (proj_pts[4, 0, 0], proj_pts[4, 0, 1]), # left mouth
        ]
        res = detector.estimate_gaze(lms, (480, 640, 3))
        assert res["is_valid"] is True
        assert res["gaze_direction"] == expected_dir
        assert res["is_looking_away"] is expected_away


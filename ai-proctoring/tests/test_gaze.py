import pytest
import numpy as np
from detection.gaze_detector import GazeDetector

def test_gaze_detector_init():
    detector = GazeDetector()
    assert detector is not None

def test_gaze_detector_center():
    detector = GazeDetector()
    # Centered symmetric landmarks for 640x480 image
    # right_eye, left_eye, nose_tip, right_mouth, left_mouth
    landmarks = [
        (280, 200),  # right eye
        (360, 200),  # left eye
        (320, 240),  # nose tip
        (290, 290),  # right mouth
        (350, 290)   # left mouth
    ]
    res = detector.estimate_gaze(landmarks, (480, 640, 3))
    assert res["gaze_direction"] == "CENTER"
    assert abs(res["yaw"]) < 15.0
    assert abs(res["pitch"]) < 15.0
    assert res["is_looking_away"] is False

def test_gaze_detector_looking_left():
    detector = GazeDetector()
    # Nose shifted significantly left relative to eye midpoint
    landmarks = [
        (260, 200),  # right eye
        (380, 200),  # left eye
        (275, 240),  # nose tip shifted far left
        (270, 290),  # right mouth
        (360, 290)   # left mouth
    ]
    res = detector.estimate_gaze(landmarks, (480, 640, 3))
    assert res["yaw"] < -15.0
    assert res["gaze_direction"] == "LEFT"
    assert res["is_looking_away"] is True

def test_gaze_detector_looking_right():
    detector = GazeDetector()
    # Nose shifted significantly right relative to eye midpoint
    landmarks = [
        (260, 200),  # right eye
        (380, 200),  # left eye
        (365, 240),  # nose tip shifted far right
        (280, 290),  # right mouth
        (370, 290)   # left mouth
    ]
    res = detector.estimate_gaze(landmarks, (480, 640, 3))
    assert res["yaw"] > 15.0
    assert res["gaze_direction"] == "RIGHT"
    assert res["is_looking_away"] is True

def test_gaze_detector_invalid_landmarks():
    detector = GazeDetector()
    res = detector.estimate_gaze([], (480, 640, 3))
    assert res["gaze_direction"] == "CENTER"
    assert res["yaw"] == 0.0
    assert res["is_looking_away"] is False

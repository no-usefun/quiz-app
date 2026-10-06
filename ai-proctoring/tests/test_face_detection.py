import pytest
import numpy as np
import cv2
from detection.face_detector import FaceDetector

def test_detector_initialization():
    detector = FaceDetector()
    assert detector is not None

def test_detect_empty_image():
    detector = FaceDetector()
    faces, raw = detector.detect_faces(np.zeros((100, 100, 3), dtype=np.uint8))
    assert isinstance(faces, list)
    assert len(faces) == 0

def test_detect_none_image():
    detector = FaceDetector()
    faces, raw = detector.detect_faces(None)
    assert faces == []
    assert raw is None

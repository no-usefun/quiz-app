import pytest
import numpy as np
from detection.person_detector import PersonDetector

def test_person_detector_init():
    detector = PersonDetector()
    assert detector is not None

def test_person_detector_empty_image():
    detector = PersonDetector()
    img = np.zeros((320, 320, 3), dtype=np.uint8)
    count, detections = detector.detect_persons(img)
    assert count == 0
    assert detections == []

def test_person_detector_none_image():
    detector = PersonDetector()
    count, detections = detector.detect_persons(None)
    assert count == 0
    assert detections == []

from types import SimpleNamespace

import numpy as np

from detection.phone_detector import PhoneDetector


class FakeTensor:
    def __init__(self, value):
        self.value = value

    def __getitem__(self, index):
        return FakeTensor(self.value[index])

    def __int__(self):
        return int(self.value)

    def __float__(self):
        return float(self.value)

    def cpu(self):
        return self

    def numpy(self):
        return np.asarray(self.value)


class FakeBox:
    cls = FakeTensor([67])
    conf = FakeTensor([0.22])
    xyxy = FakeTensor([[10, 20, 70, 130]])


class FakeModel:
    def __init__(self):
        self.kwargs = None

    def predict(self, **kwargs):
        self.kwargs = kwargs
        return [SimpleNamespace(boxes=[FakeBox()])]


def test_phone_detection_uses_high_resolution_augmented_inference_for_low_confidence_phone():
    detector = PhoneDetector.__new__(PhoneDetector)
    import threading
    detector._inference_lock = threading.Lock()
    detector.model = FakeModel()

    detected, boxes = detector.detect_phone(np.zeros((480, 640, 3), dtype=np.uint8))

    assert detected is True
    assert boxes == [{"bbox": [10, 20, 60, 110], "confidence": 0.22}]
    assert detector.model.kwargs["classes"] == [67]
    assert detector.model.kwargs["conf"] == 0.15
    assert detector.model.kwargs["imgsz"] == 960
    assert detector.model.kwargs["augment"] is True

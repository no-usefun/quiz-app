import os
import cv2
import numpy as np
import logging
from config import YUNET_MODEL_PATH, FACE_CONFIDENCE_THRESHOLD, FACE_NMS_THRESHOLD, ensure_models_exist

logger = logging.getLogger("ai-proctoring.face_detector")

class FaceDetector:
    def __init__(self, model_path: str = YUNET_MODEL_PATH):
        ensure_models_exist()
        self.model_path = model_path
        self.detector = None
        self._init_detector()

    def _init_detector(self):
        try:
            if os.path.exists(self.model_path) and os.path.getsize(self.model_path) > 10000:
                self.detector = cv2.FaceDetectorYN.create(
                    model=self.model_path,
                    config="",
                    input_size=(320, 320),
                    score_threshold=FACE_CONFIDENCE_THRESHOLD,
                    nms_threshold=FACE_NMS_THRESHOLD,
                    top_k=5000,
                    backend_id=cv2.dnn.DNN_BACKEND_OPENCV,
                    target_id=cv2.dnn.DNN_TARGET_CPU
                )
                logger.info("YuNet DNN Face Detector loaded successfully.")
            else:
                logger.warning("YuNet model file not found at %s. Falling back to OpenCV Cascade.", self.model_path)
                self.detector = None
        except Exception as e:
            logger.error("Failed to initialize YuNet detector: %s", e)
            self.detector = None

    def detect_faces(self, image: np.ndarray):
        """
        Detects faces in BGR image using YuNet.
        Returns:
            faces_data: List of dicts with bbox, landmarks, and confidence score.
            raw_faces: Raw numpy array from YuNet (used by SFace).
        """
        if image is None or image.size == 0:
            return [], None

        h, w = image.shape[:2]
        if self.detector is not None:
            try:
                self.detector.setInputSize((w, h))
                _, raw_faces = self.detector.detect(image)
                if raw_faces is None or len(raw_faces) == 0:
                    return [], None

                faces_data = []
                for face in raw_faces:
                    bbox = [int(face[0]), int(face[1]), int(face[2]), int(face[3])]
                    landmarks = [
                        (int(face[4]), int(face[5])),   # right eye
                        (int(face[6]), int(face[7])),   # left eye
                        (int(face[8]), int(face[9])),   # nose tip
                        (int(face[10]), int(face[11])), # right mouth corner
                        (int(face[12]), int(face[13]))  # left mouth corner
                    ]
                    score = float(face[14])
                    faces_data.append({
                        "bbox": bbox,
                        "landmarks": landmarks,
                        "confidence": score
                    })
                return faces_data, raw_faces
            except Exception as e:
                logger.error("YuNet detection error: %s", e)

        # Haar fallback if YuNet is unavailable
        gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        face_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        detected = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(60, 60))
        faces_data = []
        for (x, y, fw, fh) in detected:
            faces_data.append({
                "bbox": [int(x), int(y), int(fw), int(fh)],
                "landmarks": [],
                "confidence": 0.85
            })
        return faces_data, None

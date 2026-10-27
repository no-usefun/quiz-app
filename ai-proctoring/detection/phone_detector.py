import os
import cv2
import numpy as np
import logging
from config import PHONE_CONFIDENCE_THRESHOLD, YOLO_MODEL_PATH

logger = logging.getLogger("ai-proctoring.phone_detector")

class PhoneDetector:
    def __init__(self, model_name: str = "yolov8n.pt"):
        self.model = None
        self._init_model(model_name)

    def _init_model(self, model_name: str):
        try:
            from ultralytics import YOLO
            # If local model exists in models/ use it, otherwise YOLO will auto-download yolov8n.pt
            target = YOLO_MODEL_PATH if os.path.exists(YOLO_MODEL_PATH) else model_name
            self.model = YOLO(target)
            logger.info("YOLOv8 Phone Detector loaded successfully.")
        except Exception as e:
            logger.error("Failed to load YOLOv8 model: %s", e)
            self.model = None

    def detect_phone(self, image: np.ndarray) -> tuple[bool, list[dict]]:
        """
        Detects mobile phones in frame.
        Returns:
            (phone_detected: bool, detections: list[dict])
        """
        if self.model is None or image is None or image.size == 0:
            return False, []

        try:
            results = self.model.predict(
                source=image,
                conf=PHONE_CONFIDENCE_THRESHOLD,
                classes=[67], # COCO class 67: cell phone
                verbose=False
            )
            detections = []
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].cpu().numpy().tolist()
                    if cls_id == 67 and conf >= PHONE_CONFIDENCE_THRESHOLD:
                        detections.append({
                            "bbox": [int(xyxy[0]), int(xyxy[1]), int(xyxy[2] - xyxy[0]), int(xyxy[3] - xyxy[1])],
                            "confidence": round(conf, 3)
                        })

            return len(detections) > 0, detections
        except Exception as e:
            logger.error("Phone detection inference error: %s", e)
            return False, []

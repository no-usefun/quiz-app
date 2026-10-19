import os
import cv2
import numpy as np
import logging
from config import PERSON_CONFIDENCE_THRESHOLD, YOLO_MODEL_PATH

logger = logging.getLogger("ai-proctoring.person_detector")

class PersonDetector:
    def __init__(self, model_name: str = "yolov8n.pt"):
        self.model = None
        self._init_model(model_name)

    def _init_model(self, model_name: str):
        try:
            from ultralytics import YOLO
            target = YOLO_MODEL_PATH if os.path.exists(YOLO_MODEL_PATH) else model_name
            self.model = YOLO(target)
            logger.info("YOLOv8 Person Detector loaded successfully.")
        except Exception as e:
            logger.error("Failed to load YOLOv8 model for person detector: %s", e)
            self.model = None

    def detect_persons(self, image: np.ndarray) -> tuple[int, list[dict]]:
        """
        Detects human persons in frame.
        Returns:
            (person_count: int, detections: list[dict])
        """
        if self.model is None or image is None or image.size == 0:
            return 0, []

        try:
            results = self.model.predict(
                source=image,
                conf=PERSON_CONFIDENCE_THRESHOLD,
                classes=[0], # COCO class 0: person
                verbose=False
            )
            raw_detections = []
            for r in results:
                boxes = r.boxes
                for box in boxes:
                    cls_id = int(box.cls[0])
                    conf = float(box.conf[0])
                    xyxy = box.xyxy[0].cpu().numpy().tolist()
                    w = int(xyxy[2] - xyxy[0])
                    h = int(xyxy[3] - xyxy[1])
                    if cls_id == 0 and conf >= PERSON_CONFIDENCE_THRESHOLD and w >= 40 and h >= 40:
                        raw_detections.append({
                            "bbox": [int(xyxy[0]), int(xyxy[1]), w, h],
                            "confidence": round(conf, 3)
                        })

            # Sort by confidence descending
            raw_detections.sort(key=lambda d: d["confidence"], reverse=True)
            filtered_detections = []
            for det in raw_detections:
                box = det["bbox"]
                overlap = False
                for kept in filtered_detections:
                    kbox = kept["bbox"]
                    # Calculate IoU
                    xA = max(box[0], kbox[0])
                    yA = max(box[1], kbox[1])
                    xB = min(box[0] + box[2], kbox[0] + kbox[2])
                    yB = min(box[1] + box[3], kbox[1] + kbox[3])
                    inter = max(0, xB - xA) * max(0, yB - yA)
                    union = (box[2] * box[3]) + (kbox[2] * kbox[3]) - inter
                    if union > 0 and (inter / union) >= 0.25:
                        overlap = True
                        break
                if not overlap:
                    filtered_detections.append(det)

            return len(filtered_detections), filtered_detections
        except Exception as e:
            logger.error("Person detection inference error: %s", e)
            return 0, []

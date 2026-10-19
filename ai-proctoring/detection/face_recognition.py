import os
import cv2
import numpy as np
import logging
from config import SFACE_MODEL_PATH, BIOMETRIC_COSINE_SIMILARITY_THRESHOLD, ensure_models_exist

logger = logging.getLogger("ai-proctoring.face_recognition")

class BiometricFaceRecognizer:
    def __init__(self, model_path: str = SFACE_MODEL_PATH):
        ensure_models_exist()
        self.model_path = model_path
        self.recognizer = None
        self._init_recognizer()

    def _init_recognizer(self):
        try:
            if os.path.exists(self.model_path) and os.path.getsize(self.model_path) > 10000:
                self.recognizer = cv2.FaceRecognizerSF.create(
                    model=self.model_path,
                    config="",
                    backend_id=cv2.dnn.DNN_BACKEND_OPENCV,
                    target_id=cv2.dnn.DNN_TARGET_CPU
                )
                logger.info("SFace DNN Biometric Face Recognizer loaded successfully.")
            else:
                logger.warning("SFace model not found at %s. Biometrics offline.", self.model_path)
                self.recognizer = None
        except Exception as e:
            logger.error("Failed to initialize SFace recognizer: %s", e)
            self.recognizer = None

    def extract_embedding(self, image: np.ndarray, raw_face: np.ndarray) -> np.ndarray:
        """
        Aligns the face using YuNet landmarks and extracts a 128-d L2 normalized biometric embedding.
        """
        if self.recognizer is None or image is None or raw_face is None:
            return None
        try:
            # alignCrop aligns face into standard 112x112 biometric template
            aligned_face = self.recognizer.alignCrop(image, raw_face)
            embedding = self.recognizer.feature(aligned_face)
            return embedding
        except Exception as e:
            logger.error("Error extracting biometric embedding: %s", e)
            return None

    def match(self, ref_embedding: np.ndarray, query_embedding: np.ndarray) -> tuple[bool, float]:
        """
        Computes cosine similarity between two 128-d biometric embeddings.
        Returns:
            (is_match: bool, similarity_score: float)
        """
        if ref_embedding is None or query_embedding is None:
            return False, 0.0

        try:
            if self.recognizer is not None:
                similarity = float(self.recognizer.match(ref_embedding, query_embedding, cv2.FaceRecognizerSF_FR_COSINE))
            else:
                # Cosine similarity fallback formula: (A . B) / (||A|| * ||B||)
                a = ref_embedding.flatten()
                b = query_embedding.flatten()
                norm_a = np.linalg.norm(a)
                norm_b = np.linalg.norm(b)
                if norm_a == 0 or norm_b == 0:
                    return False, 0.0
                similarity = float(np.dot(a, b) / (norm_a * norm_b))

            is_match = similarity >= BIOMETRIC_COSINE_SIMILARITY_THRESHOLD
            return is_match, round(similarity, 4)
        except Exception as e:
            logger.error("Biometric match error: %s", e)
            return False, 0.0

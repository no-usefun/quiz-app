import os
import urllib.request
import logging

logger = logging.getLogger("ai-proctoring.config")

# Base directories
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# Server Config
HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 8000))
SPRING_BOOT_URL = os.getenv("SPRING_BOOT_URL", "http://localhost:8080")
PROCTOR_FRONTEND_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "PROCTOR_FRONTEND_ORIGINS",
        "http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001"
    ).split(",")
    if origin.strip()
]

# Model Paths
YUNET_MODEL_PATH = os.path.join(MODELS_DIR, "face_detection_yunet_2023mar.onnx")
SFACE_MODEL_PATH = os.path.join(MODELS_DIR, "face_recognition_sface_2021dec.onnx")
YOLO_MODEL_PATH = os.path.join(MODELS_DIR, "yolov8n.pt")

# OpenCV Zoo download URLs
YUNET_DOWNLOAD_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
SFACE_DOWNLOAD_URL = "https://github.com/opencv/opencv_zoo/raw/main/models/face_recognition_sface/face_recognition_sface_2021dec.onnx"

# Detection & Biometric Thresholds
FACE_CONFIDENCE_THRESHOLD = 0.50
FACE_NMS_THRESHOLD = 0.30
BIOMETRIC_COSINE_SIMILARITY_THRESHOLD = 0.363  # Validated OpenCV SFace threshold
PHONE_CONFIDENCE_THRESHOLD = 0.30
PERSON_CONFIDENCE_THRESHOLD = 0.35

# Head Pose / Gaze Thresholds (in degrees)
YAW_LEFT_THRESHOLD = -15.0
YAW_RIGHT_THRESHOLD = 15.0
PITCH_UP_THRESHOLD = -12.0
PITCH_DOWN_THRESHOLD = 15.0

# VAD Audio Thresholds
VAD_ENERGY_THRESHOLD = 0.025
VAD_SPEECH_FREQ_MIN = 300   # Hz
VAD_SPEECH_FREQ_MAX = 3400  # Hz
LOUD_VOICE_RMS_THRESHOLD = 0.65

# Temporal Consecutive Frame Thresholds (for debounced malpractice confirmation at ~350ms per frame)
STREAK_NO_FACE = 6            # ~2.1 seconds
STREAK_MULTIPLE_FACES = 3     # ~1.0 second
STREAK_MULTIPLE_PERSONS = 4   # ~1.4 seconds
STREAK_LOOKING_AWAY = 6       # ~2.1 seconds sustained gaze deviation
STREAK_PHONE = 2              # ~0.7 seconds
STREAK_IDENTITY_MISMATCH = 4  # ~1.4 seconds
STREAK_VOICE = 3              # ~1.0 second

def ensure_models_exist():
    """Ensure ONNX and YOLO weights exist in models directory."""
    if not os.path.exists(YUNET_MODEL_PATH) or os.path.getsize(YUNET_MODEL_PATH) < 10000:
        try:
            logger.info("Downloading YuNet ONNX face detection model...")
            req = urllib.request.Request(YUNET_DOWNLOAD_URL, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req) as resp:
                data = resp.read()
                with open(YUNET_MODEL_PATH, "wb") as f:
                    f.write(data)
            logger.info("YuNet model downloaded successfully (%d bytes)", len(data))
        except Exception as e:
            logger.error("Failed to auto-download YuNet model: %s", e)

    if not os.path.exists(SFACE_MODEL_PATH) or os.path.getsize(SFACE_MODEL_PATH) < 10000:
        try:
            logger.info("Downloading SFace ONNX face recognition model...")
            req = urllib.request.Request(SFACE_DOWNLOAD_URL, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req) as resp:
                data = resp.read()
                with open(SFACE_MODEL_PATH, "wb") as f:
                    f.write(data)
            logger.info("SFace model downloaded successfully (%d bytes)", len(data))
        except Exception as e:
            logger.error("Failed to auto-download SFace model: %s", e)

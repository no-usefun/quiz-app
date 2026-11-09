
import os
import urllib.request
import logging
from dotenv import load_dotenv

logger = logging.getLogger("ai-proctoring.config")

# ============================================================
# BASE DIRECTORIES AND ENVIRONMENT
# ============================================================

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

os.makedirs(MODELS_DIR, exist_ok=True)

# Load AI service environment configuration
ENV_FILE = os.path.join(BASE_DIR, ".env")

load_dotenv(dotenv_path=ENV_FILE, override=False)

logger.info("Loading environment from: %s", ENV_FILE)

# ============================================================
# SERVER CONFIGURATION
# ============================================================

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", "8000"))

SPRING_BOOT_URL = os.getenv(
    "SPRING_BOOT_URL",
    "http://localhost:8080"
).rstrip("/")

PROCTOR_FRONTEND_ORIGINS = [
    origin.strip().rstrip("/")
    for origin in os.getenv(
        "PROCTOR_FRONTEND_ORIGINS",
        "http://localhost:3000,http://127.0.0.1:3000"
    ).split(",")
    if origin.strip()
]

logger.info("AI server host: %s", HOST)
logger.info("AI server port: %s", PORT)
logger.info("Allowed frontend origins: %s", PROCTOR_FRONTEND_ORIGINS)

# ============================================================
# MODEL PATHS
# ============================================================

YUNET_MODEL_PATH = os.path.join(
    MODELS_DIR,
    "face_detection_yunet_2023mar.onnx"
)

SFACE_MODEL_PATH = os.path.join(
    MODELS_DIR,
    "face_recognition_sface_2021dec.onnx"
)

YOLO_MODEL_PATH = os.path.join(
    MODELS_DIR,
    "yolov8n.pt"
)

# ============================================================
# MODEL DOWNLOAD URLS
# ============================================================

YUNET_DOWNLOAD_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/"
    "models/face_detection_yunet/face_detection_yunet_2023mar.onnx"
)

SFACE_DOWNLOAD_URL = (
    "https://github.com/opencv/opencv_zoo/raw/main/"
    "models/face_recognition_sface/face_recognition_sface_2021dec.onnx"
)

# ============================================================
# DETECTION AND BIOMETRIC THRESHOLDS
# ============================================================

FACE_CONFIDENCE_THRESHOLD = 0.50
FACE_NMS_THRESHOLD = 0.30

BIOMETRIC_COSINE_SIMILARITY_THRESHOLD = 0.363

PHONE_CONFIDENCE_THRESHOLD = 0.15
PERSON_CONFIDENCE_THRESHOLD = 0.65

# ============================================================
# HEAD POSE / GAZE THRESHOLDS (DEGREES)
# ============================================================

YAW_LEFT_THRESHOLD = -28.0
YAW_RIGHT_THRESHOLD = 28.0

PITCH_UP_THRESHOLD = -25.0
PITCH_DOWN_THRESHOLD = 30.0

# ============================================================
# VAD AUDIO THRESHOLDS
# ============================================================

VAD_ENERGY_THRESHOLD = 0.025

VAD_SPEECH_FREQ_MIN = 300
VAD_SPEECH_FREQ_MAX = 3400

LOUD_VOICE_RMS_THRESHOLD = 0.65

# ============================================================
# TEMPORAL CONSECUTIVE FRAME THRESHOLDS
# ============================================================

STREAK_NO_FACE = 6
STREAK_MULTIPLE_FACES = 3
STREAK_MULTIPLE_PERSONS = 4

STREAK_LOOKING_AWAY = 8
STREAK_PHONE = 2

STREAK_IDENTITY_MISMATCH = 4
STREAK_VOICE = 3

# ============================================================
# MODEL DOWNLOAD HELPER
# ============================================================

def _download_model(url: str, destination: str, model_name: str):
    """Download a model artifact if it does not exist or is invalid."""

    if os.path.exists(destination) and os.path.getsize(destination) >= 10000:
        logger.info(
            "%s model already exists (%d bytes)",
            model_name,
            os.path.getsize(destination)
        )
        return

    temp_path = destination + ".download"

    try:
        logger.info("Downloading %s model...", model_name)

        request = urllib.request.Request(
            url,
            headers={"User-Agent": "Mozilla/5.0"}
        )

        with urllib.request.urlopen(request, timeout=120) as response:
            data = response.read()

        if len(data) < 10000:
            raise ValueError(
                f"{model_name} download is unexpectedly small: {len(data)} bytes"
            )

        with open(temp_path, "wb") as model_file:
            model_file.write(data)

        os.replace(temp_path, destination)

        logger.info(
            "%s model downloaded successfully (%d bytes)",
            model_name,
            len(data)
        )

    except Exception as exc:
        if os.path.exists(temp_path):
            os.remove(temp_path)

        logger.error(
            "Failed to download %s model: %s",
            model_name,
            exc
        )

        raise RuntimeError(
            f"Required model artifact unavailable: {model_name}"
        ) from exc


def ensure_models_exist():
    """
    Ensure required YuNet and SFace model artifacts exist.

    YOLOv8 weights are handled separately by Ultralytics
    if the existing application uses automatic model loading.
    """

    _download_model(
        YUNET_DOWNLOAD_URL,
        YUNET_MODEL_PATH,
        "YuNet face detection"
    )

    _download_model(
        SFACE_DOWNLOAD_URL,
        SFACE_MODEL_PATH,
        "SFace face recognition"
    )

    logger.info("Required face detection and recognition models are ready.")

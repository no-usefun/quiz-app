from contextlib import asynccontextmanager
import uvicorn
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import router, ws_router
from api.routes import malpractice_detector
from config import HOST, PORT, ensure_models_exist

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("ai-proctoring")

# Pre-download & ensure models
ensure_models_exist()

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("AI Proctoring Microservice initialized.")
    yield
    logger.info("AI Proctoring Microservice shutting down... Closing resources.")
    await malpractice_detector.close()

app = FastAPI(
    title="Quizly AI Proctoring Service",
    version="2.0.0",
    description="Microservice for OpenCV YuNet face detection, SFace biometrics, VAD audio, and YOLOv8 device detection.",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Allow all origins for local dev and frontend ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.include_router(ws_router)

if __name__ == "__main__":
    logger.info("Starting AI Proctoring Microservice on %s:%d", HOST, PORT)
    uvicorn.run("app:app", host=HOST, port=PORT, reload=False)

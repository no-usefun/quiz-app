FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1

# Install system dependencies required by OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all source code and pre-bundled models (models/ and yolov8n.pt)
COPY . .

# Expose default port
EXPOSE 8000

# Start FastAPI microservice binding dynamically to Railway's $PORT
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]

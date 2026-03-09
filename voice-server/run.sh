#!/bin/bash
# Run voice server with GPU passthrough via Docker + nvidia-container-toolkit
# Can also use: docker compose up voice-server (GPU support is in docker-compose.yml)

set -euo pipefail

CONTAINER_NAME="worldview_oss-voice-server-1"
IMAGE_NAME="worldview_oss-voice-server"
VOICE_PORT="${VOICE_PORT:-8790}"
VOICE_MODEL="${VOICE_MODEL:-Qwen/Qwen2.5-Omni-3B}"

# Stop existing container if running
if docker container inspect "$CONTAINER_NAME" &>/dev/null; then
    echo "Stopping existing voice server..."
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
fi

# Build if image doesn't exist or --build flag passed
if [[ "${1:-}" == "--build" ]] || ! docker image inspect "$IMAGE_NAME" &>/dev/null; then
    echo "Building voice server image..."
    docker build -t "$IMAGE_NAME" "$(dirname "$0")"
fi

# Ensure voice-models volume exists
docker volume inspect voice-models &>/dev/null || docker volume create voice-models

echo "Starting voice server on port $VOICE_PORT with GPU..."
docker run -d \
    --name "$CONTAINER_NAME" \
    --gpus all \
    -p "${VOICE_PORT}:8790" \
    -v voice-models:/models \
    -e "VOICE_MODEL=${VOICE_MODEL}" \
    -e "NVIDIA_VISIBLE_DEVICES=all" \
    --network worldview_oss_default \
    --health-cmd "curl -f http://localhost:8790/v1/voice/status" \
    --health-interval 30s \
    --health-timeout 10s \
    --health-retries 5 \
    --health-start-period 120s \
    "$IMAGE_NAME"

echo "Voice server started. Logs: docker logs -f $CONTAINER_NAME"

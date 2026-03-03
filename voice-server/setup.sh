#!/usr/bin/env bash
# Local dev setup for voice-server (non-Docker).
# Requires: Python 3.10+, CUDA 12.x, FFmpeg (for torchaudio WebM decoding)
# Docker is the preferred method: docker compose up voice-server

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=== WorldView Voice Server Setup ==="

# Create venv
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

source venv/bin/activate

echo "Installing dependencies (this may take a while for torch)..."
pip install --upgrade pip
pip install -r requirements.txt

echo ""
echo "=== Setup complete ==="
echo ""
echo "To start the voice server:"
echo "  cd $SCRIPT_DIR"
echo "  source venv/bin/activate"
echo "  python -m uvicorn server:app --host 0.0.0.0 --port 8790"
echo ""
echo "Or use Docker (preferred):"
echo "  docker compose up voice-server"

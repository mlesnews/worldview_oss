#!/usr/bin/env bash
# Setup NVIDIA Container Toolkit for GPU passthrough in Docker or Podman.
# Run this ONCE on a fresh machine before using `docker compose up voice-server`.
# Requires: NVIDIA GPU driver already installed (verify with `nvidia-smi`).

set -euo pipefail

# ── Detect container runtime ────────────────────────────────

RUNTIME=""
if command -v podman &>/dev/null && docker --version 2>/dev/null | grep -qi podman; then
    RUNTIME="podman"
elif command -v docker &>/dev/null; then
    RUNTIME="docker"
elif command -v podman &>/dev/null; then
    RUNTIME="podman"
else
    echo "ERROR: Neither Docker nor Podman found. Install one first."
    exit 1
fi

echo "=== NVIDIA GPU Setup for ${RUNTIME^} ==="
echo ""

# ── Check for NVIDIA driver ─────────────────────────────────

if ! command -v nvidia-smi &>/dev/null; then
    echo "ERROR: nvidia-smi not found. Install the NVIDIA GPU driver first."
    exit 1
fi

echo "GPU detected:"
nvidia-smi --query-gpu=name,driver_version --format=csv,noheader
echo ""

# ── Check if toolkit already installed ───────────────────────

if command -v nvidia-ctk &>/dev/null; then
    echo "NVIDIA Container Toolkit is already installed:"
    nvidia-ctk --version
    echo ""
    read -rp "Re-run setup anyway? [y/N] " answer
    if [[ ! "$answer" =~ ^[Yy]$ ]]; then
        if [ "$RUNTIME" = "podman" ]; then
            echo "Regenerating CDI spec..."
            sudo nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml
            echo ""
            echo "CDI devices:"
            nvidia-ctk cdi list
        else
            echo "Docker runtime already configured."
        fi
        echo ""
        echo "Done. Run: docker compose up -d --build voice-server"
        exit 0
    fi
fi

# ── Install NVIDIA Container Toolkit ────────────────────────

echo "Adding NVIDIA Container Toolkit repository..."
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
    | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
    | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
    | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

echo "Installing nvidia-container-toolkit..."
sudo apt-get update -qq
sudo apt-get install -y nvidia-container-toolkit

# ── Runtime-specific configuration ──────────────────────────

echo ""

if [ "$RUNTIME" = "podman" ]; then
    # Podman uses CDI (Container Device Interface) for GPU access.
    # The CDI spec maps `nvidia.com/gpu=all` in docker-compose.yml to the real GPU.
    echo "Generating CDI spec for Podman..."
    sudo nvidia-ctk cdi generate --output=/etc/cdi/nvidia.yaml

    echo ""
    echo "CDI devices:"
    nvidia-ctk cdi list

    echo ""
    echo "NOTE: docker-compose.yml uses 'devices: [nvidia.com/gpu=all]' for Podman."
    echo "If switching to Docker, replace with the 'deploy.resources.reservations.devices' block."
else
    # Docker uses the nvidia container runtime. Register it with dockerd.
    echo "Configuring Docker runtime..."
    sudo nvidia-ctk runtime configure --runtime=docker
    echo "Restarting Docker daemon..."
    sudo systemctl restart docker

    echo ""
    echo "NOTE: docker-compose.yml currently uses 'devices: [nvidia.com/gpu=all]' (Podman style)."
    echo "For Docker, replace that with:"
    echo ""
    echo "    deploy:"
    echo "      resources:"
    echo "        reservations:"
    echo "          devices:"
    echo "            - driver: nvidia"
    echo "              count: 1"
    echo "              capabilities: [gpu]"
fi

# ── Verify ──────────────────────────────────────────────────

echo ""
echo "=== Setup complete ==="
echo ""
echo "Start the voice server with:"
echo "  docker compose up -d --build voice-server"
echo ""
echo "Verify GPU is visible inside the container with:"
echo "  docker compose exec voice-server nvidia-smi"

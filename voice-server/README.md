# Voice Server

Qwen2.5-Omni-7B (GPTQ-Int4) voice assistant sidecar for WorldView OSS. Accepts audio input, returns text + audio responses with tool-call markers for globe navigation, agent deployment, and layer toggling.

## Prerequisites

- NVIDIA GPU with 12GB+ VRAM (tested on RTX 5070 Ti)
- NVIDIA GPU driver installed (`nvidia-smi` should work)
- Podman or Docker with Compose

## GPU Setup (run once)

Both Docker and Podman need the NVIDIA Container Toolkit to pass the GPU into containers. The setup script auto-detects your runtime and configures it accordingly:

```bash
cd voice-server
./setup-gpu.sh
```

**What it does per runtime:**

| | Podman | Docker |
|---|---|---|
| Installs | `nvidia-container-toolkit` | `nvidia-container-toolkit` |
| Configures | CDI spec at `/etc/cdi/nvidia.yaml` | `nvidia` runtime in Docker daemon |
| Compose syntax | `devices: [nvidia.com/gpu=all]` | `deploy.resources.reservations.devices` |

The script tells you if the `docker-compose.yml` needs adjustment for your runtime. The repo currently ships with Podman-style `devices:` config. For Docker, the script prints the block to swap in.

## Quick Start

```bash
# Build and start (from project root)
docker compose up -d --build voice-server

# Check logs (model takes ~60-90s to load)
docker compose logs -f voice-server

# Verify GPU is accessible inside container
docker compose exec voice-server nvidia-smi

# Verify model loaded
curl http://localhost:8790/v1/voice/status
```

A successful startup shows:

```
Loaded via Qwen2_5OmniForConditionalGeneration
Model loaded in XX.Xs
Uvicorn running on http://0.0.0.0:8790
```

## Local Dev (without Docker)

```bash
cd voice-server
./setup.sh                 # creates venv, installs deps
source venv/bin/activate
python -m uvicorn server:app --host 0.0.0.0 --port 8790
```

## API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/v1/voice/status` | GET | Model load status |
| `/v1/voice/chat` | POST | Audio in (WebM/Opus) -> text + audio + tool calls |
| `/v1/voice/interrupt` | POST | Cancel in-progress generation |
| `/health` | GET | Docker healthcheck |

## Model Cache

The model (~4GB) downloads from HuggingFace on first start and is persisted in the `voice-models` Docker volume. Subsequent starts skip the download.

Set `HF_TOKEN` in your environment for faster downloads and higher rate limits:

```bash
HF_TOKEN=hf_xxx docker compose up -d voice-server
```

## Troubleshooting

**503 Service Unavailable** — Model hasn't loaded yet. Check logs with `docker compose logs voice-server`. Model loading takes ~60-90s.

**"NVIDIA Driver was not detected"** — GPU not passed through. Run `./setup-gpu.sh` (Podman) or verify Docker GPU runtime is configured.

**Out of VRAM** — The GPTQ-Int4 model needs ~10-12GB. If Ollama is holding GPU memory, it auto-unloads after 5min idle. Stop Ollama temporarily if needed: `ollama stop`.

**Slow first download** — Set `HF_TOKEN` env var. Without auth, HuggingFace rate-limits downloads.

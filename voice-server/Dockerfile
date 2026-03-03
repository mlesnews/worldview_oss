FROM nvidia/cuda:12.4.1-devel-ubuntu22.04

RUN apt-get update && apt-get install -y \
    python3.11 python3.11-dev python3.11-venv python3-pip ffmpeg git curl \
    && rm -rf /var/lib/apt/lists/*

# Ensure pip, setuptools, wheel are up to date (gptqmodel builds from source)
RUN python3.11 -m pip install --upgrade pip setuptools wheel

WORKDIR /app

# Stage 1: Install torch first (gptqmodel's setup.py needs torch pre-installed to detect version)
COPY requirements-torch.txt .
RUN python3.11 -m pip install --no-cache-dir -r requirements-torch.txt

# Stage 2: Install gptqmodel with --no-build-isolation so it sees the torch we just installed
# (PEP 517 build isolation creates a temp venv where torch isn't visible)
RUN python3.11 -m pip install --no-cache-dir --no-build-isolation gptqmodel>=2.2.0

# Stage 3: Install remaining deps
COPY requirements.txt .
RUN python3.11 -m pip install --no-cache-dir -r requirements.txt

COPY server.py .

# Model cache persisted via Docker volume
ENV HF_HOME=/models
ENV VOICE_MODEL=Qwen/Qwen2.5-Omni-7B-GPTQ-Int4

EXPOSE 8790
CMD ["python3.11", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8790"]

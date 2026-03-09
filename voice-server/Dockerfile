FROM nvidia/cuda:12.8.1-devel-ubuntu22.04

RUN apt-get update && apt-get install -y \
    python3.11 python3.11-dev python3.11-venv python3-pip ffmpeg git curl \
    && rm -rf /var/lib/apt/lists/*

RUN python3.11 -m pip install --upgrade pip setuptools wheel

WORKDIR /app

# Stage 1: Install torch first (needed before auto-gptq for CUDA kernel detection)
COPY requirements-torch.txt .
RUN python3.11 -m pip install --no-cache-dir -r requirements-torch.txt

# Stage 2: Install auto-gptq (GPTQ backend for transformers)
# gptqmodel doesn't support Qwen2.5-Omni architecture (block pattern mismatch)
# auto-gptq is what Qwen used to create the GPTQ-Int4 quantization
ENV TORCH_CUDA_ARCH_LIST="12.0"
RUN printf '#!/bin/bash\nif [[ "$*" == *"compute_cap"* ]]; then echo "12.0"; else echo "NVIDIA-SMI stub (docker build)"; fi\n' \
    > /usr/local/bin/nvidia-smi && chmod +x /usr/local/bin/nvidia-smi
RUN python3.11 -m pip install --no-cache-dir --no-build-isolation auto-gptq
RUN rm -f /usr/local/bin/nvidia-smi

# Stage 3: Install remaining deps
COPY requirements.txt .
RUN python3.11 -m pip install --no-cache-dir -r requirements.txt

COPY server.py .

# Model cache persisted via Docker volume
ENV HF_HOME=/models
ENV VOICE_MODEL=Qwen/Qwen2.5-Omni-3B

EXPOSE 8790
CMD ["python3.11", "-m", "uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8790"]

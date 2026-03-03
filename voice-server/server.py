"""
Voice sidecar server for WorldView OSS.
Runs Qwen2.5-Omni-7B (GPTQ-Int4) for speech-to-speech interaction.

Usage:
  docker compose up voice-server    (preferred)
  python -m uvicorn server:app --host 0.0.0.0 --port 8790
"""

import asyncio
import base64
import io
import logging
import os
import re
import threading
import time
from collections import deque
from contextlib import asynccontextmanager
from typing import Any

import numpy as np
import soundfile as sf
import torch
import torchaudio
from fastapi import FastAPI, File, UploadFile
from fastapi.responses import JSONResponse

logger = logging.getLogger("voice-server")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")

# ── Globals ───────────────────────────────────────────────────

MODEL_NAME = os.environ.get("VOICE_MODEL", "Qwen/Qwen2.5-Omni-7B-GPTQ-Int4")
MAX_HISTORY = 6  # conversation turns to retain

model: Any = None
processor: Any = None
model_loaded = False
cancel_event = threading.Event()

# Conversation history: list of {"role": "user"|"assistant", "content": [...]}
history: deque = deque(maxlen=MAX_HISTORY * 2)

SYSTEM_PROMPT = """You are WorldView, a tactical voice assistant for a real-time global intelligence dashboard.
You help users navigate the globe, deploy intelligence agents, toggle data layers, and analyze geopolitical events.

When the user asks you to perform an action, include one of these tool markers in your response:
- <<TOOL:flyTo|location=PLACE_NAME>> — navigate the globe to a location
- <<TOOL:flyTo|location=PLACE_NAME,altitude=METERS>> — navigate with specific altitude
- <<TOOL:deployAgents|location=PLACE_NAME,radius=KM>> — deploy intelligence agents to an area
- <<TOOL:specialistChat|message=YOUR_QUERY>> — ask the specialist analyst a question
- <<TOOL:toggleLayer|layer=LAYER_NAME>> — toggle a data layer (flights, satellites, disasters, asteroids, weather, cameras, livestreams, news, militaryActions)
- <<TOOL:setViewMode|mode=MODE>> — change view mode (eo, flir, nightvision, crt)

Keep responses concise and tactical. Use military-style brevity when appropriate.
Always include the tool marker when an action is requested."""

TOOL_REGEX = re.compile(r"<<TOOL:(\w+)\|([^>]+)>>")


# ── Lifespan ──────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    global model, processor, model_loaded

    logger.info(f"Loading model: {MODEL_NAME}")
    start = time.time()

    try:
        from transformers import AutoProcessor, AutoModelForSpeechSeq2Seq

        # Try loading with gptqmodel for GPTQ quantized models
        try:
            from gptqmodel import GPTQModel
            model = GPTQModel.from_quantized(
                MODEL_NAME,
                device_map="auto",
                torch_dtype=torch.float16,
            )
            logger.info("Loaded via GPTQModel")
        except Exception as e:
            logger.warning(f"GPTQModel failed ({e}), trying AutoModel...")
            from transformers import AutoModelForCausalLM
            model = AutoModelForCausalLM.from_pretrained(
                MODEL_NAME,
                device_map="auto",
                torch_dtype=torch.float16,
                trust_remote_code=True,
            )
            logger.info("Loaded via AutoModelForCausalLM")

        processor = AutoProcessor.from_pretrained(MODEL_NAME, trust_remote_code=True)
        model_loaded = True
        logger.info(f"Model loaded in {time.time() - start:.1f}s")
    except Exception as e:
        logger.error(f"Failed to load model: {e}")
        model_loaded = False

    yield

    # Cleanup
    logger.info("Shutting down voice server")


app = FastAPI(lifespan=lifespan)


# ── Endpoints ─────────────────────────────────────────────────

@app.get("/v1/voice/status")
async def status():
    return {"model": MODEL_NAME if model_loaded else None, "loaded": model_loaded}


@app.post("/v1/voice/interrupt")
async def interrupt():
    cancel_event.set()
    return {"ok": True}


@app.post("/v1/voice/chat")
async def chat(audio: UploadFile = File(...)):
    if not model_loaded:
        return JSONResponse({"error": "Model not loaded"}, status_code=503)

    cancel_event.clear()

    try:
        # Read uploaded audio
        audio_bytes = await audio.read()

        # Convert WebM to 16kHz mono WAV using torchaudio
        waveform, sample_rate = _decode_audio(audio_bytes)

        # Resample to 16kHz if needed
        if sample_rate != 16000:
            resampler = torchaudio.transforms.Resample(sample_rate, 16000)
            waveform = resampler(waveform)
            sample_rate = 16000

        # Convert to mono if stereo
        if waveform.shape[0] > 1:
            waveform = waveform.mean(dim=0, keepdim=True)

        audio_array = waveform.squeeze().numpy()

        # Build conversation with system prompt + history + new user audio
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        messages.extend(list(history))

        # Add current user message with audio
        user_msg = {
            "role": "user",
            "content": [{"type": "audio", "audio": audio_array}],
        }
        messages.append(user_msg)

        # Generate response (run in thread to not block event loop)
        text, audio_out = await asyncio.to_thread(_generate, messages, audio_array)

        if cancel_event.is_set():
            return JSONResponse({"text": "", "audioBase64": None, "toolCalls": []})

        # Parse tool calls from text
        tool_calls = []
        for match in TOOL_REGEX.finditer(text):
            tool_name = match.group(1)
            param_str = match.group(2)
            params = {}
            for pair in param_str.split(","):
                eq_idx = pair.find("=")
                if eq_idx > 0:
                    params[pair[:eq_idx].strip()] = pair[eq_idx + 1:].strip()
            tool_calls.append({"tool": tool_name, "params": params})

        # Encode audio response
        audio_b64 = None
        if audio_out is not None:
            wav_buf = io.BytesIO()
            sf.write(wav_buf, audio_out, 24000, format="WAV")
            audio_b64 = base64.b64encode(wav_buf.getvalue()).decode("ascii")

        # Update history
        history.append(user_msg)
        history.append({"role": "assistant", "content": text})

        return {"text": text, "audioBase64": audio_b64, "toolCalls": tool_calls}

    except Exception as e:
        logger.exception("Chat error")
        return JSONResponse({"error": str(e)}, status_code=500)


# ── Internal helpers ──────────────────────────────────────────

def _decode_audio(audio_bytes: bytes) -> tuple:
    """Decode audio bytes (WebM/Opus) to waveform tensor."""
    buf = io.BytesIO(audio_bytes)
    try:
        # torchaudio can handle WebM/Opus with ffmpeg backend
        waveform, sr = torchaudio.load(buf)
        return waveform, sr
    except Exception:
        # Fallback: try soundfile (WAV/FLAC/OGG)
        buf.seek(0)
        data, sr = sf.read(buf)
        return torch.from_numpy(data).float().unsqueeze(0), sr


def _generate(messages: list, audio_array: np.ndarray) -> tuple[str, np.ndarray | None]:
    """Run model inference. Returns (text, audio_array_or_None)."""
    try:
        # Qwen2.5-Omni uses a specific chat template
        # The exact API depends on the transformers preview branch
        inputs = processor(
            text=_format_text_from_messages(messages),
            audios=[audio_array],
            return_tensors="pt",
            sampling_rate=16000,
        )

        # Move to model device
        device = next(model.parameters()).device
        inputs = {k: v.to(device) if hasattr(v, "to") else v for k, v in inputs.items()}

        with torch.no_grad():
            outputs = model.generate(
                **inputs,
                max_new_tokens=512,
                do_sample=True,
                temperature=0.7,
                top_p=0.9,
            )

        # Decode text output
        text = processor.batch_decode(outputs, skip_special_tokens=True)[0]

        # Try to extract audio output (model-specific)
        audio_out = _extract_audio_output(outputs)

        return text, audio_out

    except Exception as e:
        logger.error(f"Generation error: {e}")
        return f"I encountered an error processing your request: {str(e)}", None


def _format_text_from_messages(messages: list) -> str:
    """Format messages into text prompt for the model."""
    parts = []
    for msg in messages:
        role = msg["role"]
        content = msg["content"]
        if isinstance(content, str):
            parts.append(f"<|{role}|>\n{content}")
        elif isinstance(content, list):
            # Multi-modal content — extract text parts
            text_parts = [c.get("text", "") for c in content if isinstance(c, dict) and c.get("type") == "text"]
            if text_parts:
                parts.append(f"<|{role}|>\n{''.join(text_parts)}")
            else:
                parts.append(f"<|{role}|>\n[audio input]")
    parts.append("<|assistant|>\n")
    return "\n".join(parts)


def _extract_audio_output(outputs) -> np.ndarray | None:
    """Try to extract audio from model outputs. Returns None if text-only."""
    # Qwen2.5-Omni may output audio tokens that need vocoder decoding.
    # The exact mechanism depends on the model version.
    # For now, return None (text-only) — audio generation can be added
    # once the model's audio output API is empirically tested.
    return None


# ── Health check for Docker ───────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": model_loaded}

"""
Voice sidecar server for WorldView OSS.
Runs Qwen2.5-Omni-3B for speech-to-text + text generation,
with edge-tts for text-to-speech synthesis.

The Qwen2.5-Omni model needs ~18GB VRAM for its built-in audio
generation (talker + token2wav), which exceeds 12GB GPUs. We disable
the talker to fit the model in GPU memory and use edge-tts instead.

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
import subprocess
import tempfile
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

# Try to set ffmpeg as the torchaudio backend (fallback if torchcodec unavailable)
try:
    torchaudio.set_audio_backend("ffmpeg")
    logger.info("torchaudio backend set to ffmpeg")
except Exception:
    logger.info("ffmpeg torchaudio backend not available, using default")

# ── Globals ───────────────────────────────────────────────────

MODEL_NAME = os.environ.get("VOICE_MODEL", "Qwen/Qwen2.5-Omni-3B")
TTS_VOICE = os.environ.get("TTS_VOICE", "en-US-GuyNeural")
MAX_HISTORY = 6  # conversation turns to retain

model: Any = None
processor: Any = None
model_loaded = False
cancel_event = threading.Event()

# Conversation history: list of {"role": "user"|"assistant", "content": [...]}
history: deque = deque(maxlen=MAX_HISTORY * 2)

# Required by Qwen2.5-Omni for audio output — custom prompts break TTS generation
SYSTEM_PROMPT = "You are Qwen, a virtual human developed by the Qwen Team, Alibaba Group, capable of perceiving auditory and visual inputs, as well as generating text and speech."

# WorldView instructions injected as first user message (workaround for system prompt restriction)
WORLDVIEW_INSTRUCTIONS = """You are also WorldView, a tactical voice assistant for a real-time global intelligence dashboard.
You help users navigate the globe, deploy intelligence agents, toggle data layers, and analyze geopolitical events.

When the user asks you to perform an action, include one of these tool markers in your response:
- <<TOOL:flyTo|location=PLACE_NAME>> — navigate the globe to a location
- <<TOOL:flyTo|location=PLACE_NAME,altitude=METERS>> — navigate with specific altitude
- <<TOOL:deployAgents|location=PLACE_NAME,radius=KM>> — deploy intelligence agents to an area
- <<TOOL:specialistChat|message=YOUR_QUERY>> — ask the specialist analyst a question
- <<TOOL:toggleLayer|layer=LAYER_NAME>> — toggle a data layer (flights, satellites, disasters, asteroids, weather, cameras, livestreams, news, militaryActions)
- <<TOOL:setViewMode|mode=MODE>> — change view mode (eo, flir, nightvision, crt)

Keep responses concise and tactical. Use military-style brevity when appropriate.
Always include the tool marker when an action is requested. Acknowledge these instructions briefly, then await the user's voice input."""

TOOL_REGEX = re.compile(r"<<TOOL:(\w+)\|([^>]+)>>")


# ── Lifespan ──────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load model on startup."""
    global model, processor, model_loaded

    logger.info(f"Loading model: {MODEL_NAME}")
    start = time.time()

    try:
        from transformers import Qwen2_5OmniForConditionalGeneration, Qwen2_5OmniProcessor

        model = Qwen2_5OmniForConditionalGeneration.from_pretrained(
            MODEL_NAME,
            device_map="auto",
            torch_dtype=torch.float16,
        )
        logger.info("Loaded via Qwen2_5OmniForConditionalGeneration")

        # Disable talker (audio generation) to save VRAM. The talker + token2wav
        # need ~8GB extra, pushing the total to ~18GB which exceeds 12GB GPUs.
        # With the talker disabled, model.generate() returns text-only.
        # We use edge-tts for speech synthesis instead.
        if hasattr(model, "disable_talker"):
            model.disable_talker()
            logger.info("Talker disabled (using edge-tts for speech synthesis)")

        processor = Qwen2_5OmniProcessor.from_pretrained(MODEL_NAME)

        # Fix: device_map="auto" CPU-offloads some parameters via meta device
        # placeholders. This causes eos_token_id/pad_token_id to become meta
        # tensors, crashing generation with "Tensor.item() cannot be called on
        # meta tensors". Set plain integer IDs from the tokenizer config.
        eos_id = processor.tokenizer.eos_token_id
        pad_id = processor.tokenizer.pad_token_id or eos_id
        model.generation_config.eos_token_id = eos_id
        model.generation_config.pad_token_id = pad_id
        if hasattr(model.config, "eos_token_id"):
            model.config.eos_token_id = eos_id
        if hasattr(model.config, "pad_token_id"):
            model.config.pad_token_id = pad_id
        logger.info(f"Set token IDs: eos={eos_id}, pad={pad_id}")

        model_loaded = True
        logger.info(f"Model loaded in {time.time() - start:.1f}s")
        logger.info(f"TTS voice: {TTS_VOICE}")
    except Exception as e:
        logger.exception(f"Failed to load model: {e}")
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

        # Build conversation in Qwen2.5-Omni format
        # Default system prompt required for audio output; WorldView instructions
        # injected as first user message (custom system prompts break TTS)
        conversation = [
            {
                "role": "system",
                "content": [{"type": "text", "text": SYSTEM_PROMPT}],
            },
            {
                "role": "user",
                "content": [{"type": "text", "text": WORLDVIEW_INSTRUCTIONS}],
            },
            {
                "role": "assistant",
                "content": [{"type": "text", "text": "Copy. WorldView tactical assistant online. Awaiting voice input."}],
            },
        ]
        for msg in history:
            conversation.append(msg)

        conversation.append({
            "role": "user",
            "content": [{"type": "audio", "audio": audio_array}],
        })

        # Generate text response (run in thread to not block event loop)
        text = await asyncio.to_thread(_generate, conversation)

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

        # Synthesize speech from text response via edge-tts
        audio_b64 = None
        # Strip tool markers from spoken text
        spoken_text = TOOL_REGEX.sub("", text).strip()
        if spoken_text and not cancel_event.is_set():
            try:
                audio_b64 = await _synthesize_speech(spoken_text)
            except Exception as e:
                logger.warning(f"TTS failed, returning text-only: {e}")

        # Update history (text-only so numpy arrays aren't retained in memory)
        history.append({
            "role": "user",
            "content": [{"type": "text", "text": "[audio input]"}],
        })
        history.append({
            "role": "assistant",
            "content": [{"type": "text", "text": text}],
        })

        return {"text": text, "audioBase64": audio_b64, "toolCalls": tool_calls}

    except Exception as e:
        logger.exception("Chat error")
        return JSONResponse({"error": str(e)}, status_code=500)


# ── Internal helpers ──────────────────────────────────────────

def _decode_audio(audio_bytes: bytes) -> tuple:
    """Decode audio bytes (WebM/Opus) to waveform tensor.

    Three-stage fallback:
    1. torchaudio.load() — works if torchcodec or ffmpeg backend is available
    2. ffmpeg subprocess — convert WebM→WAV in a temp file, then torchaudio.load()
    3. soundfile — last resort (only works for WAV/FLAC/OGG, not WebM)
    """
    # Stage 1: direct torchaudio load
    buf = io.BytesIO(audio_bytes)
    try:
        waveform, sr = torchaudio.load(buf)
        logger.debug("Audio decoded via torchaudio.load()")
        return waveform, sr
    except Exception as e:
        logger.warning(f"torchaudio.load() failed: {e}")

    # Stage 2: ffmpeg subprocess (WebM → WAV conversion)
    try:
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp_in:
            tmp_in.write(audio_bytes)
            tmp_in_path = tmp_in.name
        tmp_out_path = tmp_in_path.replace(".webm", ".wav")
        try:
            subprocess.run(
                ["ffmpeg", "-y", "-i", tmp_in_path, "-ar", "16000", "-ac", "1", tmp_out_path],
                capture_output=True, check=True, timeout=10,
            )
            waveform, sr = torchaudio.load(tmp_out_path)
            logger.debug("Audio decoded via ffmpeg subprocess")
            return waveform, sr
        finally:
            for p in (tmp_in_path, tmp_out_path):
                try:
                    os.unlink(p)
                except OSError:
                    pass
    except Exception as e:
        logger.warning(f"ffmpeg subprocess fallback failed: {e}")

    # Stage 3: soundfile (WAV/FLAC/OGG only)
    buf = io.BytesIO(audio_bytes)
    data, sr = sf.read(buf)
    logger.debug("Audio decoded via soundfile")
    return torch.from_numpy(data).float().unsqueeze(0), sr


def _generate(conversation: list) -> str:
    """Run model inference using Qwen2.5-Omni API. Returns text response.

    With talker disabled, model.generate() returns text token IDs only
    (no audio). Speech synthesis is handled separately by edge-tts.
    """
    from qwen_omni_utils import process_mm_info

    try:
        # Format text via chat template
        text_prompt = processor.apply_chat_template(
            conversation, add_generation_prompt=True, tokenize=False,
        )

        # Extract audio/image/video arrays from conversation messages
        audios, images, videos = process_mm_info(conversation, use_audio_in_video=True)

        # Build model inputs
        inputs = processor(
            text=text_prompt,
            audio=audios,
            images=images,
            videos=videos,
            return_tensors="pt",
            padding=True,
            use_audio_in_video=True,
        )

        # Find a real device (not meta) from model parameters for input tensors
        input_device = next(
            (p.device for p in model.parameters() if p.device.type != "meta"),
            torch.device("cuda:0"),
        )
        inputs = inputs.to(input_device).to(model.dtype)
        input_len = inputs["input_ids"].shape[1]

        # Generate text only (talker is disabled, so returns text_ids directly)
        with torch.no_grad():
            text_ids = model.generate(
                **inputs,
                use_audio_in_video=True,
                return_audio=False,
                max_new_tokens=512,
            )

        # Strip input tokens — generate() returns full sequence (prompt + generated)
        generated_ids = text_ids[:, input_len:]

        # Decode only the generated portion
        text = processor.batch_decode(
            generated_ids, skip_special_tokens=True, clean_up_tokenization_spaces=False,
        )[0]

        return text

    except Exception as e:
        logger.exception(f"Generation error: {e}")
        return f"I encountered an error processing your request: {str(e)}"


async def _synthesize_speech(text: str) -> str | None:
    """Convert text to speech using edge-tts. Returns base64-encoded WAV."""
    import edge_tts

    communicate = edge_tts.Communicate(text, TTS_VOICE)

    # Collect audio chunks
    audio_chunks = []
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_chunks.append(chunk["data"])

    if not audio_chunks:
        return None

    mp3_bytes = b"".join(audio_chunks)

    # Convert MP3 to WAV via ffmpeg (edge-tts outputs MP3)
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as tmp_in:
        tmp_in.write(mp3_bytes)
        tmp_in_path = tmp_in.name
    tmp_out_path = tmp_in_path.replace(".mp3", ".wav")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", tmp_in_path, "-ar", "24000", "-ac", "1", tmp_out_path],
            capture_output=True, check=True, timeout=10,
        )
        with open(tmp_out_path, "rb") as f:
            wav_bytes = f.read()
        return base64.b64encode(wav_bytes).decode("ascii")
    finally:
        for p in (tmp_in_path, tmp_out_path):
            try:
                os.unlink(p)
            except OSError:
                pass


# ── Health check for Docker ───────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": model_loaded}

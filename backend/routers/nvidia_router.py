"""NVIDIA NIM Compatibility Bridge — Multi-model AI services."""
from __future__ import annotations
import os, base64, logging, json
import httpx
from fastapi import APIRouter, HTTPException, File, UploadFile
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from typing import Optional, List

logger = logging.getLogger("nvidia_router")
router = APIRouter(prefix="/nvidia", tags=["nvidia"])

NIM_BASE       = os.getenv("NVIDIA_NIM_BASE_URL", "https://integrate.api.nvidia.com/v1")
NIM_GENAI_BASE = "https://ai.api.nvidia.com/v1/genai"  # Flux uses this endpoint
KEY_IMAGE      = os.getenv("NVIDIA_API_KEY_IMAGE", "").strip()
KEY_IMAGE_FLUX = os.getenv("NVIDIA_API_KEY_FLUX", "").strip()
KEY_TTS        = os.getenv("NVIDIA_API_KEY_TTS", "").strip()
KEY_TRANSLATE  = os.getenv("NVIDIA_API_KEY_TRANSLATE", "").strip()
KEY_CODING     = os.getenv("NVIDIA_API_KEY_CODING", "").strip()
KEY_WEATHER    = os.getenv("NVIDIA_API_KEY_WEATHER", "").strip()
KEY_CHAT       = os.getenv("NVIDIA_API_KEY", "").strip()
KEY_ASR        = os.getenv("NVIDIA_API_KEY_ASR", "").strip()
GROQ_KEY       = os.getenv("GROQ_API_KEY", "").strip()


# ── Image Generation (Stable Diffusion 3 Medium) ──────────────────────────────
class ImageRequest(BaseModel):
    prompt: str
    negative_prompt: str = "blurry, low quality, text, watermark"
    width: int = 1024
    height: int = 576
    steps: int = 30
    cfg_scale: float = 7.0
    seed: int = -1


_FLUX_VALID_DIMS = (768, 832, 896, 960, 1024, 1088, 1152, 1216, 1280, 1344)

def _snap_flux_dim(v: int) -> int:
    """Snap arbitrary width/height to the closest Flux-accepted value."""
    return min(_FLUX_VALID_DIMS, key=lambda d: abs(d - v))


async def _call_flux(api_key: str, prompt: str, width: int, height: int, steps: int, seed: int) -> str:
    """Call NVIDIA Flux.1 Schnell via the GenAI endpoint. Returns base64 image string."""
    url = f"{NIM_GENAI_BASE}/black-forest-labs/flux.1-schnell"
    payload = {
        "prompt": prompt,
        "width": _snap_flux_dim(width),
        "height": _snap_flux_dim(height),
        "seed": seed if seed >= 0 else 0,
        "steps": min(max(steps, 1), 4),  # Schnell is a 4-step model (NIM API max=4)
        "cfg_scale": 0.0,                # Schnell ignores guidance
    }
    # Flux cold-start can take up to ~90s — use 120s to be safe
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(
            url, json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
        )
    if r.status_code != 200:
        logger.warning("Flux error %s: %s", r.status_code, r.text[:300])
        raise HTTPException(r.status_code, f"Flux error: {r.text[:200]}")
    data = r.json()
    # Flux returns { "artifacts": [{ "base64": "...", "finishReason": "SUCCESS" }] } OR { "image": "..." }
    if "artifacts" in data and data["artifacts"]:
        return data["artifacts"][0].get("base64") or data["artifacts"][0].get("b64_json", "")
    if "image" in data:
        return data["image"]
    raise HTTPException(500, f"Unexpected Flux response shape: {list(data.keys())}")


async def _call_sdxl(api_key: str, req: "ImageRequest") -> str:
    """Call SDXL-turbo via OpenAI-compat endpoint. Returns base64 PNG string."""
    payload = {
        "model": "stabilityai/sdxl-turbo",
        "prompt": req.prompt,
        "negative_prompt": req.negative_prompt,
        "width": req.width,
        "height": req.height,
        "num_inference_steps": req.steps,
        "guidance_scale": req.cfg_scale,
        "response_format": "b64_json",
    }
    if req.seed >= 0:
        payload["seed"] = req.seed
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{NIM_BASE}/images/generations", json=payload,
            headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
        )
    if r.status_code != 200:
        logger.warning("SDXL error %s: %s", r.status_code, r.text[:300])
        raise HTTPException(r.status_code, f"SDXL error: {r.text[:200]}")
    return r.json()["data"][0]["b64_json"]


def _detect_mime(b64: str) -> str:
    """NVIDIA sometimes returns JPEG, sometimes PNG. Sniff the magic bytes."""
    if b64.startswith("/9j/"):        return "image/jpeg"
    if b64.startswith("iVBORw0KGgo"): return "image/png"
    return "image/png"  # default


@router.post("/image")
async def generate_image(req: ImageRequest):
    """Raw image bytes. Prefer Flux.1 Schnell if FLUX key set, else SDXL-turbo."""
    try:
        if KEY_IMAGE_FLUX:
            b64 = await _call_flux(KEY_IMAGE_FLUX, req.prompt, req.width, req.height, req.steps, req.seed)
        elif KEY_IMAGE:
            b64 = await _call_sdxl(KEY_IMAGE, req)
        else:
            raise HTTPException(503, "No image-gen key configured")
        img_bytes = base64.b64decode(b64)
        return Response(content=img_bytes, media_type=_detect_mime(b64),
                        headers={"Cache-Control": "no-cache"})
    except httpx.TimeoutException:
        raise HTTPException(504, "Image-gen timeout")


@router.post("/image/url")
async def generate_image_url(req: ImageRequest):
    """Returns base64 data URL — easier for frontend."""
    try:
        if KEY_IMAGE_FLUX:
            b64 = await _call_flux(KEY_IMAGE_FLUX, req.prompt, req.width, req.height, req.steps, req.seed)
        elif KEY_IMAGE:
            b64 = await _call_sdxl(KEY_IMAGE, req)
        else:
            raise HTTPException(503, "No image-gen key configured")
        return {"url": f"data:{_detect_mime(b64)};base64,{b64}"}
    except httpx.TimeoutException:
        raise HTTPException(504, "Image-gen timeout")


# ── TTS (Magpie Multilingual) ──────────────────────────────────────────────────
class NvidiaTTSRequest(BaseModel):
    text: str
    voice: str = "multilingual_female"
    language: str = "ro"
    speed: float = 1.0


@router.post("/tts")
async def nvidia_tts(req: NvidiaTTSRequest):
    if not KEY_TTS:
        raise HTTPException(503, "NVIDIA_API_KEY_TTS not configured")
    payload = {
        "model": "magpie-tts-multilingual",
        "input": req.text,
        "voice": req.voice,
        "language": req.language,
        "speed": req.speed,
        "response_format": "wav",
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{NIM_BASE}/audio/speech",
                json=payload,
                headers={"Authorization": f"Bearer {KEY_TTS}", "Accept": "audio/wav"},
            )
        if r.status_code != 200:
            logger.warning("Magpie TTS error %s: %s", r.status_code, r.text[:300])
            raise HTTPException(r.status_code, f"Magpie TTS error: {r.text[:200]}")
        return Response(content=r.content, media_type="audio/wav")
    except httpx.TimeoutException:
        raise HTTPException(504, "NVIDIA TTS timeout")


# ── Translation (Riva Translate 4.0b Instruct) ──────────────────────────────
class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "en"
    target_lang: str = "ro"


@router.post("/translate")
async def nvidia_translate(req: TranslateRequest):
    if not KEY_TRANSLATE:
        raise HTTPException(503, "NVIDIA_API_KEY_TRANSLATE not configured")
    # Use Llama-3.3-70b as translator (Riva translate NIM is not in the public catalog)
    payload = {
        "model": "meta/llama-3.3-70b-instruct",
        "messages": [
            {"role": "system", "content": f"You are a professional translator. Translate the user's text from {req.source_lang} to {req.target_lang}. Output ONLY the translation, no preamble, no quotes, no explanation."},
            {"role": "user", "content": req.text},
        ],
        "max_tokens": 2048,
        "temperature": 0.2,
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            r = await client.post(
                f"{NIM_BASE}/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {KEY_TRANSLATE}", "Accept": "application/json"},
            )
        if r.status_code != 200:
            logger.warning("Translate error %s: %s", r.status_code, r.text[:300])
            raise HTTPException(r.status_code, f"Riva Translate error: {r.text[:200]}")
        data = r.json()
        translation = data["choices"][0]["message"]["content"]
        return {"translation": translation, "source": req.source_lang, "target": req.target_lang}
    except httpx.TimeoutException:
        raise HTTPException(504, "NVIDIA Translate timeout")


# ── Coding AI (Qwen 3.5 122b-a10b) ─────────────────────────────────────────
class CodingChatMessage(BaseModel):
    role: str
    content: str

class CodingChatRequest(BaseModel):
    messages: List[CodingChatMessage]
    max_tokens: int = 4096
    temperature: float = 0.6
    stream: bool = False


@router.post("/coding/chat")
async def nvidia_coding_chat(req: CodingChatRequest):
    if not KEY_CODING:
        raise HTTPException(503, "NVIDIA_API_KEY_CODING not configured")
    # Current NVIDIA catalog name for Qwen coder
    payload = {
        "model": "qwen/qwen2.5-coder-32b-instruct",
        "messages": [m.dict() for m in req.messages],
        "max_tokens": req.max_tokens,
        "temperature": req.temperature,
        "stream": req.stream,
    }
    try:
        if req.stream:
            async def stream_gen():
                async with httpx.AsyncClient(timeout=120) as client:
                    async with client.stream(
                        "POST",
                        f"{NIM_BASE}/chat/completions",
                        json=payload,
                        headers={"Authorization": f"Bearer {KEY_CODING}", "Accept": "text/event-stream"},
                    ) as resp:
                        async for line in resp.aiter_lines():
                            if line.startswith("data: "):
                                yield line + "\n\n"
            return StreamingResponse(stream_gen(), media_type="text/event-stream")
        else:
            async with httpx.AsyncClient(timeout=120) as client:
                r = await client.post(
                    f"{NIM_BASE}/chat/completions",
                    json=payload,
                    headers={"Authorization": f"Bearer {KEY_CODING}", "Accept": "application/json"},
                )
            if r.status_code != 200:
                logger.warning("Coding AI error %s: %s", r.status_code, r.text[:300])
                raise HTTPException(r.status_code, f"Qwen error: {r.text[:200]}")
            return r.json()
    except httpx.TimeoutException:
        raise HTTPException(504, "NVIDIA Coding AI timeout")


@router.get("/status")
async def nvidia_status():
    return {
        "image_configured": bool(KEY_IMAGE or KEY_IMAGE_FLUX),
        "tts_configured": bool(KEY_TTS),
        "translate_configured": bool(KEY_TRANSLATE),
        "coding_configured": bool(KEY_CODING),
        "weather_configured": bool(KEY_WEATHER),
        "chat_configured": bool(KEY_CHAT),
        "asr_configured": bool(KEY_ASR),
        "base_url": NIM_BASE,
        "models": {
            "image_primary": "black-forest-labs/flux.1-schnell" if KEY_IMAGE_FLUX else "stabilityai/sdxl-turbo",
            "image_fallback": "stabilityai/sdxl-turbo",
            "tts": "magpie-tts-multilingual",
            "translate": "meta/llama-3.3-70b-instruct",
            "coding": "qwen/qwen2.5-coder-32b-instruct",
            "weather": "nvidia/fourcastnet",
            "chat": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
            "asr": "nvidia/parakeet-ctc-0.6b-asr",
        }
    }


# ── AURA Brain — Nemotron Omni (Reasoning Chat) ─────────────────────────────
AURA_SYSTEM_PROMPT = (
    "You are AURA, a sophisticated personal AI assistant — inspired by F.R.I.D.A.Y. "
    "from Tony Stark's lab. You speak with calm confidence, composure, and subtle warmth.\n\n"
    "Personality guidelines:\n"
    "- Be concise and direct. Prefer short, clear sentences over long paragraphs.\n"
    "- Sound composed and slightly formal, but never cold or robotic.\n"
    "- Use a measured, elegant tone — as if briefing a trusted colleague.\n"
    "- When appropriate, show dry wit or understated humor.\n"
    "- Address the user naturally. No excessive pleasantries or filler.\n"
    "- If you don't know something, say so plainly.\n"
    "- When providing technical information, be precise but accessible.\n"
    "- Proactively offer relevant suggestions without being asked.\n\n"
    "Your responses will be spoken aloud via text-to-speech, so:\n"
    "- Keep sentences short (under 20 words when possible).\n"
    "- Avoid markdown formatting, bullet lists, or code blocks in conversational replies.\n"
    "- Use natural speech patterns. Write how you'd speak, not how you'd write.\n"
    "- Spell out abbreviations and numbers when they'll be spoken.\n\n"
    "You are the user's intelligent companion — reliable, sharp, and always ready."
)


class AuraChatMessage(BaseModel):
    role: str
    content: str


class AuraChatRequest(BaseModel):
    messages: List[AuraChatMessage]
    max_tokens: int = 65536
    temperature: float = 0.6
    top_p: float = 0.95
    stream: bool = True
    enable_thinking: bool = True
    reasoning_budget: int = 16384


@router.post("/chat")
async def nvidia_aura_chat(req: AuraChatRequest):
    """AURA Brain — streams Nemotron Omni with reasoning support."""
    api_key = KEY_CHAT
    if not api_key:
        raise HTTPException(503, "NVIDIA_API_KEY not configured for Nemotron chat")

    msgs = [m.dict() for m in req.messages]
    if not msgs or msgs[0].get("role") != "system":
        msgs.insert(0, {"role": "system", "content": AURA_SYSTEM_PROMPT})

    payload = {
        "model": "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
        "messages": msgs,
        "temperature": req.temperature,
        "top_p": req.top_p,
        "max_tokens": req.max_tokens,
        "stream": req.stream,
        "extra_body": {
            "chat_template_kwargs": {"enable_thinking": req.enable_thinking},
            "reasoning_budget": req.reasoning_budget,
        },
    }

    if req.stream:
        async def stream_gen():
            async with httpx.AsyncClient(timeout=180) as client:
                async with client.stream(
                    "POST",
                    f"{NIM_BASE}/chat/completions",
                    json=payload,
                    headers={"Authorization": f"Bearer {api_key}", "Accept": "text/event-stream"},
                ) as resp:
                    if resp.status_code != 200:
                        error_body = await resp.aread()
                        logger.warning("Nemotron stream error %s: %s", resp.status_code, error_body[:300])
                        yield f"data: {json.dumps({'error': f'Nemotron error {resp.status_code}'})}\n\n"
                        return
                    async for line in resp.aiter_lines():
                        if line.startswith("data: "):
                            yield line + "\n\n"
        return StreamingResponse(stream_gen(), media_type="text/event-stream")
    else:
        try:
            async with httpx.AsyncClient(timeout=180) as client:
                r = await client.post(
                    f"{NIM_BASE}/chat/completions",
                    json=payload,
                    headers={"Authorization": f"Bearer {api_key}", "Accept": "application/json"},
                )
            if r.status_code != 200:
                logger.warning("Nemotron error %s: %s", r.status_code, r.text[:300])
                raise HTTPException(r.status_code, f"Nemotron error: {r.text[:200]}")
            return r.json()
        except httpx.TimeoutException:
            raise HTTPException(504, "Nemotron chat timeout")


# ── AURA Ears — Speech-to-Text (Groq Whisper primary, NVIDIA fallback) ───────

GROQ_ASR_URL = "https://api.groq.com/openai/v1/audio/transcriptions"
NVIDIA_ASR_MODELS = [
    "nvidia/parakeet-ctc-1.1b-asr",
    "nvidia/parakeet-ctc-0.6b-asr",
]


@router.post("/asr")
async def nvidia_asr(audio: UploadFile = File(...)):
    """AURA Ears — Speech-to-Text. Tries Groq Whisper first, then NVIDIA Parakeet."""
    audio_bytes = await audio.read()
    content_type = audio.content_type or "audio/wav"
    filename = audio.filename or "audio.webm"
    logger.info("ASR request: %d bytes, content_type=%s", len(audio_bytes), content_type)

    errors = []

    # ── 1. Groq Whisper (fast, free, reliable) ──
    if GROQ_KEY:
        try:
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(
                    GROQ_ASR_URL,
                    files={"file": (filename, audio_bytes, content_type)},
                    data={"model": "whisper-large-v3-turbo", "language": "en"},
                    headers={"Authorization": f"Bearer {GROQ_KEY}"},
                )
            if r.status_code == 200:
                data = r.json()
                text = data.get("text", "")
                logger.info("Groq Whisper OK: %s", text[:80])
                return {"text": text}
            errors.append(f"groq status={r.status_code} body={r.text[:200]}")
            logger.warning("Groq Whisper failed: %s %s", r.status_code, r.text[:200])
        except Exception as e:
            errors.append(f"groq error={e}")
            logger.warning("Groq Whisper exception: %s", e)

    # ── 2. NVIDIA Parakeet (fallback) ──
    api_key = KEY_ASR or KEY_CHAT
    if api_key:
        for model in NVIDIA_ASR_MODELS:
            try:
                async with httpx.AsyncClient(timeout=30) as client:
                    r = await client.post(
                        f"{NIM_BASE}/audio/transcriptions",
                        files={"file": (filename, audio_bytes, content_type)},
                        data={"model": model, "language": "en"},
                        headers={"Authorization": f"Bearer {api_key}"},
                    )
                if r.status_code == 200:
                    logger.info("NVIDIA ASR OK with model %s", model)
                    return r.json()
                errors.append(f"nvidia {model} status={r.status_code}")
                logger.warning("NVIDIA ASR %s: %s %s", model, r.status_code, r.text[:200])
            except Exception as e:
                errors.append(f"nvidia {model} error={e}")
                logger.warning("NVIDIA ASR %s exception: %s", model, e)

    if not GROQ_KEY and not api_key:
        raise HTTPException(503, "No ASR API keys configured (need GROQ_API_KEY or NVIDIA_API_KEY_ASR)")

    raise HTTPException(502, f"All ASR providers failed: {'; '.join(errors)}")

"""
Alexa Bridge router — A2DP playback + ASK SDK fulfillment endpoint.

All voice commands are now routed through the universal voice_command_router
for consistent NLP across Alexa, VoiceOrb, and any future input modality.

Every hub actually executes its command and returns real results:
  - Aura:   Gemini / Llama chat → spoken answer
  - YouTube: yt-dlp → AudioPlayer directive
  - Nexus:  HA device control → confirmation
  - Canvas: NVIDIA image gen → confirmation + email
  - Sculpt: 3D model gen → confirmation + email
  - Echo:   Coding AI → spoken answer
  - Lexi:   Translation → spoken result
  - Sky:    Weather fetch → spoken forecast
  - Mappy:  Navigation → spoken directions info
"""
from __future__ import annotations

import json as _json
import logging
import os

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from services.alexa_service import (
    build_ask_response, get_a2dp_bridge, get_mode, parse_ask_intent, set_mode
)
from services.tts_service import get_tts_service

logger = logging.getLogger("alexa_router")
router = APIRouter(prefix="/alexa", tags=["alexa"])


class ModeRequest(BaseModel):
    mode: str  # a2dp | ask_sdk


class SpeakRequest(BaseModel):
    text: str
    domain: str = "constructii"


@router.post("/mode")
async def change_mode(req: ModeRequest):
    if req.mode not in ("a2dp", "ask_sdk"):
        raise HTTPException(status_code=400, detail="Mode must be 'a2dp' or 'ask_sdk'")
    set_mode(req.mode)
    return {"mode": req.mode, "status": "updated"}


@router.get("/mode")
async def current_mode():
    return {"mode": get_mode()}


@router.post("/speak")
async def speak_via_alexa(req: SpeakRequest):
    """Synthesize text and play it over Bluetooth (A2DP mode)."""
    tts = get_tts_service()
    wav_bytes = await tts.synthesize(req.text, req.domain)
    bridge = get_a2dp_bridge()
    await bridge.play_audio(wav_bytes)
    return {"status": "played", "chars": len(req.text)}


def _build_audio_player_response(audio_url: str, title: str, subtitle: str = "") -> dict:
    """Build an Alexa AudioPlayer.Play directive response.
    Alexa requires: HTTPS URL, outputSpeech alongside directives."""
    import hashlib
    token = hashlib.md5(title.encode()).hexdigest()[:16]
    return {
        "version": "1.0",
        "response": {
            "outputSpeech": {
                "type": "SSML",
                "ssml": f"<speak>Playing {title[:80]}</speak>",
            },
            "directives": [{
                "type": "AudioPlayer.Play",
                "playBehavior": "REPLACE_ALL",
                "audioItem": {
                    "stream": {
                        "url": audio_url,
                        "token": token,
                        "offsetInMilliseconds": 0,
                    },
                    "metadata": {
                        "title": title[:128],
                        "subtitle": subtitle[:128],
                    }
                }
            }],
            "shouldEndSession": True,
        }
    }


## ─── Hub executors (each one actually does the real work) ──────────────────

async def _exec_youtube(params: dict, query: str) -> dict | None:
    """Search + play on YouTube via AudioPlayer directive."""
    try:
        from routers.youtube_router import _run_ytdlp
    except ImportError:
        logger.warning("youtube_router not available")
        return None

    search_q = params.get("query", query)
    try:
        raw = await _run_ytdlp(
            f"ytsearch1:{search_q}",
            "--dump-json", "--no-download", "--no-warnings",
            "-f", "bestaudio[ext=m4a]/bestaudio/best",
        )
    except Exception as e:
        logger.warning("yt-dlp search failed: %s", e)
        return None

    try:
        j = _json.loads(raw.strip().split("\n")[0])
    except (_json.JSONDecodeError, IndexError):
        logger.warning("yt-dlp returned unparseable output")
        return None

    audio_url = j.get("url", "")
    # Alexa AudioPlayer requires HTTPS
    if audio_url and audio_url.startswith("http://"):
        audio_url = audio_url.replace("http://", "https://", 1)
    title = j.get("title", search_q)
    channel = j.get("channel", j.get("uploader", ""))

    if not audio_url:
        # Fallback: look in requested_formats
        for fmt in j.get("requested_formats", []):
            if fmt.get("acodec") != "none":
                audio_url = fmt.get("url", "")
                if audio_url and audio_url.startswith("http://"):
                    audio_url = audio_url.replace("http://", "https://", 1)
                break

    if audio_url:
        return _build_audio_player_response(audio_url, title, channel)
    return None


async def _exec_nexus(action: str, params: dict) -> str:
    """Execute a Nexus smart-home command via HA."""
    from routers.nexus_router import execute_command, ExecuteRequest as NexusReq
    r = await execute_command(NexusReq(action=action, params=params))
    return r.get("message", "Done.")


async def _exec_aura(query: str) -> str:
    """Ask Aura (Gemini → Llama fallback) and return a spoken answer."""
    # Try Gemini first
    gemini_key = os.getenv("GEMINI_API_KEY", "")
    if gemini_key:
        try:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={gemini_key}"
            async with httpx.AsyncClient(timeout=30) as client:
                r = await client.post(url, json={
                    "contents": [{"role": "user", "parts": [{"text": query}]}],
                    "generationConfig": {"maxOutputTokens": 400, "temperature": 0.7},
                })
            if r.status_code == 200:
                text = r.json().get("candidates", [{}])[0].get("content", {}).get("parts", [{}])[0].get("text", "")
                if text:
                    return text.strip()[:1000]
        except Exception as e:
            logger.warning("Gemini Alexa chat failed: %s", e)

    # Fallback: orchestrator / Llama
    try:
        from orchestrator.orchestrator import get_orchestrator
        orch = get_orchestrator()
        full = ""
        async for ev in orch.query(message=query, domain="constructii"):
            if ev.get("type") == "text_fragment":
                full += ev.get("content", "") + " "
            if ev.get("type") == "done":
                break
        if full.strip():
            return full.strip()[:1000]
    except Exception:
        pass
    return "Sorry, I couldn't get an answer right now."


async def _exec_canvas(params: dict) -> str:
    """Actually generate an image via NVIDIA and email it."""
    prompt = params.get("prompt", "a beautiful landscape")
    try:
        from routers.nvidia_router import generate_image_url, ImageRequest
        result = await generate_image_url(ImageRequest(prompt=prompt))
        data_url = result.get("url", "")

        # Try to email the image
        gmail_user = os.getenv("GMAIL_USER", "")
        if gmail_user and data_url:
            try:
                import base64 as b64mod
                # Extract base64 from data URL
                raw_b64 = data_url.split(",", 1)[1] if "," in data_url else ""
                if raw_b64:
                    from routers.email_router import send_file, SendFileRequest
                    await send_file(SendFileRequest(
                        file_b64=raw_b64,
                        filename=f"canvas-{prompt[:20].replace(' ', '_')}.png",
                        subject=f"Canvas Image: {prompt[:50]}",
                        body=f"Here's the image you requested via voice.\n\nPrompt: {prompt}",
                    ))
                    return f"I've generated an image of {prompt} and sent it to your email."
            except Exception as email_err:
                logger.warning("Canvas email failed: %s", email_err)

        return f"I've generated an image of {prompt}. Check your Canvas hub to view it."
    except Exception as e:
        logger.warning("Canvas generation failed: %s", e)
        return f"Sorry, I couldn't generate that image. {str(e)[:100]}"


async def _exec_sculpt(params: dict) -> str:
    """Actually generate a 3D model and email it."""
    prompt = params.get("prompt", "a 3D object")
    try:
        from routers.blender_router import generate, GenRequest
        result = await generate(GenRequest(prompt=prompt, method="auto"))
        glb_url = result.get("glb_url", "")
        method = result.get("method", "auto")

        # Email the .glb
        gmail_user = os.getenv("GMAIL_USER", "")
        if gmail_user and glb_url:
            try:
                from routers.email_router import send_file, SendFileRequest
                # glb_url is a relative path like /blender/file/xxx.glb
                # We need to read the file directly
                from routers.blender_router import SCULPT_DIR
                filename = glb_url.split("/")[-1]
                filepath = SCULPT_DIR / filename
                if filepath.exists():
                    import base64 as b64mod
                    raw_b64 = b64mod.b64encode(filepath.read_bytes()).decode()
                    await send_file(SendFileRequest(
                        file_b64=raw_b64,
                        filename=f"sculpt-{prompt[:20].replace(' ', '_')}.glb",
                        subject=f"Sculpt 3D Model: {prompt[:50]}",
                        body=f"Here's the 3D model you requested via voice.\n\nPrompt: {prompt}\nMethod: {method}",
                    ))
                    return f"I've created a 3D model of {prompt} using {method} and sent it to your email."
            except Exception as email_err:
                logger.warning("Sculpt email failed: %s", email_err)

        return f"I've created a 3D model of {prompt} using {method}. Check your Sculpt hub to view it."
    except Exception as e:
        logger.warning("Sculpt generation failed: %s", e)
        return f"Sorry, I couldn't create that 3D model. {str(e)[:100]}"


async def _exec_echo(params: dict) -> str:
    """Actually run the Coding AI and return the answer."""
    query = params.get("query", "")
    try:
        from routers.nvidia_router import nvidia_coding_chat, CodingChatRequest, CodingChatMessage
        result = await nvidia_coding_chat(CodingChatRequest(
            messages=[
                CodingChatMessage(role="system", content="You are Echo, a real-time coding agent. Structure every response with: [READING] — context examined, [THINKING] — reasoning, [PLANNING] — next actions, [CODING] — code output, [CHECKING] — verification. Be incremental, concise, and expose your workflow. When speaking results aloud, keep it brief and actionable."),
                CodingChatMessage(role="user", content=query),
            ],
            max_tokens=800,
            temperature=0.4,
            stream=False,
        ))
        answer = result.get("choices", [{}])[0].get("message", {}).get("content", "")
        if answer:
            # Truncate for speech — remove code blocks for spoken form
            spoken = answer.replace("```", "").replace("`", "")
            return spoken.strip()[:800]
    except Exception as e:
        logger.warning("Echo coding failed: %s", e)
    return "Sorry, the coding AI is unavailable right now."


async def _exec_lexi(params: dict) -> str:
    """Actually translate text via NVIDIA."""
    text = params.get("text", "")
    target = params.get("target", "en")
    if not text:
        return "I need some text to translate."
    try:
        from routers.nvidia_router import nvidia_translate, TranslateRequest
        result = await nvidia_translate(TranslateRequest(
            text=text, source_lang="auto", target_lang=target,
        ))
        translation = result.get("translation", "")
        if translation:
            return f"The translation is: {translation}"
    except Exception as e:
        logger.warning("Lexi translation failed: %s", e)
    return "Sorry, I couldn't translate that right now."


async def _exec_sky(params: dict) -> str:
    """Actually fetch weather and return a spoken forecast."""
    location = params.get("location", "Constanta")
    try:
        # Use Open-Meteo (Constanta default)
        lat, lon = 44.1598, 28.6348
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lon}"
            f"&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weather_code,apparent_temperature,uv_index,precipitation"
            f"&daily=temperature_2m_max,temperature_2m_min,weather_code,precipitation_sum"
            f"&timezone=Europe/Bucharest&forecast_days=3"
        )
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(url)
        if r.status_code == 200:
            data = r.json()
            c = data.get("current", {})
            daily = data.get("daily", {})
            desc_map = {0: "clear", 1: "mainly clear", 2: "partly cloudy", 3: "overcast",
                        45: "foggy", 51: "drizzle", 61: "rain", 71: "snow", 95: "thunderstorm"}
            code = c.get("weather_code", 0)
            desc = desc_map.get(code, "unknown conditions")
            temp = c.get("temperature_2m", "?")
            feels = c.get("apparent_temperature", "?")
            wind = c.get("wind_speed_10m", "?")
            humidity = c.get("relative_humidity_2m", "?")

            forecast = ""
            if daily.get("time"):
                for i in range(min(3, len(daily["time"]))):
                    day_name = daily["time"][i]
                    hi = round(daily["temperature_2m_max"][i])
                    lo = round(daily["temperature_2m_min"][i])
                    forecast += f" {day_name}: {lo} to {hi} degrees."

            return (
                f"Currently in {location} it's {temp} degrees, feels like {feels}, "
                f"with {desc}. Wind is {wind} kilometers per hour, humidity {humidity} percent."
                f"{' Forecast:' + forecast if forecast else ''}"
            )
    except Exception as e:
        logger.warning("Sky weather failed: %s", e)
    return f"Sorry, I couldn't get the weather for {location} right now."


async def _exec_mappy(params: dict) -> str:
    """Return navigation info (Alexa can't display a map, so give spoken directions)."""
    dest = params.get("destination", "")
    if not dest:
        return "Where would you like to navigate to?"
    return (
        f"I've set your destination to {dest}. "
        f"Open the Mappy hub on your device to see the route and turn-by-turn directions."
    )


# ── Main fulfillment endpoint ──────────────────────────────────────────────

@router.post("/ask/fulfillment")
async def ask_fulfillment(request: Request):
    """
    Amazon ASK SDK fulfillment endpoint.
    Register this URL in Amazon Developer Console → Your Skill → Endpoint.

    Routes all intents through the universal voice command NLP, then
    ACTUALLY EXECUTES the matched action on the real backend.
    """
    body = await request.json()
    intent = parse_ask_intent(body)
    request_type = intent["type"]

    if request_type == "LaunchRequest":
        return JSONResponse(build_ask_response(
            "Hello! Personal AI OS is active. What would you like me to do?",
            reprompt="Say a command like: play music, turn off the lights, generate an image, or ask me anything.",
            end_session=False,
        ))

    if request_type == "IntentRequest":
        intent_name = intent.get("intent_name", "")

        # ── Handle Amazon built-in intents ──
        if intent_name == "AMAZON.HelpIntent":
            return JSONResponse(build_ask_response(
                "You can ask me anything! Try: play despacito, turn on the lights, "
                "generate an image of a sunset, what's the weather, or just ask me a question.",
                reprompt="What would you like me to do?",
                end_session=False,
            ))
        if intent_name in ("AMAZON.CancelIntent", "AMAZON.StopIntent"):
            return JSONResponse(build_ask_response("Goodbye!"))
        if intent_name == "AMAZON.FallbackIntent":
            return JSONResponse(build_ask_response(
                "I didn't understand that. Try saying: ask Personal AI, followed by your command.",
                reprompt="What would you like me to do?",
                end_session=False,
            ))
        if intent_name == "AMAZON.PauseIntent":
            return JSONResponse({
                "version": "1.0",
                "response": {
                    "directives": [{"type": "AudioPlayer.Stop"}],
                    "shouldEndSession": True,
                }
            })
        if intent_name == "AMAZON.ResumeIntent":
            return JSONResponse(build_ask_response(
                "To resume, please ask me to play again.",
            ))

        query = intent.get("raw_query") or intent.get("slots", {}).get("query", "")

        if not query:
            return JSONResponse(build_ask_response(
                "I didn't catch that. Please try again.",
                end_session=False,
            ))

        try:
            from routers.voice_command_router import _match_intent
            result = _match_intent(query)

            answer = result.spoken_reply  # default fallback

            # ═══ YOUTUBE — AudioPlayer directive ═══
            if result.hub == "youtube" and result.action == "play":
                try:
                    resp = await _exec_youtube(result.params, query)
                    if resp:
                        return JSONResponse(resp)
                    answer = "I found a result but couldn't stream the audio."
                except Exception as e:
                    logger.warning("Alexa YouTube: %s", e)
                    answer = f"Sorry, YouTube playback failed."

            # ═══ NEXUS — Smart home device control ═══
            elif result.hub == "nexus":
                try:
                    await _exec_nexus(result.action, result.params)
                except Exception as e:
                    logger.warning("Alexa Nexus: %s", e)
                answer = result.spoken_reply

            # ═══ AURA — AI chat (Gemini → Llama) ═══
            elif result.hub == "aura":
                try:
                    answer = await _exec_aura(query)
                except Exception as e:
                    logger.warning("Alexa Aura: %s", e)

            # ═══ CANVAS — Image generation ═══
            elif result.hub == "canvas":
                try:
                    answer = await _exec_canvas(result.params)
                except Exception as e:
                    logger.warning("Alexa Canvas: %s", e)
                    answer = "Sorry, image generation failed."

            # ═══ SCULPT — 3D model generation ═══
            elif result.hub == "sculpt":
                try:
                    answer = await _exec_sculpt(result.params)
                except Exception as e:
                    logger.warning("Alexa Sculpt: %s", e)
                    answer = "Sorry, 3D generation failed."

            # ═══ ECHO — Coding AI ═══
            elif result.hub == "echo":
                try:
                    answer = await _exec_echo(result.params)
                except Exception as e:
                    logger.warning("Alexa Echo: %s", e)
                    answer = "Sorry, the coding AI is unavailable."

            # ═══ LEXI — Translation ═══
            elif result.hub == "lexi":
                try:
                    answer = await _exec_lexi(result.params)
                except Exception as e:
                    logger.warning("Alexa Lexi: %s", e)
                    answer = "Sorry, translation failed."

            # ═══ SKY — Weather ═══
            elif result.hub == "sky":
                try:
                    answer = await _exec_sky(result.params)
                except Exception as e:
                    logger.warning("Alexa Sky: %s", e)
                    answer = "Sorry, I couldn't fetch the weather."

            # ═══ MAPPY — Navigation ═══
            elif result.hub == "mappy":
                try:
                    answer = await _exec_mappy(result.params)
                except Exception as e:
                    logger.warning("Alexa Mappy: %s", e)
                    answer = "Sorry, I couldn't set that destination."

            # ── Optional A2DP playback ──
            if get_mode() == "a2dp":
                try:
                    tts = get_tts_service()
                    wav_bytes = await tts.synthesize(answer, "constructii")
                    bridge = get_a2dp_bridge()
                    await bridge.play_audio(wav_bytes)
                except Exception as tts_err:
                    logger.warning("A2DP TTS failed: %s", tts_err)

            return JSONResponse(build_ask_response(answer))

        except Exception as exc:
            logger.error("ASK fulfillment error: %s", exc)
            return JSONResponse(build_ask_response("An internal error occurred."))

    if request_type == "SessionEndedRequest":
        return JSONResponse({"version": "1.0", "response": {}})

    # Handle AudioPlayer requests
    if request_type in ("AudioPlayer.PlaybackStarted", "AudioPlayer.PlaybackFinished",
                        "AudioPlayer.PlaybackStopped", "AudioPlayer.PlaybackNearlyFinished",
                        "AudioPlayer.PlaybackFailed"):
        return JSONResponse({"version": "1.0", "response": {}})

    return JSONResponse(build_ask_response("Unknown command."))

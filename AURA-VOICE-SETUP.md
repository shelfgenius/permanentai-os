# AURA Voice Pipeline — Setup Guide

## Architecture

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│  Microphone  │────▶│  Parakeet STT    │────▶│  Nemotron Omni   │
│  (browser)   │     │  (local Docker)  │     │  (cloud NIM)     │
│              │     │  ~200-400ms      │     │  ~500-1500ms     │
└──────────────┘     └──────────────────┘     └────────┬─────────┘
                                                       │
┌──────────────┐     ┌──────────────────┐              │
│  Speaker     │◀────│  Magpie TTS      │◀─────────────┘
│  (browser)   │     │  (local Docker)  │
│              │     │  ~300-800ms      │
└──────────────┘     └──────────────────┘

Total latency: ~1-2.7 seconds end-to-end
Voice: Irish female, calm, higher-pitched (zero-shot cloned)
```

## Prerequisites

- **Docker Desktop** with NVIDIA Container Toolkit
- **NVIDIA GPU** — Ampere or newer (RTX 3060+ / A100 / etc.)
- **~13 GB VRAM** — Parakeet (5 GB) + Magpie (8 GB)
- **NGC API Key** — already in `.env` line 61

## Step 1 — Login to NGC

```bash
docker login nvcr.io -u '$oauthtoken' -p $(cat .env | grep NGC_API_KEY | cut -d= -f2)
```

Or on Windows PowerShell:
```powershell
$key = (Select-String -Path backend\.env -Pattern "NGC_API_KEY=(.+)" | % { $_.Matches.Groups[1].Value })
docker login nvcr.io -u '$oauthtoken' -p $key
```

## Step 2 — Prepare the Irish Voice Reference

Record a **5-10 second** audio clip of a calm, neutral, higher-pitched Irish female voice.

**Requirements:**
- Format: 16-bit mono WAV
- Sample rate: 22.05 kHz or higher
- Duration: 3-10 seconds (aim for ~5 seconds)
- Content: Clear speech, no background noise, consistent volume
- Trim silence from start/end

**Save it to:** `voices/aura_irish.wav`

**Tips:**
- Use Audacity to record and export as WAV (16-bit PCM, mono, 22050 Hz)
- Say something natural like: "Hello, I'm Aura, your intelligent assistant. How can I help you today?"
- Record in a quiet room, close to the microphone
- If you don't have a reference yet, the system uses the built-in `Magpie-ZeroShot.Female-Calm` voice

## Step 3 — Start the NIM Containers

```bash
cd retail-engine
docker compose -f docker-compose.aura.yml up -d
```

**First run** downloads ~13 GB of model data. Watch progress:
```bash
docker compose -f docker-compose.aura.yml logs -f
```

**Check readiness:**
```bash
curl http://localhost:9200/v1/health/ready   # Parakeet STT
curl http://localhost:9300/v1/health/ready   # Magpie TTS
```

## Step 4 — Verify via Backend Health Check

```bash
curl http://localhost:8000/aura/voice/health
```

Expected response when everything is running:
```json
{
  "pipeline": "ready",
  "parakeet": { "status": "online", "url": "http://localhost:9200" },
  "magpie": { "status": "online", "url": "http://localhost:9300" },
  "voice": {
    "irish_reference": "loaded",
    "default_builtin": "Magpie-ZeroShot.Female-Calm",
    "quality": 25
  }
}
```

## Step 5 — Test TTS Directly

```bash
# With Irish voice reference
curl -X POST http://localhost:8000/aura/voice/tts \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, I am Aura. How can I help you today?"}' \
  --output test_irish.wav

# With built-in Female-Calm voice
curl -X POST http://localhost:8000/aura/voice/tts/builtin \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello, I am Aura."}' \
  --output test_builtin.wav
```

## How It Works (Standby Mode)

1. **Aura starts in standby** — microphone is active, listening
2. **You speak** — audio is captured by the browser
3. **Parakeet STT** transcribes your speech (~200-400ms)
4. **Nemotron Omni** generates a response (~500-1500ms, streamed)
5. **Magpie TTS** speaks each sentence as it arrives (~300-800ms per sentence)
6. **After speaking**, Aura returns to standby and listens again

## Fallback Chain

If local containers aren't running, the system gracefully degrades:

| Component | Local (fast) | Cloud fallback | Last resort |
|-----------|-------------|----------------|-------------|
| **STT** | Parakeet 1.1b Docker | Cloud Parakeet 0.6b | — |
| **LLM** | — | Nemotron Omni (always cloud) | — |
| **TTS** | Magpie Zeroshot Docker | Cloud Magpie Multilingual → Kokoro → XTTS | Browser speechSynthesis |

## Available Built-in Voices

If you don't have an Irish reference WAV, these voices are available:

| Voice ID | Gender | Emotion |
|----------|--------|---------|
| `Magpie-ZeroShot.Female-1` | Female | Default |
| `Magpie-ZeroShot.Female-Calm` | Female | Calm ✓ |
| `Magpie-ZeroShot.Female-Neutral` | Female | Neutral |
| `Magpie-ZeroShot.Female-Happy` | Female | Happy |
| `Magpie-ZeroShot.Male-1` | Male | Default |
| `Magpie-ZeroShot.Male-Calm` | Male | Calm |

## Troubleshooting

- **Containers won't start:** Check `docker compose -f docker-compose.aura.yml logs`
- **Port conflict:** MinIO uses 9000, so NIM uses 9200/9300 instead
- **Out of VRAM:** Close other GPU apps. Parakeet needs ~5GB, Magpie ~8GB
- **Slow first response:** First-run downloads models (~13GB total). Subsequent starts use cached models.

# Kokoro TTS — Local Voice Engine for Aura

Free, high-quality, local text-to-speech using [Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) via [kokoro-fastapi](https://github.com/remsky/kokoro-fastapi).

## Quick Start

```bash
cd kokoro-tts
docker compose up -d
```

Server starts at **http://localhost:8880**

## API (OpenAI-compatible)

```bash
curl -X POST http://localhost:8880/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"input": "Hello, I am Aura.", "voice": "af_heart", "model": "kokoro", "response_format": "mp3"}' \
  --output test.mp3
```

## Available Voices

| Voice ID       | Description                    | Agent   |
|----------------|-------------------------------|---------|
| `af_heart`     | American Female — warm         | Aura    |
| `af_sky`       | American Female — smooth       | Sky     |
| `am_adam`      | American Male — deep           | Nexus   |
| `am_michael`   | American Male — warm           | Echo    |
| `bf_emma`      | British Female — elegant       | Mappy   |

## Endpoints

- `POST /v1/audio/speech` — OpenAI-compatible TTS
- `GET /v1/audio/voices` — List available voices
- `GET /health` — Health check

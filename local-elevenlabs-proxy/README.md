# ElevenLabs Local Proxy

Runs on your PC to bypass Render's flagged IP for ElevenLabs free tier.

## Quick Start

```bash
pip install fastapi uvicorn httpx python-multipart
python server.py
```

Server runs on `http://localhost:8765`.

## Expose via ngrok (for testing from phone)

```bash
ngrok http 8765
```

Use the ngrok URL as the backend URL in the frontend for ElevenLabs calls.

## Environment Variables (optional)

The API key and voice IDs are hardcoded as defaults but can be overridden:

```
ELEVENLABS_API_KEY=sk_...
ELEVENLABS_VOICE_EN=DvA6jVPzwhTAbLWwZd0K
ELEVENLABS_VOICE_RO=urzoE6aZYmSRdFQ6215h
```

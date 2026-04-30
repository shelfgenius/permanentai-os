---
title: AURA Voice - Irish Voice Clone
emoji: 🎙️
colorFrom: green
colorTo: blue
sdk: gradio
sdk_version: 4.44.0
app_file: app.py
pinned: true
license: apache-2.0
hardware: cpu-basic
---

# 🎙️ AURA Voice — Irish Female Voice Clone

Zero-shot voice cloning using **XTTS-v2** with an Irish female reference voice for the AURA AI assistant.

## API Usage

```python
from gradio_client import Client

client = Client("shelfgenius/aura-voice")
result = client.predict(
    text="Hello, I am Aura. How can I help you today?",
    language="en",
    api_name="/synthesize"
)
print(result)  # Path to generated WAV
```

## HTTP API

```bash
curl -X POST https://shelfgenius-aura-voice.hf.space/api/synthesize \
  -H "Content-Type: application/json" \
  -d '{"data": ["Hello, I am Aura.", "en"]}'
```

## Features
- **Zero-shot voice cloning** with Irish female reference
- **17 languages** supported
- **Free** on Hugging Face Spaces with ZeroGPU
- **API-ready** — integrates directly with AURA voice pipeline

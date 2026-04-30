"""
AURA Voice — XTTS-v2 Zero-Shot Voice Cloning API
Deployed on Hugging Face Spaces (ZeroGPU)

Endpoints:
  POST /api/tts         — Synthesize speech with Irish voice clone
  GET  /api/health      — Health check
  GET  /api/voices      — List available reference voices

Uses Coqui XTTS-v2 for zero-shot voice cloning with the Irish female
reference WAV baked into the Space.
"""

import os
import io
import tempfile
import logging
import numpy as np
import torch
import gradio as gr
import scipy.io.wavfile as wav_io

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("aura-xtts")

# ── Global model ──────────────────────────────────────────────────
MODEL = None
REFERENCE_WAV = os.path.join(os.path.dirname(__file__), "voices", "aura_irish.wav")


def load_model():
    """Load XTTS-v2 model (runs once on startup)."""
    global MODEL
    if MODEL is not None:
        return MODEL
    
    from TTS.tts.configs.xtts_config import XttsConfig
    from TTS.tts.models.xtts import Xtts

    logger.info("Loading XTTS-v2 model...")
    config = XttsConfig()
    config.load_json(os.path.join(
        os.path.dirname(__file__), "xtts_model", "config.json"
    ))
    
    MODEL = Xtts.init_from_config(config)
    MODEL.load_checkpoint(
        config,
        checkpoint_dir=os.path.join(os.path.dirname(__file__), "xtts_model"),
        use_deepspeed=False,
    )
    
    if torch.cuda.is_available():
        MODEL.cuda()
        logger.info("XTTS-v2 loaded on GPU")
    else:
        logger.info("XTTS-v2 loaded on CPU (slower)")
    
    return MODEL


def load_model_from_hub():
    """Alternative: load XTTS-v2 directly from TTS library."""
    global MODEL
    if MODEL is not None:
        return MODEL
    
    from TTS.api import TTS
    
    logger.info("Loading XTTS-v2 from TTS hub...")
    device = "cuda" if torch.cuda.is_available() else "cpu"
    MODEL = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
    logger.info(f"XTTS-v2 loaded on {device}")
    return MODEL


def synthesize(text: str, language: str = "en", reference_wav: str = None):
    """Synthesize speech with voice cloning."""
    ref = reference_wav or REFERENCE_WAV
    
    if not os.path.exists(ref):
        raise FileNotFoundError(f"Reference WAV not found: {ref}")
    
    tts = load_model_from_hub()
    
    # Generate speech
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        tts.tts_to_file(
            text=text,
            speaker_wav=ref,
            language=language,
            file_path=tmp.name,
        )
        return tmp.name


# ── Gradio API Interface ─────────────────────────────────────────

def tts_api(text: str, language: str = "en"):
    """Main TTS endpoint — returns audio file path."""
    if not text or not text.strip():
        return None
    
    try:
        wav_path = synthesize(text.strip(), language)
        return wav_path
    except Exception as e:
        logger.error(f"TTS error: {e}")
        raise gr.Error(f"TTS synthesis failed: {str(e)[:200]}")


def health_check():
    """Return health status."""
    gpu = "cuda" if torch.cuda.is_available() else "cpu"
    model_loaded = MODEL is not None
    return {
        "status": "ready" if model_loaded else "loading",
        "device": gpu,
        "model": "xtts_v2",
        "voice": "aura_irish",
    }


# ── Gradio App ───────────────────────────────────────────────────

with gr.Blocks(title="AURA Voice — XTTS-v2 Irish Voice Clone") as demo:
    gr.Markdown(
        """
        # 🎙️ AURA Voice — Irish Female Voice Clone
        Zero-shot voice cloning using XTTS-v2 with an Irish female reference voice.
        
        **API Usage:**
        ```python
        from gradio_client import Client
        client = Client("YOUR_SPACE_URL")
        result = client.predict(
            text="Hello, I am Aura.",
            language="en",
            api_name="/synthesize"
        )
        # result is the path to the generated WAV file
        ```
        """
    )
    
    with gr.Row():
        with gr.Column(scale=3):
            text_input = gr.Textbox(
                label="Text to speak",
                placeholder="Enter text for Aura to say...",
                lines=3,
                value="Hello! I'm Aura, your AI assistant. How can I help you today?",
            )
            lang_input = gr.Dropdown(
                label="Language",
                choices=["en", "es", "fr", "de", "it", "pt", "pl", "tr", "ru",
                         "nl", "cs", "ar", "zh-cn", "ja", "hu", "ko", "hi"],
                value="en",
            )
            submit_btn = gr.Button("🔊 Speak", variant="primary", size="lg")
        
        with gr.Column(scale=2):
            audio_output = gr.Audio(label="Generated Speech", type="filepath")
            status_output = gr.JSON(label="Status")
    
    submit_btn.click(
        fn=tts_api,
        inputs=[text_input, lang_input],
        outputs=audio_output,
        api_name="synthesize",
    )
    
    # Health check button
    health_btn = gr.Button("Check Status", size="sm")
    health_btn.click(fn=health_check, outputs=status_output, api_name="health")


if __name__ == "__main__":
    # Pre-load model on startup
    try:
        load_model_from_hub()
        logger.info("Model pre-loaded successfully")
    except Exception as e:
        logger.warning(f"Model pre-load failed (will retry on first request): {e}")
    
    demo.launch(server_name="0.0.0.0", server_port=7860)

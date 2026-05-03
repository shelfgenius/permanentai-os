"""
TechQuery — FastAPI Backend Entry Point

Starts the uvicorn server, registers all routers, and exposes health endpoints.
Spawned as a sidecar process by the Electron main process.
"""

import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

# Load .env INTO os.environ before importing any router that reads via os.getenv().
# (pydantic-settings reads .env into its own Settings object but does NOT export
# those vars into os.environ, so os.getenv() would return "" otherwise.)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), ".env"), override=False)
except ImportError:
    pass  # dotenv optional — pydantic-settings still reads .env for Settings

import asyncio
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from config import get_settings
from db.database import init_db

# Core routers — always loaded
from routers.tts_router import router as tts_router
from routers.nvidia_router import router as nvidia_router
from routers.gemini_router import router as gemini_router
from routers.youtube_router import router as youtube_router
from routers.voice_command_router import router as voice_command_router
from routers.pdf_router import router as pdf_router
from routers.email_router import router as email_router
from routers.nexus_router import router as nexus_router
from routers.social import router as social_router
from routers.alexa_router import router as alexa_router
from routers.edu_router import router as edu_router
from routers.auth_router import router as auth_router
from routers.blender_router import router as blender_router
from routers.sky_router import router as sky_router
from routers.slide_router import router as slide_router
from routers.aura_voice_router import router as aura_voice_router
from routers.elevenlabs_router import router as elevenlabs_router
from routers.echo_router import router as echo_router
from routers.geocode_router import router as geocode_router

# Optional routers — may fail on cloud if heavy deps (torch, chromadb) are missing
_optional_routers = {}
def _try_import(name, module_path, attr="router"):
    try:
        mod = __import__(module_path, fromlist=[attr])
        _optional_routers[name] = getattr(mod, attr)
    except Exception as e:
        logging.getLogger("techquery").warning("Skipping %s: %s", name, e)

_try_import("chat", "routers.chat", "router")
_try_import("search", "routers.search", "router")
_try_import("knowledge", "routers.knowledge_lite", "router")
_try_import("orchestrator", "routers.orchestrator_router", "router")
_try_import("scavenger", "routers.scavenger_router", "router")
_try_import("xtts", "routers.xtts_router", "router")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("techquery")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Starting TechQuery backend v%s", settings.app_version)
    try:
        await init_db()
        logger.info("Database initialised")
    except Exception as exc:
        logger.warning("DB init skipped (not connected): %s", exc)

    yield

    logger.info("Shutting down TechQuery backend")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="RAG-powered technical assistant backend",
    lifespan=lifespan,
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

app.add_middleware(GZipMiddleware, minimum_size=1000)
# CORS — use explicit allowlist instead of wildcard regex.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://permanentai-os.pages.dev",
        "https://aura-ai.live",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://localhost:5174",
    ] + settings.cors_origins,
    allow_origin_regex=r"https://[a-z0-9\-]+\.permanentai-os\.pages\.dev|https://[a-z0-9\-]+\.trycloudflare\.com",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Core routers
app.include_router(tts_router)
app.include_router(nvidia_router)
app.include_router(gemini_router)
app.include_router(youtube_router)
app.include_router(voice_command_router)
app.include_router(pdf_router)
app.include_router(email_router)
app.include_router(nexus_router)
app.include_router(social_router)
app.include_router(alexa_router)
app.include_router(edu_router)
app.include_router(auth_router)
app.include_router(blender_router)
app.include_router(sky_router)
app.include_router(slide_router)
app.include_router(aura_voice_router)
app.include_router(elevenlabs_router)
app.include_router(echo_router)
app.include_router(geocode_router)

# Optional routers (loaded only if deps available)
for name, r in _optional_routers.items():
    app.include_router(r)
    logger.info("Loaded optional router: %s", name)


@app.api_route("/health", methods=["GET", "HEAD"])
async def health():
    import httpx
    status = {"status": "ok", "version": settings.app_version}
    # Check Ollama if it's the provider
    if settings.llm_provider == "ollama":
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                r = await client.get(f"{settings.ollama_base_url}/api/version")
                status["ollama"] = "connected" if r.status_code == 200 else "disconnected"
        except Exception:
            status["ollama"] = "disconnected"
    else:
        status["llm_provider"] = settings.llm_provider
    return status


@app.get("/")
async def root():
    return {"name": settings.app_name, "version": settings.app_version}


if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 8000)),
        reload=False,
        log_level="info",
        access_log=False,
    )

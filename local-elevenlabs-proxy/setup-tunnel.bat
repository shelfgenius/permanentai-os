@echo off
title ElevenLabs TTS - Cloudflare Tunnel
color 0B
echo.
echo   ===================================
echo    ElevenLabs TTS + Cloudflare Tunnel
echo   ===================================
echo.
echo   Permanent URL: https://elevenlabs.aura-ai.live
echo.

cd /d "%~dp0"

:: Check Python
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found.
    pause
    exit /b 1
)

:: Install deps if needed
python -c "import uvicorn, httpx, fastapi" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [INFO] Installing dependencies...
    pip install fastapi uvicorn httpx python-multipart
    echo.
)

echo   Step 1: Starting ElevenLabs proxy on port 8766...
start "ElevenLabs Proxy" cmd /c "python server.py"
timeout /t 3 /nobreak >nul

echo   Step 2: Starting Cloudflare Tunnel (permanent)...
echo.
echo   Render env var:
echo     ELEVENLABS_PROXY_URL = https://elevenlabs.aura-ai.live/elevenlabs
echo.
echo   ─────────────────────────────────────────────
echo.
cloudflared tunnel --config "%USERPROFILE%\.cloudflared\elevenlabs-config.yml" run elevenlabs-tts
pause

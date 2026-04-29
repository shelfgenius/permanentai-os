@echo off
title Aura YT Background Server
echo.
echo   ╔══════════════════════════════════════╗
echo   ║   Aura YouTube Background Server     ║
echo   ║   yt.aura-ai.live                    ║
echo   ╚══════════════════════════════════════╝
echo.

:: Kill any existing process on port 8765
echo   Checking for stale server on port 8765...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr :8765 ^| findstr LISTENING 2^>nul') do (
    echo   Killing old server PID %%a...
    taskkill /F /PID %%a >nul 2>&1
    timeout /t 1 /nobreak >nul
)

echo   Starting local yt-dlp server...
start /B python "%~dp0server.py"
timeout /t 3 /nobreak >nul
echo   Starting Cloudflare tunnel...
echo.
cloudflared tunnel run yt-local

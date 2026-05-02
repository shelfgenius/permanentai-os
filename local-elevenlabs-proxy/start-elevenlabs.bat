@echo off
title ElevenLabs Local Proxy
color 0A
echo.
echo   ===================================
echo    ElevenLabs TTS Local Proxy
echo   ===================================
echo.
echo   Starting on http://localhost:8765
echo   Press Ctrl+C to stop
echo.

cd /d "%~dp0"

:: Check if Python is available
where python >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [ERROR] Python not found. Install Python 3.10+ first.
    pause
    exit /b 1
)

:: Install deps if needed (first run only)
python -c "import uvicorn, httpx, fastapi" >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [INFO] Installing dependencies...
    pip install fastapi uvicorn httpx python-multipart
    echo.
)

:: Start the server
python server.py
pause

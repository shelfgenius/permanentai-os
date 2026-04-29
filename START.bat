@echo off
title Personal AI OS
color 0A

set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend

echo.
echo  ====================================================
echo   Personal AI OS - Starting...
echo   Backend: https://aura-backend.aura-ai.live
echo  ====================================================
echo.

:: ── Check if venv exists, if not use global python ──
echo  [0/4] Checking Python environment...
if exist "%BACKEND%\.venv\Scripts\activate.bat" (
    echo        Using virtual environment
    set "PYTHON_CMD=cd /d %BACKEND% && .venv\Scripts\activate.bat && python main.py"
) else (
    echo        No .venv found - using global Python
    echo        Installing missing packages if needed...
    pip install fastapi "uvicorn[standard]" httpx pydantic pydantic-settings python-dotenv sentence-transformers aiofiles python-multipart fpdf2 markdown yt-dlp asyncpg pgvector sqlalchemy alembic openai anthropic requests beautifulsoup4 lxml minio boto3 edge-tts pyttsx3 "python-jose[cryptography]" "passlib[bcrypt]" docx2txt tenacity >nul 2>&1
    set "PYTHON_CMD=cd /d %BACKEND% && python main.py"
)
echo.

echo  [1/4] Starting backend AI server...
start "AI Backend" cmd /k "%PYTHON_CMD%"

timeout /t 4 /nobreak >nul

echo  [2/4] Starting frontend...
start "AI Frontend" cmd /k "cd /d %FRONTEND% && npm run dev"

timeout /t 2 /nobreak >nul

:: ── Publish permanent tunnel URL to Supabase ──
echo  [3/4] Publishing permanent tunnel URL...
start "AI Tunnel" cmd /k "cd /d %ROOT% && python auto_tunnel.py"

timeout /t 2 /nobreak >nul

echo  [4/4] Opening browser...
start "" "http://localhost:5173"

echo.
echo  ====================================================
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:8000
echo   Tunnel:    https://aura-backend.aura-ai.live
echo   Status:    https://aura-backend.aura-ai.live/health
echo  ====================================================
echo.
echo  The tunnel is permanent (Windows service).
echo  auto_tunnel.py just publishes the URL to Supabase.
echo.
echo  Press any key to close this window.
echo  (Backend, Frontend continue in background)
echo.
pause >nul

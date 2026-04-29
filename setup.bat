@echo off
title Personal AI OS - Setup Initial
color 0B

set ROOT=%~dp0
set BACKEND=%ROOT%backend
set FRONTEND=%ROOT%frontend

echo.
echo  Personal AI OS - Setup Initial (rulezi o singura data)
echo  =======================================================
echo.
echo  Acest script instaleaza tot ce e necesar.
echo  Dureaza 10-20 minute prima data.
echo.
pause

:: ── 1. Verificare Python ─────────────────────────────────────
echo.
echo [1/6] Verificare Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  EROARE: Python nu e instalat!
    echo  Du-te la https://www.python.org/downloads/
    echo  Bifeaza "Add Python to PATH" la instalare.
    echo.
    pause & exit /b 1
)
echo  OK - Python gasit

:: ── 2. Verificare Node.js ────────────────────────────────────
echo [2/6] Verificare Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  EROARE: Node.js nu e instalat!
    echo  Du-te la https://nodejs.org si descarca versiunea LTS.
    echo.
    pause & exit /b 1
)
echo  OK - Node.js gasit

:: ── 3. Creare .env ───────────────────────────────────────────
echo [3/6] Creare fisier configurare (.env)...
if not exist "%BACKEND%\.env" (
    echo APP_NAME=Personal AI OS> "%BACKEND%\.env"
    echo APP_VERSION=2.1.0>> "%BACKEND%\.env"
    echo DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/techquery>> "%BACKEND%\.env"
    echo LLM_PROVIDER=ollama>> "%BACKEND%\.env"
    echo OPENAI_API_KEY=>> "%BACKEND%\.env"
    echo OPENAI_MODEL=gpt-4o-mini>> "%BACKEND%\.env"
    echo OLLAMA_BASE_URL=http://localhost:11434>> "%BACKEND%\.env"
    echo OLLAMA_MODEL=llama3.2>> "%BACKEND%\.env"
    echo CHROMA_HOST=localhost>> "%BACKEND%\.env"
    echo CHROMA_PORT=8001>> "%BACKEND%\.env"
    echo STORAGE_PROVIDER=local>> "%BACKEND%\.env"
    echo MINIO_ENDPOINT=localhost:9000>> "%BACKEND%\.env"
    echo MINIO_ACCESS_KEY=minioadmin>> "%BACKEND%\.env"
    echo MINIO_SECRET_KEY=minioadmin>> "%BACKEND%\.env"
    echo MINIO_BUCKET=techquery>> "%BACKEND%\.env"
    echo CORS_ORIGINS=http://localhost:5173,http://localhost:5174>> "%BACKEND%\.env"
    echo ONLINE_MODE=true>> "%BACKEND%\.env"
    echo  OK - .env creat
) else (
    echo  OK - .env deja exista
)

:: ── 4. Python venv + deps ────────────────────────────────────
echo [4/6] Instalare Python (poate dura 10-15 min)...
if not exist "%BACKEND%\.venv" (
    python -m venv "%BACKEND%\.venv"
    echo  OK - mediu virtual creat
)
call "%BACKEND%\.venv\Scripts\activate.bat"
pip install --upgrade pip --quiet
pip install -r "%BACKEND%\requirements_full.txt" --quiet
pip install "python-jose[cryptography]==3.3.0" "passlib[bcrypt]==1.7.4" --quiet
echo  OK - dependente Python instalate

:: ── 5. Node deps ─────────────────────────────────────────────
echo [5/6] Instalare Node.js (2-3 min)...
cd /d "%ROOT%"
call npm install
cd /d "%FRONTEND%"
call npm install
echo  OK - dependente Node.js instalate

:: ── 6. Ollama ────────────────────────────────────────────────
echo [6/6] Verificare Ollama...
where ollama >nul 2>&1
if %errorlevel% neq 0 (
    echo.
    echo  Ollama nu e instalat.
    echo  Descarca de la: https://ollama.com/download
    echo  Dupa instalare, reporneste calculatorul si ruleaza:
    echo    ollama pull llama3.2
    echo.
) else (
    echo  Descarcare model AI llama3.2...
    ollama pull llama3.2
    echo  OK - model AI gata
)

echo.
echo  =======================================================
echo   Setup complet! Acum poti folosi START.bat zilnic.
echo  =======================================================
echo.
pause

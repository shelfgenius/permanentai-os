@echo off
title Permanent Cloudflare Tunnel Setup
echo ============================================================
echo   PERMANENT CLOUDFLARE TUNNEL SETUP
echo   This creates a FIXED URL that never changes.
echo ============================================================
echo.

REM Step 1: Check cloudflared
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo [ERROR] cloudflared not found. Download from:
    echo https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
    echo Place cloudflared.exe in C:\Windows\System32\
    pause
    exit /b 1
)

echo [1/5] cloudflared found.
echo.

REM Step 2: Login to Cloudflare
echo [2/5] Opening browser to log in to Cloudflare...
echo       If you don't have a Cloudflare account, create one at https://dash.cloudflare.com
echo.
cloudflared tunnel login
if errorlevel 1 (
    echo [ERROR] Login failed. Try again.
    pause
    exit /b 1
)
echo.
echo [OK] Logged in to Cloudflare.
echo.

REM Step 3: Create tunnel
set TUNNEL_NAME=personal-ai-backend
echo [3/5] Creating tunnel "%TUNNEL_NAME%"...
cloudflared tunnel create %TUNNEL_NAME%
echo.

REM Step 4: Get tunnel info
echo [4/5] Tunnel created. Getting tunnel info...
cloudflared tunnel list
echo.
echo ============================================================
echo   IMPORTANT: Copy the Tunnel ID from the list above.
echo   It looks like: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
echo ============================================================
echo.
set /p TUNNEL_ID="Paste your Tunnel ID here: "
echo.

REM Step 5: Create config
set CONFIG_DIR=%USERPROFILE%\.cloudflared
echo [5/5] Writing config to %CONFIG_DIR%\config.yml...

(
echo tunnel: %TUNNEL_ID%
echo credentials-file: %CONFIG_DIR%\%TUNNEL_ID%.json
echo.
echo ingress:
echo   - hostname: personal-ai-backend.%TUNNEL_ID%.cfargotunnel.com
echo     service: http://localhost:8000
echo   - service: http_status:404
) > "%CONFIG_DIR%\config.yml"

echo.
echo ============================================================
echo   CONFIG WRITTEN. Now you need to route DNS:
echo.
echo   Option A - Free subdomain (no domain needed):
echo     cloudflared tunnel route dns %TUNNEL_NAME% aios-backend.YOUR-DOMAIN.com
echo.
echo   Option B - Use tunnel URL directly:
echo     The tunnel URL is: https://%TUNNEL_ID%.cfargotunnel.com
echo.
echo   To run the permanent tunnel:
echo     cloudflared tunnel run %TUNNEL_NAME%
echo.
echo   To set it in your .env:
echo     TUNNEL_STATIC_URL=https://YOUR-CHOSEN-HOSTNAME
echo ============================================================
echo.

REM Ask if they want to add to .env
set /p ADD_ENV="Add TUNNEL_STATIC_URL to backend\.env? (y/n): "
if /i "%ADD_ENV%"=="y" (
    set /p TUNNEL_URL="Enter the full tunnel URL (https://...): "
    echo.>> backend\.env
    echo # Permanent Cloudflare Tunnel URL>> backend\.env
    echo TUNNEL_STATIC_URL=%TUNNEL_URL%>> backend\.env
    echo [OK] Added to backend\.env
)

echo.
echo Done! Run "cloudflared tunnel run %TUNNEL_NAME%" to start the permanent tunnel.
pause

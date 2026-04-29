# Start Kokoro TTS server (F.R.I.D.A.Y. voice for AURA)
Write-Host "Starting Kokoro TTS (bf_emma — F.R.I.D.A.Y. voice)..." -ForegroundColor Cyan

# Check if Docker is running
$dockerRunning = docker info 2>$null
if (-not $dockerRunning) {
    Write-Host "Docker Desktop is not running. Starting..." -ForegroundColor Yellow
    Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    Write-Host "Waiting for Docker to start (30s)..." -ForegroundColor Yellow
    Start-Sleep -Seconds 30
}

# Start the container
docker compose up -d

# Wait for health check
Write-Host "Waiting for Kokoro to initialize..." -ForegroundColor Yellow
$maxWait = 60
$waited = 0
while ($waited -lt $maxWait) {
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:8880/v1/audio/voices" -TimeoutSec 3 -ErrorAction Stop
        if ($response.StatusCode -eq 200) {
            Write-Host "Kokoro TTS is ready at http://localhost:8880" -ForegroundColor Green
            Write-Host "Default voice: bf_emma (British Female — elegant)" -ForegroundColor Green
            exit 0
        }
    } catch {}
    Start-Sleep -Seconds 3
    $waited += 3
    Write-Host "  Still loading... ($waited/$maxWait s)" -ForegroundColor Gray
}

Write-Host "Kokoro TTS did not start in time. Check 'docker logs kokoro-tts'" -ForegroundColor Red

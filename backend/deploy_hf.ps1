# Deploy backend to Hugging Face Spaces
# Usage: Run this AFTER creating the Space on huggingface.co

param(
    [string]$HF_USERNAME = "YOUR_HF_USERNAME",
    [string]$SPACE_NAME  = "permanentai-backend"
)

$SPACE_DIR = "$env:TEMP\hf-space-deploy"
$BACKEND_DIR = "$PSScriptRoot"

Write-Host "=== Deploying to HuggingFace Space: $HF_USERNAME/$SPACE_NAME ===" -ForegroundColor Cyan

# Clean and create temp dir
if (Test-Path $SPACE_DIR) { Remove-Item $SPACE_DIR -Recurse -Force }
New-Item -ItemType Directory -Path $SPACE_DIR | Out-Null

# Clone the HF Space repo
Write-Host "Cloning Space repo..." -ForegroundColor Yellow
git clone "https://huggingface.co/spaces/$HF_USERNAME/$SPACE_NAME" $SPACE_DIR
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Could not clone. Make sure the Space exists and you're logged in (huggingface-cli login)" -ForegroundColor Red
    exit 1
}

# Copy backend source files (exclude what we don't need)
Write-Host "Copying backend files..." -ForegroundColor Yellow
$exclude = @('.venv', '__pycache__', 'data', 'voices', 'hf_space', '*.pyc', '.env', 'client_secret.json', 'gmail_token.json', '*.sqlite', '*.db', 'deploy_hf.ps1', 'railway.toml')

Get-ChildItem $BACKEND_DIR -Exclude $exclude | ForEach-Object {
    if ($_.PSIsContainer) {
        if ($_.Name -notin @('.venv', '__pycache__', 'data', 'voices', 'hf_space')) {
            Copy-Item $_.FullName "$SPACE_DIR\$($_.Name)" -Recurse -Force
        }
    } else {
        Copy-Item $_.FullName "$SPACE_DIR\$($_.Name)" -Force
    }
}

# Overwrite Dockerfile and README with HF Space versions
Copy-Item "$BACKEND_DIR\hf_space\Dockerfile" "$SPACE_DIR\Dockerfile" -Force
Copy-Item "$BACKEND_DIR\hf_space\README.md" "$SPACE_DIR\README.md" -Force

Write-Host "Files ready in $SPACE_DIR" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. cd $SPACE_DIR"
Write-Host "  2. git add ."
Write-Host '  3. git commit -m "Deploy backend"'
Write-Host "  4. git push"
Write-Host ""
Write-Host "Then add secrets in the HF Space Settings page." -ForegroundColor Yellow

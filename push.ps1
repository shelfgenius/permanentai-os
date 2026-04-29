# ═══════════════════════════════════════════════════════════════
#  push.ps1 — One-command deploy pipeline
#  1. Build frontend → deploy direct to Cloudflare Pages
#  2. Git commit + push to GitHub (backup sync)
#  3. Render auto-deploys backend from GitHub push
# ═══════════════════════════════════════════════════════════════

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$message = if ($args[0]) { $args[0] } else { "auto: update $timestamp" }
$ROOT = $PSScriptRoot

Write-Host ""
Write-Host "╔═══════════════════════════════════════════╗" -ForegroundColor DarkCyan
Write-Host "║   DEPLOY PIPELINE — Build + Ship + Push   ║" -ForegroundColor DarkCyan
Write-Host "╚═══════════════════════════════════════════╝" -ForegroundColor DarkCyan
Write-Host ""

# ── Step 1: Build frontend ────────────────────────────────────
Write-Host "[1/5] Building frontend..." -ForegroundColor Cyan
Push-Location "$ROOT\frontend"
npm run build 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Frontend build failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Write-Host "       Build complete (frontend/dist)" -ForegroundColor Green
Pop-Location

# ── Step 2: Deploy to Cloudflare Pages (direct) ───────────────
Write-Host "[2/5] Deploying to Cloudflare Pages..." -ForegroundColor Cyan
Push-Location "$ROOT\frontend"
npx wrangler pages deploy dist --project-name=permanentai-os --commit-dirty=true 2>&1 | Tee-Object -Variable cfOutput
$cfExitCode = $LASTEXITCODE
Pop-Location

if ($cfExitCode -eq 0) {
    Write-Host "       Cloudflare Pages deployed!" -ForegroundColor Green
    Write-Host "       https://personal-ai-os.pages.dev" -ForegroundColor Blue
} else {
    Write-Host "WARNING: Cloudflare deploy failed — continuing with git push" -ForegroundColor Yellow
}

# ── Step 3: Git stage + commit ─────────────────────────────────
Write-Host "[3/5] Staging all changes..." -ForegroundColor Cyan
Push-Location $ROOT
git add -A

$status = git status --porcelain
if (-not $status) {
    Write-Host "       Nothing to commit — already up to date." -ForegroundColor Yellow
} else {
    # Show what changed
    Write-Host ""
    git diff --cached --stat | ForEach-Object { Write-Host "    $_" -ForegroundColor DarkGray }
    Write-Host ""
    Write-Host "[4/5] Committing: $message" -ForegroundColor Cyan
    git commit -m $message
}

# ── Step 5: Push to GitHub ─────────────────────────────────────
Write-Host "[5/5] Pushing to GitHub..." -ForegroundColor Cyan
git push
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Git push failed (you may need to pull first)" -ForegroundColor Yellow
} else {
    Write-Host "       GitHub synced" -ForegroundColor Green
}
Pop-Location

Write-Host ""
Write-Host "╔═══════════════════════════════════════════╗" -ForegroundColor DarkGreen
Write-Host "║         DEPLOY COMPLETE                   ║" -ForegroundColor DarkGreen
Write-Host "╚═══════════════════════════════════════════╝" -ForegroundColor DarkGreen
Write-Host ""
Write-Host "  Cloudflare: https://personal-ai-os.pages.dev" -ForegroundColor DarkGray
Write-Host "  GitHub:     https://github.com/shelfgenius/permanentai-os" -ForegroundColor DarkGray
Write-Host "  Render:     auto-deploys from git push" -ForegroundColor DarkGray
Write-Host "  Commit:     $message" -ForegroundColor DarkGray
Write-Host ""

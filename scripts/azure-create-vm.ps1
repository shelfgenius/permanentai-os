# ═══════════════════════════════════════════════════════════════════
#  AURA Voice — Create Azure GPU VM (run from YOUR PC)
#
#  Prerequisites:
#    1. Azure for Students account (azure.microsoft.com/free/students)
#    2. Azure CLI installed: winget install Microsoft.AzureCLI
#
#  This script creates:
#    - Resource group: aura-voice-rg
#    - VM: aura-voice-vm (NC4as_T4_v3 — 4 vCPU, 28GB RAM, 1x T4 GPU)
#    - Opens ports 9200 (STT) and 9300 (TTS)
#
#  Cost: ~$0.53/hr on-demand ($0.19/hr spot)
#  With $100 student credits: ~190 hours on-demand
#
#  IMPORTANT: Stop the VM when not using voice to save credits!
#    az vm deallocate -g aura-voice-rg -n aura-voice-vm
#    az vm start -g aura-voice-rg -n aura-voice-vm
# ═══════════════════════════════════════════════════════════════════

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  AURA Voice — Azure GPU VM Setup" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ── Step 1: Login ─────────────────────────────────────────────────
Write-Host "[1/6] Logging into Azure..." -ForegroundColor Yellow
az login

# ── Step 2: Check credits ────────────────────────────────────────
Write-Host "[2/6] Checking subscription..." -ForegroundColor Yellow
az account show --query "{Name:name, SubscriptionId:id, State:state}" -o table

# ── Step 3: Create resource group ────────────────────────────────
Write-Host "[3/6] Creating resource group (East US — best T4 availability)..." -ForegroundColor Yellow
az group create --name aura-voice-rg --location eastus

# ── Step 4: Create GPU VM ────────────────────────────────────────
Write-Host "[4/6] Creating GPU VM (NC4as_T4_v3 — NVIDIA T4, 16GB VRAM)..." -ForegroundColor Yellow
Write-Host "       This takes 2-5 minutes..." -ForegroundColor Gray

az vm create `
    --resource-group aura-voice-rg `
    --name aura-voice-vm `
    --size Standard_NC4as_T4_v3 `
    --image Canonical:ubuntu-24_04-lts:server:latest `
    --admin-username azureuser `
    --generate-ssh-keys `
    --public-ip-sku Standard `
    --os-disk-size-gb 64 `
    --priority Spot `
    --eviction-policy Deallocate `
    --max-price 0.25

# Note: --priority Spot saves ~63% ($0.19/hr instead of $0.53/hr)
# The VM may be evicted if Azure needs capacity, but it auto-restarts
# Remove --priority Spot --eviction-policy Deallocate --max-price 0.25
# if you prefer guaranteed availability at higher cost.

# ── Step 5: Open ports ──────────────────────────────────────────
Write-Host "[5/6] Opening ports 9200 (STT) and 9300 (TTS)..." -ForegroundColor Yellow
az vm open-port --resource-group aura-voice-rg --name aura-voice-vm --port 9200 --priority 1001
az vm open-port --resource-group aura-voice-rg --name aura-voice-vm --port 9300 --priority 1002

# ── Step 6: Install NVIDIA GPU drivers ───────────────────────────
Write-Host "[6/6] Installing NVIDIA GPU driver extension..." -ForegroundColor Yellow
az vm extension set `
    --resource-group aura-voice-rg `
    --vm-name aura-voice-vm `
    --name NvidiaGpuDriverLinux `
    --publisher Microsoft.HpcCompute `
    --version 1.9

# ── Get VM IP ────────────────────────────────────────────────────
$vmIp = az vm show -d -g aura-voice-rg -n aura-voice-vm --query publicIps -o tsv

Write-Host ""
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Green
Write-Host "  VM Created Successfully!" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Green
Write-Host ""
Write-Host "  VM IP: $vmIp" -ForegroundColor White
Write-Host "  GPU:   NVIDIA T4 (16GB VRAM)" -ForegroundColor White
Write-Host "  Cost:  ~$0.19/hr (spot)" -ForegroundColor White
Write-Host ""
Write-Host "  Next steps:" -ForegroundColor Yellow
Write-Host "  1. Wait 3-5 min for GPU driver install to finish" -ForegroundColor Gray
Write-Host "  2. SSH into the VM:" -ForegroundColor Gray
Write-Host "     ssh azureuser@$vmIp" -ForegroundColor White
Write-Host "  3. Run the setup script:" -ForegroundColor Gray
Write-Host "     curl -sL https://raw.githubusercontent.com/shelfgenius/permanentai-os/main/scripts/azure-magpie-setup.sh | bash" -ForegroundColor White
Write-Host ""
Write-Host "  To STOP the VM (save credits):" -ForegroundColor Yellow
Write-Host "     az vm deallocate -g aura-voice-rg -n aura-voice-vm" -ForegroundColor White
Write-Host "  To START the VM:" -ForegroundColor Yellow
Write-Host "     az vm start -g aura-voice-rg -n aura-voice-vm" -ForegroundColor White
Write-Host ""
Write-Host "  After containers are running, update your .env:" -ForegroundColor Yellow
Write-Host "     AURA_PARAKEET_URL=http://${vmIp}:9200" -ForegroundColor White
Write-Host "     AURA_MAGPIE_URL=http://${vmIp}:9300" -ForegroundColor White
Write-Host "═══════════════════════════════════════════════" -ForegroundColor Green

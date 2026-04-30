#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  AURA Voice — Google Cloud GPU VM Setup
#
#  Creates a T4 GPU VM and deploys Magpie TTS Zeroshot + Parakeet STT.
#
#  Prerequisites:
#    1. Google Cloud account with $300 free trial
#    2. GPU quota approved (at least 1 T4 in us-central1)
#    3. gcloud CLI installed (or use Cloud Shell in your browser)
#
#  Cost: ~$0.35/hr ($0.11/hr spot/preemptible)
#  $300 credits = ~850 hours on-demand, or ~2700 hours spot
#
#  Run from Google Cloud Shell (console.cloud.google.com → click ">_" icon)
#  Or install gcloud: https://cloud.google.com/sdk/docs/install
# ═══════════════════════════════════════════════════════════════════

set -e

PROJECT_ID=$(gcloud config get-value project)
ZONE="us-central1-a"
VM_NAME="aura-voice-vm"
MACHINE_TYPE="n1-standard-4"   # 4 vCPU, 15 GB RAM
GPU_TYPE="nvidia-tesla-t4"      # 16 GB VRAM — perfect for Magpie + Parakeet

echo "═══════════════════════════════════════════════"
echo "  AURA Voice — Google Cloud VM Setup"
echo "  Project: $PROJECT_ID"
echo "  Zone: $ZONE"
echo "  GPU: NVIDIA T4 (16GB VRAM)"
echo "  Cost: ~$0.35/hr on-demand"
echo "═══════════════════════════════════════════════"
echo ""

# ── 1. Enable Compute Engine API ─────────────────────────────────
echo "[1/5] Enabling Compute Engine API..."
gcloud services enable compute.googleapis.com

# ── 2. Create firewall rules for TTS/STT ports ───────────────────
echo "[2/5] Creating firewall rules for ports 9200 (STT) and 9300 (TTS)..."
gcloud compute firewall-rules create allow-aura-voice \
    --allow tcp:9200,tcp:9300 \
    --target-tags aura-voice \
    --description "Allow Aura voice pipeline ports (Parakeet STT + Magpie TTS)" \
    2>/dev/null || echo "Firewall rule already exists."

# ── 3. Create the GPU VM ────────────────────────────────────────
echo "[3/5] Creating GPU VM (this takes 1-3 minutes)..."
gcloud compute instances create $VM_NAME \
    --zone=$ZONE \
    --machine-type=$MACHINE_TYPE \
    --accelerator=type=$GPU_TYPE,count=1 \
    --maintenance-policy=TERMINATE \
    --image-family=ubuntu-2404-lts-amd64 \
    --image-project=ubuntu-os-cloud \
    --boot-disk-size=80GB \
    --boot-disk-type=pd-balanced \
    --tags=aura-voice \
    --metadata=startup-script='#!/bin/bash
# Auto-install NVIDIA drivers on first boot
if ! command -v nvidia-smi &> /dev/null; then
    apt-get update -qq
    apt-get install -y -qq linux-headers-$(uname -r) build-essential
    curl -fsSL https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2404/x86_64/cuda-keyring_1.1-1_all.deb -o /tmp/cuda-keyring.deb
    dpkg -i /tmp/cuda-keyring.deb
    apt-get update -qq
    apt-get install -y -qq cuda-drivers
fi'

# ── 4. Wait for VM to be ready ───────────────────────────────────
echo "[4/5] Waiting for VM to be ready..."
sleep 30

VM_IP=$(gcloud compute instances describe $VM_NAME \
    --zone=$ZONE \
    --format='get(networkInterfaces[0].accessConfigs[0].natIP)')

echo "[5/5] VM created!"
echo ""
echo "═══════════════════════════════════════════════"
echo "  VM Ready!"
echo "═══════════════════════════════════════════════"
echo ""
echo "  Public IP: $VM_IP"
echo "  GPU:       NVIDIA T4 (16GB VRAM)"
echo ""
echo "  NEXT STEPS:"
echo "  1. Wait 3-5 min for NVIDIA drivers to install"
echo "  2. SSH into the VM:"
echo "     gcloud compute ssh $VM_NAME --zone=$ZONE"
echo ""
echo "  3. Once inside the VM, run:"
echo "     curl -sL https://raw.githubusercontent.com/shelfgenius/permanentai-os/main/scripts/azure-magpie-setup.sh | bash"
echo ""
echo "  4. After containers are running (~10 min), update your .env:"
echo "     AURA_PARAKEET_URL=http://$VM_IP:9200"
echo "     AURA_MAGPIE_URL=http://$VM_IP:9300"
echo ""
echo "  TO STOP VM (save credits):"
echo "     gcloud compute instances stop $VM_NAME --zone=$ZONE"
echo "  TO START VM:"
echo "     gcloud compute instances start $VM_NAME --zone=$ZONE"
echo "  TO DELETE VM (stop all charges):"
echo "     gcloud compute instances delete $VM_NAME --zone=$ZONE"
echo ""
echo "═══════════════════════════════════════════════"

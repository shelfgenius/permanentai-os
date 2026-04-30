#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
#  AURA Voice — Azure VM Setup Script
#
#  Run this ONCE after SSH-ing into your Azure NC4as_T4_v3 VM.
#  It installs Docker, NVIDIA Container Toolkit, and starts
#  Magpie TTS Zeroshot + Parakeet STT containers.
#
#  Usage:
#    ssh azureuser@<YOUR_VM_IP>
#    curl -sL https://raw.githubusercontent.com/shelfgenius/permanentai-os/main/scripts/azure-magpie-setup.sh | bash
#
#  Or copy this file to the VM and run:
#    chmod +x azure-magpie-setup.sh && ./azure-magpie-setup.sh
# ═══════════════════════════════════════════════════════════════════

set -e

echo "═══════════════════════════════════════════════"
echo "  AURA Voice Pipeline — Azure VM Setup"
echo "═══════════════════════════════════════════════"
echo ""

# ── 1. Your NGC API Key (change this!) ────────────────────────────
export NGC_API_KEY="${NGC_API_KEY:-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}"

# ── 2. Install Docker ─────────────────────────────────────────────
echo "[1/5] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    sudo usermod -aG docker $USER
    echo "Docker installed. You may need to re-login for group changes."
else
    echo "Docker already installed."
fi

# ── 3. Install NVIDIA Container Toolkit ───────────────────────────
echo "[2/5] Installing NVIDIA Container Toolkit..."
if ! dpkg -l | grep -q nvidia-container-toolkit; then
    curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | \
        sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
    curl -s -L https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list | \
        sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' | \
        sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list
    sudo apt-get update -qq
    sudo apt-get install -y -qq nvidia-container-toolkit
    sudo nvidia-ctk runtime configure --runtime=docker
    sudo systemctl restart docker
    echo "NVIDIA Container Toolkit installed."
else
    echo "NVIDIA Container Toolkit already installed."
fi

# ── 4. Verify GPU ────────────────────────────────────────────────
echo "[3/5] Verifying GPU..."
nvidia-smi || { echo "ERROR: nvidia-smi failed. GPU drivers may not be installed."; exit 1; }
echo ""

# ── 5. Login to NGC and pull containers ──────────────────────────
echo "[4/5] Logging into NGC and pulling containers..."
echo "$NGC_API_KEY" | docker login nvcr.io -u '$oauthtoken' --password-stdin

echo "Pulling Magpie TTS Zeroshot (this may take 5-10 minutes on first run)..."
docker pull nvcr.io/nim/nvidia/magpie-tts-zeroshot:latest

echo "Pulling Parakeet STT..."
docker pull nvcr.io/nim/nvidia/parakeet-1-1b-ctc-en-us:latest

# ── 6. Create voice directory and download reference ─────────────
echo "[5/5] Setting up voice reference..."
mkdir -p ~/aura-voices
# If you have the Irish voice WAV, place it at ~/aura-voices/aura_irish.wav
# For now, we'll use the built-in Female-Calm voice

# ── 7. Start containers ─────────────────────────────────────────
echo ""
echo "Starting Magpie TTS Zeroshot on port 9300..."
docker run -d \
    --name aura-magpie \
    --gpus all \
    --restart unless-stopped \
    --shm-size=16gb \
    -e NGC_API_KEY="$NGC_API_KEY" \
    -e NIM_HTTP_API_PORT=9300 \
    -e NIM_GRPC_API_PORT=50052 \
    -e NIM_TAGS_SELECTOR="name=magpie-tts-zeroshot" \
    -p 9300:9300 \
    -p 50052:50052 \
    -v ~/aura-voices/aura_irish.wav:/app/aura_irish.wav:ro \
    -v aura_nim_cache_magpie:/opt/nim/.cache \
    nvcr.io/nim/nvidia/magpie-tts-zeroshot:latest

echo "Starting Parakeet STT on port 9200..."
docker run -d \
    --name aura-parakeet \
    --gpus all \
    --restart unless-stopped \
    --shm-size=8gb \
    -e NGC_API_KEY="$NGC_API_KEY" \
    -e NIM_HTTP_API_PORT=9200 \
    -e NIM_GRPC_API_PORT=50051 \
    -e "NIM_TAGS_SELECTOR=name=parakeet-1-1b-ctc-en-us,mode=str,model_type=prebuilt" \
    -p 9200:9200 \
    -p 50051:50051 \
    -v aura_nim_cache_parakeet:/opt/nim/.cache \
    nvcr.io/nim/nvidia/parakeet-1-1b-ctc-en-us:latest

echo ""
echo "═══════════════════════════════════════════════"
echo "  Containers starting! Model download in progress..."
echo "  This can take 5-15 minutes on first run."
echo ""
echo "  Monitor progress:"
echo "    docker logs -f aura-magpie"
echo "    docker logs -f aura-parakeet"
echo ""
echo "  Check health:"
echo "    curl http://localhost:9300/v1/health/ready"
echo "    curl http://localhost:9200/v1/health/ready"
echo ""
echo "  Test TTS:"
echo "    curl http://localhost:9300/v1/audio/synthesize \\"
echo "      -F language=en-US \\"
echo "      -F text='Hello, I am Aura.' \\"
echo "      -F voice=Magpie-ZeroShot.Female-Calm \\"
echo "      --output test.wav"
echo ""
echo "  Your VM public IP: $(curl -s ifconfig.me)"
echo "═══════════════════════════════════════════════"

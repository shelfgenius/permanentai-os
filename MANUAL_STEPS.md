# Manual Configuration Steps — Personal AI OS

Everything that requires **your manual action** (API keys, account setup, service config) is listed below.

---

## 1. iCloud Email (for Sculpt model + PDF email delivery)

The email router uses **iCloud SMTP** (`smtp.mail.me.com:587`).

**Status:** ✅ **CONFIGURED** — `maherboss23@icloud.com` with app-specific password set.

### Steps:
1. Go to [appleid.apple.com](https://appleid.apple.com) → Sign In
2. Go to **Security** → **App-Specific Passwords**
3. Click **Generate** → name it "AI OS"
4. Copy the 16-character password
5. Paste it in `backend/.env`:
   ```
   GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
   ```

---

## 2. Gemini API Key

**Status:** Check `backend/.env` for `GEMINI_API_KEY`.

If blank:
1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Create a key
3. Paste in `backend/.env`:
   ```
   GEMINI_API_KEY=your-key-here
   ```

---

## 3. Alexa Skill Setup (for voice control via Echo)

This requires an **Amazon Developer** account and manual skill creation.

### Steps:
1. Go to [developer.amazon.com/alexa/console](https://developer.amazon.com/alexa/console)
2. Create a new **Custom Skill** named "Personal AI" → **Provision your own** endpoint
3. Choose **Start from Scratch** template

#### Interaction Model:
4. Go to **Intents** → **+ Add Intent** → create `QueryIntent`
5. Add a slot: name `query`, type `AMAZON.SearchQuery`
6. Add sample utterances (one per line):
   ```
   {query}
   ask AI {query}
   tell AI {query}
   play {query}
   search {query}
   turn {query}
   turn on {query}
   turn off {query}
   generate {query}
   translate {query}
   what is {query}
   ```
7. **IMPORTANT — Built-in Intents** (required or Alexa says "I'm not sure"):
   - Ensure these exist in your intent list (they should be auto-added):
   - `AMAZON.HelpIntent`, `AMAZON.CancelIntent`, `AMAZON.StopIntent`, `AMAZON.FallbackIntent`
   - If using AudioPlayer, also add: `AMAZON.PauseIntent`, `AMAZON.ResumeIntent`

#### Interfaces:
8. Go to **Interfaces** → enable **Audio Player** (required for music/YouTube playback)
9. Click **Save Interfaces**, then go back to **Build** and **Build Model**

#### Endpoint:
10. Go to **Endpoint** → select **HTTPS**
11. Default Region URL:
    ```
    https://aura-backend.aura-ai.live/alexa/ask/fulfillment
    ```
12. SSL cert type: **"My development endpoint has a certificate from a trusted certificate authority"**
13. Click **Save Endpoints**

#### Test:
14. Go to **Test** tab → set to **Development**
15. Try: `ask personal ai what is the capital of france`
16. Try: `ask personal ai play despacito`

---

## 4. Cloudflare Tunnel — PERMANENT URL (recommended)

Right now `auto_tunnel.py` gives you a **random URL that changes every restart**.
You want a **fixed URL that never changes**. Here's how — through **Cloudflare Zero Trust**.

> **You do NOT need a Worker, a Page, or a custom domain.**
> You just create a tunnel in the Cloudflare dashboard. That's it.

---

### STEP 1 — Create a free Cloudflare account (skip if you already have one)

1. Open your browser → go to **https://dash.cloudflare.com**
2. Click **Sign Up** → use your email → verify it → done
3. You're now on the Cloudflare Dashboard

---

### STEP 2 — Go to Zero Trust

1. On the left sidebar of the Cloudflare Dashboard, look for **"Zero Trust"**
   - It might also say **"Cloudflare One"** or have a shield icon
2. Click it → it opens a new panel
3. If it asks you to pick a plan → pick the **FREE plan** (it's free for up to 50 users, you only need 1)
4. If it asks for a team name → type anything, like `maher-ai` → Continue

You're now in **Zero Trust Dashboard**.

---

### STEP 3 — Create the Tunnel

1. On the left sidebar inside Zero Trust, click **Networks → Tunnels**
   - (Older UI might show it as **Access → Tunnels**)
2. Click the blue button **"Create a tunnel"**
3. Select **"Cloudflared"** as the connector type → click **Next**
4. **Name your tunnel**: type `personal-ai-backend` → click **Save tunnel**

---

### STEP 4 — Install the connector on your PC

After creating the tunnel, Cloudflare shows you an install command. You have two choices:

**If you already have `cloudflared` installed** (you do):
1. Cloudflare shows a command like:
   ```
   cloudflared service install eyJhIjoiNjQ1MG....(very long token)
   ```
2. **Copy that entire command**
3. Open **Command Prompt as Administrator** (right-click cmd → Run as admin)
4. **Paste and run it**
5. This installs cloudflared as a **Windows service** — it starts automatically on boot!

**If cloudflared is NOT installed:**
1. Cloudflare gives you a download link → download and install it
2. Then run the `cloudflared service install ...` command above

> After this step, cloudflared runs **permanently in the background**, even after reboot.
> You never have to manually start it again.

---

### STEP 5 — Set the public hostname (this is your permanent URL)

After the connector connects (green dot in dashboard), click **Next** and you'll see the **Public Hostname** page:

1. **Subdomain**: type `ai-backend` (or whatever you want)
2. **Domain**: it shows your options. If you have **no domain**, Cloudflare gives you one like:
   - `ai-backend.SOMETHING.cfargotunnel.com`
   
   If you **do** have a domain added to Cloudflare (e.g. `yourdomain.com`), pick it from the dropdown:
   - `ai-backend.yourdomain.com`

3. **Service type**: select **HTTP**
4. **URL**: type `localhost:8000`
5. Click **Save tunnel**

**Your permanent URL is now live.** For example:
```
https://ai-backend.yourdomain.com
```
or
```
https://ai-backend.XXXXX.cfargotunnel.com
```

Test it: open that URL in your browser, add `/health` at the end:
```
https://aura-backend.aura-ai.live/health
```
You should see `{"status":"ok"}`.

---

### STEP 6 — Tell your app about the permanent URL

✅ **DONE** — Already set in `backend/.env`:
```
TUNNEL_STATIC_URL=https://aura-backend.aura-ai.live
```

3. Now when you run `python auto_tunnel.py`, it will:
   - See the static URL
   - Publish it to Supabase immediately
   - Frontend picks it up automatically — **no more copy-pasting URLs**

---

### STEP 7 — Update your Alexa Skill endpoint

Go back to [developer.amazon.com/alexa/console](https://developer.amazon.com/alexa/console):
1. Open your "Personal AI OS" skill
2. Go to **Endpoint**
3. Change the URL to your permanent one:
   ```
   https://aura-backend.aura-ai.live/alexa/ask/fulfillment
   ```
4. **Save** → **Build** → Done forever!

---

### Summary: What you DID and DIDN'T need

| Thing | Needed? |
|---|---|
| Cloudflare account | ✅ Yes (free) |
| Zero Trust → Tunnels | ✅ Yes (this is where you created it) |
| Cloudflare Worker | ❌ No |
| Cloudflare Pages | ❌ No (Pages is for frontend, not backend tunnel) |
| Custom domain | ❌ Optional (free cfargotunnel.com subdomain works) |
| Running `cloudflared` manually | ❌ No (it's a Windows service now, auto-starts) |

### Quick tunnel fallback (old method, still works if you skip all this)
```bash
cd C:\Users\maher\Desktop\retail-engine
python auto_tunnel.py
```

---

## 5. Backend Server Start

```bash
cd C:\Users\maher\Desktop\retail-engine\backend
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 6. Frontend Build + Deploy

```bash
cd C:\Users\maher\Desktop\retail-engine\frontend
npm run build
npx wrangler pages deploy dist --project-name=permanentai-os --commit-dirty=true
```

---

## 7. Git Push (must be done manually — times out in Cascade)

```bash
cd C:\Users\maher\Documents\GitHub\permanentai-os
xcopy /E /Y /I C:\Users\maher\Desktop\retail-engine\* .
git add .
git commit -m "Full integration: Gemini, PDF, email, YouTube, voice, iOS stability"
git push
```

---

## 8. pip Dependencies (already installed)

These were installed via `pip install`:
- `fpdf2` — PDF generation
- `markdown` — Markdown→HTML conversion
- `yt-dlp` — YouTube audio extraction

Optional (better PDF quality):
```bash
pip install weasyprint
```

---

## 9. NVIDIA NIM — Local AI Model Hosting (Docker)

Your NGC key is already set in `.env`. To run models locally:

### Docker Login
```bash
docker login nvcr.io
# Username: $oauthtoken
# Password: (your NGC_API_KEY from .env)
```

### Run Gemma-4 31B (requires NVIDIA GPU + Docker)
```bash
set NGC_API_KEY=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
set LOCAL_NIM_CACHE=%USERPROFILE%\.cache\nim
mkdir "%LOCAL_NIM_CACHE%"

docker run -it --rm --gpus all --ipc host --shm-size=32GB ^
    -e NGC_API_KEY ^
    -v "%LOCAL_NIM_CACHE%:/opt/nim/.cache" ^
    -p 8000:8000 ^
    nvcr.io/nim/google/gemma-4-31b-it:latest
```

### Test NIM
```bash
curl -X POST http://localhost:8000/v1/chat/completions ^
  -H "Content-Type: application/json" ^
  -d "{\"model\":\"google/gemma-4-31b-it\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}"
```

> **Note:** Running NIM locally requires a machine with NVIDIA GPU (24GB+ VRAM for 31B). If you don't have one, the cloud API (`integrate.api.nvidia.com`) is already configured and works automatically.

---

## 10. Nexus — Connect Your Real Smart Home Devices

Nexus controls your devices through **Home Assistant** (free, open-source). Here's the step-by-step setup.

### Step 1 — Install Home Assistant

**Option A: Home Assistant OS (Recommended — dedicated device)**
1. Get a Raspberry Pi 4 (4GB+) or old laptop
2. Download from [home-assistant.io/installation](https://www.home-assistant.io/installation/)
3. Flash to SD card/USB → boot → open `http://homeassistant.local:8123`
4. Create your account

**Option B: Home Assistant Container (on your PC)**
```bash
docker run -d --name homeassistant --restart unless-stopped ^
  -e TZ=Europe/Bucharest ^
  -v %USERPROFILE%\homeassistant:/config ^
  --network=host ^
  ghcr.io/home-assistant/home-assistant:stable
```
Open `http://localhost:8123` → create account.

### Step 2 — Connect Each Device

#### ❄️ Beko AC (via Beko/ConnectLife integration)
1. In HA: **Settings → Devices & Services → Add Integration**
2. Search **"ConnectLife"** or **"SmartThings"** (Beko uses ConnectLife app)
3. If not available, install HACS → search "Beko" or "ConnectLife"
   ```
   HACS → Integrations → + Explore → "ConnectLife" → Install
   ```
4. Enter your **Beko/ConnectLife app credentials**
5. Your AC units appear as `climate.beko_living_room`, `climate.beko_bedroom`

#### 📺 LG TV (via built-in LG webOS integration)
1. **Turn on your LG TV** and make sure it's on the same WiFi
2. In HA: **Settings → Devices & Services → Add Integration**
3. Search **"LG webOS Smart TV"** → it auto-discovers your TV
4. A pairing prompt appears on the TV → **Accept**
5. Entity: `media_player.lg_tv`

#### 💡 Ledvance Lights (via LEDVANCE/SYLVANIA integration)
1. In HA: **Settings → Devices & Services → Add Integration**
2. Search **"LEDVANCE"** or **"SYLVANIA"**
3. If using Zigbee bulbs → use **ZHA** or **Zigbee2MQTT** integration:
   - You need a Zigbee USB stick (ConBee II / Sonoff Zigbee 3.0)
   - **Settings → Devices → Add Integration → ZHA**
   - Put bulbs in pairing mode → they appear automatically
4. If using WiFi bulbs → use the **LEDVANCE SMART+ WiFi** integration
5. Entity: `light.ledvance_living_room`

#### 🤖 Xiaomi Vacuum (via Xiaomi Miot Auto)
1. Install HACS in HA (if not installed):
   - Go to `http://your-ha:8123/hacs/`
   - If not there: [hacs.xyz/docs/setup](https://hacs.xyz/docs/setup/download)
2. **HACS → Integrations → + Explore → "Xiaomi Miot Auto" → Install**
3. Restart HA
4. **Settings → Devices → Add Integration → Xiaomi Miot Auto**
5. Enter your **Xiaomi/Mi Home credentials** (same as Mi Home app)
6. Select your vacuum from the list
7. Entity: `vacuum.xiaomi_robot`

#### 🔵 Alexa Echo (via Alexa Media Player)
1. **HACS → Integrations → + Explore → "Alexa Media Player" → Install**
2. Restart HA
3. **Settings → Devices → Add Integration → Alexa Media Player**
4. Log in with your **Amazon account**
5. Entity: `media_player.alexa_echo`

### Step 3 — Get Home Assistant Long-Lived Token

1. In HA, click your profile picture (bottom-left)
2. Scroll to **"Long-Lived Access Tokens"**
3. Click **"Create Token"** → name it "Personal AI OS"
4. **Copy the token** (shown only once!)

### Step 4 — Configure Nexus in Your App

**Option A: Via UI (recommended)**
1. Open your app → go to **Nexus Hub**
2. Click **⚙ SETUP** (top bar)
3. Switch to **Home Assistant** mode
4. Enter your HA URL: `http://YOUR-HA-IP:8123`
5. Paste the Long-Lived Token
6. Verify entity IDs match your devices
7. Click **🔌 Test Connection** → should show ✓ Connected
8. Click **SAVE CONFIGURATION**

**Option B: Via .env (backend)**
Add to `backend/.env`:
```
NEXUS_BACKEND=ha
HA_URL=http://YOUR-HA-IP:8123
HA_TOKEN=YOUR_LONG_LIVED_TOKEN
HA_ENTITY_AC=climate.beko_living_room
HA_ENTITY_AC_BED=climate.beko_bedroom
HA_ENTITY_TV=media_player.lg_tv
HA_ENTITY_LIGHTS=light.ledvance_living_room
HA_ENTITY_VACUUM=vacuum.xiaomi_robot
HA_ENTITY_ALEXA=media_player.alexa_echo
```

### Step 5 — Test Voice Commands

Once connected, try these via Alexa or VoiceOrb:
- "Turn off the lights"
- "Set AC to 22"
- "Turn on the TV"
- "Start the vacuum"
- "Activate movie scene"

### Troubleshooting
- **Device not found**: Check entity IDs in HA → Developer Tools → States
- **Connection refused**: Make sure HA is on the same network, or use a Cloudflare tunnel for HA too
- **Token expired**: HA long-lived tokens don't expire, but if it stops working, generate a new one

---

## Summary of New Backend Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/gemini/audio` | POST | Multimodal audio → text via Gemini |
| `/gemini/chat` | POST | Text chat via Gemini (SSE streaming) |
| `/gemini/status` | GET | Check Gemini API key config |
| `/youtube/search` | POST | Search YouTube videos |
| `/youtube/play` | POST | Get audio stream URL for a video |
| `/youtube/status` | GET | Check yt-dlp availability |
| `/voice/command` | POST | Universal voice → action dispatcher |
| `/voice/status` | GET | List available voice commands |
| `/pdf/generate` | POST | Markdown/HTML → PDF |
| `/pdf/research` | POST | AI deep research → PDF |
| `/pdf/file/{name}` | GET | Download generated PDF |
| `/email/send-file` | POST | Email file attachment (URL or base64) |
| `/email/status` | GET | Check email config |
| `/nexus/execute` | POST | Execute smart home device command |
| `/nexus/devices` | GET | List configured device entities |
| `/nexus/setup` | GET/POST | Get/save Nexus connection config |
| `/nexus/test` | POST | Test Home Assistant connection |
| `/alexa/ask/fulfillment` | POST | Alexa skill — executes ALL hub commands |

---

## Summary of New Frontend Features

- **Deep Research → PDF** panel (BookOpen button) in AIHub + EchoHub
- **Sculpt email** — "Email .glb" button auto-sends model to your iCloud
- **Sky Advanced Data** — expandable panel with 60+ weather data points
- **iOS Safari stability** — site-wide (all hubs, all 3D canvases)
- **Lexi website translation** — iframe error detection + "Open in new tab" fallback
- **Nexus Setup Panel** — ⚙ SETUP button for connecting real devices via Home Assistant
- **Alexa executes ALL hubs** — voice commands actually run Canvas, Sculpt, Echo, Lexi, Sky, Mappy, Aura
- **VoiceOrb executes ALL hubs** — same as Alexa, works from browser too

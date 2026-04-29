# 🚀 SETUP COMPLET — Personal AI OS
> Urmează pașii în ordine. Durată totală: ~30 minute prima dată.

---

## ✅ CE AI NEVOIE ÎNAINTE DE ORICE

1. **Windows 10/11** (64-bit)
2. **Python 3.11** instalat → https://www.python.org/downloads/release/python-3119/
   - ⚠️ Bifează **"Add Python to PATH"** la instalare!
3. **Node.js 20+** → https://nodejs.org/en (versiunea LTS)
4. **Git** → https://git-scm.com/download/win
5. **Ollama** (AI gratuit local) → https://ollama.ai/download

---

## PASUL 1 — Instalează Ollama și modelul AI

```
# Deschide Command Prompt (cmd) și rulează:
ollama pull llama3.2
```
- Descarcă ~2GB. Așteaptă să termine.
- Verificare: `ollama list` — trebuie să apară `llama3.2`

---

## PASUL 2 — Configurează cheile API gratuite

Deschide fișierul: `retail-engine\backend\.env`

Completează cheile (cel puțin una):

```
GROQ_API_KEY=gsk_...        # https://console.groq.com/keys (GRATUIT)
GEMINI_API_KEY=AIza...      # https://aistudio.google.com/apikey (GRATUIT)
MISTRAL_API_KEY=...         # https://console.mistral.ai (GRATUIT)
```

> **Cheia Groq e cea mai rapidă (sub 1 secundă răspuns)**

---

## PASUL 3 — Instalează dependențele backend

```
cd C:\Users\maher\Desktop\retail-engine\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

---

## PASUL 4 — Instalează dependențele frontend

```
cd C:\Users\maher\Desktop\retail-engine\frontend
npm install
```

---

## PASUL 5 — Pornire aplicație

**Dublu-click pe `START.bat`** din folderul `retail-engine`.

Acesta pornește automat:
- 🤖 Backend AI (port 8000)
- 💻 Frontend UI (port 5173)
- 🌐 Cloudflare Tunnel (dacă e instalat)

Browserul se deschide automat la `http://localhost:5173`

---

## PASUL 6 — Creează contul tău

1. La prima deschidere apare ecranul de login
2. Click **"Creează cont"**
3. Completează: username, nume, parolă
4. Click **"Înregistrare"**

---

## UTILIZARE ZILNICĂ

Dublu-click pe `START.bat` → gata!

# 🚀 SETUP SIMPLU — Personal AI OS
### Citește de sus în jos. Fă fiecare pas în ordine. Nu sări pași.

---

## ✅ CE TREBUIE SĂ AI INSTALAT (o singură dată, pe viață)

Dacă nu le ai, instalează-le acum:

| Program | Link de descărcare | De ce e nevoie |
|---|---|---|
| **Docker Desktop** | https://www.docker.com/products/docker-desktop | Rulează toate modulele AI |
| **Node.js 18+** | https://nodejs.org | Pornește interfața vizuală |
| **Python 3.11+** | https://www.python.org/downloads | Rulează backend-ul AI |
| **Git** | https://git-scm.com/downloads | (opțional, pentru update-uri) |

> 💡 **Cum știi că le-ai instalat corect?**
> Deschide un terminal (Win+R → tastează `cmd` → Enter) și scrie:
> - `docker --version` → trebuie să apară ceva de genul `Docker version 25.x`
> - `node --version` → trebuie să apară `v18.x` sau mai mare
> - `python --version` → trebuie să apară `Python 3.11.x`

---

## PASUL 1 — Configurează cheia AI (5 minute)

Ai nevoie de o cheie API de la un furnizor AI. Alege una:

### Opțiunea A: OpenAI (recomandat pentru început)
1. Mergi la https://platform.openai.com/api-keys
2. Creează un cont (sau loghează-te)
3. Click **"Create new secret key"**
4. Copiază cheia (arată ca `sk-proj-abc123...`)

### Opțiunea B: Ollama — GRATUIT, funcționează fără internet
1. Mergi la https://ollama.ai și descarcă programul
2. Instalează-l
3. Deschide un terminal și scrie: `ollama pull llama3.2`
4. Așteptă să se descarce (câteva minute)

---

## PASUL 2 — Configurează fișierul de setări (2 minute)

1. Deschide folderul proiectului: `C:\Users\maher\Desktop\retail-engine\backend`
2. Găsești fișierul `.env`
3. Deschide-l cu Notepad (click dreapta → "Deschide cu" → Notepad)
4. Modifică aceste linii:

```
# Dacă folosești OpenAI:
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-CHEIA_TA_AICI

# SAU dacă folosești Ollama (gratuit):
LLM_PROVIDER=ollama
OLLAMA_MODEL=llama3.2
```

5. Salvează fișierul (Ctrl+S) și închide Notepad.

---

## PASUL 3 — Pornește Docker Desktop

1. Caută **Docker Desktop** în meniu Start și deschide-l
2. Așteaptă până apare o balenă verde în bara de sistem (colțul din dreapta jos)
3. Asta înseamnă că Docker rulează

---

## PASUL 4 — Pornește baza de date vectorială (ChromaDB)

Deschide un terminal (`cmd` sau PowerShell) și navighează în folderul proiectului:

```
cd C:\Users\maher\Desktop\retail-engine
```

Acum pornește ChromaDB cu Docker:

```
docker run -d -p 8001:8001 --name tq_chromadb chromadb/chroma:latest
```

> ✅ Dacă apare un ID lung de caractere, înseamnă că a pornit. Bravo!

---

## PASUL 5 — Instalează dependențele Python

În același terminal, scrie:

```
cd C:\Users\maher\Desktop\retail-engine\backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements_full.txt
```

> ⏳ Asta durează **5-15 minute** prima dată. E normal. Lasă-l să ruleze.

---

## PASUL 6 — Instalează dependențele Node.js

Deschide un **terminal nou** și scrie:

```
cd C:\Users\maher\Desktop\retail-engine
npm install

cd frontend
npm install
```

> ⏳ Durează 2-3 minute. Normal.

---

## PASUL 7 — Pornește backend-ul AI

În terminalul cu Python activ (cel cu `.venv`), scrie:

```
cd C:\Users\maher\Desktop\retail-engine\backend
.venv\Scripts\activate
python main.py
```

> ✅ Trebuie să apară ceva de genul:
> `INFO: Uvicorn running on http://127.0.0.1:8000`
>
> Dacă apare asta — backend-ul rulează. **Nu închide acest terminal!**

---

## PASUL 8 — Pornește interfața vizuală

Deschide un **alt terminal nou** și scrie:

```
cd C:\Users\maher\Desktop\retail-engine\frontend
npm run dev
```

> ✅ Trebuie să apară:
> `VITE v5.x ready in Xms`
> `Local: http://localhost:5173/`

---

## PASUL 9 — Deschide aplicația! 🎉

Deschide browserul (Chrome recomandat) și mergi la:

```
http://localhost:5173
```

**Vei vedea:**
- Animație de boot cu text care rulează
- Interfața Iron Man cu particule animate
- Mascota domeniului tău activ
- Câmp de text jos pentru întrebări

---

## 💬 TESTE RAPIDE — Ce poți face imediat

Scrie una din aceste întrebări în câmpul de text:

```
Calculează distanța de oprire la 90 km/h pe carosabil umed.
```
→ Mascota Condus calculează și animă formula pe ecran.

```
Câți metri cubi de beton îmi trebuie pentru o placă de 5m × 4m × 0.15m?
```
→ Mascota Construcții calculează și afișează materialele necesare.

```
Care sunt regulile SOLAS pentru detectarea incendiilor pe o navă cargo?
```
→ Mascota Maritim răspunde din baza de date.

---

## 🔧 PROBLEME FRECVENTE

### „Backend-ul nu pornește"
**Cauza:** Cheia API lipsă sau greșită.
**Soluție:** Verifică fișierul `backend/.env` — `OPENAI_API_KEY` trebuie să fie completă.

### „Port 8000 already in use"
**Cauza:** Un alt program folosește portul 8000.
**Soluție:** Deschide Task Manager (Ctrl+Shift+Esc) → găsește procesul care folosește portul și oprește-l. Sau repornește calculatorul.

### „npm: command not found"
**Cauza:** Node.js nu e instalat sau nu e în PATH.
**Soluție:** Reinstalează Node.js de pe https://nodejs.org și bifează opțiunea „Add to PATH".

### „python: command not found"
**Cauza:** Python nu e în PATH.
**Soluție:** Reinstalează Python și bifează „Add Python to PATH" la instalare.

### Mascota nu vorbește (nu se aude nimic)
**Cauza:** XTTS-v2 necesită modele vocale descărcate.
**Soluție:** Adaugă în `backend/.env`:
```
LLM_PROVIDER=openai
```
Atunci va folosi vocea OpenAI ca fallback (necesită cheie API).

### Interfața e neagră / nu se încarcă
**Soluție:** Fă Ctrl+Shift+R în browser (reload hard). Dacă tot nu merge, verifică că `npm run dev` rulează în terminal.

---

## 🚀 VERSIUNEA DOCKER COMPLETĂ (opțional, mai avansat)

Dacă vrei să pornești **TOT** dintr-o singură comandă (necesită Docker Desktop activ):

```
cd C:\Users\maher\Desktop\retail-engine
docker compose up --build
```

> ⏳ Prima dată durează 10-20 minute (descarcă imaginile).
> După, la fiecare pornire durează ~1 minut.
>
> Accesezi interfața tot la: http://localhost:5173

---

## 📁 ADAUGĂ DOCUMENTE ÎN BAZA DE CUNOȘTINȚE

1. Deschide aplicația → click pe tab-ul **"Knowledge"** din stânga
2. Click pe **"Add Documents"**
3. Drag & drop PDF-uri, Word-uri, txt-uri
4. Alege domeniul (Maritim, Construcții, etc.)
5. Click **"Upload & Index"**
6. Statusul devine **"indexed"** în câteva minute

**Documente recomandate pentru start:**
- Manual tehnic al navei / utilajului tău
- Regulamente de construcții
- Codul rutier PDF
- Cărți de design interior
- Manuale școlare

---

## 🔁 CUM PORNEȘTI ZILNIC (după prima instalare)

Deschide **2 terminale** și scrie:

**Terminal 1 (backend):**
```
cd C:\Users\maher\Desktop\retail-engine\backend
.venv\Scripts\activate
python main.py
```

**Terminal 2 (frontend):**
```
cd C:\Users\maher\Desktop\retail-engine\frontend
npm run dev
```

Apoi deschide `http://localhost:5173` în browser. Gata!

---

## �️ DOMENII NOI — 3D Printing și 3D Modeling

Aceste două domenii apar acum în lista din stânga. Le poți folosi imediat.

**Exemple de întrebări 3D Printing:**
```
Câte grame de filament PLA am nevoie pentru un model de 45 cm³ cu infill 20%?
Cât durează să printez un model de 80 cm³ la 50mm/s?
Ce setări recomanzi pentru PETG funcțional?
```

**Exemple de întrebări 3D Modeling:**
```
Câți poligoni are nevoie un personaj de joc la nivel mediu de detaliu?
Convertește 2.5 inch în milimetri pentru Blender.
Cât durează un render la 1920×1080 cu 256 samples?
```

---

## 📚 SUBIECTE EDUCAȚIE (cu Repetiție Spațiată)

Când selectezi domeniul **Educație** din stânga, apare o secțiune cu 5 subiecte:

| Subiect | Icon | Ce înveți |
|---|---|---|
| Română | 🇷🇴 | Gramatică, literatură, compuneri |
| Matematică | 📐 | Formule, geometrie, algebră |
| Biologie | 🧬 | Celule, organe, ecosisteme |
| Engleză Oral | 🗣️ | Pronunție, conversație, vocabular |
| Competențe Digitale | 💻 | Office, internet, securitate |

**Cum funcționează Repetiția Spațiată:**
1. Studiezi un concept → sistemul îl marchează pentru revizuire la 1 zi
2. A doua zi apare un badge portocaliu **„Azi!"** lângă subiect
3. Revizuiești → intervalul crește la 3 zile, 7 zile, 21 zile, 60 zile
4. Dacă nu reușești → revine la 1 zi

---

## 🔵 ALEXA — Configurare

Sistemul suportă două moduri de integrare cu Alexa Echo:

### Modul A (recomandat — simplu, fără cont Amazon Developer)
1. Asociază boxele Echo cu telefonul prin Bluetooth
2. Asigură-te că boxele apar ca dispozitiv audio în Windows
3. Sistemul va reda răspunsurile AI direct prin Echo
4. **Nu e nevoie de nicio configurare suplimentară**

### Modul B (avansat — Alexa Skill nativ)
1. Mergi la https://developer.amazon.com/alexa/console/ask
2. Creează un cont gratuit
3. Click **Create Skill** → name: "Personal AI OS" → Custom model
4. La **Endpoint** alege **HTTPS** și introdu:
   ```
   https://ADRESA_TA_CLOUDFLARE/alexa/ask/fulfillment
   ```
5. Copiază **Skill ID** și pune-l în `config.yaml`:
   ```yaml
   alexa:
     mode: ask_sdk
     ask_skill_id: amzn1.ask.skill.XXXX
   ```
6. Spune: **"Alexa, deschide Personal AI OS"**

**Schimbarea modului din aplicație:**
- Click pe iconița **🔵 Alexa** în panoul Social din stânga
- Click pe butonul `A2DP (Bluetooth)` sau `ASK SDK (Skill)` pentru a comuta

---

## 📱 SOCIAL MEDIA — Configurare

Panoul **Social & Alexa** din stânga arată statusul conexiunilor.

### Gmail
1. Mergi la https://console.cloud.google.com
2. Creează un proiect nou
3. Activează **Gmail API**
4. Creează credențiale OAuth 2.0 → descarcă `credentials.json`
5. Pune fișierul în `backend/gmail_credentials.json`
6. Prima dată rulează `python backend/auth_gmail.py` → se deschide browserul → autorizează
7. Se creează `gmail_token.json` → gata!

### WhatsApp + Instagram
1. Mergi la https://developers.facebook.com
2. Creează o aplicație → adaugă produsul **WhatsApp** sau **Instagram**
3. La **Webhook** introdu:
   ```
   URL: https://ADRESA_TA_CLOUDFLARE/social/whatsapp/webhook
   Token verificare: techquery_wh_secret
   ```
4. Adaugă în `backend/.env`:
   ```
   WHATSAPP_TOKEN=EAAxxxxx
   INSTAGRAM_TOKEN=EAAxxxxx
   ```

> 💡 **Fără Cloudflare Tunnel** notificările de la WhatsApp/Instagram nu funcționează în rețea locală. Cloudflare Tunnel îți dă o adresă publică securizată. Vezi secțiunea de mai jos.

### Cloudflare Tunnel (pentru acces extern)
1. Mergi la https://dash.cloudflare.com → Zero Trust → Tunnels
2. Click **Create a tunnel** → name: "personal-ai-os"
3. Urmează instrucțiunile → instalezi `cloudflared` pe PC
4. Adaugă un public hostname:
   - Subdomain: `ai` → Service: `http://localhost:8000`
5. Adresa ta publică va fi: `https://ai.DOMENIUL_TAU.com`

---

## �📞 SUMAR RAPID

| Ce faci | Unde o faci |
|---|---|
| Schimbi modelul AI | `backend/.env` → `LLM_PROVIDER=` |
| Adaugi documente | Aplicație → tab Knowledge → Add Documents |
| Schimbi domeniul activ | Click pe iconița domeniului în stânga |
| Activezi subiecte educație | Click pe „Educație" → secțiunea se deschide |
| Comuți modul Alexa | Panoul Social & Alexa → buton A2DP/ASK SDK |
| Oprești totul | Ctrl+C în ambele terminale |
| Folosești fără internet | `backend/.env` → `LLM_PROVIDER=ollama` |
| Adaugi concept educațional | Scrie întrebarea cu domeniu setat pe „Educație" |


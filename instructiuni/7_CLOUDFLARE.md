# ☁️ CLOUDFLARE — Acces Global (Frontend + Backend)

> Cu Cloudflare, aplicația ta e accesibilă de pe orice dispozitiv din lume.
> **Nu ai nevoie de domeniu propriu.**

---

## PARTEA 1 — CLOUDFLARE TUNNEL (Backend online)

### Pasul 1 — Instalează cloudflared

1. Mergi la → https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/
2. Descarcă **Windows 64-bit**
3. Salvează `cloudflared.exe` în `C:\Windows\System32\` (ca să funcționeze din orice folder)

Verificare în cmd:
```
cloudflared --version
```
Trebuie să apară ceva de genul: `cloudflared version 2025.x.x`

---

### Pasul 2 — Pornește Quick Tunnel (fără cont, fără domeniu)

```
cloudflared tunnel --url http://localhost:8000
```

În câteva secunde apare:
```
Your quick Tunnel has been created! Visit it at:
https://random-words-here.trycloudflare.com
```

**Copiază acest URL** — acesta e adresa backend-ului tău online.

> ⚠️ URL-ul se schimbă la fiecare repornire. Dacă vrei URL fix → vezi Pasul 5.

---

### Pasul 3 — Configurează frontend-ul cu noul URL

1. Deschide aplicația la `http://localhost:5173`
2. Click pe **⚙️** (Settings) din bara de sus dreapta
3. La câmpul **"Backend URL"** înlocuiește cu URL-ul tunelului:
   ```
   https://random-words.trycloudflare.com
   ```
4. Click **"Salvează"**

Acum aplicația locală folosește backend-ul prin tunel.

---

### Pasul 4 — START.bat pornește tunelul automat

`START.bat` detectează și pornește tunelul automat dacă `cloudflared` e instalat.
URL-ul apare în fereastra **"AI Tunnel"**.

---

### Pasul 5 — URL FIX (opțional, necesită cont Cloudflare)

Dacă vrei același URL mereu:

1. Mergi la → https://dash.cloudflare.com
2. Creează cont gratuit cu emailul tău
3. **Zero Trust → Networks → Tunnels → Create a tunnel**
4. Selectează **Cloudflared** → urmează pașii
5. Notează **Tunnel ID** (format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
6. Rulează:
   ```
   cloudflared tunnel login
   ```
   Se deschide browserul → loghează-te cu contul Cloudflare
7. Editează `C:\Users\maher\.cloudflared\config.yml`:
   ```yaml
   tunnel: TUNNEL_ID_TAU
   credentials-file: C:\Users\maher\.cloudflared\TUNNEL_ID_TAU.json
   ingress:
     - service: http://localhost:8000
   ```
8. Pornește tunelul:
   ```
   cloudflared tunnel run personal-ai-backend
   ```

---

## PARTEA 2 — CLOUDFLARE PAGES (Frontend online)

> Pune site-ul (interfața) online gratuit pe Cloudflare Pages.

### Pasul 1 — Build frontend

```
cd C:\Users\maher\Desktop\retail-engine\frontend
npm run build
```
Creează folderul `dist\` cu site-ul compilat.

### Pasul 2 — Instalează Wrangler (CLI Cloudflare)

```
npm install -g wrangler
```

### Pasul 3 — Loghează-te în Cloudflare

```
wrangler login
```
Se deschide browserul → loghează-te.

### Pasul 4 — Deploy

```
cd C:\Users\maher\Desktop\retail-engine\frontend
wrangler pages deploy dist --project-name personal-ai-os
```

URL-ul site-ului tău va fi: `https://personal-ai-os.pages.dev`

### Pasul 5 — Configurează Backend URL

1. Mergi pe site: `https://personal-ai-os.pages.dev`
2. Click ⚙️ Settings
3. Introdu URL-ul tunelului Cloudflare
4. Click Salvează

---

## FLUX COMPLET ZILNIC

```
1. Pornește calculatorul
2. Dublu-click START.bat
3. Copiază URL-ul din fereastra "AI Tunnel"
4. Deschide aplicația (local sau Pages)
5. Settings → actualizează Backend URL (dacă s-a schimbat)
```

---

## TROUBLESHOOTING

**"cloudflared: command not found"**
→ Asigură-te că `cloudflared.exe` e în `C:\Windows\System32\`

**Tunelul se deconectează des**
→ Normal pentru Quick Tunnel. Folosește cont Cloudflare pentru stabilitate.

**Frontend-ul nu se conectează la backend**
→ Verifică că URL-ul din Settings e corect
→ Testează URL-ul în browser: `https://your-tunnel.trycloudflare.com/health`
→ Trebuie să apară: `{"status":"ok"}`

# Gmail — Notificări email în aplicație

## Ce face această funcție?
Aplicația verifică Gmail-ul la fiecare 30 secunde și îți arată notificări
pentru emailurile necitite direct în interfața AI OS.

---

## Pasul 1 — Creează un proiect Google Cloud

1. Mergi la: **https://console.cloud.google.com/**
2. Loghează-te cu contul Google pe care vrei să îl conectezi
3. Click pe **"Select a project"** (sus stânga) → **"New Project"**
4. Nume proiect: `Personal AI OS` → Click **"Create"**

---

## Pasul 2 — Activează Gmail API

1. În meniul stânga: **"APIs & Services"** → **"Library"**
2. Caută `Gmail API`
3. Click pe **Gmail API** → Click **"Enable"**

---

## Pasul 3 — Creează credențiale OAuth

1. **"APIs & Services"** → **"Credentials"**
2. Click **"+ Create Credentials"** → **"OAuth client ID"**
3. Dacă te cere să configurezi **"OAuth consent screen"**:
   - User Type: **External**
   - App name: `Personal AI OS`
   - Email: adresa ta
   - Salvează și continuă
4. Înapoi la credențiale:
   - Application type: **Desktop app**
   - Name: `AI OS Desktop`
   - Click **"Create"**
5. Va apărea o fereastră cu **Client ID** și **Client Secret**
6. Click **"Download JSON"** — salvează fișierul

---

## Pasul 4 — Generează token-ul de acces

Copiază fișierul descărcat în folderul `backend\` și redenumește-l `client_secret.json`.

Deschide un terminal în folderul `backend\`:
```
cd C:\Users\maher\Desktop\retail-engine\backend
.venv\Scripts\activate
python generate_gmail_token.py
```

Se va deschide browserul → loghează-te cu contul Google → aprobă accesul.
Se va crea automat fișierul `gmail_token.json` în folderul `backend\`.

---

## Pasul 5 — Adaugă în .env

Deschide `backend\.env` și adaugă:
```
GMAIL_TOKEN_PATH=gmail_token.json
```

Repornește backend-ul (`START.bat`).

---

## Notă importantă

Fișierele `client_secret.json` și `gmail_token.json` conțin date sensibile.
**Nu le partaja cu nimeni și nu le urca pe internet.**

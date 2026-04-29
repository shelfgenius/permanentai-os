# ▶️ PORNIRE ZILNICĂ — Personal AI OS

---

## CEA MAI SIMPLĂ METODĂ

**Dublu-click pe `START.bat`** din folderul `retail-engine`

Gata. Aplicația pornește automat în browser.

---

## CE FACE START.BAT AUTOMAT

| Pas | Ce pornește | Unde |
|-----|-------------|------|
| 1 | Backend AI (Python) | `http://localhost:8000` |
| 2 | Frontend UI (React) | `http://localhost:5173` |
| 3 | Cloudflare Tunnel | URL afișat în fereastra "AI Tunnel" |
| 4 | Deschide browserul | `http://localhost:5173` |

---

## DACĂ CEVA NU PORNEȘTE

### Backend nu pornește (fereastra "AI Backend" arată erori)
```
cd C:\Users\maher\Desktop\retail-engine\backend
.venv\Scripts\activate
python main.py
```
Dacă apare eroare → citește mesajul de eroare și verifică `.env`

### Frontend nu pornește (fereastra "AI Frontend" arată erori)
```
cd C:\Users\maher\Desktop\retail-engine\frontend
npm install
npm run dev
```

### AI-ul nu răspunde
1. Verifică că backend-ul rulează: deschide `http://localhost:8000/health`
2. Trebuie să apară: `{"status":"ok","version":"1.0.0"}`
3. Dacă nu apare → repornește backend-ul

### Ollama (AI local) nu funcționează
```
ollama serve
```
Sau repornește calculatorul (Ollama pornește automat)

---

## OPRIRE CORECTĂ

Închide ferestrele:
- **AI Backend** (cmd window)
- **AI Frontend** (cmd window)
- **AI Tunnel** (cmd window, dacă e deschisă)

Sau apasă `Ctrl+C` în fiecare fereastră.

---

## SHORTCUT PE DESKTOP

1. Click dreapta pe `START.bat`
2. Click **"Trimite la" → "Desktop (creează scurtătură)"**
3. Acum ai iconița pe desktop
4. Dublu-click pe iconița de pe desktop = pornire rapidă

---

## PORNIRE LA STARTUP WINDOWS (opțional)

1. Apasă `Win+R` → scrie `shell:startup` → Enter
2. Copiază scurtătura `START.bat` în folderul care s-a deschis
3. La fiecare pornire Windows, aplicația va porni automat

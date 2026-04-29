# 🔑 CHEI API GRATUITE — Groq, Gemini, Mistral

> Aceste chei îți dau acces la AI rapid în cloud. **Toate sunt gratuite.**

---

## 🏆 GROQ — CEL MAI RAPID (recomandat)

**Limită gratuită:** 14,400 requests/zi · Răspuns sub 1 secundă

### Cum obții cheia:
1. Mergi la → https://console.groq.com/keys
2. Click **"Sign Up"** → cont cu Google sau email
3. Click **"Create API Key"**
4. Copiază cheia (începe cu `gsk_`)
5. O-o adaugi în `backend\.env`:
```
GROQ_API_KEY=gsk_CHEIA_TA_AICI
```

---

## 🔮 GOOGLE GEMINI — GRATUIT

**Limită gratuită:** 15 req/min · 1,500 req/zi

### Cum obții cheia:
1. Mergi la → https://aistudio.google.com/apikey
2. Loghează-te cu contul Google
3. Click **"Create API key"**
4. Selectează un proiect (sau creează unul nou)
5. Copiază cheia (începe cu `AIza`)
6. O-o adaugi în `backend\.env`:
```
GEMINI_API_KEY=AIzaSy...CHEIA_TA
```

---

## 🌀 MISTRAL — GRATUIT

**Limită gratuită:** 1 req/sec · tier gratuit

### Cum obții cheia:
1. Mergi la → https://console.mistral.ai
2. **Sign Up** → cont cu email
3. **API Keys** → **Create new key**
4. Copiază cheia
5. O-o adaugi în `backend\.env`:
```
MISTRAL_API_KEY=CHEIA_TA_AICI
```

---

## 🔄 TOGETHER AI — $5 CREDIT GRATUIT

1. Mergi la → https://api.together.ai
2. Sign Up → primești $5 credit gratuit
3. Settings → API Keys → Create
4. Adaugă în `.env`:
```
TOGETHER_API_KEY=CHEIA_TA_AICI
```

---

## CUM FUNCȚIONEAZĂ SISTEMUL

AI-ul încearcă providerii în ordine:
```
1. Groq (cel mai rapid)
2. Gemini
3. Mistral
4. Together AI
5. Ollama (local, mereu disponibil)
```

Dacă unul nu funcționează → trece automat la următorul.

---

## EDITAREA FIȘIERULUI .ENV

1. Deschide `retail-engine\backend\.env` cu **Notepad** sau **VS Code**
2. Găsește liniile cu `API_KEY`
3. Înlocuiește `=` după cheie cu valoarea ta
4. Salvează fișierul (Ctrl+S)
5. Repornește backend-ul (închide și redeschide `START.bat`)

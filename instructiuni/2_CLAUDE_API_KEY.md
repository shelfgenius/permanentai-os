# Claude API Key — AI Premium (Antropic)

## Ce este Claude?
Claude este cel mai inteligent AI creat de Anthropic — răspunsuri mai bune decât ChatGPT pe anumite taskuri complexe. Funcționează imediat, fără să ruleze pe calculatorul tău (nu consumă resurse locale).

> **Alternative:** Dacă nu vrei cheie API, folosește Ollama gratuit local (vezi `1_OLLAMA_AI_GRATUIT.md`)

---

## Cum obții un API Key

### Pasul 1 — Cont Anthropic
1. Mergi la: **https://console.anthropic.com/**
2. Creează un cont cu email-ul tău
3. Verifică email-ul și loghează-te

### Pasul 2 — Generează cheie
1. În dashboard, click pe **"Get API Keys"** sau **"Create API Key"**
2. Click **"Create Key"**
3. Copiază cheia — arată ca: `sk-ant-api03-...`

> ⚠️ **ATENȚIE:** Cheia se vede doar o dată! Salveaz-o într-un fișier text înainte să închizi fereastra.

---

## Configurare în aplicație

### Opțiunea A — Editezi fișierul `.env`

1. Deschide `backend\.env` în Notepad
2. Înlocuiește:
```
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-api03-CHEIA_TA_AICI
ANTHROPIC_MODEL=claude-3-5-haiku-20241022
```

### Opțiunea B — SETUP.bat creează automat (recomandat)

Dacă rulezi `SETUP.bat`, va crea `.env` cu Claude deja configurat. Doar adaugă cheia ta în loc de `PUNE_CHEIA_TA_CLAUDE_AICI`.

---

## Modele Claude disponibile

| Model | Preț | Calitate | Viteză | Când să-l folosești |
|-------|------|----------|--------|---------------------|
| `claude-3-5-haiku-20241022` | $0.80/milion token | ⭐⭐⭐⭐ | ⚡ Foarte rapid | Cea mai bună alegere pentru aplicații rapide |
| `claude-3-5-sonnet-20241022` | $3/milion token | ⭐⭐⭐⭐⭐ | Rapid | Complexitate medie, precizie ridicată |
| `claude-3-opus-20240229` | $15/milion token | ⭐⭐⭐⭐⭐⭐ | Mediu | Taskuri extrem de complexe |

**Recomandare:** Începe cu `claude-3-5-haiku-20241022` — e cel mai rapid și ieftin.

---

## Cost estimativ

| Utilizare | Cost lunar estimat |
|-----------|-------------------|
| Ușoară (10-20 mesaje/zi) | ~$3-8 |
| Moderată (50-100 mesaje/zi) | ~$15-30 |
| Intensivă (200+ mesaje/zi) | ~$50-100 |

---

## Testare

După ce adaugi cheia și repornești backend-ul (`START.bat`), deschide:
- http://localhost:8000/docs (Swagger UI)
- Trimite un mesaj de test la `/chat/stream`

Sau testează direct în aplicație — mascota ar trebui să răspundă imediat.

---

## Probleme comune

### "Failed to fetch" la login
Backend-ul nu rulează. Deschide `START.bat` și așteaptă să pornească complet.

### "No credits" sau "Rate limit"
Ai depășit limita gratuită. Adaugă un card de credit în contul Anthropic.

### Răspunsuri lente
Schimbă modelul în `.env` la `claude-3-5-haiku-20241022` pentru viteză maximă.

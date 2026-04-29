# OpenAI API Key — AI Premium (opțional)

## Când ai nevoie de OpenAI?
- Dacă vrei răspunsuri mai rapide și mai precise decât Ollama local
- Dacă calculatorul tău e slab și Ollama e prea lent
- Dacă vrei vocea mascotei prin OpenAI TTS (calitate superioară)

> **Fără OpenAI funcționează** — aplicația folosește Ollama gratuit + vocea browserului.

---

## Cum obții un API Key

1. Mergi la: **https://platform.openai.com/api-keys**
2. Creează un cont sau loghează-te
3. Click **"Create new secret key"**
4. Copiază cheia (arată ca `sk-proj-...`)

> ⚠️ Cheia se vede o singură dată! Copiaz-o imediat.

---

## Adăugare în aplicație

Deschide fișierul `backend\.env` în Notepad și schimbă:
```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-cheia-ta-aici
```

Repornește backend-ul (`START.bat`).

---

## Cost estimativ

| Utilizare | Cost lunar estimat |
|-----------|--------------------|
| Casual (1-5 mesaje/zi) | $0.50 - $2 |
| Moderat (20-50 mesaje/zi) | $5 - $15 |
| Intens (100+ mesaje/zi) | $20 - $50 |

Modelul implicit este `gpt-4o-mini` (cel mai ieftin cu calitate bună).

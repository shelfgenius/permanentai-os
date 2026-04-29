# 🤖 OLLAMA — AI GRATUIT LOCAL

> Ollama rulează AI-ul direct pe calculatorul tău. **100% gratuit, fără internet.**

---

## INSTALARE (o singură dată)

### Pasul 1 — Descarcă Ollama
1. Mergi la → https://ollama.ai/download
2. Click **"Download for Windows"**
3. Rulează fișierul `.exe` descărcat
4. Urmează pașii de instalare (Next → Next → Install)

### Pasul 2 — Descarcă modelul AI
Deschide **Command Prompt** (Win+R → cmd → Enter) și scrie:
```
ollama pull llama3.2
```
- Descarcă ~2 GB. Durată: 5-15 minute (depinde de conexiune)
- Când termină, scrie `ollama list` — trebuie să apară `llama3.2`

### Pasul 3 — Verificare
```
ollama run llama3.2
>>> Salut!
```
Dacă răspunde, totul e OK. Scrie `/bye` pentru a ieși.

---

## MODELE OPȚIONALE (mai puternice)

```
ollama pull mistral          # 4GB - mai inteligent
ollama pull llama3.1:8b      # 5GB - echilibrat viteză/calitate
ollama pull phi3             # 2GB - mai mic, mai rapid
```

Pentru a schimba modelul, editează `backend\.env`:
```
OLLAMA_MODEL=mistral
```

---

## PROBLEME FRECVENTE

**"ollama: command not found"**
→ Repornește calculatorul după instalare

**Răspuns lent (>30 sec)**
→ Folosește Groq API gratuit în loc (vezi `2_API_KEYS.md`)

**Eroare la download**
→ Verifică conexiunea la internet și spațiul pe disc (minim 4GB liber)

---

## NOTE IMPORTANTE

- Ollama pornește automat cu Windows după instalare
- Rulează pe `http://localhost:11434`
- AI-ul funcționează chiar și fără internet (după descărcare)
- `START.bat` pornește Ollama automat dacă nu rulează

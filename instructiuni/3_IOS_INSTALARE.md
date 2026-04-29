# 📱 INSTALARE PE iPHONE / iPAD

> Aplica ta poate fi accesată de pe iPhone ca o aplicație nativă (PWA).
> Nu e nevoie de App Store — se instalează direct din browser.

---

## CERINȚE

- iPhone cu iOS 14+ sau iPad cu iPadOS 14+
- Safari (browserul Apple, nu Chrome)
- Personal AI OS să fie accesibil online (prin Cloudflare Tunnel)

---

## PASUL 1 — Fă aplicația accesibilă online

Trebuie să ai Cloudflare Tunnel activ. Urmează pașii din `7_CLOUDFLARE.md`.

URL-ul tău va arăta ca: `https://cuvinte-random.trycloudflare.com`

---

## PASUL 2 — Deschide pe iPhone

1. Deschide **Safari** pe iPhone (nu Chrome, nu Firefox!)
2. Scrie URL-ul tău Cloudflare în bara de adrese
3. Exemplu: `https://random-words.trycloudflare.com`
4. Apasă Enter și așteaptă să se încarce

---

## PASUL 3 — Instalează ca aplicație

1. Apasă butonul **Partajare** (pătratul cu săgeată în sus ⬆️) din bara Safari
2. Scrollează în jos în meniu
3. Apasă **"Adaugă pe ecranul principal"** (Add to Home Screen)
4. Schimbă numele dacă vrei (ex: "Personal AI")
5. Apasă **"Adaugă"** în colțul dreapta sus

---

## PASUL 4 — Folosește aplicația

1. Mergi pe **ecranul principal** al iPhone-ului
2. Găsește iconița **"Personal AI"**
3. Apasă pe ea — se deschide ca o aplicație nativă (fără bara Safari)
4. Loghează-te cu contul tău

---

## IMPORTANT — Conexiunea cu backend-ul

La fiecare pornire a aplicației, verifică:
1. `START.bat` rulează pe calculatorul tău Windows
2. Cloudflare Tunnel este activ
3. iPhone-ul și calculatorul sunt conectate la internet

> ⚠️ Dacă URL-ul Cloudflare s-a schimbat (Quick Tunnel se schimbă la fiecare restart):
> Mergi în app → Settings (⚙️) → actualizează Backend URL

---

## TROUBLESHOOTING

**Aplicația nu se deschide / eroare de conexiune**
→ Verifică că `START.bat` rulează
→ Verifică URL-ul tunelului în Settings

**Ecranul e prea mic / elementele se suprapun**
→ Rotește iPhone-ul în landscape (orizontal)

**Audio nu funcționează pe iPhone**
→ Dezactivează modul silențios (comutatorul din lateral)
→ Crește volumul

**Nu apare "Adaugă pe ecranul principal"**
→ Ești sigur că folosești Safari (nu Chrome)?
→ Derulează mai jos în meniul de partajare

# WhatsApp & Instagram — Notificări în aplicație

## Ce face această funcție?
Aplicația primește mesaje WhatsApp și Instagram direct în interfața AI OS,
ca notificări în timp real.

## ⚠️ Important — Cerință tehnică
WhatsApp și Instagram necesită un **URL public** (adresă de internet) pentru webhook.
Calculatorul tău de acasă nu are URL public implicit.

**Ai 2 opțiuni:**
- **Opțiunea A** — ngrok (gratuit, simplu, recomandat pentru uz personal)
- **Opțiunea B** — server cloud (mai complex, pentru uz permanent)

---

# WHATSAPP

## Pasul 1 — Cont Meta Business

1. Mergi la: **https://developers.facebook.com/**
2. Loghează-te cu contul Facebook/Meta
3. Click **"My Apps"** → **"Create App"**
4. Tip: **Business** → Next
5. Nume: `Personal AI OS` → Create

---

## Pasul 2 — Activează WhatsApp

1. În dashboard-ul aplicației → **"Add Product"**
2. Găsește **WhatsApp** → Click **"Set Up"**
3. Urmează pașii pentru a lega un număr de telefon de test

---

## Pasul 3 — URL public cu ngrok

1. Descarcă ngrok: **https://ngrok.com/download**
2. Creează cont gratuit pe ngrok.com și copiază auth token-ul
3. Deschide un terminal și configurează:
   ```
   ngrok config add-authtoken TOKEN_TAU_NGROK
   ```
4. Pornește tunelul (cu aplicația rulând):
   ```
   ngrok http 8000
   ```
5. Va apărea o adresă de tip `https://abc123.ngrok.io` — copiaz-o

---

## Pasul 4 — Configurare Webhook în Meta

1. În Meta Developers → aplicația ta → **WhatsApp → Configuration**
2. **Callback URL**: `https://abc123.ngrok.io/social/whatsapp/webhook`
3. **Verify Token**: scrie orice parolă (ex: `personal-ai-2025`)
4. Click **Verify and Save**

---

## Pasul 5 — Adaugă în .env

```
WHATSAPP_VERIFY_TOKEN=personal-ai-2025
```

---

# INSTAGRAM

Instagram folosește același sistem Meta ca WhatsApp.

## Pasul 1 — Activează Instagram în Meta App

1. În dashboard-ul Meta App → **"Add Product"** → **Instagram**
2. Leagă un cont Instagram Business/Creator

## Pasul 2 — Configurare Webhook

1. **Instagram → Webhooks**
2. **Callback URL**: `https://abc123.ngrok.io/social/instagram/webhook`
3. Subscrie la evenimentele: `messages`

---

# NOTĂ FINALĂ

**ngrok URL-ul se schimbă la fiecare repornire** (plan gratuit).
Dacă repornești ngrok, trebuie să actualizezi URL-ul în Meta Developers.

**Plan recomandat pentru uz permanent:**
Cumpără planul ngrok Static Domain (~$8/lună) pentru un URL fix.

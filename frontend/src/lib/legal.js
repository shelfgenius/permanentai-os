/**
 * Legal content for AI Operator OS.
 *
 *  - `TERMS`: full Terms & Conditions, Romanian + English.
 *  - `PROVIDERS`: upstream services whose policies we pass through.
 *  - `TC_VERSION`: bump whenever the text changes to force users to re-accept.
 */

export const TC_VERSION = '2026.04.21';

export const TERMS = {
  ro: {
    title: 'Termeni și Condiții — AI Operator OS',
    lastUpdated: `Ultima actualizare: ${TC_VERSION}`,
    sections: [
      {
        h: '1. Natura serviciului',
        p: `AI Operator OS este o interfață personală care unifică multiple modele AI (chat, imagine, voce), un asistent GPS de bord (Mappy) și module de productivitate. Aplicația este oferită "ca atare", fără garanții de disponibilitate continuă, acuratețe sau adecvare la un scop anume.`,
      },
      {
        h: '2. Limitările modelelor AI',
        p: `Răspunsurile generate de modelele de limbaj, imagine sau voce pot fi eronate, părtinitoare, învechite sau fabricate ("halucinații"). Nu utiliza aceste rezultate ca sfat medical, juridic, financiar, tehnic de siguranță sau profesional fără verificare independentă. Tu ești responsabil pentru orice decizie luată pe baza output-urilor.`,
      },
      {
        h: '3. Asistentul de condus (Mappy) — AVERTISMENT DE SIGURANȚĂ',
        p: `Mappy este un instrument informativ de planificare a rutelor și avertizare de radare/rovinietă. NU ESTE UN SISTEM AUTONOM DE CONDUCERE. Conducătorul auto poartă întreaga răspundere legală și civilă pentru respectarea Codului Rutier (Legea 49/2006 și O.U.G. 195/2002), pentru atenția la drum și pentru comenzile vehiculului. Nu privi ecranul în timpul conducerii. Ignoră indicațiile Mappy dacă intră în conflict cu realitatea din trafic, semnalizarea rutieră oficială sau instrucțiunile poliției. Datele despre radare/ANPR pot fi incomplete sau incorecte.`,
      },
      {
        h: '4. Autentificare și conturi',
        p: `Autentificarea se face via Supabase, cu posibilitate de conectare prin Google sau GitHub (OAuth 2.0). Ești responsabil pentru securitatea contului, a parolei și a dispozitivelor tale. Notifică imediat orice utilizare neautorizată.`,
      },
      {
        h: '5. Date procesate',
        p: `Prompturile text, fișierele încărcate și comenzile vocale sunt trimise către modelul AI selectat (local sau cloud) pentru a genera răspunsul. Locația GPS este folosită doar local în browser pentru Mappy și nu este stocată pe serverele noastre. Email-ul și metadatele OAuth sunt stocate în Supabase. Nu introdu în aplicație date confidențiale despre terți fără acordul lor.`,
      },
      {
        h: '6. Proprietate intelectuală',
        p: `Drepturile asupra output-urilor generate respectă termenii modelului AI folosit (vezi /certs). Conținutul tău introdus rămâne al tău. Nu genera conținut ilegal, discriminatoriu, care încalcă drepturi de autor sau care exploatează minori.`,
      },
      {
        h: '7. Modificări și încetare',
        p: `Îmi rezerv dreptul de a modifica acești termeni. La o modificare majoră vei fi solicitat să reaccepți. Pot suspenda conturile care încalcă acești termeni sau legea română/europeană aplicabilă.`,
      },
      {
        h: '8. Lege aplicabilă',
        p: `Acești termeni sunt guvernați de legislația României și de Regulamentul General privind Protecția Datelor (GDPR, UE 2016/679). Forul competent: instanțele judecătorești din Constanța.`,
      },
    ],
  },
  en: {
    title: 'Terms & Conditions — AI Operator OS',
    lastUpdated: `Last updated: ${TC_VERSION}`,
    sections: [
      {
        h: '1. Nature of the service',
        p: `AI Operator OS is a personal front-end that unifies multiple AI models (chat, image, voice), an in-car GPS assistant (Mappy) and productivity modules. The app is provided "as is", with no guarantee of continuous uptime, accuracy, or fitness for any particular purpose.`,
      },
      {
        h: '2. AI model limitations',
        p: `Outputs from language, image or voice models may be wrong, biased, outdated or fabricated ("hallucinations"). Do not rely on them as medical, legal, financial, safety-critical or professional advice without independent verification. You are responsible for every decision based on the outputs.`,
      },
      {
        h: '3. Driving assistant (Mappy) — SAFETY WARNING',
        p: `Mappy is an informational route planner and radar / vignette alerter. IT IS NOT AN AUTONOMOUS DRIVING SYSTEM. The driver bears full legal and civil responsibility for obeying traffic laws, staying attentive and controlling the vehicle. Do not look at the screen while driving. Disregard Mappy guidance whenever it conflicts with actual road conditions, official signs or police instructions. Radar / ANPR datasets may be incomplete or outdated.`,
      },
      {
        h: '4. Authentication & accounts',
        p: `Authentication goes through Supabase, with Google or GitHub OAuth 2.0 available. You are responsible for the security of your account, password and devices. Report any unauthorised use immediately.`,
      },
      {
        h: '5. Data processed',
        p: `Text prompts, uploaded files and voice commands are sent to the selected AI model (local or cloud) to produce the response. GPS location is used only locally in the browser for Mappy; it is not stored on our servers. Your email and OAuth metadata are stored in Supabase. Do not enter confidential third-party data without consent.`,
      },
      {
        h: '6. Intellectual property',
        p: `Rights to generated outputs follow the upstream AI model's terms (see /certs). Your input content remains yours. Do not generate illegal, discriminatory, copyright-infringing or child-exploitative content.`,
      },
      {
        h: '7. Changes & termination',
        p: `I reserve the right to modify these terms. On a material change you will be asked to re-accept. Accounts breaching these terms or applicable Romanian / EU law may be suspended.`,
      },
      {
        h: '8. Governing law',
        p: `These terms are governed by Romanian law and GDPR (EU 2016/679). Venue: courts of Constanța, Romania.`,
      },
    ],
  },
};

/**
 * Upstream providers whose legal terms flow through this app.
 * Displayed on /certs. Add every new model / API here before shipping it.
 */
export const PROVIDERS = [
  {
    name: 'Supabase',
    role: 'Autentificare + bază de date',
    terms: 'https://supabase.com/terms',
    privacy: 'https://supabase.com/privacy',
    dpa: 'https://supabase.com/legal/dpa',
  },
  {
    name: 'Google OAuth',
    role: 'Login social',
    terms: 'https://policies.google.com/terms',
    privacy: 'https://policies.google.com/privacy',
  },
  {
    name: 'GitHub OAuth',
    role: 'Login social',
    terms: 'https://docs.github.com/en/site-policy/github-terms/github-terms-of-service',
    privacy: 'https://docs.github.com/en/site-policy/privacy-policies/github-privacy-statement',
  },
  {
    name: 'OpenAI',
    role: 'Modele LLM cloud',
    terms: 'https://openai.com/policies/terms-of-use/',
    privacy: 'https://openai.com/policies/privacy-policy/',
  },
  {
    name: 'Anthropic Claude',
    role: 'Modele LLM cloud',
    terms: 'https://www.anthropic.com/legal/consumer-terms',
    privacy: 'https://www.anthropic.com/legal/privacy',
  },
  {
    name: 'NVIDIA NIM',
    role: 'Generare imagine (SD3M) + TTS multilingv (Magpie)',
    terms: 'https://www.nvidia.com/en-us/about-nvidia/terms-of-service/',
    privacy: 'https://www.nvidia.com/en-us/about-nvidia/privacy-policy/',
  },
  {
    name: 'Coqui XTTS v2',
    role: 'TTS local (MPL-2.0)',
    terms: 'https://coqui.ai/cpml',
    privacy: null,
  },
  {
    name: 'ElevenLabs',
    role: 'TTS cloud (opțional)',
    terms: 'https://elevenlabs.io/terms-of-use',
    privacy: 'https://elevenlabs.io/privacy-policy',
  },
  {
    name: 'Microsoft Edge TTS',
    role: 'TTS cloud gratuit (browser)',
    terms: 'https://www.microsoft.com/en-us/servicesagreement',
    privacy: 'https://privacy.microsoft.com/en-us/privacystatement',
  },
  {
    name: 'OpenStreetMap',
    role: 'Tiles harta standard',
    terms: 'https://www.openstreetmap.org/copyright',
    privacy: 'https://wiki.osmfoundation.org/wiki/Privacy_Policy',
  },
  {
    name: 'Esri / ArcGIS',
    role: 'Tiles harta satelit',
    terms: 'https://www.esri.com/en-us/legal/terms/full-master-agreement',
    privacy: 'https://www.esri.com/en-us/privacy/overview',
  },
  {
    name: 'OSRM',
    role: 'Rutare auto',
    terms: 'https://github.com/Project-OSRM/osrm-backend/blob/master/LICENSE.TXT',
    privacy: null,
  },
  {
    name: 'Nominatim',
    role: 'Geocodare adrese',
    terms: 'https://operations.osmfoundation.org/policies/nominatim/',
    privacy: null,
  },
  {
    name: 'Cloudflare',
    role: 'Pages hosting + Tunnel',
    terms: 'https://www.cloudflare.com/terms/',
    privacy: 'https://www.cloudflare.com/privacypolicy/',
  },
];

import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import RouteEditor from './RouteEditor.jsx';

/* ══════════════════════════════════════════════════════════
   FOAIE DE PENALIZARE — transcriere exactă din documentul oficial
   Sursa: Fișa de evaluare practică categoria B, Romania
   ══════════════════════════════════════════════════════════ */
const PENALIZARI_OFICIALE = [
  /* ── I. Pregătire tehnică ─────────────────────────────── */
  {
    sectiune: 'I. Pregătirea și verificarea tehnică a autovehiculului',
    items: [
      { cod: 'T1', text: 'Verificarea prin intermediul aparaturii de bord sau a comenzilor autovehiculului a funcționarii directiei, frânei, instalatiei de ungere/racire, luminilor, semnalizarilor si a avertizorului sonor', puncte: 3 },
      { cod: 'T2', text: 'Reglarea scaunului, a oglinzilor retrovizoare, nefixarea centurii de siguranță, neeliberarea frânei de ajutor', puncte: 6 },
      { cod: 'T3', text: 'Necunoașterea aparaturii de bord a comenzilor autovehiculului', puncte: 9 },
    ],
  },
  /* ── II. Manevrare și poziție ─────────────────────────── */
  {
    sectiune: 'II. Manevrarea și poziția autovehiculului în timpul mersului',
    items: [
      { cod: 'M1', text: 'Nesincronizarea comenzilor (oprirea motorului, accelerarea excesivă, folosirea incorectă a treptelor de viteza)', puncte: 6 },
      { cod: 'M2', text: 'Nemenținerea direcției de mers', puncte: 9 },
      { cod: 'M3', text: 'Folosirea incorectă a drumului cu sau fără marcaj', puncte: 6 },
      { cod: 'M4', text: 'Încrucișarea cu alte vehicule, inclusiv în spații restrânse', puncte: 6 },
      { cod: 'M5', text: 'Mersul înapoi, oprirea și pornirea din rampă, parcarea cu față, spatele sau lateral', puncte: 5 },
      { cod: 'M6', text: 'Întoarcerea vehiculului cu fața în sens opus prin efectuarea manevrelor de mers înainte și înapoi', puncte: 5 },
      { cod: 'M7', text: 'Întoarcerea pe o stradă cu mai multe benzi de circulatie pe sens', puncte: 5 },
      { cod: 'M8', text: 'Conducerea în mod neeconomic și agresiv pentru mediul înconjurator', puncte: 5 },
    ],
  },
  /* ── Viraje ───────────────────────────────────────────── */
  {
    sectiune: 'Schimbarea direcției de mers și efectuarea virajelor',
    items: [
      { cod: 'V1', text: 'Neasigurarea la schimbarea direcției de mers / la parasirea locului de staționare', puncte: 9 },
      { cod: 'V2', text: 'Executarea neregulamentară a virajelor', puncte: 6 },
      { cod: 'V3', text: 'Nesemnalizarea sau semnalizarea greșită a schimbarii direcției de mers', puncte: 6 },
    ],
  },
  /* ── Intersecții ──────────────────────────────────────── */
  {
    sectiune: 'Circulația în intersecții, poziții în timpul mersului',
    items: [
      { cod: 'I1', text: 'Neîncadrarea necorespunzătoare în raport cu direcția de mers dorită', puncte: 6 },
      { cod: 'I2', text: 'Efectuarea unor manevre interzise (oprire, staționare, întoarcere, mers înapoi)', puncte: 6 },
      { cod: 'I3', text: 'Neasigurare la pătrunderea în intersecții', puncte: 9 },
      { cod: 'I4', text: 'Nepastrarea distanței suficiente față de cei care rulează înainte sau vin din sens opus', puncte: 9 },
    ],
  },
  /* ── Depășire ─────────────────────────────────────────── */
  {
    sectiune: 'Depășirea',
    items: [
      { cod: 'D1', text: 'Ezitarea repetată de a depăși alte vehicule', puncte: 6 },
      { cod: 'D2', text: 'Nerespectarea regulilor de executare a depășirii ori efectuarea acestora în locuri și situații interzise', puncte: 21 },
    ],
  },
  /* ── Prioritate ───────────────────────────────────────── */
  {
    sectiune: 'Prioritatea',
    items: [
      { cod: 'P1', text: 'Neacordarea prioritatii vehiculelor și pietonilor care au acest drept (intersecții, sens giratoriu, statie transport în comun cu alveolă, stație tramvai fără refugiu pentru pietoni, trecere de pietoni)', puncte: 21 },
    ],
  },
];

/* Prag de respingere: 21p individual sau total acumulat >= 21p
   Notă: în practică examinatorii pot respinge și sub 21p acumulate,
   dar 21p individual = respins imediat conform documentului oficial */
const PRAG_RESPINGERE = 21;

/* ══════════════════════════════════════════════════════════
   TRASEUL REAL — coordonate din harta Apple Maps furnizată
   Traseu: Parcare Bd. Mamaia → Delfinariu → Str. Soveja →
           Str. Razboieni → Str. Cituz → Str. Ion Rațiu → retur
   NOTĂ: Coordonatele sunt aproximative, calibrate pe Delfinariu
   (44.1762N, 28.6508E) conform harta furnizată de utilizator
   ══════════════════════════════════════════════════════════ */
const TRASEU = [
  {
    id: 0,
    titlu: '🅿️ START — Parcare Bd. Mamaia (nord Delfinariu)',
    descriere: 'Ești în parcarea de pe Bulevardul Mamaia, între Delfinariu și Rompetrol/Vaporaș (traseul galben de pe hartă, capătul de nord). Motorul pornit, frâna de ajutor trasă.',
    procedura: [
      'Verifică bord: combustibil, frână, lumini (3p penalizare dacă sari peste)',
      'Centura de siguranță — OBLIGATORIU înainte de a porni',
      'Reglează oglinda stânga, față, dreapta (6p dacă nu)',
      'Semnalizează DREAPTA',
      'Verifică unghiul mort stânga (întoarce capul)',
      'Eliberează frâna de ajutor treptat — ieși pe Bd. Mamaia spre SUD',
    ],
    coords: [44.1840, 28.6515],
    intrebare: 'Ieși din parcare. Trebuie să ajungi la semafor Delfinariu. Ce direcție iei pe Bd. Mamaia?',
    optiuni: [
      { text: '⬇️ Spre SUD — spre Delfinariu', corect: true, explicatie: 'Corect! Traseul merge spre Sud pe Bd. Mamaia (linia galbenă de pe hartă) până la semaforul de la Delfinariu.' },
      { text: '⬆️ Spre NORD', corect: false, cod: 'V1', explicatie: 'Greșit. Direcția corectă este spre Sud, spre Delfinariu. Neasigurare la ieșire din parcare = 9p.' },
    ],
    sfat: '💡 Examinatorul bifează dacă ai verificat oglinzile și ai semnalizat la ieșire din parcare.',
    culoare: '#00d4ff',
  },
  {
    id: 1,
    titlu: '🚦 Semafor Delfinariu — Bd. Mamaia',
    descriere: 'Ai ajuns la semaforul de la Delfinariu pe Bulevardul Mamaia. Semaforul arată ROȘU. Examinatorul observă tot ce faci.',
    procedura: [
      'Frânezi progresiv din timp — nu brusc',
      'Oprești COMPLET în dreptul liniei de stop',
      'Treapta neutră',
      'La verde: verifici că intersecția e liberă, apoi pornești',
    ],
    coords: [44.1762, 28.6510],
    intrebare: 'Semaforul este ROȘU. Ești singurul pe drum. Ce faci?',
    optiuni: [
      { text: '🛑 Opresc complet la linia de stop și aștept verde', corect: true, explicatie: 'Corect! Oprire completă obligatorie la roșu, indiferent dacă e liber.' },
      { text: '🚗 Trec încet, nu e nimeni', corect: false, cod: 'I2', eliminatoriu: true, explicatie: '⚠️ ATENȚIE: Nerespectare semnal roșu = manevră interzisă (6p) + risc eliminare imediată. Roșu înseamnă STOP total.' },
    ],
    sfat: '💡 Examinatorul verifică dacă roțile s-au oprit complet. Oprire lentă fără stop total = penalizare.',
    culoare: '#ff4444',
  },
  {
    id: 2,
    titlu: '↗️ Viraj Dreapta — Intrare Str. Soveja',
    descriere: 'La semaforul Delfinariu devii verde. Examinatorul spune: "Virați dreapta". Intri pe Strada Soveja (linia roz de pe hartă, mergând spre vest).',
    procedura: [
      'Verifică oglinda față, oglinda dreapta',
      'Semnalizezi DREAPTA — minim 30m înainte de intersecție (6p dacă semnalizezi după)',
      'Te încadrezi pe banda dreaptă',
      'Verifici pieton pe trecere (dacă există)',
      'Virezi strâns (nu larg — nu intri pe sensul opus)',
      'Pornești pe Str. Soveja treapta 1 → 2',
    ],
    coords: [44.1730, 28.6495],
    intrebare: 'Faci virajul dreapta pe Str. Soveja. Cum virezi corect?',
    optiuni: [
      { text: '✅ Semnalizez dreapta înainte, mă încadrez pe dreapta, virez strâns', corect: true, explicatie: 'Perfect! Viraj dreapta corect: semnalizare anticipată + curbă strânsă fără a invada sensul opus.' },
      { text: '❌ Virez larg prin mijlocul intersecției', corect: false, cod: 'V2', explicatie: 'Greșit! Virajul larg la dreapta = executare neregulamentară a virajului = 6p penalizare.' },
      { text: '❌ Semnalizez în timpul virajului', corect: false, cod: 'V3', explicatie: 'Greșit! Semnalizarea după ce ai început virajul = semnalizare greșită = 6p penalizare.' },
    ],
    sfat: '💡 Str. Soveja este îngustă. Mers pe treapta 2, viteză mică, atenție la mașini parcate pe lateral.',
    culoare: '#ff8c00',
  },
  {
    id: 3,
    titlu: '↙️ Coborâre spre Str. Razboieni — Zonă rezidențială',
    descriere: 'Ești pe Str. Soveja mergând spre vest. Examinatorul îți cere să virezi stânga pe strada ce coboară spre Str. Razboieni (linia roz pe hartă — intrare în zona rezidențială).',
    procedura: [
      'Verifică oglinda stânga',
      'Semnalizezi STÂNGA cu min. 30m înainte',
      'Încadrezi pe marginea stângă a benzii',
      'Verifici că nu vine nimeni din sens opus',
      'Verifici pieton pe trecere',
      'Virezi stânga — acorzi prioritate celor din față',
    ],
    coords: [44.1710, 28.6425],
    intrebare: 'Vine o mașină din față pe Str. Soveja (sens opus). Vrei să virezi stânga. Ce faci?',
    optiuni: [
      { text: '✅ Aștept să treacă mașina din sens opus, apoi virez', corect: true, explicatie: 'Corect! La viraj stânga cedezi trecerea celor din sens opus. Prioritatea lor este absolută.' },
      { text: '❌ Virez rapid că am semnalizat', corect: false, cod: 'P1', explicatie: 'GREȘEALĂ GRAVĂ! Semnalizarea nu anulează obligația de a ceda trecerea. Neacordare prioritate = 21p → respins.' },
    ],
    sfat: '💡 Regula fundamentală: viraj stânga = cedezi trecerea tuturor vehiculelor din sens opus + pietonilor.',
    culoare: '#a855f7',
  },
  {
    id: 4,
    titlu: '⚠️ CAPCANA — Str. Razboieni (prioritate dreapta)',
    descriere: 'Ești pe strada rezidențială, ajungi la intersecția cu Str. Razboieni. NU există indicator de prioritate. Mașini parcate pe colț — vizibilitate redusă spre dreapta. Aceasta este zona "capcană" din traseul Constanța.',
    procedura: [
      'Cu 20-30m înainte de intersecție: reduci la 5-10 km/h',
      'Apleci vizibil capul spre dreapta (examinatorul VERIFICĂ mișcarea capului)',
      'Apleci capul și spre stânga',
      'Dacă vine cineva din dreapta: OPRIRE COMPLETĂ — cedezi trecerea',
      'Dacă e liber: treci cu viteză mică rămânând atent',
      'Reiei treapta 2 abia după ce ai trecut intersecția',
    ],
    coords: [44.1660, 28.6400],
    intrebare: 'O mașină se apropie din DREAPTA de pe Str. Razboieni. Intersecție fără indicator. Ce faci?',
    optiuni: [
      { text: '✅ Opresc complet și îi acord prioritate', corect: true, explicatie: 'PERFECT! Prioritate de dreapta este regula de bază la intersecții fără indicatoare. Cel din dreapta are prioritate absolută.' },
      { text: '❌ Continui, strada mea pare mai mare', corect: false, cod: 'P1', eliminatoriu: true, explicatie: '21p = RESPINS IMEDIAT! Lățimea aparentă a drumului NU contează. Fără indicator = prioritate de dreapta, punct.' },
      { text: '❌ Claxonez și trec', corect: false, cod: 'P1', eliminatoriu: true, explicatie: '21p = RESPINS IMEDIAT! Claxonul nu dă prioritate. Tu cedezi, nu el.' },
    ],
    sfat: '⚠️ PE TOT TRASEUL PRIN ZONA REZIDENȚIALĂ: la fiecare intersecție fără semn = viteză 5-10 km/h + mișcare cap dreapta vizibilă. Asta caută examinatorul.',
    culoare: '#ff4444',
    critic: true,
  },
  {
    id: 5,
    titlu: '🔁 Continuare — Str. Cituz (verificare procedurală)',
    descriere: 'Continui prin zona rezidențială. Ajungi la intersecția cu Str. Cituz. Nu vine nimeni, dar examinatorul urmărește procedura ta la fiecare intersecție.',
    procedura: [
      'Reduci viteza la 5-10 km/h ÎNAINTE de intersecție',
      'Verifici stânga (întoarci capul — vizibil)',
      'Verifici dreapta (întoarci capul — OBLIGATORIU chiar dacă e liber)',
      'Dacă e liber: treci controlat',
      'Reiei viteza după ce ai depășit intersecția',
    ],
    coords: [44.1630, 28.6390],
    intrebare: 'La intersecția cu Str. Cituz nu vine nimeni. Ce faci?',
    optiuni: [
      { text: '✅ Reduc viteza, verific vizual stânga-dreapta, trec', corect: true, explicatie: 'Corect! Procedura de verificare se aplică la FIECARE intersecție, indiferent dacă vine sau nu cineva. Examinatorul notează mișcarea capului.' },
      { text: '❌ Merg normal, e clar liber', corect: false, cod: 'I3', explicatie: '9p penalizare! Neasigurare la pătrunderea în intersecție = 9p, chiar dacă era liber. Procedura e obligatorie.' },
    ],
    sfat: '💡 Mișcarea capului la dreapta și stânga este OBLIGATORIE la fiecare intersecție, verificată constant de examinator.',
    culoare: '#22d3ee',
  },
  {
    id: 6,
    titlu: '↪️ Str. Ion Rațiu — Viraj stânga spre est',
    descriere: 'Ajungi la Str. Ion Rațiu — strada principală din sudul traseului (vizibilă pe hartă). Examinatorul spune: "Virați stânga". Semaforul este verde.',
    procedura: [
      'Semnalizezi STÂNGA cu cel puțin 30m înainte',
      'Încadrezi pe marginea stângă a benzii',
      'La verde: verifici că nu mai vine nimeni din față pe Ion Rațiu',
      'Cedezi trecerea celor din față (sens opus)',
      'Verifici pietoni pe trecerea de pe Ion Rațiu',
      'Virezi stânga spre est (spre Bd. Mamaia)',
    ],
    coords: [44.1590, 28.6440],
    intrebare: 'La Ion Rațiu sunt 2 mașini care vin din față (sens opus) pe verde. Vrei să virezi stânga. Ce faci?',
    optiuni: [
      { text: '✅ Intru în intersecție, aștept să treacă, apoi virez', corect: true, explicatie: 'Corect! La semafor verde poți intra în intersecție și aștepți acolo să se elibereze sensul opus. Nu blochezi din spate.' },
      { text: '❌ Virez imediat, e verde', corect: false, cod: 'P1', eliminatoriu: true, explicatie: '21p = RESPINS! Verde nu dă prioritate față de sensul opus la viraj stânga. Ei au prioritate în continuare.' },
      { text: '❌ Aștept complet în afara intersecției', corect: false, explicatie: 'Acceptabil dar nu ideal. Blocheezi coada din spate inutil. Mai bine intri în intersecție și aștepți acolo.' },
    ],
    sfat: '💡 Str. Ion Rațiu este o arteră aglomerată. Atenție la viteză (30 km/h zona rezidențială) și la distanța față de mașinile din față.',
    culoare: '#3b82f6',
  },
  {
    id: 7,
    titlu: '🅿️ MANEVRĂ — Parcare laterală',
    descriere: 'Pe una din străzile rezidențiale (Razboieni sau Cituz), examinatorul spune: "Parcați între cele două mașini de pe dreapta". Spațiul este de aproximativ 1,5× lungimea mașinii tale.',
    procedura: [
      '1. Treci paralel cu mașina din față la ~50cm lateral',
      '2. Oprești când oglinda ta dreaptă e aliniată cu bara din spate a mașinii din față',
      '3. Semnalizezi DREAPTA',
      '4. Marșarier cu volan la DREAPTA (unghi ~45°) până oglinda dreapta vede colțul bordurii',
      '5. Îndrepți volanul: mașina intră paralel în spațiu',
      '6. Corectezi dacă e nevoie (fără a atinge bordura!)',
      '7. Frână de ajutor, treapta neutră',
      '⚠️ Distanța față de bordură: 15-30cm — nu o atingi niciodată',
    ],
    coords: [44.1645, 28.6395],
    intrebare: 'În timpul marșarierului pentru parcare laterală, cum știi când să îndrepți volanul?',
    optiuni: [
      { text: '✅ Când oglinda dreaptă îmi arată colțul bordurii, îndrept volanul', corect: true, explicatie: 'Corect! Tehnica standard. Oglinda dreaptă este ghidul tău în parcare laterală. Când vezi bordura în colțul oglinzii = îndrept.' },
      { text: '❌ Dau marșarier drept fără unghi', corect: false, cod: 'M5', explicatie: '5p penalizare. Marșarier drept = rămâi departe de bordură, nu intri corect în spațiu.' },
      { text: '❌ Intru cu botul înainte', corect: false, cod: 'M5', explicatie: '5p penalizare. Parcarea laterală se face OBLIGATORIU cu marșarier, nu cu botul înainte.' },
    ],
    sfat: '💡 Dacă atingi bordura cu roata = penalizare. Dacă atingi mașina alăturată = posibil eliminatoriu (producere accident).',
    manevra: true,
    culoare: '#f0c040',
  },
  {
    id: 8,
    titlu: '🔄 MANEVRĂ — Întoarcere din 3 mișcări',
    descriere: 'Pe Str. Razboieni sau Str. Cituz (stradă suficient de lată), examinatorul spune: "Întoarceți-vă din 3 mișcări".',
    procedura: [
      'MIȘCAREA 1 — Înainte:',
      '  • Semnalizezi STÂNGA',
      '  • Te apropii de marginea stângă a drumului',
      '  • Mergi înainte cu volanul complet spre stânga',
      '  • Oprești înainte să atingi bordura/trotuarul opus',
      'MIȘCAREA 2 — Marșarier:',
      '  • Semnalizezi DREAPTA',
      '  • Marșarier cu volanul complet spre dreapta',
      '  • Oprești când poți continua înainte în noua direcție',
      'MIȘCAREA 3 — Înainte:',
      '  • Mergi înainte, îndreptând volanul',
      '  • Semnalizezi în noua direcție',
      '⚠️ La fiecare mișcare: verifici față, spate, lateral — OBLIGATORIU',
    ],
    coords: [44.1650, 28.6405],
    intrebare: 'La mișcarea 1, nu ai mers suficient de mult înainte. Acum ai nevoie de 5 mișcări. Ce consecință are?',
    optiuni: [
      { text: '⚠️ Primesc penalizare, dar nu sunt eliminat automat din 5 mișcări', corect: true, explicatie: 'Corect. 5 mișcări = penalizare mai mare la M6 (Întoarcere față în sens opus = 5p), dar nu este eliminatoriu automat. Important: nu urci pe trotuar!' },
      { text: '❌ Sunt eliminat imediat dacă nu reușesc în 3 mișcări', corect: false, explicatie: 'Incorect. Norma nu spune că ești eliminat dacă faci mai mult de 3 mișcări. Primești penalizare suplimentară, dar continui examenul.' },
    ],
    sfat: '💡 Dacă strada e îngustă și simți că nu poți în 3 mișcări, comunică examinatorului. A ridica mâna și a spune "nu am spațiu" e mai bine decât să urci pe trotuar.',
    manevra: true,
    culoare: '#f0c040',
  },
  {
    id: 9,
    titlu: '🏁 FINAL — Retur Bd. Mamaia',
    descriere: 'Ai parcurs traseul rezidențial. Acum trebuie să te întorci la punctul de plecare pe Bulevardul Mamaia (linia galbenă de pe hartă, mergând spre nord).',
    procedura: [
      'Pe Ion Rațiu spre est: respectă limita 30 km/h zonă rezidențială',
      'La Bd. Mamaia: semnalizezi, verifici, acorzi prioritate traficului de pe bulevard',
      'Intri pe Bd. Mamaia spre nord',
      'La parcare: semnalizezi dreapta, verifici, intri în parcare',
      'Oprești: treapta neutră, frâna de ajutor, oprești motorul',
      'Examinatorul completează fișa — nu comenta, nu întreba până nu termină',
    ],
    coords: [44.1762, 28.6510],
    intrebare: 'Ai oprit în parcare. Cum finalizezi corect?',
    optiuni: [
      { text: '✅ Trag frâna de ajutor → treapta neutră → opresc motorul', corect: true, explicatie: 'Corect! Ordinea: frână ajutor + neutru + motor oprit. Nefolosire frână de ajutor = 6p (neasigurare la parasirea locului de staționare, cod V1).' },
      { text: '❌ Opresc motorul fără frâna de ajutor', corect: false, cod: 'V1', explicatie: '9p penalizare! Neasigurare la parasirea locului de staționare include și oprirea fără frână de ajutor.' },
    ],
    sfat: '💡 La final de examen, examinatorul completează fișa în tăcere. Dacă ai greșit ceva, NU explica — notele lui sunt deja puse. Rezultatul îți este comunicat după finalizare.',
    culoare: '#00cc66',
    final: true,
  },
];

/* ══════════════════════════════════════════════════════════
   COMPONENT PRINCIPAL
   ══════════════════════════════════════════════════════════ */
export default function InteractiveModule() {
  const [tab, setTab] = useState('traseu');

  const TABS = [
    { id: 'traseu',     label: '🗺️ Simulator' },
    { id: 'editor',     label: '✏️ Editor Traseu' },
    { id: 'penalizari', label: '📋 Penalizări' },
  ];

  return (
    <div className="flex flex-col h-full" style={{ background: '#f5f5f7' }}>
      <div className="flex items-center gap-1 px-4 py-2.5 border-b flex-shrink-0"
        style={{ borderColor: 'rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.95)' }}>
        {TABS.map(t => (
          <motion.button key={t.id}
            whileHover={{ y: -1 }} whileTap={{ scale: 0.97 }}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: tab === t.id ? 'rgba(0,113,227,0.08)' : 'transparent',
              border: `1px solid ${tab === t.id ? 'rgba(0,113,227,0.3)' : 'transparent'}`,
              color: tab === t.id ? '#0071e3' : 'rgba(29,29,31,0.45)',
            }}>
            {t.label}
          </motion.button>
        ))}
        <div className="ml-auto text-[10px] font-mono uppercase tracking-widest" style={{ color: 'rgba(29,29,31,0.28)' }}>
          Constanța · Bd. Mamaia
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        {tab === 'traseu'     && <SimulatorTraseu />}
        {tab === 'editor'     && <RouteEditor defaultRoute={TRASEU} />}
        {tab === 'penalizari' && <FoaiePenalizareOficiala />}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SIMULATOR TRASEU
   ══════════════════════════════════════════════════════════ */
function SimulatorTraseu() {
  const [pasIdx, setPasIdx] = useState(0);
  const [ales, setAles] = useState(null);
  const [greseliFoaie, setGreseliFoaie] = useState([]);
  const [totalPuncte, setTotalPuncte] = useState(0);
  const [terminat, setTerminat] = useState(false);
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const markerRef = useRef(null);

  // Use custom saved route if available, otherwise use default
  const [traseuActiv] = useState(() => {
    try {
      const saved = localStorage.getItem('customTraseu');
      return saved ? JSON.parse(saved) : TRASEU;
    } catch { return TRASEU; }
  });

  const pas = traseuActiv[pasIdx] || traseuActiv[0];

  useEffect(() => {
    if (window.L) { initMap(); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = initMap;
    document.head.appendChild(script);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function initMap() {
    if (!mapRef.current || leafletMapRef.current) return;
    const L = window.L;
    const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
    map.setView([44.1715, 28.6455], 14);

    // Traseul complet (polyline)
    const coords = traseuActiv.map(p => p.coords);
    L.polyline(coords, { color: '#ffff00', weight: 4, opacity: 0.6 }).addTo(map);

    // Waypoints numerotate
    traseuActiv.forEach((p, i) => {
      const icon = L.divIcon({
        html: `<div style="background:${p.culoare};color:#000;width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:bold;font-size:10px;border:2px solid rgba(255,255,255,0.8);">${i + 1}</div>`,
        className: '', iconAnchor: [10, 10],
      });
      L.marker(p.coords, { icon }).addTo(map)
        .bindTooltip(`${i + 1}. ${p.titlu.replace(/^[^ ]+ /, '')}`, { permanent: false });
    });

    // Marker poziție curentă (galben pulsant)
    const pulseIcon = L.divIcon({
      html: '<div style="width:14px;height:14px;border-radius:50%;background:#fff700;border:3px solid white;box-shadow:0 0 10px #fff700;"></div>',
      className: '', iconAnchor: [7, 7],
    });
    markerRef.current = L.marker(traseuActiv[0].coords, { icon: pulseIcon }).addTo(map);
    leafletMapRef.current = map;
  }

  useEffect(() => {
    if (!leafletMapRef.current || !markerRef.current) return;
    markerRef.current.setLatLng(pas.coords);
    leafletMapRef.current.panTo(pas.coords, { animate: true, duration: 0.7 });
  }, [pas]);

  const handleAlegere = (opt) => {
    if (ales !== null) return;
    setAles(opt);

    if (!opt.corect && opt.cod) {
      // Găsim penalizarea din foaie
      let gasit = null;
      for (const sec of PENALIZARI_OFICIALE) {
        const item = sec.items.find(x => x.cod === opt.cod);
        if (item) { gasit = item; break; }
      }
      if (gasit) {
        setGreseliFoaie(prev => [...prev, gasit]);
        setTotalPuncte(prev => prev + gasit.puncte);
      }
    }
  };

  const nextPas = () => {
    if (pasIdx >= traseuActiv.length - 1) { setTerminat(true); return; }
    setPasIdx(i => i + 1);
    setAles(null);
  };

  const restart = () => {
    setPasIdx(0); setAles(null); setGreseliFoaie([]);
    setTotalPuncte(0); setTerminat(false);
  };

  const respins = totalPuncte >= PRAG_RESPINGERE || greseliFoaie.some(g => g.puncte >= PRAG_RESPINGERE);

  if (terminat) {
    const admis = !respins;
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-full gap-5 p-8 text-center">
        <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 0.5, repeat: 2 }}
          className="text-6xl">{admis ? '🏆' : '📚'}</motion.div>
        <div>
          <div className="text-2xl font-bold mb-1" style={{ color: admis ? '#00cc66' : '#ff4444' }}>
            {admis ? 'ADMIS!' : 'RESPINS'}
          </div>
          <div className="text-sm mt-1" style={{ color: 'rgba(29,29,31,0.5)' }}>Total puncte penalizare: {totalPuncte}p</div>
          <div className="text-xs mt-1" style={{ color: 'rgba(29,29,31,0.32)' }}>Prag de respingere: {PRAG_RESPINGERE} puncte</div>
        </div>
        {greseliFoaie.length > 0 && (
          <div className="w-full max-w-lg p-4 rounded-xl text-left space-y-2"
            style={{ background: '#fff5f5', border: '1px solid rgba(255,59,48,0.15)' }}>
            <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: 'rgba(29,29,31,0.35)' }}>Greșeli înregistrate:</div>
            {greseliFoaie.map((g, i) => (
              <div key={i} className="flex items-start justify-between gap-3 text-xs p-2 rounded-lg"
                style={{ background: '#fff0f0', border: '1px solid rgba(255,59,48,0.12)' }}>
                <span className="flex-1 leading-relaxed" style={{ color: 'rgba(29,29,31,0.6)' }}>[{g.cod}] {g.text}</span>
                <span className="font-bold flex-shrink-0" style={{ color: g.puncte >= 21 ? '#ff4444' : '#ff8c00' }}>
                  -{g.puncte}p
                </span>
              </div>
            ))}
            <div className="flex justify-between pt-2 border-t text-sm font-bold"
              style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
              <span style={{ color: 'rgba(29,29,31,0.4)' }}>TOTAL</span>
              <span style={{ color: respins ? '#ff4444' : '#00cc66' }}>{totalPuncte}p / {PRAG_RESPINGERE}p maxim</span>
            </div>
          </div>
        )}
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={restart}
          className="px-6 py-3 rounded-xl font-semibold text-sm"
          style={{ background: 'rgba(0,113,227,0.08)', border: '1px solid rgba(0,113,227,0.3)', color: '#0071e3' }}>
          🔄 Reia Simularea
        </motion.button>
      </motion.div>
    );
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Hartă */}
      <div className="w-[300px] flex-shrink-0 border-r relative" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        <div className="absolute bottom-3 left-2 right-2 z-[1000] p-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(0,0,0,0.1)', backdropFilter: 'blur(8px)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div className="flex justify-between text-[10px] font-mono mb-1.5">
            <span style={{ color: '#0071e3' }}>{pasIdx + 1}/{traseuActiv.length} — {(pas.titlu || '').split('—')[0].trim()}</span>
          </div>
          <div className="flex justify-between text-[10px] font-mono mb-1">
            <span style={{ color: 'rgba(29,29,31,0.4)' }}>Penalizare acumulate:</span>
            <span style={{ color: totalPuncte >= 15 ? '#ff4444' : totalPuncte >= 9 ? '#ff8c00' : '#00cc66' }}>
              {totalPuncte}p / {PRAG_RESPINGERE}p
            </span>
          </div>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.1)' }}>
            <div className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, (totalPuncte / PRAG_RESPINGERE) * 100)}%`,
                background: totalPuncte >= 15 ? '#ff4444' : '#ff8c00',
              }} />
          </div>
          <div className="h-0.5 rounded-full mt-1" style={{ background: 'rgba(0,0,0,0.08)' }}>
            <div className="h-full rounded-full transition-all"
              style={{ width: `${(pasIdx / Math.max(1, traseuActiv.length - 1)) * 100}%`, background: 'rgba(0,113,227,0.5)' }} />
          </div>
        </div>
      </div>

      {/* Conținut pas */}
      <div className="flex-1 overflow-y-auto p-5">
        <AnimatePresence mode="wait">
          <motion.div key={pasIdx}
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}
            className="space-y-4 pb-6">

            {/* Header */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0"
                style={{ background: `${pas.culoare}20`, border: `1px solid ${pas.culoare}88`, color: pas.culoare }}>
                {pasIdx + 1}
              </div>
              <div>
                <h2 className="text-sm font-bold" style={{ color: '#1d1d1f' }}>{pas.titlu}</h2>
                {pas.critic && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1"
                    style={{ background: '#ff444420', color: '#ff6666', border: '1px solid #ff444440' }}>
                    ⚠️ ZONĂ CRITICĂ — Capcana Examenului
                  </span>
                )}
                {pas.manevra && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-1"
                    style={{ background: '#f0c04020', color: '#f0c040', border: '1px solid #f0c04040' }}>
                    🔧 MANEVRĂ SPECIFICĂ
                  </span>
                )}
              </div>
            </div>

            {/* Descriere */}
            <div className="p-3 rounded-xl text-sm leading-relaxed"
              style={{ background: '#ffffff', border: `1px solid ${pas.culoare}30`, color: 'rgba(29,29,31,0.6)', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              {pas.descriere}
            </div>

            {/* Procedura */}
            <div className="p-3 rounded-xl space-y-1"
              style={{ background: '#f0f5ff', border: '1px solid rgba(59,130,246,0.2)' }}>
              <div className="text-[10px] font-mono uppercase tracking-widest mb-2" style={{ color: 'rgba(59,130,246,0.65)' }}>
                ✅ Procedura corectă:
              </div>
              {pas.procedura.map((linie, i) => (
                <div key={i} className="text-xs font-mono leading-relaxed"
                  style={{ color: linie.startsWith('⚠️') ? '#ff9500' : 'rgba(29,29,31,0.45)' }}>
                  {linie}
                </div>
              ))}
            </div>

            {/* Întrebare */}
            <div className="p-3 rounded-xl"
              style={{ background: `${pas.culoare}08`, border: `1px solid ${pas.culoare}25` }}>
              <div className="text-xs font-semibold" style={{ color: '#1d1d1f' }}>❓ {pas.intrebare}</div>
            </div>

            {/* Opțiuni */}
            <div className="space-y-2">
              {pas.optiuni.map((opt, i) => {
                let bg = '#f9f9fb', border = 'rgba(0,0,0,0.1)', color = 'rgba(29,29,31,0.65)';
                if (ales) {
                  if (opt === ales) {
                    if (opt.corect) { bg = '#f0fff5'; border = '#34c759'; color = '#34c759'; }
                    else if (opt.eliminatoriu || (opt.cod && ['P1', 'D2'].includes(opt.cod))) {
                      bg = '#fff0f0'; border = '#ff3b30'; color = '#ff3b30';
                    } else { bg = '#fff8f0'; border = '#ff9500'; color = '#ff9500'; }
                  } else if (opt.corect) {
                    bg = '#f0fff5'; border = 'rgba(52,199,89,0.4)'; color = 'rgba(52,199,89,0.7)';
                  }
                }
                return (
                  <motion.button key={i}
                    whileHover={!ales ? { x: 3, scale: 1.01 } : {}}
                    whileTap={!ales ? { scale: 0.99 } : {}}
                    onClick={() => handleAlegere(opt)}
                    className="w-full p-3 rounded-xl text-sm text-left transition-all"
                    style={{ background: bg, border: `1px solid ${border}`, color }}>
                    {opt.text}
                    {opt.cod && !ales && (
                      <span className="ml-2 text-[9px] opacity-40">[{opt.cod}]</span>
                    )}
                  </motion.button>
                );
              })}
            </div>

            {/* Feedback */}
            <AnimatePresence>
              {ales && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-xl space-y-2"
                  style={{
                    background: ales.corect ? '#f0fff5' : '#fff5f0',
                    border: `1px solid ${ales.corect ? 'rgba(52,199,89,0.4)' : ales.eliminatoriu || ['P1','D2'].includes(ales?.cod) ? 'rgba(255,59,48,0.4)' : 'rgba(255,149,0,0.4)'}`,
                  }}>
                  {!ales.corect && ales.cod && (() => {
                    let gasit = null;
                    for (const sec of PENALIZARI_OFICIALE) {
                      const item = sec.items.find(x => x.cod === ales.cod);
                      if (item) { gasit = item; break; }
                    }
                    return gasit ? (
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded"
                          style={{ background: 'rgba(255,59,48,0.1)', color: '#ff3b30' }}>
                          Cod {gasit.cod}
                        </span>
                        <span className="text-sm font-bold" style={{ color: '#ff4444' }}>
                          -{gasit.puncte}p penalizare
                        </span>
                      </div>
                    ) : null;
                  })()}
                  <div className="text-xs leading-relaxed"
                    style={{ color: ales.corect ? '#34c759' : '#ff3b30' }}>
                    {ales.corect ? '✅ ' : '❌ '}{ales.explicatie}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Sfat */}
            <div className="p-3 rounded-xl text-xs leading-relaxed"
              style={{ background: '#f5f5f7', border: '1px solid rgba(0,0,0,0.07)', color: 'rgba(29,29,31,0.45)' }}>
              {pas.sfat}
            </div>

            {/* Buton continuare */}
            {ales && (
              <motion.button
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                whileHover={{ scale: 1.01, y: -1 }} whileTap={{ scale: 0.99 }}
                onClick={nextPas}
                className="w-full py-3 rounded-xl text-sm font-semibold"
                style={{ background: 'rgba(0,113,227,0.08)', border: '1px solid rgba(0,113,227,0.3)', color: '#0071e3' }}>
                {pasIdx >= traseuActiv.length - 1 ? '🏁 Finalizează și vezi rezultatul' : 'Continuă →'}
              </motion.button>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   FOAIE PENALIZARE — transcriere exactă din documentul oficial
   ══════════════════════════════════════════════════════════ */
function FoaiePenalizareOficiala() {
  return (
    <div className="h-full overflow-y-auto p-5 space-y-5 max-w-3xl mx-auto">
      <div className="text-center py-3">
        <h1 className="text-base font-bold tracking-widest uppercase" style={{ color: 'rgba(29,29,31,0.8)' }}>
          PENALIZAREA GREȘELILOR COMISE DE CANDIDAT
        </h1>
        <h2 className="text-sm mt-1" style={{ color: 'rgba(29,29,31,0.5)' }}>(PUNCTE DE PENALIZARE)</h2>
        <p className="text-[10px] mt-1 max-w-lg mx-auto leading-relaxed" style={{ color: 'rgba(29,29,31,0.32)' }}>
          Aplicate pentru nerespectarea normelor rutiere / neexecutarea ori executarea incorectă a manevrelor indicate
        </p>
        <div className="flex items-center justify-center gap-3 mt-3">
          <div className="px-3 py-1.5 rounded-lg text-xs"
            style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.25)', color: '#ff3b30' }}>
            ⚠️ 21p individual sau cumulat ≥ 21p = RESPINS
          </div>
        </div>
      </div>

      {PENALIZARI_OFICIALE.map((sectiune, si) => (
        <div key={si} className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(0,0,0,0.08)' }}>
          <div className="px-4 py-2.5"
            style={{ background: '#f2f2f7', borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
            <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'rgba(29,29,31,0.6)' }}>{sectiune.sectiune}</div>
          </div>
          <div className="divide-y" style={{ '--tw-divide-opacity': 1 }}>
            {sectiune.items.map(item => (
              <div key={item.cod}
                className="flex items-center justify-between px-4 py-3 gap-4 hover:bg-black/[0.02] bg-white transition-colors">
                <div className="flex items-start gap-3 flex-1">
                  <span className="font-mono text-[10px] px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5"
                    style={{
                      background: item.puncte >= 21 ? 'rgba(255,59,48,0.1)' : item.puncte >= 9 ? 'rgba(255,149,0,0.1)' : 'rgba(0,0,0,0.04)',
                      color: item.puncte >= 21 ? '#ff3b30' : item.puncte >= 9 ? '#ff9500' : 'rgba(29,29,31,0.35)',
                      border: `1px solid ${item.puncte >= 21 ? 'rgba(255,59,48,0.25)' : 'rgba(0,0,0,0.08)'}`,
                    }}>
                    {item.cod}
                  </span>
                  <span className="text-xs leading-relaxed" style={{ color: 'rgba(29,29,31,0.6)' }}>{item.text}</span>
                </div>
                <div className="flex-shrink-0 text-right">
                  <span className="font-bold text-sm font-mono"
                    style={{ color: item.puncte >= 21 ? '#ff3b30' : item.puncte >= 9 ? '#ff9500' : item.puncte >= 6 ? '#ffcc00' : 'rgba(29,29,31,0.4)' }}>
                    {item.puncte}p
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className="p-4 rounded-xl"
        style={{ background: '#f0f5ff', border: '1px solid rgba(59,130,246,0.2)' }}>
        <div className="text-xs font-bold mb-3" style={{ color: 'rgba(59,130,246,0.7)' }}>📌 Notă despre sistemul de punctaj</div>
        <div className="space-y-1.5">
          {[
            'Punctele se cumulează pe durata întregului examen practic',
            'O greșeală de 21p (prioritate sau depășire ilegală) = respingere imediată',
            'Combinații care duc la respingere: ex. 9p + 9p + 6p = 24p > 21p = respins',
            'Examinatorul completează fișa în ORIGINAL la finalul examenului',
            'Candidatul semnează fișa după comunicarea rezultatului',
            'Foaia de penalizare are 3 coloane: Puncte de penalizare / B1 / BE (tipuri licențe)',
          ].map((n, i) => (
            <div key={i} className="flex items-start gap-2 text-xs" style={{ color: 'rgba(29,29,31,0.45)' }}>
              <span className="flex-shrink-0" style={{ color: 'rgba(59,130,246,0.5)' }}>›</span>
              <span>{n}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

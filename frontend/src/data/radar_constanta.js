/**
 * Radar / speed-camera / ANPR registry for Constanța County.
 *
 * Compiled from the "Traffic Cameras & Radars in Constanța County" report
 * (CNAIR press + rovinieta.ro + IPJ Constanța + local media).
 *
 * Schema:
 *   id      unique identifier
 *   lat/lng WGS84 coordinates
 *   type    'fixed' | 'mobile' | 'average' | 'redlight' | 'rovinieta'
 *   speed   posted speed limit at the point (km/h; 0 for non-speed enforcement)
 *   road    human-readable road / intersection
 *   note    short context (install date, direction, etc.)
 *
 * Note: Constanța's municipal "Safe City" CCTV network (~1,100 surveillance
 * cameras) is *not* included here — those are passive surveillance, not
 * speed/toll enforcement, so we don't announce them.
 */

export const RADARS_CONSTANTA = [
  /* ─── ANPR rovinietă / RCA toll-check cameras (CNAIR) ─────────── */
  {
    id:    'ct-anpr-movilita-dn38',
    lat:   44.0450,
    lng:   28.5108,
    type:  'rovinieta',
    speed: 90,
    road:  'DN38 · Movilița',
    note:  'Cameră ANPR rovinietă/RCA · CNAIR (2019)',
  },
  {
    id:    'ct-anpr-negru-voda-dn38',
    lat:   43.8195,
    lng:   28.2177,
    type:  'rovinieta',
    speed: 50,
    road:  'DN38 · Negru Vodă (centru)',
    note:  'Cameră ANPR rovinietă/RCA · CNAIR',
  },
  {
    id:    'ct-anpr-ostrov-dn3',
    lat:   44.1092,
    lng:   27.3639,
    type:  'rovinieta',
    speed: 50,
    road:  'DN3 · Ostrov (vama BG)',
    note:  'Cameră ANPR rovinietă/RCA · CNAIR',
  },

  /* ─── Highway speed-enforcement sensor ───────────────────────── */
  {
    id:    'ct-a2-cernavoda-km158',
    lat:   44.3396,
    lng:   28.0327,
    type:  'fixed',
    speed: 130,
    road:  'A2 · km ~158 (București → Constanța)',
    note:  'Radar fix · CNAIR / Poliția Rutieră (oct 2024)',
  },

  /* ─── Constanța-city fixed speed cameras (IPJ Constanța, oct 2025) ─── */
  {
    id:    'ct-city-aurel-vlaicu-lukoil',
    lat:   44.1636,
    lng:   28.6001,
    type:  'fixed',
    speed: 50,
    road:  'Bd. Aurel Vlaicu · Lukoil',
    note:  'Cameră viteză fixă · IPJ Constanța (oct 2025)',
  },
  {
    id:    'ct-city-bratianu-statia48',
    lat:   44.1780,
    lng:   28.6350,
    type:  'fixed',
    speed: 50,
    road:  'Bd. I.C. Brătianu · stația 48',
    note:  'Cameră viteză fixă · IPJ Constanța (oct 2025)',
  },
];

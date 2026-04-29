/**
 * Radar / speed-camera registry and proximity warning engine.
 *
 * Data file: `radar_constanta.js` — populated from the user's paste.
 * Structure of each radar:
 *   {
 *     id:       'ct-001',
 *     lat:      44.1712,
 *     lng:      28.6455,
 *     type:     'fixed' | 'mobile' | 'average' | 'redlight',
 *     speed:    50,            // km/h limit (0 if not a speed camera)
 *     road:     'B-dul Mamaia',
 *     note:     'Intersecția cu Bd. Tomis',
 *   }
 */

import { RADARS_CONSTANTA } from '../../data/radar_constanta.js';

// Hard-coded global seeds are kept separately (for expansion outside Constanța).
const GLOBAL_SEED = [];

export const ALL_RADARS = [...RADARS_CONSTANTA, ...GLOBAL_SEED];

/** Haversine distance in meters between two lat/lng points. */
export function haversineMeters(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const la1  = toRad(a.lat);
  const la2  = toRad(b.lat);
  const x = Math.sin(dLat / 2) ** 2
          + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * Given the user's current position and bearing, return the nearest radar
 * within `radiusMeters` — but only if it is *ahead* of the user (i.e. the
 * radar is in the forward-hemisphere of the user's heading).
 *
 * This matches how Waze announces "Radar ahead" instead of "Radar behind".
 */
export function nearestRadarAhead(pos, bearingDeg, radiusMeters = 800) {
  if (!pos) return null;
  let best = null;
  let bestDist = Infinity;
  for (const r of ALL_RADARS) {
    const d = haversineMeters(pos, r);
    if (d > radiusMeters) continue;
    // angle from user to radar
    const angleToRadar = bearingTo(pos, r);
    const delta = angularDelta(bearingDeg, angleToRadar);
    // within ±90° of heading → "ahead"
    if (Math.abs(delta) > 90) continue;
    if (d < bestDist) {
      bestDist = d;
      best = { ...r, distance: d };
    }
  }
  return best;
}

/** Compass bearing (0–360°) from point A to point B. */
export function bearingTo(a, b) {
  const toRad = (v) => (v * Math.PI) / 180;
  const toDeg = (v) => (v * 180) / Math.PI;
  const φ1 = toRad(a.lat), φ2 = toRad(b.lat);
  const Δλ = toRad(b.lng - a.lng);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2)
          - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Smallest signed angular difference in degrees, normalised to [-180,180]. */
export function angularDelta(a, b) {
  let d = ((b - a) % 360 + 540) % 360 - 180;
  return d;
}

/** Human-friendly label for a radar. */
export function radarLabel(r) {
  if (!r) return '';
  const t = r.type || 'fixed';
  const s = r.speed ? ` ${r.speed} km/h` : '';
  const kind = t === 'redlight'  ? 'Red-light camera'
             : t === 'mobile'    ? 'Mobile radar'
             : t === 'average'   ? 'Average-speed section'
             : t === 'rovinieta' ? 'Rovinietă / RCA camera'
             :                     'Speed camera';
  return `${kind}${s}`;
}

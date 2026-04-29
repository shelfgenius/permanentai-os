/**
 * Mappy navigation helpers.
 *
 * Uses entirely free, public services so Mappy works out-of-the-box with no
 * API keys:
 *   - Nominatim  (OpenStreetMap)  → geocoding / address search
 *   - OSRM       (public router)  → turn-by-turn routing + instructions
 *
 * For production usage at scale, swap NOMINATIM_URL / OSRM_URL for your own
 * hosted instances or Mapbox / GraphHopper. The rest of the app stays the same.
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';
const OSRM_URL      = 'https://router.project-osrm.org';

/* ── Geocoding ─────────────────────────────────────────────────── */

/**
 * Multi-strategy Nominatim search.
 *
 * Nominatim's free-form `q=` handler is poor at Romanian "Street 123" style
 * addresses, so we run up to four queries in parallel and merge the results:
 *
 *   1. Structured address search   (best for exact "Calea Dobrogei 432")
 *   2. Free-form with Romania bias (best for places / POIs)
 *   3. Free-form + ", Constanța, Romania" suffix (best for short local names)
 *   4. Free-form near user's viewbox (soft-bias, not bounded)
 *
 * Results are deduplicated by place_id and sorted by Nominatim's importance.
 */
export async function searchPlaces(query, { limit = 8, near } = {}) {
  const q = (query || '').trim();
  if (q.length < 2) return [];

  const queries = [];

  // ── 1. Structured address: "Street Name 123" or "123 Street Name" ─────
  const mTail = q.match(/^(.+?)[,\s]+(\d+[a-zA-Z]?)$/);   // "Calea Dobrogei 432"
  const mHead = q.match(/^(\d+[a-zA-Z]?)[,\s]+(.+)$/);    // "432 Calea Dobrogei"
  let street = null;
  if (mTail) street = { name: mTail[1].trim(), number: mTail[2] };
  if (mHead) street = { name: mHead[2].trim(), number: mHead[1] };

  if (street) {
    queries.push(
      buildUrl({
        street:   `${street.number} ${street.name}`,
        country:  'Romania',
        countrycodes: 'ro',
        limit,
      }),
    );
    // Bias to Constanța city specifically — most common case for this app
    queries.push(
      buildUrl({
        street:   `${street.number} ${street.name}`,
        city:     'Constanța',
        countrycodes: 'ro',
        limit,
      }),
    );
    // Street-only fallback: many Romanian addresses don't have house-number
    // data in OSM, so we always also return the street itself as an anchor
    // the user can refine from. These are tagged with _streetOnly=true.
    queries.push(
      buildUrl({
        street:   street.name,
        city:     'Constanța',
        countrycodes: 'ro',
        limit:    4,
      }),
    );
    queries.push(
      buildUrl({
        q:        `${street.name}, Constanța, Romania`,
        limit:    4,
      }),
    );
  }

  // ── 2. Free-form, Romania-scoped ──────────────────────────────────────
  queries.push(buildUrl({ q, countrycodes: 'ro', limit }));

  // ── 3. Free-form, suffix Constanța / Romania ──────────────────────────
  if (!/constan/i.test(q) && !/romania|romania/i.test(q)) {
    queries.push(buildUrl({ q: `${q}, Constanța, Romania`, limit }));
  }

  // ── 4. Soft-bias viewbox around user ──────────────────────────────────
  if (near) {
    const dLat = 0.6, dLng = 0.9;   // wider than before so we don't miss results
    queries.push(buildUrl({
      q, limit,
      viewbox: [near.lng - dLng, near.lat + dLat, near.lng + dLng, near.lat - dLat].join(','),
      bounded: '0',
    }));
  }

  // run all in parallel, merge
  const batches = await Promise.all(queries.map(fetchJson));
  const merged = [];
  const seen   = new Set();
  for (const batch of batches) {
    for (const d of batch || []) {
      if (!d.place_id || seen.has(d.place_id)) continue;
      seen.add(d.place_id);
      merged.push({
        id:     String(d.place_id),
        label:  d.display_name,
        lat:    parseFloat(d.lat),
        lng:    parseFloat(d.lon),
        type:   d.type || d.class || 'location',
        // Priority: structured / house-number hits first, then importance score
        _score: (d.address?.house_number ? 2 : 0) + (parseFloat(d.importance) || 0),
      });
    }
  }
  merged.sort((a, b) => b._score - a._score);
  return merged.slice(0, limit).map(({ _score, ...r }) => r);
}

function buildUrl(params) {
  const usp = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    ...params,
    limit: String(params.limit ?? 8),
  });
  return `${NOMINATIM_URL}/search?${usp.toString()}`;
}

async function fetchJson(url) {
  try {
    const r = await fetch(url, { headers: { 'Accept-Language': 'ro,en;q=0.8' } });
    if (!r.ok) return [];
    return await r.json();
  } catch {
    return [];
  }
}

export async function reverseGeocode({ lat, lng }) {
  try {
    const r = await fetch(
      `${NOMINATIM_URL}/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      { headers: { 'Accept-Language': 'ro,en;q=0.8' } },
    );
    if (!r.ok) return null;
    const d = await r.json();
    return d?.display_name || null;
  } catch {
    return null;
  }
}

/* ── Routing ───────────────────────────────────────────────────── */

/**
 * @param {{lat:number,lng:number}} from
 * @param {{lat:number,lng:number}} to
 * @param {'driving'|'cycling'|'foot'} profile
 * @returns {Promise<null | {
 *   distance: number,          // meters
 *   duration: number,          // seconds
 *   geometry: [number,number][],  // [lat,lng] polyline
 *   steps: {
 *     distance: number,
 *     duration: number,
 *     instruction: string,
 *     maneuver: string,
 *     modifier?: string,
 *     name?: string,
 *     location: [number,number],
 *   }[]
 * }>}
 */
export async function routeBetween(from, to, profile = 'driving') {
  if (!from || !to) return null;
  const coords = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${OSRM_URL}/route/v1/${profile}/${coords}`
            + '?overview=full&geometries=geojson&steps=true&alternatives=false';
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    const data = await r.json();
    const route = data.routes?.[0];
    if (!route) return null;
    const geom = (route.geometry?.coordinates || []).map(([lng, lat]) => [lat, lng]);
    const steps = [];
    for (const leg of route.legs || []) {
      for (const s of leg.steps || []) {
        const loc = s.maneuver?.location || [];
        steps.push({
          distance:    s.distance,
          duration:    s.duration,
          maneuver:    s.maneuver?.type || 'continue',
          modifier:    s.maneuver?.modifier || '',
          instruction: humanInstruction(s),
          name:        s.name || '',
          location:    loc.length === 2 ? [loc[1], loc[0]] : [0, 0],
        });
      }
    }
    return {
      distance: route.distance,
      duration: route.duration,
      geometry: geom,
      steps,
    };
  } catch {
    return null;
  }
}

/** Convert an OSRM step to a short human instruction (en/ro friendly). */
export function humanInstruction(step) {
  const m   = step.maneuver?.type || 'continue';
  const mod = step.maneuver?.modifier || '';
  const name = step.name ? ` on ${step.name}` : '';
  switch (m) {
    case 'turn':             return `Turn ${mod}${name}`;
    case 'new name':         return `Continue${name}`;
    case 'depart':           return `Start${name}`;
    case 'arrive':           return `You have arrived`;
    case 'merge':            return `Merge ${mod}${name}`;
    case 'on ramp':          return `Take the ramp ${mod}${name}`;
    case 'off ramp':         return `Take the exit ${mod}${name}`;
    case 'fork':             return `Keep ${mod}${name}`;
    case 'end of road':      return `Turn ${mod}${name}`;
    case 'continue':         return `Continue ${mod}${name}`.trim();
    case 'roundabout':       return `At the roundabout, take exit ${step.maneuver?.exit ?? ''}`;
    case 'rotary':           return `At the rotary, take exit ${step.maneuver?.exit ?? ''}`;
    case 'roundabout turn':  return `Turn ${mod} at the roundabout`;
    case 'notification':     return `Continue${name}`;
    default:                 return `Continue${name}`;
  }
}

/* ── Utilities ──────────────────────────────────────────────── */

export function formatDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}
export function formatDuration(seconds) {
  const m = Math.round(seconds / 60);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  return `${h} h ${r} min`;
}

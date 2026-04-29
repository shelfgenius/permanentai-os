import React, { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const STORAGE_KEY = 'customTraseu';
const COLORS = ['#00d4ff','#ff4444','#ff8c00','#00cc66','#a855f7','#f0c040','#22d3ee','#3b82f6','#ec4899','#84cc16'];

function loadRoute(defaultRoute) {
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : defaultRoute.map(p => ({ ...p }));
  } catch { return defaultRoute.map(p => ({ ...p })); }
}

function newWaypoint(lat, lng, idx) {
  return {
    id: Date.now(),
    titlu: `📍 Punct ${idx + 1}`,
    descriere: 'Descriere punct nou.',
    procedura: ['Pas 1', 'Pas 2'],
    coords: [parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))],
    intrebare: 'Întrebare?',
    optiuni: [
      { text: '✅ Răspuns corect', corect: true, explicatie: 'Explicație răspuns corect.' },
      { text: '❌ Răspuns greșit', corect: false, explicatie: 'Explicație răspuns greșit.' },
    ],
    sfat: '💡 Sfat examinator.',
    culoare: COLORS[idx % COLORS.length],
  };
}

/* ── Edit panel for a single waypoint ─────────────────── */
function WaypointEditPanel({ wp, onUpdate, onDelete, onClose }) {
  const [local, setLocal] = useState(() => JSON.parse(JSON.stringify(wp)));

  useEffect(() => {
    setLocal(JSON.parse(JSON.stringify(wp)));
  }, [wp.id]);

  const set = (key, val) => setLocal(l => ({ ...l, [key]: val }));

  const save = () => { onUpdate(local); };

  const setProcLinie = (i, val) => {
    const arr = [...local.procedura];
    arr[i] = val;
    setLocal(l => ({ ...l, procedura: arr }));
  };

  const addProcLinie = () => setLocal(l => ({ ...l, procedura: [...l.procedura, ''] }));
  const delProcLinie = (i) => setLocal(l => ({ ...l, procedura: l.procedura.filter((_, j) => j !== i) }));

  const setOptiune = (i, key, val) => {
    const arr = local.optiuni.map((o, j) => j === i ? { ...o, [key]: val } : o);
    setLocal(l => ({ ...l, optiuni: arr }));
  };
  const addOptiune = () => setLocal(l => ({ ...l, optiuni: [...l.optiuni, { text: '', corect: false, explicatie: '' }] }));
  const delOptiune = (i) => setLocal(l => ({ ...l, optiuni: l.optiuni.filter((_, j) => j !== i) }));

  const labelStyle = { color: 'var(--text-muted)', fontSize: '10px', fontFamily: 'monospace', textTransform: 'uppercase', letterSpacing: '0.08em' };
  const inputStyle = {
    background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text)',
    borderRadius: '8px', padding: '6px 10px', fontSize: '12px', width: '100%', outline: 'none',
  };
  const textareaStyle = { ...inputStyle, minHeight: '60px', resize: 'vertical' };

  return (
    <div className="h-full flex flex-col overflow-hidden"
      style={{ background: 'var(--surface)', borderLeft: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--border)' }}>
        <span className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>✏️ Editează punct</span>
        <div className="flex gap-2">
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={save}
            className="px-3 py-1 rounded-lg text-[11px] font-semibold"
            style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', border: '1px solid color-mix(in srgb, var(--accent) 35%, transparent)', color: 'var(--accent)' }}>
            Salvează
          </motion.button>
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={onClose}
            className="px-2 py-1 rounded-lg text-[11px]"
            style={{ color: 'var(--text-muted)', border: '1px solid var(--border)' }}>
            ✕
          </motion.button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Titlu */}
        <div>
          <label style={labelStyle}>Titlu</label>
          <input value={local.titlu} onChange={e => set('titlu', e.target.value)} style={{ ...inputStyle, marginTop: '4px' }} />
        </div>

        {/* Coordonate */}
        <div>
          <label style={labelStyle}>Coordonate (lat, lng)</label>
          <div className="flex gap-2 mt-1">
            <input type="number" step="0.0001"
              value={local.coords[0]}
              onChange={e => set('coords', [parseFloat(e.target.value) || 0, local.coords[1]])}
              style={{ ...inputStyle, width: '50%' }}
              placeholder="Latitudine" />
            <input type="number" step="0.0001"
              value={local.coords[1]}
              onChange={e => set('coords', [local.coords[0], parseFloat(e.target.value) || 0])}
              style={{ ...inputStyle, width: '50%' }}
              placeholder="Longitudine" />
          </div>
        </div>

        {/* Culoare */}
        <div>
          <label style={labelStyle}>Culoare marker</label>
          <div className="flex gap-1.5 flex-wrap mt-1">
            {COLORS.map(c => (
              <button key={c} onClick={() => set('culoare', c)}
                className="w-6 h-6 rounded-full border-2 transition-transform hover:scale-110"
                style={{ background: c, borderColor: local.culoare === c ? 'white' : 'transparent' }} />
            ))}
          </div>
        </div>

        {/* Descriere */}
        <div>
          <label style={labelStyle}>Descriere</label>
          <textarea value={local.descriere} onChange={e => set('descriere', e.target.value)}
            style={{ ...textareaStyle, marginTop: '4px' }} />
        </div>

        {/* Procedura */}
        <div>
          <div className="flex items-center justify-between">
            <label style={labelStyle}>Pași procedură</label>
            <button onClick={addProcLinie}
              className="text-[10px] px-2 py-0.5 rounded"
              style={{ color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}>
              + Adaugă
            </button>
          </div>
          <div className="space-y-1.5 mt-1">
            {local.procedura.map((linie, i) => (
              <div key={i} className="flex gap-1.5 items-start">
                <span className="text-[10px] font-mono mt-2" style={{ color: 'var(--text-muted)', minWidth: '16px' }}>{i + 1}.</span>
                <input value={linie} onChange={e => setProcLinie(i, e.target.value)}
                  style={{ ...inputStyle, flex: 1 }} />
                <button onClick={() => delProcLinie(i)}
                  className="mt-1.5 text-[10px] px-1.5 py-0.5 rounded"
                  style={{ color: '#ff4444', border: '1px solid #ff444430' }}>✕</button>
              </div>
            ))}
          </div>
        </div>

        {/* Intrebare */}
        <div>
          <label style={labelStyle}>Întrebare quiz</label>
          <input value={local.intrebare} onChange={e => set('intrebare', e.target.value)}
            style={{ ...inputStyle, marginTop: '4px' }} />
        </div>

        {/* Optiuni */}
        <div>
          <div className="flex items-center justify-between">
            <label style={labelStyle}>Opțiuni răspuns</label>
            <button onClick={addOptiune}
              className="text-[10px] px-2 py-0.5 rounded"
              style={{ color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' }}>
              + Adaugă
            </button>
          </div>
          <div className="space-y-2 mt-1">
            {local.optiuni.map((opt, i) => (
              <div key={i} className="p-2 rounded-lg space-y-1.5"
                style={{ background: 'var(--surface2)', border: `1px solid ${opt.corect ? '#00cc6630' : 'var(--border)'}` }}>
                <div className="flex gap-2 items-center">
                  <input type="checkbox" checked={opt.corect}
                    onChange={e => setOptiune(i, 'corect', e.target.checked)}
                    className="accent-green-500" />
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Corect</span>
                  <button onClick={() => delOptiune(i)} className="ml-auto text-[10px] px-1.5 rounded"
                    style={{ color: '#ff4444' }}>✕</button>
                </div>
                <input value={opt.text} onChange={e => setOptiune(i, 'text', e.target.value)}
                  style={inputStyle} placeholder="Textul opțiunii" />
                <input value={opt.explicatie || ''} onChange={e => setOptiune(i, 'explicatie', e.target.value)}
                  style={inputStyle} placeholder="Explicație răspuns" />
              </div>
            ))}
          </div>
        </div>

        {/* Sfat */}
        <div>
          <label style={labelStyle}>Sfat examinator</label>
          <textarea value={local.sfat} onChange={e => set('sfat', e.target.value)}
            style={{ ...textareaStyle, marginTop: '4px' }} />
        </div>

        {/* Flags */}
        <div className="flex gap-3">
          {[['critic', '⚠️ Zonă critică'], ['manevra', '🔧 Manevră'], ['final', '🏁 Final']].map(([key, label]) => (
            <label key={key} className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={!!local[key]}
                onChange={e => set(key, e.target.checked)} className="accent-cyan-500" />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
            </label>
          ))}
        </div>

        {/* Delete */}
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={onDelete}
          className="w-full py-2 rounded-xl text-xs font-semibold mt-2"
          style={{ background: '#ff444415', border: '1px solid #ff444430', color: '#ff6666' }}>
          🗑 Șterge acest punct
        </motion.button>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   ROUTE EDITOR
   ══════════════════════════════════════════════════════════ */
export default function RouteEditor({ defaultRoute }) {
  const [route, setRoute]       = useState(() => loadRoute(defaultRoute));
  const [selected, setSelected] = useState(null);  // index
  const [addMode, setAddMode]   = useState(false);
  const [saved, setSaved]       = useState(false);

  const mapRef      = useRef(null);
  const leafletRef  = useRef(null);
  const markersRef  = useRef([]);
  const polylineRef = useRef(null);

  /* ── Rebuild map markers + polyline ────────────────── */
  const rebuildMap = useCallback((currentRoute, L) => {
    if (!leafletRef.current || !L) return;
    const map = leafletRef.current;

    // Remove old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    // Remove old polyline
    if (polylineRef.current) { polylineRef.current.remove(); polylineRef.current = null; }

    if (currentRoute.length < 1) return;

    // Draw polyline
    const coords = currentRoute.map(p => p.coords);
    polylineRef.current = L.polyline(coords, { color: '#ffff00', weight: 3, opacity: 0.55, dashArray: '6,4' }).addTo(map);

    // Draw markers
    currentRoute.forEach((p, i) => {
      const icon = L.divIcon({
        html: `<div style="
          background:${p.culoare || '#00d4ff'};
          color:#000;
          width:22px;height:22px;
          border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          font-weight:bold;font-size:10px;
          border:2px solid rgba(255,255,255,0.9);
          cursor:pointer;
          box-shadow:0 0 8px ${p.culoare || '#00d4ff'}88;
        ">${i + 1}</div>`,
        className: '',
        iconAnchor: [11, 11],
      });

      const marker = L.marker(p.coords, { icon, draggable: true }).addTo(map);

      marker.on('click', () => setSelected(i));

      marker.on('dragend', (e) => {
        const { lat, lng } = e.target.getLatLng();
        setRoute(prev => {
          const next = prev.map((wp, j) =>
            j === i ? { ...wp, coords: [parseFloat(lat.toFixed(6)), parseFloat(lng.toFixed(6))] } : wp
          );
          return next;
        });
      });

      marker.bindTooltip(`${i + 1}. ${p.titlu.replace(/^[^\s]+ /, '')}`, { permanent: false, direction: 'top' });
      markersRef.current.push(marker);
    });
  }, []);

  /* ── Init Leaflet ────────────────────────────────────── */
  useEffect(() => {
    const init = () => {
      if (!mapRef.current || leafletRef.current) return;
      const L = window.L;
      const map = L.map(mapRef.current, { zoomControl: true, attributionControl: false });
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 19 }).addTo(map);
      const center = route.length > 0 ? route[0].coords : [44.172, 28.645];
      map.setView(center, 14);
      leafletRef.current = map;
      rebuildMap(route, L);
    };

    if (window.L) { init(); return; }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
    document.head.appendChild(link);
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = init;
    document.head.appendChild(script);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Rebuild on route change ─────────────────────────── */
  useEffect(() => {
    if (leafletRef.current && window.L) {
      rebuildMap(route, window.L);
    }
  }, [route, rebuildMap]);

  /* ── Map click → add waypoint ────────────────────────── */
  useEffect(() => {
    if (!leafletRef.current) return;
    const map = leafletRef.current;
    const handler = (e) => {
      if (!addMode) return;
      const { lat, lng } = e.latlng;
      setRoute(prev => {
        const next = [...prev, newWaypoint(lat, lng, prev.length)];
        return next;
      });
      setAddMode(false);
    };
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [addMode]);

  /* ── Update cursor style on add mode ────────────────── */
  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.style.cursor = addMode ? 'crosshair' : '';
  }, [addMode]);

  /* ── Save / Reset ────────────────────────────────────── */
  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(route));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    if (!window.confirm('Resetezi traseul la varianta originală? Modificările tale vor fi pierdute.')) return;
    localStorage.removeItem(STORAGE_KEY);
    setRoute(defaultRoute.map(p => ({ ...p })));
    setSelected(null);
  };

  const handleUpdateWp = (updated) => {
    setRoute(prev => prev.map((wp, i) => i === selected ? updated : wp));
  };

  const handleDeleteWp = () => {
    setRoute(prev => prev.filter((_, i) => i !== selected));
    setSelected(null);
  };

  const moveUp = (i) => {
    if (i === 0) return;
    setRoute(prev => {
      const next = [...prev];
      [next[i - 1], next[i]] = [next[i], next[i - 1]];
      return next;
    });
    setSelected(i - 1);
  };

  const moveDown = (i) => {
    if (i >= route.length - 1) return;
    setRoute(prev => {
      const next = [...prev];
      [next[i], next[i + 1]] = [next[i + 1], next[i]];
      return next;
    });
    setSelected(i + 1);
  };

  const isCustom = !!localStorage.getItem(STORAGE_KEY);

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── LEFT: MAP ─────────────────────────────────── */}
      <div className="flex flex-col" style={{ width: selected !== null ? '42%' : '55%', flexShrink: 0 }}>
        {/* Map toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={() => setAddMode(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
            style={{
              background: addMode ? 'color-mix(in srgb, var(--accent) 18%, transparent)' : 'var(--surface2)',
              border: `1px solid ${addMode ? 'color-mix(in srgb, var(--accent) 50%, transparent)' : 'var(--border)'}`,
              color: addMode ? 'var(--accent)' : 'var(--text-muted)',
            }}
          >
            {addMode ? '🎯 Click pe hartă…' : '➕ Adaugă punct'}
          </motion.button>

          <div className="flex-1" />

          {isCustom && (
            <span className="text-[9px] font-mono px-2 py-1 rounded"
              style={{ background: 'color-mix(in srgb, var(--accent) 10%, transparent)', color: 'var(--accent)', border: '1px solid color-mix(in srgb, var(--accent) 25%, transparent)' }}>
              ✎ Personalizat
            </span>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={handleSave}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold"
            style={{
              background: saved ? '#00cc6615' : 'color-mix(in srgb, var(--accent) 12%, transparent)',
              border: `1px solid ${saved ? '#00cc6640' : 'color-mix(in srgb, var(--accent) 30%, transparent)'}`,
              color: saved ? '#00cc66' : 'var(--accent)',
            }}
          >
            {saved ? '✓ Salvat!' : '💾 Salvează'}
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg text-[11px]"
            style={{ color: '#ff6666', border: '1px solid #ff444430', background: '#ff444410' }}
          >
            ↺ Reset
          </motion.button>
        </div>

        {/* Map */}
        <div className="flex-1 relative">
          <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
          {addMode && (
            <motion.div
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className="absolute top-3 left-3 right-3 z-[1000] px-3 py-2 rounded-lg text-xs text-center"
              style={{ background: 'color-mix(in srgb, var(--accent) 12%, rgba(0,0,0,0.8))', border: '1px solid color-mix(in srgb, var(--accent) 40%, transparent)', color: 'var(--accent)', backdropFilter: 'blur(8px)' }}
            >
              🎯 Dă click oriunde pe hartă pentru a adăuga un punct nou
            </motion.div>
          )}
        </div>

        {/* Waypoint list */}
        <div className="flex-shrink-0 border-t overflow-y-auto"
          style={{ borderColor: 'var(--border)', maxHeight: '180px', background: 'var(--surface)' }}>
          <div className="text-[9px] font-mono uppercase tracking-widest px-3 pt-2 pb-1"
            style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
            {route.length} puncte · trage pentru reordonare
          </div>
          {route.map((wp, i) => (
            <motion.div
              key={wp.id ?? i}
              whileHover={{ x: 2 }}
              className="flex items-center gap-2 px-3 py-1.5 cursor-pointer transition-all"
              style={{
                background: selected === i ? 'color-mix(in srgb, var(--accent) 8%, transparent)' : 'transparent',
                borderLeft: `2px solid ${selected === i ? wp.culoare || 'var(--accent)' : 'transparent'}`,
              }}
              onClick={() => setSelected(i === selected ? null : i)}
            >
              <div className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold flex-shrink-0"
                style={{ background: wp.culoare || '#00d4ff', color: '#000' }}>
                {i + 1}
              </div>
              <span className="text-[11px] flex-1 truncate" style={{ color: 'var(--text)' }}>{wp.titlu}</span>
              <span className="text-[9px] font-mono" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
                {wp.coords[0].toFixed(4)}, {wp.coords[1].toFixed(4)}
              </span>
              <div className="flex gap-0.5">
                <button onClick={e => { e.stopPropagation(); moveUp(i); }}
                  className="w-5 h-5 flex items-center justify-center rounded text-[9px]"
                  style={{ color: 'var(--text-muted)' }}>▲</button>
                <button onClick={e => { e.stopPropagation(); moveDown(i); }}
                  className="w-5 h-5 flex items-center justify-center rounded text-[9px]"
                  style={{ color: 'var(--text-muted)' }}>▼</button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── RIGHT: EDIT PANEL ─────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        <AnimatePresence mode="wait">
          {selected !== null && route[selected] ? (
            <motion.div key={selected} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="h-full">
              <WaypointEditPanel
                wp={route[selected]}
                onUpdate={handleUpdateWp}
                onDelete={handleDeleteWp}
                onClose={() => setSelected(null)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="h-full flex flex-col items-center justify-center gap-4 px-8"
              style={{ background: 'var(--surface)' }}
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 3, repeat: Infinity }}
                className="text-5xl"
              >🗺️</motion.div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Editor Traseu</p>
                <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  ➕ <strong>Adaugă punct</strong> → click pe hartă<br />
                  ✏️ <strong>Editează</strong> → click pe un punct din listă<br />
                  🔀 <strong>Reordonează</strong> → butoanele ▲▼<br />
                  🖱️ <strong>Mută pe hartă</strong> → trage markerul<br />
                  💾 <strong>Salvează</strong> → traseul e permanent
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

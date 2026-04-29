import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import useStore from '../store/useStore.js';

/* ═══════════════════════════════════════════════════════════
   SKY — Weather Intelligence Dashboard
   OKComputer-inspired glassmorphic satellite map + sidebar
═══════════════════════════════════════════════════════════ */

const MAP_CENTER = [44.1598, 28.6348];
const TABS = ['Live Map', 'Forecast', 'Radar', 'Analytics', 'Alerts', 'History', 'Settings'];

const STATIONS = [
  { id: 'constanta', name: 'Constanța City', lat: 44.1733, lng: 28.6383, status: 'online' },
  { id: 'mangalia', name: 'Mangalia', lat: 43.8, lng: 28.5833, status: 'online' },
  { id: 'medgidia', name: 'Medgidia', lat: 44.25, lng: 28.2833, status: 'online' },
  { id: 'eforie', name: 'Eforie', lat: 44.0667, lng: 28.65, status: 'offline' },
];

const OVERLAYS = [
  { value: 'none', label: 'None' },
  { value: 'precipitation', label: 'Precipitation' },
  { value: 'wind', label: 'Wind' },
  { value: 'temperature', label: 'Temperature' },
];

// ── Hooks ────────────────────────────────────────────────
function useCountUp(target, duration = 1000, decimals = 0) {
  const [value, setValue] = useState(0);
  const startRef = useRef(null);
  const rafRef = useRef(null);
  useEffect(() => {
    const animate = (ts) => {
      if (startRef.current === null) startRef.current = ts;
      const p = Math.min((ts - startRef.current) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(eased * target);
      if (p < 1) rafRef.current = requestAnimationFrame(animate);
    };
    startRef.current = null;
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);
  return decimals > 0 ? value.toFixed(decimals) : Math.round(value).toString();
}

function useIsMobile() {
  const [m, setM] = useState(typeof window !== 'undefined' && window.innerWidth < 768);
  useEffect(() => {
    const h = () => setM(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return m;
}

// ── Sparkline SVG ────────────────────────────────────────
function Sparkline({ data = [], color = '#3B82F6', width = 120, height = 40 }) {
  const pathD = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
    const pad = 4, cW = width - pad * 2, cH = height - pad * 2;
    return data.map((v, i) => {
      const x = pad + (i / (data.length - 1)) * cW;
      const y = pad + cH - ((v - min) / range) * cH;
      return `${i === 0 ? 'M' : 'L'}${x},${y}`;
    }).join(' ');
  }, [data, width, height]);

  const areaD = useMemo(() => {
    if (data.length < 2) return '';
    const min = Math.min(...data), max = Math.max(...data), range = max - min || 1;
    const pad = 4, cW = width - pad * 2, cH = height - pad * 2;
    let d = '';
    data.forEach((v, i) => {
      const x = pad + (i / (data.length - 1)) * cW;
      const y = pad + cH - ((v - min) / range) * cH;
      d += `${i === 0 ? 'M' : 'L'}${x},${y} `;
    });
    d += `L${width - pad},${height} L${pad},${height} Z`;
    return d;
  }, [data, width, height]);

  const gId = `sg-${color.replace('#', '')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={gId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${gId})`} />
      <path d={pathD} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Glass panel base ─────────────────────────────────────
const glass = { background: 'rgba(14,14,22,0.75)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.06)' };
const card = { background: 'rgba(14,14,22,0.85)', border: '1px solid rgba(255,255,255,0.06)' };

// ── TopNav ───────────────────────────────────────────────
function TopNav({ activeTab, onTabChange, onBack }) {
  return (
    <motion.nav initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="flex items-center justify-between px-5 h-14 border-b border-white/[0.06] shrink-0">
      <div className="flex items-center gap-3 cursor-pointer" onClick={onBack}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-white">
          <rect x="3" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="14" y="3" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="3" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
          <rect x="14" y="14" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        <span className="text-white text-lg font-semibold tracking-tight">Sky</span>
      </div>
      <div className="hidden md:flex items-center gap-1">
        {TABS.map((tab) => (
          <button key={tab} onClick={() => onTabChange(tab)}
            className={`relative px-4 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
              activeTab === tab ? 'text-white bg-white/[0.08]' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04]'
            }`}>{tab}</button>
        ))}
      </div>
      <div className="flex items-center gap-3 text-white/60">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 20h.01M7 20v-4M12 20V10M17 20V4" /></svg>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" /></svg>
      </div>
    </motion.nav>
  );
}

// ── StatsRow ─────────────────────────────────────────────
function StatsRow({ weather }) {
  const cur = weather?.current;
  const det = weather?.details;
  const stats = [
    { label: 'Temp', value: cur ? `${cur.temp}°C` : '--' },
    { label: 'Humidity', value: det ? `${det.humidity}%` : '--' },
    { label: 'Wind', value: det ? `${det.windSpeed} km/h` : '--' },
    { label: 'Pressure', value: det ? `${det.pressure} hPa` : '--' },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
      className="flex items-center gap-2">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-2 px-3 py-2 rounded-xl flex-1" style={card}>
          <div>
            <div className="text-[11px] text-white/40 leading-tight">{s.label}</div>
            <div className="text-xs font-semibold text-white leading-tight">{s.value}</div>
          </div>
        </div>
      ))}
    </motion.div>
  );
}

// ── AccuracyPanel ────────────────────────────────────────
function AccuracyPanel() {
  const countValue = useCountUp(94.2, 800, 1);
  const sparkData = [88, 90, 91, 89, 92, 93, 94, 93, 95, 94, 96, 94];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
      className="p-4 rounded-2xl" style={card}>
      <div className="text-xs text-white/60 mb-1">Weather Accuracy</div>
      <div className="flex items-baseline gap-1">
        <span className="text-4xl font-light text-white">{countValue}</span>
        <span className="text-sm text-white/40">%</span>
      </div>
      <div className="text-[11px] text-white/30 mb-3">Target: 95%</div>
      <Sparkline data={sparkData} color="#3B82F6" width={260} height={50} />
      <div className="flex justify-between mt-2">
        {['06:00', '09:00', '12:00', '15:00', '17:00'].map((t) => (
          <span key={t} className="text-[9px] text-white/25">{t}</span>
        ))}
      </div>
    </motion.div>
  );
}

// ── LocationCard ─────────────────────────────────────────
function LocationCard({ station, weather, index }) {
  const chartData = [22, 23, 24, 24, 25, 24, 23, 24];
  const temp = weather?.current?.temp || (20 + index * 2);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 + index * 0.08 }}
      className="rounded-xl overflow-hidden cursor-pointer" style={card}>
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-xs font-medium text-white">{station.name}</div>
            <div className="text-[9px] text-white/30 mt-0.5">{new Date().toLocaleString()}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[#161622] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"><path d="M17 18a5 5 0 0 0-10 0M12 9V2M4.22 10.22l1.42 1.42M1 18h2M21 18h2M18.36 11.64l1.42-1.42" /></svg>
          </div>
          <div className="text-lg font-light text-white">{temp}°C</div>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-1">
            {station.status === 'online'
              ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: 'pulse-glow 2s ease-in-out infinite' }} />
              : <div className="w-0 h-0 border-l-[4px] border-l-transparent border-r-[4px] border-r-transparent border-b-[6px] border-b-amber-500" />}
            <span className="text-[10px] text-white/50 capitalize">{station.status}</span>
          </div>
          <span className="text-[9px] text-white/30">GPS</span>
          <span className="text-[9px] text-white/30">LTE</span>
        </div>
        <Sparkline data={chartData} color={station.status === 'online' ? '#3B82F6' : '#EF4444'} width={140} height={28} />
      </div>
    </motion.div>
  );
}

// ── ForecastVariance ─────────────────────────────────────
function ForecastVariance() {
  const countValue = useCountUp(2.5, 600, 1);
  const vData = [
    { label: 'L1', value: -2 }, { label: 'L2', value: 1 }, { label: 'L3', value: -1.5 },
    { label: 'L4', value: 0.5 }, { label: 'L5', value: -1 }, { label: 'L6', value: 2 },
    { label: 'L7', value: -2.5 }, { label: 'L8', value: 1.5 },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.6 }}
      className="p-4 rounded-2xl" style={card}>
      <div className="flex items-start justify-between mb-2">
        <div className="text-xs text-white/60">Forecast Variance</div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
      </div>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-3xl font-light text-white">± {countValue}</span>
        <span className="text-sm text-white/40">min</span>
      </div>
      <div className="text-[11px] text-white/30 mb-3">Average Variance</div>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[9px] text-white/30 mb-1">
          <span>Route</span><span>Variance</span>
        </div>
        {vData.map((v) => (
          <div key={v.label} className="flex items-center gap-2">
            <span className="text-[9px] text-white/40 w-6">{v.label}</span>
            <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
              <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min(Math.abs(v.value) / 3 * 100, 100)}%` }}
                transition={{ duration: 0.8, delay: 0.8 }}
                className={`h-full rounded-full ${v.value > 0 ? 'bg-amber-500/60' : 'bg-emerald-500/60'}`} />
            </div>
            <span className={`text-[9px] w-8 text-right ${v.value > 0 ? 'text-amber-400' : 'text-emerald-400'}`}>
              {v.value > 0 ? `+${v.value}` : v.value}min
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── Sidebar (desktop) ────────────────────────────────────
function Sidebar({ weather }) {
  const activeCount = STATIONS.filter(s => s.status === 'online').length;
  const inactiveCount = STATIONS.filter(s => s.status === 'offline').length;
  return (
    <motion.aside initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
      className="hidden md:flex flex-col gap-3 w-[340px] lg:w-[420px] min-w-[300px] h-full overflow-y-auto pr-1"
      style={{ scrollbarWidth: 'none' }}>
      <StatsRow weather={weather} />
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" style={{ animation: 'pulse-glow 2s ease-in-out infinite' }} />
          <span className="text-xs text-white/60">Active</span>
          <span className="text-lg font-light text-white">{activeCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-0 h-0 border-l-[5px] border-l-transparent border-r-[5px] border-r-transparent border-b-[8px] border-b-amber-500" />
          <span className="text-xs text-white/60">Inactive</span>
          <span className="text-lg font-light text-white">{inactiveCount}</span>
        </div>
      </div>
      <AccuracyPanel />
      <div className="grid grid-cols-2 gap-2">
        {STATIONS.map((s, i) => <LocationCard key={s.id} station={s} weather={weather} index={i} />)}
      </div>
    </motion.aside>
  );
}

// ── Map helpers ──────────────────────────────────────────
function MapRefSetter({ onMap }) {
  const map = useMap();
  useEffect(() => { onMap(map); }, [map, onMap]);
  return null;
}

function createIcon(status) {
  const bg = status === 'online' ? '#3B82F6' : '#EF4444';
  const shadow = status === 'online' ? 'rgba(59,130,246,0.6)' : 'rgba(239,68,68,0.6)';
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:${bg};border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 10px ${shadow};"></div>`,
    iconSize: [12, 12], iconAnchor: [6, 6],
  });
}

function WeatherOverlayLayer({ overlay }) {
  const map = useMap();
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    if (overlay === 'none') return;
    const canvasEl = L.DomUtil.create('canvas', 'leaflet-canvas-layer');
    Object.assign(canvasEl.style, { position: 'absolute', top: '0', left: '0', pointerEvents: 'none', zIndex: '300' });
    const pane = map.getPane('overlayPane');
    if (pane) pane.appendChild(canvasEl);
    canvasRef.current = canvasEl;
    const resize = () => {
      const s = map.getSize();
      canvasEl.width = s.x; canvasEl.height = s.y;
      canvasEl.style.width = s.x + 'px'; canvasEl.style.height = s.y + 'px';
    };
    resize();
    map.on('resize move zoom', resize);
    const ctx = canvasEl.getContext('2d');
    if (!ctx) return;
    let time = 0;
    const draw = () => {
      const s = map.getSize();
      ctx.clearRect(0, 0, s.x, s.y);
      if (overlay === 'precipitation') {
        const blobs = [{ x: 0.3, y: 0.4, r: 0.15, i: 0.8 }, { x: 0.6, y: 0.5, r: 0.12, i: 0.6 }, { x: 0.45, y: 0.35, r: 0.1, i: 0.4 }];
        blobs.forEach(b => {
          const px = b.x * s.x, py = b.y * s.y, pr = b.r * Math.min(s.x, s.y);
          const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
          g.addColorStop(0, `rgba(59,130,246,${b.i * 0.5})`);
          g.addColorStop(0.5, `rgba(6,182,212,${b.i * 0.3})`);
          g.addColorStop(1, 'rgba(59,130,246,0)');
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(px, py, pr * (1 + Math.sin(time * 0.001 + b.x * 10) * 0.1), 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (overlay === 'wind') {
        ctx.strokeStyle = 'rgba(6,182,212,0.3)'; ctx.lineWidth = 1;
        for (let x = 0; x < s.x; x += 40) for (let y = 0; y < s.y; y += 40) {
          const a = (Math.sin(x * 0.01 + time * 0.0005) + Math.cos(y * 0.01)) * Math.PI;
          const l = 15 + Math.sin(time * 0.001 + x) * 5;
          ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); ctx.stroke();
        }
      } else if (overlay === 'temperature') {
        const g = ctx.createLinearGradient(0, 0, s.x, s.y);
        g.addColorStop(0, 'rgba(59,130,246,0.15)'); g.addColorStop(0.5, 'rgba(16,185,129,0.1)'); g.addColorStop(1, 'rgba(245,158,11,0.15)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, s.x, s.y);
      }
      time += 16;
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      map.off('resize move zoom', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (pane && canvasEl.parentNode === pane) pane.removeChild(canvasEl);
    };
  }, [map, overlay]);
  return null;
}

// ── ForecastTimeline ─────────────────────────────────────
function ForecastTimeline({ hourly }) {
  const data = useMemo(() => {
    if (hourly?.length) return hourly.slice(0, 8).map(h => ({ hour: h.time || '--', temp: h.temp, precip: h.precipChance || 0 }));
    return [
      { hour: '00:00', temp: 19, precip: 0 }, { hour: '03:00', temp: 17, precip: 0 },
      { hour: '06:00', temp: 18, precip: 5 }, { hour: '09:00', temp: 22, precip: 10 },
      { hour: '12:00', temp: 26, precip: 20 }, { hour: '15:00', temp: 27, precip: 65 },
      { hour: '18:00', temp: 24, precip: 80 }, { hour: '21:00', temp: 21, precip: 45 },
    ];
  }, [hourly]);
  const maxP = Math.max(...data.map(d => d.precip), 1);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.7 }}
      className="rounded-xl px-4 py-3" style={glass}>
      <div className="text-xs text-white/40 mb-3">24h Forecast</div>
      <div className="flex items-end gap-3">
        {data.map((h, i) => (
          <div key={i} className="flex flex-col items-center gap-1.5 flex-1">
            <div className="text-xs font-light text-white">{h.temp}°</div>
            <div className="w-full flex flex-col items-center gap-0.5">
              <motion.div initial={{ height: 0 }} animate={{ height: `${(h.precip / maxP) * 24}px` }}
                transition={{ duration: 0.5, delay: 0.8 + i * 0.05 }}
                className={`w-full rounded-t-sm ${h.precip > 50 ? 'bg-blue-500/60' : h.precip > 20 ? 'bg-cyan-500/50' : 'bg-white/10'}`} />
              <div className="w-full h-0.5 bg-white/10" />
            </div>
            <div className="text-[9px] text-white/30">{h.hour}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

// ── SkyMap ────────────────────────────────────────────────
function SkyMap({ overlay, weather }) {
  const [mapInst, setMapInst] = useState(null);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.2 }}
      className="relative w-full h-full rounded-2xl overflow-hidden">
      <MapContainer center={MAP_CENTER} zoom={9} scrollWheelZoom style={{ width: '100%', height: '100%', borderRadius: '16px', background: '#06060A' }}>
        <MapRefSetter onMap={setMapInst} />
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="" />
        <WeatherOverlayLayer overlay={overlay} />
        {STATIONS.map(s => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={createIcon(s.status)}>
            <Popup>{s.name} ({s.status})</Popup>
          </Marker>
        ))}
      </MapContainer>

      {mapInst && (
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.5 }}
          className="absolute right-4 top-1/2 -translate-y-1/2 z-[400] flex flex-col gap-2">
          {[
            { icon: '+', fn: () => mapInst.zoomIn() },
            { icon: '⊕', fn: () => mapInst.setView(MAP_CENTER, 9) },
            { icon: '−', fn: () => mapInst.zoomOut() },
          ].map((b, i) => (
            <button key={i} onClick={b.fn} className="w-9 h-9 rounded-full flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.08] transition-all"
              style={glass}>{b.icon}</button>
          ))}
        </motion.div>
      )}

      {/* Floating map title */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.4 }}
        className="absolute top-4 left-4 z-[400] rounded-xl px-4 py-3" style={glass}>
        <h2 className="text-base font-medium text-white">Weather Radar</h2>
        <p className="text-xs text-white/50">{weather?.city?.label || 'Județul Constanța, Romania'}</p>
      </motion.div>

      {/* Current conditions */}
      {weather?.current && (
        <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.4, delay: 0.5 }}
          className="absolute top-28 right-16 z-[400] rounded-xl px-4 py-3" style={glass}>
          <div className="text-[10px] text-white/40 uppercase tracking-wider">Current Conditions</div>
          <div className="text-[10px] text-white/30 mb-1">{weather.city?.label || 'Station'}</div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-amber-400">
                <circle cx="12" cy="12" r="5" fill="currentColor" />
                <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <span className="text-2xl font-light text-white">{weather.current.temp}°C</span>
          </div>
        </motion.div>
      )}

      {/* Weather legend */}
      {overlay !== 'none' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}
          className="absolute bottom-4 left-4 z-[400] rounded-xl px-3 py-2" style={glass}>
          <div className="text-[10px] text-white/40 mb-1.5 capitalize">{overlay} Scale</div>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-white/30 w-8">Light</span>
            <div className="w-24 h-2 rounded-full bg-gradient-to-r from-blue-300/60 via-cyan-400/60 to-purple-500/60" />
            <span className="text-[9px] text-white/30 w-8 text-right">Heavy</span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── OverlaySelector ──────────────────────────────────────
function OverlaySelector({ activeOverlay, onOverlayChange }) {
  return (
    <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.55 }}
      className="absolute top-4 right-16 z-[400] rounded-xl p-1.5 flex gap-1" style={glass}>
      {OVERLAYS.map(o => (
        <button key={o.value} onClick={() => onOverlayChange(o.value)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${
            activeOverlay === o.value ? 'bg-white/[0.12] text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/[0.04]'
          }`}>
          <span className="hidden lg:inline">{o.label}</span>
          <span className="lg:hidden">{o.label.slice(0, 4)}</span>
        </button>
      ))}
    </motion.div>
  );
}

// ── Mobile bottom sheet ──────────────────────────────────
function MobileBottomSheet({ weather }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <motion.div className="md:hidden fixed bottom-0 left-0 right-0 z-[500]"
      animate={{ height: expanded ? '70vh' : '200px' }} transition={{ type: 'spring', damping: 25, stiffness: 300 }}>
      <div className="h-full rounded-t-2xl overflow-hidden flex flex-col" style={{ ...glass, background: 'rgba(14,14,22,0.92)' }}>
        <div className="flex justify-center py-2 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="w-8 h-1 rounded-full bg-white/20" />
        </div>
        <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ scrollbarWidth: 'none' }}>
          <StatsRow weather={weather} />
          {weather?.current && (
            <div className="flex items-center justify-between mt-4 mb-3">
              <div>
                <div className="text-3xl font-light text-white">{weather.current.temp}°C</div>
                <div className="text-xs text-white/50">{weather.current.conditionText}</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-white/40">H:{weather.current.high}° L:{weather.current.low}°</div>
              </div>
            </div>
          )}
          {expanded && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <AccuracyPanel />
              <div className="grid grid-cols-2 gap-2 mt-3">
                {STATIONS.map((s, i) => <LocationCard key={s.id} station={s} weather={weather} index={i} />)}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Intro Video ──────────────────────────────────────────
function SkyIntro({ onComplete }) {
  const [canSkip, setCanSkip] = useState(false);
  useEffect(() => { const t = setTimeout(() => setCanSkip(true), 2000); return () => clearTimeout(t); }, []);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[999] bg-black flex items-center justify-center">
      <video src="/sky-intro.mp4" autoPlay playsInline muted={false} onEnded={onComplete} className="w-full h-full object-cover" />
      {canSkip && (
        <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onComplete}
          className="absolute bottom-10 right-10 px-5 py-2.5 rounded-full text-sm font-semibold"
          style={{ ...glass, color: '#F2F2F2' }}>Skip Intro →</motion.button>
      )}
    </motion.div>
  );
}

// ══════════════════════════════════════════════════════════
// ── Main SkyHub ──────────────────────────────────────────
// ══════════════════════════════════════════════════════════
export default function SkyHub({ onBack }) {
  const { backendUrl } = useStore();
  const isMobile = useIsMobile();
  const [phase, setPhase] = useState('intro');
  const [activeTab, setActiveTab] = useState('Live Map');
  const [activeOverlay, setActiveOverlay] = useState('precipitation');
  const [cityKey, setCityKey] = useState('constanta');
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchWeather = useCallback(async (key) => {
    setLoading(true); setError('');
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(`${backendUrl}/sky/weather/${key}`);
        if (r.status === 502 || r.status === 503) {
          if (attempt === 0) { await new Promise(r => setTimeout(r, 4000)); continue; }
          throw new Error('Backend starting up — try again.');
        }
        if (!r.ok) throw new Error(`Server error (${r.status})`);
        setWeather(await r.json());
        break;
      } catch (e) {
        if (attempt === 1) setError(e.message || 'Failed to load weather');
        else await new Promise(r => setTimeout(r, 4000));
      }
    }
    setLoading(false);
  }, [backendUrl]);

  useEffect(() => { if (phase === 'app') fetchWeather(cityKey); }, [phase, cityKey, fetchWeather]);

  if (phase === 'intro') return <AnimatePresence><SkyIntro onComplete={() => setPhase('app')} /></AnimatePresence>;

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#06060A' }}>
      <style>{`
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.4)} 50%{box-shadow:0 0 0 6px rgba(16,185,129,0)} }
        .leaflet-control-zoom,.leaflet-control-attribution{display:none!important}
        .leaflet-container{background:#06060A!important}
      `}</style>

      <TopNav activeTab={activeTab} onTabChange={setActiveTab} onBack={onBack} />

      <div className="flex flex-1 gap-3 p-3 pt-2 overflow-hidden">
        <Sidebar weather={weather} />

        <div className="flex-1 relative min-w-0">
          {loading && !weather && (
            <div className="absolute inset-0 z-[500] flex items-center justify-center" style={{ background: 'rgba(6,6,10,0.8)' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500" />
            </div>
          )}
          <SkyMap overlay={activeOverlay} weather={weather} />
          <OverlaySelector activeOverlay={activeOverlay} onOverlayChange={setActiveOverlay} />
          {!isMobile && (
            <div className="absolute bottom-4 right-4 z-[400] w-72">
              <ForecastVariance />
            </div>
          )}
        </div>
      </div>

      <div className="px-3 pb-3">
        <ForecastTimeline hourly={weather?.hourly} />
      </div>

      {isMobile && <MobileBottomSheet weather={weather} />}

      {error && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[600] px-4 py-2 rounded-xl text-sm text-red-400" style={glass}>
          {error} <button onClick={() => fetchWeather(cityKey)} className="ml-2 text-blue-400 underline">Retry</button>
        </div>
      )}
    </div>
  );
}

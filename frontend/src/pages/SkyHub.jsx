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
  { id: 'constanta', name: 'Constanța City', lat: 44.1733, lng: 28.6383 },
  { id: 'mangalia', name: 'Mangalia', lat: 43.8, lng: 28.5833 },
  { id: 'medgidia', name: 'Medgidia', lat: 44.25, lng: 28.2833 },
  { id: 'eforie', name: 'Eforie', lat: 44.0667, lng: 28.65 },
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
  const sun = weather?.sun;
  const stats = [
    { label: 'Temperature', value: cur ? `${cur.temp}°C` : '--', sub: det ? `Feels ${det.feelsLike}°C` : '' },
    { label: 'Humidity', value: det ? `${det.humidity}%` : '--', sub: det ? `Dew ${det.dewPoint}°C` : '' },
    { label: 'Wind', value: det ? `${det.windSpeed} km/h` : '--', sub: det ? det.windDirection : '' },
    { label: 'Pressure', value: det ? `${det.pressure} hPa` : '--', sub: det ? det.pressureTrend : '' },
    { label: 'UV Index', value: det ? `${det.uvIndex}` : '--', sub: det ? det.uvText : '' },
    { label: 'Visibility', value: det ? `${det.visibility} km` : '--', sub: det ? det.visibilityText : '' },
  ];
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.1 }}
      className="grid grid-cols-3 gap-2">
      {stats.map((s) => (
        <div key={s.label} className="px-3 py-2 rounded-xl" style={card}>
          <div className="text-[10px] text-white/40 leading-tight">{s.label}</div>
          <div className="text-sm font-semibold text-white leading-tight mt-0.5">{s.value}</div>
          {s.sub && <div className="text-[9px] text-white/25 mt-0.5">{s.sub}</div>}
        </div>
      ))}
    </motion.div>
  );
}

// ── SunPanel (replaces AccuracyPanel) ─────────────────────
function SunPanel({ weather }) {
  const sun = weather?.sun;
  const cur = weather?.current;
  const hourlyTemps = useMemo(() => {
    if (!weather?.hourly?.length) return [20, 21, 22, 23, 24, 23, 22, 21, 20, 19, 18, 17];
    return weather.hourly.slice(0, 12).map(h => h.temp);
  }, [weather?.hourly]);
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
      className="p-4 rounded-2xl" style={card}>
      <div className="text-xs text-white/60 mb-1">Current Conditions</div>
      {cur && (
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-4xl font-light text-white">{cur.temp}°</span>
          <span className="text-sm text-white/40">{cur.conditionText}</span>
        </div>
      )}
      {cur && <div className="text-[11px] text-white/30 mb-3">H:{cur.high}° L:{cur.low}°</div>}
      <Sparkline data={hourlyTemps} color="#3B82F6" width={260} height={50} />
      <div className="flex justify-between mt-2 text-[9px] text-white/25">
        {weather?.hourly ? weather.hourly.slice(0, 5).map((h, i) => <span key={i}>{h.time}</span>) :
          ['06:00', '09:00', '12:00', '15:00', '17:00'].map(t => <span key={t}>{t}</span>)}
      </div>
      {sun && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/[0.06]">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(251,191,36,0.7)" strokeWidth="2"><path d="M17 18a5 5 0 0 0-10 0M12 9V2M4.22 10.22l1.42 1.42M1 18h2M21 18h2M18.36 11.64l1.42-1.42" /></svg>
            <div><div className="text-[9px] text-white/30">Sunrise</div><div className="text-xs text-white">{sun.sunrise}</div></div>
          </div>
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(251,146,60,0.7)" strokeWidth="2"><path d="M17 18a5 5 0 0 0-10 0M12 9V2M4.22 10.22l1.42 1.42M1 18h2M21 18h2M18.36 11.64l1.42-1.42" /></svg>
            <div><div className="text-[9px] text-white/30">Sunset</div><div className="text-xs text-white">{sun.sunset}</div></div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ── LocationCard ─────────────────────────────────────────
function LocationCard({ station, stationWeather, index, selected, onSelect }) {
  const hasData = !!stationWeather?.current;
  const status = hasData ? 'online' : 'loading';
  const temp = stationWeather?.current?.temp ?? '--';
  const condition = stationWeather?.current?.conditionText ?? '';
  const chartData = useMemo(() => {
    if (!stationWeather?.hourly?.length) return [20, 21, 22, 23, 24, 23, 22, 21];
    return stationWeather.hourly.slice(0, 8).map(h => h.temp);
  }, [stationWeather?.hourly]);
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 + index * 0.08 }}
      onClick={() => onSelect?.(station.id)}
      className="rounded-xl overflow-hidden cursor-pointer transition-all hover:scale-[1.02]"
      style={{ ...card, border: selected ? '1px solid rgba(59,130,246,0.4)' : card.border }}>
      <div className="p-3">
        <div className="flex items-start justify-between mb-2">
          <div>
            <div className="text-xs font-medium text-white">{station.name}</div>
            <div className="text-[9px] text-white/30 mt-0.5">{condition || 'Loading...'}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={selected ? 'rgba(59,130,246,0.8)' : 'rgba(255,255,255,0.3)'} strokeWidth="2"><path d="M7 17L17 7M17 7H7M17 7v10" /></svg>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <div className="w-10 h-10 rounded-lg bg-[#161622] flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"><path d="M17 18a5 5 0 0 0-10 0M12 9V2M4.22 10.22l1.42 1.42M1 18h2M21 18h2M18.36 11.64l1.42-1.42" /></svg>
          </div>
          <div className="text-lg font-light text-white">{temp}°C</div>
        </div>
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center gap-1">
            {hasData
              ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" style={{ animation: 'pulse-glow 2s ease-in-out infinite' }} />
              : <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
            <span className="text-[10px] text-white/50 capitalize">{status}</span>
          </div>
          {stationWeather?.details && <>
            <span className="text-[9px] text-white/30">{stationWeather.details.windSpeed} km/h</span>
            <span className="text-[9px] text-white/30">{stationWeather.details.humidity}%</span>
          </>}
        </div>
        <Sparkline data={chartData} color={hasData ? '#3B82F6' : '#EF4444'} width={140} height={28} />
      </div>
    </motion.div>
  );
}

// ── DailyForecast (replaces ForecastVariance) ─────────────
function DailyForecast({ weather }) {
  const daily = weather?.daily || [];
  const condIcon = (c) => {
    if (c === 'sunny') return '☀️';
    if (c === 'partly-cloudy') return '⛅';
    if (c === 'cloudy') return '☁️';
    if (c === 'rain') return '🌧️';
    if (c === 'snow') return '❄️';
    if (c === 'storm') return '⛈️';
    return '🌤️';
  };
  if (!daily.length) return null;
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.6 }}
      className="p-4 rounded-2xl" style={card}>
      <div className="text-xs text-white/60 mb-3">7-Day Forecast</div>
      <div className="space-y-2">
        {daily.map((d, i) => {
          const range = Math.max(...daily.map(x => x.high)) - Math.min(...daily.map(x => x.low));
          const minAll = Math.min(...daily.map(x => x.low));
          const barLeft = ((d.low - minAll) / range) * 100;
          const barWidth = ((d.high - d.low) / range) * 100;
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-white/50 w-8">{d.dayShort}</span>
              <span className="text-sm w-6 text-center">{condIcon(d.condition)}</span>
              <span className="text-[10px] text-blue-300/70 w-7 text-right">{d.low}°</span>
              <div className="flex-1 h-1.5 bg-white/[0.06] rounded-full overflow-hidden relative">
                <motion.div initial={{ width: 0 }} animate={{ width: `${Math.max(barWidth, 10)}%` }}
                  transition={{ duration: 0.6, delay: 0.1 * i }}
                  className="absolute h-full rounded-full bg-gradient-to-r from-blue-400/60 to-amber-400/60"
                  style={{ left: `${barLeft}%` }} />
              </div>
              <span className="text-[10px] text-amber-300/70 w-7">{d.high}°</span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
}

// ── Sidebar (desktop) ────────────────────────────────────
function Sidebar({ weather, allWeather, selectedStation, onSelectStation }) {
  const activeCount = STATIONS.filter(s => allWeather[s.id]?.current).length;
  const loadingCount = STATIONS.length - activeCount;
  return (
    <motion.aside initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
      className="hidden md:flex flex-col gap-3 w-[340px] lg:w-[420px] min-w-[300px] h-full overflow-y-auto pr-1"
      style={{ scrollbarWidth: 'none' }}>
      <StatsRow weather={weather} />
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500" style={{ animation: 'pulse-glow 2s ease-in-out infinite' }} />
          <span className="text-xs text-white/60">Online</span>
          <span className="text-lg font-light text-white">{activeCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs text-white/60">Loading</span>
          <span className="text-lg font-light text-white">{loadingCount}</span>
        </div>
      </div>
      <SunPanel weather={weather} />
      <div className="grid grid-cols-2 gap-2">
        {STATIONS.map((s, i) => <LocationCard key={s.id} station={s} stationWeather={allWeather[s.id]} index={i}
          selected={selectedStation === s.id} onSelect={onSelectStation} />)}
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
function SkyMap({ overlay, weather, mapInstRef }) {
  const [mapInst, setMapInst] = useState(null);
  const handleMap = useCallback((m) => {
    setMapInst(m);
    if (mapInstRef) mapInstRef.current = m;
  }, [mapInstRef]);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6, delay: 0.2 }}
      className="relative w-full h-full rounded-2xl overflow-hidden">
      <MapContainer center={MAP_CENTER} zoom={9} scrollWheelZoom style={{ width: '100%', height: '100%', borderRadius: '16px', background: '#06060A' }}>
        <MapRefSetter onMap={handleMap} />
        <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" attribution="" />
        <WeatherOverlayLayer overlay={overlay} />
        {STATIONS.map(s => (
          <Marker key={s.id} position={[s.lat, s.lng]} icon={createIcon('online')}>
            <Popup>{s.name}</Popup>
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
function MobileBottomSheet({ weather, allWeather, selectedStation, onSelectStation }) {
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
              <SunPanel weather={weather} />
              <DailyForecast weather={weather} />
              <div className="grid grid-cols-2 gap-2 mt-3">
                {STATIONS.map((s, i) => <LocationCard key={s.id} station={s} stationWeather={allWeather[s.id]} index={i}
                  selected={selectedStation === s.id} onSelect={onSelectStation} />)}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Tab Views ────────────────────────────────────────────
function ForecastView({ weather }) {
  const condIcon = (c) => ({ sunny: '☀️', 'partly-cloudy': '⛅', cloudy: '☁️', rain: '🌧️', snow: '❄️', storm: '⛈️', 'clear-night': '🌙' }[c] || '🌤️');
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto p-4" style={{ scrollbarWidth: 'none' }}>
      <h2 className="text-lg font-medium text-white mb-4">7-Day Forecast</h2>
      {weather?.daily?.length ? (
        <div className="grid gap-3">
          {weather.daily.map((d, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-4 rounded-xl" style={card}>
              <div className="w-16"><div className="text-sm font-medium text-white">{d.day}</div><div className="text-[10px] text-white/40">{d.dayShort}</div></div>
              <span className="text-2xl">{condIcon(d.condition)}</span>
              <div className="flex-1 flex items-center gap-3">
                <span className="text-blue-300 text-sm w-8 text-right">{d.low}°</span>
                <div className="flex-1 h-2 bg-white/[0.06] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-blue-400/60 to-amber-400/60" style={{ width: `${Math.max(((d.high - d.low) / 20) * 100, 20)}%` }} />
                </div>
                <span className="text-amber-300 text-sm w-8">{d.high}°</span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : <div className="text-white/40 text-sm">Loading forecast data...</div>}
      <div className="mt-6"><ForecastTimeline hourly={weather?.hourly} /></div>
    </motion.div>
  );
}

function AnalyticsView({ weather }) {
  const det = weather?.details;
  const sun = weather?.sun;
  const hourlyTemps = weather?.hourly?.map(h => h.temp) || [];
  const sections = [
    { title: 'Temperature', items: [
      { label: 'Current', value: weather?.current ? `${weather.current.temp}°C` : '--' },
      { label: 'Feels Like', value: det ? `${det.feelsLike}°C` : '--' },
      { label: 'High / Low', value: weather?.current ? `${weather.current.high}° / ${weather.current.low}°` : '--' },
      { label: 'Dew Point', value: det ? `${det.dewPoint}°C` : '--' },
    ]},
    { title: 'Wind & Pressure', items: [
      { label: 'Wind Speed', value: det ? `${det.windSpeed} ${det.windUnit}` : '--' },
      { label: 'Direction', value: det?.windDirection || '--' },
      { label: 'Pressure', value: det ? `${det.pressure} ${det.pressureUnit}` : '--' },
      { label: 'Trend', value: det?.pressureTrend || '--' },
    ]},
    { title: 'Atmosphere', items: [
      { label: 'Humidity', value: det ? `${det.humidity}%` : '--' },
      { label: 'Visibility', value: det ? `${det.visibility} ${det.visibilityUnit} (${det.visibilityText})` : '--' },
      { label: 'UV Index', value: det ? `${det.uvIndex} (${det.uvText})` : '--' },
    ]},
    { title: 'Sun', items: [
      { label: 'Sunrise', value: sun?.sunrise || '--' },
      { label: 'Sunset', value: sun?.sunset || '--' },
    ]},
  ];
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto p-4" style={{ scrollbarWidth: 'none' }}>
      <h2 className="text-lg font-medium text-white mb-4">Weather Analytics</h2>
      {hourlyTemps.length > 0 && (
        <div className="rounded-xl p-4 mb-4" style={card}>
          <div className="text-xs text-white/50 mb-2">24h Temperature Trend</div>
          <Sparkline data={hourlyTemps} color="#3B82F6" width={600} height={80} />
        </div>
      )}
      <div className="grid md:grid-cols-2 gap-3">
        {sections.map((s) => (
          <motion.div key={s.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl p-4" style={card}>
            <div className="text-xs text-white/60 mb-3 font-medium">{s.title}</div>
            <div className="space-y-2">
              {s.items.map((it) => (
                <div key={it.label} className="flex items-center justify-between">
                  <span className="text-[11px] text-white/40">{it.label}</span>
                  <span className="text-xs text-white font-medium">{it.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function AlertsView({ weather, allWeather }) {
  const alerts = useMemo(() => {
    const list = [];
    const det = weather?.details;
    const cur = weather?.current;
    if (det) {
      if (det.uvIndex >= 8) list.push({ level: 'danger', text: `Extreme UV Index (${det.uvIndex}) — avoid sun exposure`, icon: '☀️' });
      else if (det.uvIndex >= 6) list.push({ level: 'warning', text: `High UV Index (${det.uvIndex}) — use sunscreen`, icon: '☀️' });
      if (det.windSpeed >= 50) list.push({ level: 'danger', text: `Strong winds: ${det.windSpeed} km/h ${det.windDirection}`, icon: '💨' });
      else if (det.windSpeed >= 30) list.push({ level: 'warning', text: `Moderate winds: ${det.windSpeed} km/h ${det.windDirection}`, icon: '💨' });
      if (det.humidity >= 90) list.push({ level: 'warning', text: `Very high humidity (${det.humidity}%)`, icon: '💧' });
      if (det.visibility < 2) list.push({ level: 'danger', text: `Poor visibility: ${det.visibility} km`, icon: '🌫️' });
      else if (det.visibility < 5) list.push({ level: 'warning', text: `Reduced visibility: ${det.visibility} km`, icon: '🌫️' });
      if (det.pressure < 1000) list.push({ level: 'info', text: `Low pressure (${det.pressure} hPa) — possible storm`, icon: '🌪️' });
    }
    if (cur) {
      if (cur.temp >= 35) list.push({ level: 'danger', text: `Extreme heat: ${cur.temp}°C`, icon: '🌡️' });
      if (cur.temp <= 0) list.push({ level: 'warning', text: `Freezing temperature: ${cur.temp}°C`, icon: '🥶' });
      if (['storm'].includes(cur.condition)) list.push({ level: 'danger', text: `Thunderstorm activity detected`, icon: '⛈️' });
      if (['rain'].includes(cur.condition)) list.push({ level: 'info', text: `Rain expected — carry an umbrella`, icon: '🌧️' });
      if (['snow'].includes(cur.condition)) list.push({ level: 'warning', text: `Snow conditions — drive carefully`, icon: '❄️' });
    }
    if (list.length === 0) list.push({ level: 'ok', text: 'No weather alerts — conditions are normal', icon: '✅' });
    return list;
  }, [weather]);
  const colors = { danger: 'border-red-500/30 bg-red-500/5', warning: 'border-amber-500/30 bg-amber-500/5', info: 'border-blue-500/30 bg-blue-500/5', ok: 'border-emerald-500/30 bg-emerald-500/5' };
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto p-4" style={{ scrollbarWidth: 'none' }}>
      <h2 className="text-lg font-medium text-white mb-4">Weather Alerts</h2>
      <div className="space-y-2">
        {alerts.map((a, i) => (
          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className={`flex items-center gap-3 p-4 rounded-xl border ${colors[a.level]}`}>
            <span className="text-xl">{a.icon}</span>
            <span className="text-sm text-white/80">{a.text}</span>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}

function HistoryView({ weather }) {
  const daily = weather?.daily || [];
  const condIcon = (c) => ({ sunny: '☀️', 'partly-cloudy': '⛅', cloudy: '☁️', rain: '🌧️', snow: '❄️', storm: '⛈️', 'clear-night': '🌙' }[c] || '🌤️');
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto p-4" style={{ scrollbarWidth: 'none' }}>
      <h2 className="text-lg font-medium text-white mb-1">Weather History</h2>
      <p className="text-xs text-white/30 mb-4">7-day forecast data (historical data requires premium API)</p>
      {daily.length ? (
        <div className="space-y-2">
          {daily.map((d, i) => (
            <div key={i} className="flex items-center gap-4 p-3 rounded-xl" style={card}>
              <span className="text-lg">{condIcon(d.condition)}</span>
              <div className="flex-1">
                <div className="text-sm text-white font-medium">{d.day}</div>
                <div className="text-[10px] text-white/40">High {d.high}° / Low {d.low}°</div>
              </div>
            </div>
          ))}
        </div>
      ) : <div className="text-white/40 text-sm">No historical data available</div>}
    </motion.div>
  );
}

function SettingsView({ cityKey, onCityChange, backendUrl }) {
  const [cities, setCities] = useState([]);
  useEffect(() => {
    fetch(`${backendUrl}/sky/cities`).then(r => r.json()).then(setCities).catch(() => {});
  }, [backendUrl]);
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full overflow-y-auto p-4" style={{ scrollbarWidth: 'none' }}>
      <h2 className="text-lg font-medium text-white mb-4">Settings</h2>
      <div className="rounded-xl p-4 mb-4" style={card}>
        <div className="text-xs text-white/60 mb-3">Primary City</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {cities.map((c) => (
            <button key={c.key} onClick={() => onCityChange(c.key)}
              className={`px-3 py-2 rounded-lg text-xs text-left transition-all ${
                cityKey === c.key ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-white/50 hover:text-white/80 hover:bg-white/[0.04] border border-white/[0.06]'
              }`}>
              <div className="font-medium">{c.label}</div>
              <div className="text-[9px] opacity-50 mt-0.5">{c.country}</div>
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-xl p-4" style={card}>
        <div className="text-xs text-white/60 mb-3">Data Source</div>
        <div className="text-xs text-white/40">Open-Meteo (Free, no API key required)</div>
        <div className="text-[10px] text-white/25 mt-1">Hourly updates • 7-day forecast • Global coverage</div>
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
  const [selectedStation, setSelectedStation] = useState('constanta');
  const [weather, setWeather] = useState(null);
  const [allWeather, setAllWeather] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const mapInstRef = useRef(null);

  // Fetch weather for a single city key
  const fetchSingle = useCallback(async (key) => {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(`${backendUrl}/sky/weather/${key}`);
        if (r.status === 502 || r.status === 503) {
          if (attempt === 0) { await new Promise(res => setTimeout(res, 3000)); continue; }
          return null;
        }
        if (!r.ok) return null;
        return await r.json();
      } catch { if (attempt === 0) await new Promise(res => setTimeout(res, 3000)); }
    }
    return null;
  }, [backendUrl]);

  // Fetch primary city weather
  const fetchWeather = useCallback(async (key) => {
    setLoading(true); setError('');
    const data = await fetchSingle(key);
    if (data) setWeather(data);
    else setError('Failed to load weather — check backend connection.');
    setLoading(false);
  }, [fetchSingle]);

  // Fetch all station weather in parallel
  const fetchAllStations = useCallback(async () => {
    const results = {};
    await Promise.all(STATIONS.map(async (s) => {
      const data = await fetchSingle(s.id);
      if (data) results[s.id] = data;
    }));
    setAllWeather(results);
  }, [fetchSingle]);

  // On app start: fetch primary + all stations
  useEffect(() => {
    if (phase === 'app') {
      fetchWeather(cityKey);
      fetchAllStations();
    }
  }, [phase, cityKey, fetchWeather, fetchAllStations]);

  // Refresh all data every 5 minutes
  useEffect(() => {
    if (phase !== 'app') return;
    const iv = setInterval(() => { fetchWeather(cityKey); fetchAllStations(); }, 300000);
    return () => clearInterval(iv);
  }, [phase, cityKey, fetchWeather, fetchAllStations]);

  // When selecting a station, update primary weather + center map
  const handleSelectStation = useCallback((stationId) => {
    setSelectedStation(stationId);
    setCityKey(stationId);
    const s = STATIONS.find(st => st.id === stationId);
    if (s && mapInstRef.current) {
      mapInstRef.current.flyTo([s.lat, s.lng], 11, { duration: 1 });
    }
    // Use cached weather if available, fetch if not
    if (allWeather[stationId]) {
      setWeather(allWeather[stationId]);
    } else {
      fetchWeather(stationId);
    }
  }, [allWeather, fetchWeather]);

  if (phase === 'intro') return <AnimatePresence><SkyIntro onComplete={() => setPhase('app')} /></AnimatePresence>;

  // Tab → content mapping
  const showMap = activeTab === 'Live Map' || activeTab === 'Radar';
  const radarOverlay = activeTab === 'Radar' ? 'precipitation' : activeOverlay;

  const renderTabContent = () => {
    switch (activeTab) {
      case 'Forecast': return <ForecastView weather={weather} />;
      case 'Analytics': return <AnalyticsView weather={weather} />;
      case 'Alerts': return <AlertsView weather={weather} allWeather={allWeather} />;
      case 'History': return <HistoryView weather={weather} />;
      case 'Settings': return <SettingsView cityKey={cityKey} onCityChange={handleSelectStation} backendUrl={backendUrl} />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: '#06060A' }}>
      <style>{`
        @keyframes pulse-glow { 0%,100%{box-shadow:0 0 0 0 rgba(16,185,129,0.4)} 50%{box-shadow:0 0 0 6px rgba(16,185,129,0)} }
        .leaflet-control-zoom,.leaflet-control-attribution{display:none!important}
        .leaflet-container{background:#06060A!important}
      `}</style>

      <TopNav activeTab={activeTab} onTabChange={setActiveTab} onBack={onBack} />

      <div className="flex flex-1 gap-3 p-3 pt-2 overflow-hidden">
        <Sidebar weather={weather} allWeather={allWeather} selectedStation={selectedStation} onSelectStation={handleSelectStation} />

        <div className="flex-1 relative min-w-0">
          {loading && !weather && (
            <div className="absolute inset-0 z-[500] flex items-center justify-center" style={{ background: 'rgba(6,6,10,0.8)' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                className="w-8 h-8 rounded-full border-2 border-blue-500/30 border-t-blue-500" />
            </div>
          )}

          {showMap ? (
            <>
              <SkyMap overlay={radarOverlay} weather={weather} mapInstRef={mapInstRef} />
              {activeTab !== 'Radar' && <OverlaySelector activeOverlay={activeOverlay} onOverlayChange={setActiveOverlay} />}
              {!isMobile && (
                <div className="absolute bottom-4 right-4 z-[400] w-72">
                  <DailyForecast weather={weather} />
                </div>
              )}
            </>
          ) : (
            <div className="h-full rounded-2xl overflow-hidden" style={glass}>
              {renderTabContent()}
            </div>
          )}
        </div>
      </div>

      {showMap && (
        <div className="px-3 pb-3">
          <ForecastTimeline hourly={weather?.hourly} />
        </div>
      )}

      {isMobile && <MobileBottomSheet weather={weather} allWeather={allWeather} selectedStation={selectedStation} onSelectStation={handleSelectStation} />}

      {error && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[600] px-4 py-2 rounded-xl text-sm text-red-400" style={glass}>
          {error} <button onClick={() => fetchWeather(cityKey)} className="ml-2 text-blue-400 underline">Retry</button>
        </div>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion } from 'framer-motion';
import { ChevronDown, Plus, Minus, Crosshair } from 'lucide-react';

interface SkyMapProps {
  overlay: string;
}

const center: [number, number] = [44.1598, 28.6348];

function MapRefSetter({ onMap }: { onMap: (map: L.Map) => void }) {
  const map = useMap();
  useEffect(() => {
    onMap(map);
  }, [map, onMap]);
  return null;
}

// Custom marker icon
function createCustomIcon() {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:#3B82F6;border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 10px rgba(59,130,246,0.6);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

function createOfflineIcon() {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="width:12px;height:12px;border-radius:50%;background:#EF4444;border:2px solid rgba(255,255,255,0.8);box-shadow:0 0 10px rgba(239,68,68,0.6);"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

// Map overlay canvas layer
function WeatherOverlayLayer({ overlay }: { overlay: string }) {
  const map = useMap();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (overlay === 'none') return;

    const canvasLayer = L.DomUtil.create('canvas', 'leaflet-canvas-layer');
    canvasLayer.style.position = 'absolute';
    canvasLayer.style.top = '0';
    canvasLayer.style.left = '0';
    canvasLayer.style.pointerEvents = 'none';
    canvasLayer.style.zIndex = '300';

    const pane = map.getPane('overlayPane');
    if (pane) pane.appendChild(canvasLayer);
    canvasRef.current = canvasLayer;

    const resize = () => {
      const size = map.getSize();
      canvasLayer.width = size.x;
      canvasLayer.height = size.y;
      canvasLayer.style.width = size.x + 'px';
      canvasLayer.style.height = size.y + 'px';
    };

    resize();
    map.on('resize move zoom', resize);

    const ctx = canvasLayer.getContext('2d');
    if (!ctx) return;

    let time = 0;

    const draw = () => {
      const size = map.getSize();
      ctx.clearRect(0, 0, size.x, size.y);

      if (overlay === 'precipitation') {
        // Draw precipitation blobs
        const bounds = map.getBounds();
        const ne = bounds.getNorthEast();
        const sw = bounds.getSouthWest();
        const w = ne.lng - sw.lng;
        const h = ne.lat - sw.lat;

        const blobs = [
          { x: 0.3, y: 0.4, r: 0.15, intensity: 0.8 },
          { x: 0.6, y: 0.5, r: 0.12, intensity: 0.6 },
          { x: 0.45, y: 0.35, r: 0.1, intensity: 0.4 },
          { x: 0.7, y: 0.6, r: 0.08, intensity: 0.3 },
        ];

        blobs.forEach((blob) => {
          const px = ((blob.x * w + sw.lng - sw.lng) / w) * size.x;
          const py = (1 - ((blob.y * h + sw.lat - sw.lat) / h)) * size.y;
          const pr = blob.r * Math.min(size.x, size.y);

          const gradient = ctx.createRadialGradient(px, py, 0, px, py, pr);
          gradient.addColorStop(0, `rgba(59, 130, 246, ${blob.intensity * 0.5})`);
          gradient.addColorStop(0.5, `rgba(6, 182, 212, ${blob.intensity * 0.3})`);
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.arc(px, py, pr * (1 + Math.sin(time * 0.001 + blob.x * 10) * 0.1), 0, Math.PI * 2);
          ctx.fill();
        });
      } else if (overlay === 'wind') {
        // Draw wind flow lines
        const spacing = 40;
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.3)';
        ctx.lineWidth = 1;

        for (let x = 0; x < size.x; x += spacing) {
          for (let y = 0; y < size.y; y += spacing) {
            const angle = (Math.sin(x * 0.01 + time * 0.0005) + Math.cos(y * 0.01)) * Math.PI;
            const len = 15 + Math.sin(time * 0.001 + x) * 5;

            ctx.beginPath();
            ctx.moveTo(x, y);
            ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            ctx.stroke();

            // Arrow head
            const hx = x + Math.cos(angle) * len;
            const hy = y + Math.sin(angle) * len;
            ctx.beginPath();
            ctx.moveTo(hx, hy);
            ctx.lineTo(hx - Math.cos(angle - 0.5) * 4, hy - Math.sin(angle - 0.5) * 4);
            ctx.lineTo(hx - Math.cos(angle + 0.5) * 4, hy - Math.sin(angle + 0.5) * 4);
            ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
            ctx.fill();
          }
        }
      } else if (overlay === 'temperature') {
        // Temperature gradient overlay
        const gradient = ctx.createLinearGradient(0, 0, size.x, size.y);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.15)');
        gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.1)');
        gradient.addColorStop(1, 'rgba(245, 158, 11, 0.15)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, size.x, size.y);
      }

      time += 16;
      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    return () => {
      map.off('resize move zoom', resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (pane && canvasLayer.parentNode === pane) {
        pane.removeChild(canvasLayer);
      }
    };
  }, [map, overlay]);

  return null;
}

// Zoom control component
function ZoomControls({ map }: { map: L.Map }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      className="absolute right-4 top-1/2 -translate-y-1/2 z-[400] flex flex-col gap-2"
    >
      <button
        onClick={() => map.zoomIn()}
        className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.08] transition-all"
      >
        <Plus className="w-4 h-4" />
      </button>
      <button
        onClick={() => map.setView(center, 9)}
        className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.08] transition-all"
      >
        <Crosshair className="w-4 h-4" />
      </button>
      <button
        onClick={() => map.zoomOut()}
        className="w-9 h-9 rounded-full glass-panel flex items-center justify-center text-white/70 hover:text-white hover:bg-white/[0.08] transition-all"
      >
        <Minus className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export default function SkyMap({ overlay }: SkyMapProps) {
  const [mapInstance, setMapInstance] = useState<L.Map | null>(null);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="relative w-full h-full rounded-2xl overflow-hidden"
    >
      <MapContainer
        center={center}
        zoom={9}
        scrollWheelZoom={true}
        style={{ width: '100%', height: '100%', borderRadius: '16px' }}
        whenReady={() => {}}
      >
        <MapRefSetter onMap={setMapInstance} />
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution=""
        />
        <WeatherOverlayLayer overlay={overlay} />
        <Marker position={[44.1733, 28.6383]} icon={createCustomIcon()}>
          <Popup className="custom-popup">Constanța City Station</Popup>
        </Marker>
        <Marker position={[43.8, 28.5833]} icon={createCustomIcon()}>
          <Popup className="custom-popup">Mangalia Station</Popup>
        </Marker>
        <Marker position={[44.25, 28.2833]} icon={createCustomIcon()}>
          <Popup className="custom-popup">Medgidia Station</Popup>
        </Marker>
        <Marker position={[44.0667, 28.65]} icon={createOfflineIcon()}>
          <Popup className="custom-popup">Eforie Station (Offline)</Popup>
        </Marker>
      </MapContainer>

      {mapInstance && <ZoomControls map={mapInstance} />}

      {/* Map UI Overlays */}
      {/* Title Panel */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="absolute top-4 left-4 z-[400] glass-panel rounded-xl px-4 py-3"
      >
        <h2 className="text-base font-medium text-white">Weather Radar</h2>
        <p className="text-xs text-white/50">Județul Constanța, Romania</p>
      </motion.div>

      {/* Dropdowns */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.45 }}
        className="absolute top-4 left-52 z-[400] flex gap-2"
      >
        <button className="glass-panel rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs text-white/70 hover:text-white transition-colors">
          <span>Constanța</span>
          <ChevronDown className="w-3 h-3" />
        </button>
        <button className="glass-panel rounded-lg px-3 py-1.5 flex items-center gap-2 text-xs text-white/70 hover:text-white transition-colors">
          <span>Map 2</span>
          <ChevronDown className="w-3 h-3" />
        </button>
      </motion.div>

      {/* Current Conditions Card */}
      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
        className="absolute top-32 right-16 z-[400] glass-panel rounded-xl px-4 py-3"
      >
        <div className="text-[10px] text-white/40 uppercase tracking-wider">Current Conditions</div>
        <div className="text-[10px] text-white/30 mb-1">Coastal Station</div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className="text-amber-400">
              <circle cx="12" cy="12" r="5" fill="currentColor" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
          <span className="text-2xl font-light text-white">22°C</span>
        </div>
      </motion.div>

      {/* Weather Legend */}
      {overlay !== 'none' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="absolute bottom-4 left-4 z-[400] glass-panel rounded-xl px-3 py-2"
        >
          <div className="text-[10px] text-white/40 mb-1.5 capitalize">{overlay} Scale</div>
          <div className="flex items-center gap-1">
            {overlay === 'precipitation' && (
              <>
                <span className="text-[9px] text-white/30 w-8">Light</span>
                <div className="w-24 h-2 rounded-full bg-gradient-to-r from-blue-300/60 via-cyan-400/60 to-purple-500/60" />
                <span className="text-[9px] text-white/30 w-8 text-right">Heavy</span>
              </>
            )}
            {overlay === 'wind' && (
              <>
                <span className="text-[9px] text-white/30 w-8">Calm</span>
                <div className="w-24 h-2 rounded-full bg-gradient-to-r from-cyan-400/40 via-blue-400/40 to-blue-600/60" />
                <span className="text-[9px] text-white/30 w-8 text-right">Storm</span>
              </>
            )}
            {overlay === 'temperature' && (
              <>
                <span className="text-[9px] text-white/30 w-8">Cold</span>
                <div className="w-24 h-2 rounded-full bg-gradient-to-r from-blue-400/60 via-emerald-400/40 to-amber-500/60" />
                <span className="text-[9px] text-white/30 w-8 text-right">Hot</span>
              </>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

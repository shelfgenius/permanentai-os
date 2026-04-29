/**
 * MappyCarMenu — G63 AMG 3D showroom, white theme.
 *
 * Zones:
 *   Left door window  → GPS / Mappy
 *   Right door window → Simulator
 *   Hood (engine bay) → Settings
 *
 * Features:
 *   OrbitControls for free rotation (menu only)
 *   Angle-dependent labels (surface normal · camera direction)
 *   Window roll-down + hood-open animations with clipping
 */
import React, { useRef, useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree, useLoader } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import MappyMap from './mappy/MappyMap.jsx';
import InteractiveModule from './InteractiveModule.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

const MONO = '"IBM Plex Mono", "Space Mono", monospace';
const BLUE = '#1A73E8';

/* ─── Camera presets ──────────────────────────────────────────── */
const CAMS = {
  menu:     { pos: [5.5, 3.2, 6.2],    look: [0, 0.8, 0]         },
  gps:      { pos: [1.6, 1.15, 4.2],   look: [-0.18, 1.08, 0.92] },
  sim:      { pos: [1.6, 1.15, -4.2],  look: [-0.18, 1.08, -0.92]},
  settings: { pos: [1.5, 4.2, 3.8],    look: [1.0, 0.68, 0]      },
};

/* ─── Material presets ────────────────────────────────────────── */
const COL = {
  body:     '#0d0d1a',
  bodyMid:  '#10101e',
  chrome:   '#1a1a28',
  glass:    '#1a3490',
  glassGPS: '#1a50d0',
  glassSim: '#003060',
  black:    '#060609',
  cyan:     '#00D4FF',
  magenta:  '#FF0055',
  orange:   '#ff8c00',
  purple:   '#a78bfa',
};

/* ═══════════════════════════════════════════════════════════════
   CAR BODY — all geometry primitives
═══════════════════════════════════════════════════════════════ */
function CarBody({ hovered, onHover, onLeave, onClick, phase }) {
  const hoodPivotRef  = useRef();
  const leftWinRef    = useRef();
  const rightWinRef   = useRef();
  const engineGlowRef = useRef();

  /* animated values */
  const anim = useRef({ hood: 0, lw: 0, rw: 0, engineGlow: 0 });

  useFrame((_, delta) => {
    const a = anim.current;
    const isGPS  = phase === 'gps';
    const isSim  = phase === 'sim';
    const isSett = phase === 'settings';

    a.hood        = THREE.MathUtils.lerp(a.hood,  isSett ? -Math.PI * 0.44 : 0,   delta * 2.8);
    a.lw          = THREE.MathUtils.lerp(a.lw,    isGPS  ? -0.58 : 0,             delta * 2.8);
    a.rw          = THREE.MathUtils.lerp(a.rw,    isSim  ? -0.58 : 0,             delta * 2.8);
    a.engineGlow  = THREE.MathUtils.lerp(a.engineGlow, isSett ? 3.5 : 0,          delta * 2.0);

    if (hoodPivotRef.current)  hoodPivotRef.current.rotation.x  = a.hood;
    if (leftWinRef.current)    leftWinRef.current.position.y     = a.lw;
    if (rightWinRef.current)   rightWinRef.current.position.y    = a.rw;
    if (engineGlowRef.current) engineGlowRef.current.intensity   = a.engineGlow;
  });

  const isMenu = phase === 'menu';

  return (
    <group>
      {/* ── Lower body slab ── */}
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <boxGeometry args={[4.3, 0.72, 2.1]} />
        <meshStandardMaterial color={COL.body} metalness={0.90} roughness={0.12} />
      </mesh>

      {/* Side skirts (flat accent strips) */}
      <mesh position={[0, 0.04, 1.06]}>
        <boxGeometry args={[4.1, 0.08, 0.04]} />
        <meshStandardMaterial color={COL.cyan} emissive={COL.cyan} emissiveIntensity={0.6} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.04, -1.06]}>
        <boxGeometry args={[4.1, 0.08, 0.04]} />
        <meshStandardMaterial color={COL.magenta} emissive={COL.magenta} emissiveIntensity={0.6} toneMapped={false} />
      </mesh>

      {/* ── Cabin ── */}
      <mesh position={[-0.18, 1.08, 0]} castShadow>
        <boxGeometry args={[2.52, 0.78, 1.80]} />
        <meshStandardMaterial color={COL.bodyMid} metalness={0.88} roughness={0.14} />
      </mesh>

      {/* Roof */}
      <mesh position={[-0.18, 1.50, 0]} castShadow>
        <boxGeometry args={[2.28, 0.10, 1.62]} />
        <meshStandardMaterial color={COL.black} metalness={0.94} roughness={0.08} />
      </mesh>

      {/* ── Hood — pivoted at front edge x=1.08 ── */}
      <group position={[1.08, 0.72, 0]}>
        <group ref={hoodPivotRef}>
          {/* Hood panel extends backward from pivot */}
          <mesh
            position={[-0.55, 0, 0]}
            name="hood"
            onClick={isMenu ? () => onClick('settings') : undefined}
            onPointerOver={isMenu ? () => onHover('hood') : undefined}
            onPointerOut={isMenu ? onLeave : undefined}
          >
            <boxGeometry args={[1.1, 0.065, 1.88]} />
            <meshStandardMaterial
              color={hovered === 'hood' ? '#18182a' : COL.body}
              metalness={0.92} roughness={0.08}
              emissive={hovered === 'hood' ? COL.orange : '#000'}
              emissiveIntensity={hovered === 'hood' ? 0.18 : 0}
            />
          </mesh>
          {/* Hood scoop */}
          <mesh position={[-0.32, 0.065, 0]}>
            <boxGeometry args={[0.36, 0.06, 0.38]} />
            <meshStandardMaterial color={COL.black} metalness={0.96} roughness={0.04} />
          </mesh>
        </group>
      </group>

      {/* ── Engine bay (visible when hood opens) ── */}
      <mesh position={[0.54, 0.68, 0]}>
        <boxGeometry args={[1.04, 0.06, 1.80]} />
        <meshStandardMaterial color="#0a0a16" metalness={0.5} roughness={0.55} />
      </mesh>
      {/* Engine block */}
      <mesh position={[0.54, 0.76, 0]}>
        <boxGeometry args={[0.62, 0.14, 0.88]} />
        <meshStandardMaterial color="#0e0e18" metalness={0.80} roughness={0.30} />
      </mesh>
      {/* Intake manifold */}
      <mesh position={[0.54, 0.87, 0]}>
        <boxGeometry args={[0.26, 0.08, 0.55]} />
        <meshStandardMaterial color={COL.chrome} metalness={0.95} roughness={0.05} />
      </mesh>
      {/* Engine ambient glow light */}
      <pointLight ref={engineGlowRef} position={[0.54, 1.1, 0]} intensity={0} color={COL.orange} distance={2.5} decay={1.8} />

      {/* ── Windshield (angled front glass) ── */}
      <mesh position={[0.56, 1.10, 0]} rotation={[0, 0, -0.36]}>
        <boxGeometry args={[0.07, 0.74, 1.66]} />
        <meshPhysicalMaterial color="#1840a8" transparent opacity={0.50} roughness={0.04} metalness={0.05} />
      </mesh>

      {/* ── Left front door window (GPS) ── */}
      {/* Door frame */}
      <mesh position={[-0.18, 1.08, 0.91]}>
        <boxGeometry args={[0.92, 0.56, 0.055]} />
        <meshStandardMaterial color={COL.black} metalness={0.96} roughness={0.05} />
      </mesh>
      {/* Glass (rolls down) */}
      <group position={[-0.18, 1.08, 0.94]}>
        <mesh
          ref={leftWinRef}
          name="leftWindow"
          onClick={isMenu ? () => onClick('gps') : undefined}
          onPointerOver={isMenu ? () => onHover('leftWindow') : undefined}
          onPointerOut={isMenu ? onLeave : undefined}
        >
          <boxGeometry args={[0.86, 0.50, 0.06]} />
          <meshPhysicalMaterial
            color={hovered === 'leftWindow' ? '#3070ff' : COL.glassGPS}
            transparent opacity={0.70} roughness={0.03} metalness={0.07}
            emissive={hovered === 'leftWindow' ? COL.cyan : '#001840'}
            emissiveIntensity={hovered === 'leftWindow' ? 0.65 : 0.18}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* ── Right front door window (Simulator) ── */}
      <mesh position={[-0.18, 1.08, -0.91]}>
        <boxGeometry args={[0.92, 0.56, 0.055]} />
        <meshStandardMaterial color={COL.black} metalness={0.96} roughness={0.05} />
      </mesh>
      <group position={[-0.18, 1.08, -0.94]}>
        <mesh
          ref={rightWinRef}
          name="rightWindow"
          onClick={isMenu ? () => onClick('sim') : undefined}
          onPointerOver={isMenu ? () => onHover('rightWindow') : undefined}
          onPointerOut={isMenu ? onLeave : undefined}
        >
          <boxGeometry args={[0.86, 0.50, 0.06]} />
          <meshPhysicalMaterial
            color={hovered === 'rightWindow' ? '#00aaff' : COL.glassSim}
            transparent opacity={0.70} roughness={0.03} metalness={0.07}
            emissive={hovered === 'rightWindow' ? COL.cyan : '#001830'}
            emissiveIntensity={hovered === 'rightWindow' ? 0.65 : 0.12}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* ── Rear window ── */}
      <mesh position={[-0.92, 1.10, 0]}>
        <boxGeometry args={[0.07, 0.60, 1.62]} />
        <meshPhysicalMaterial color="#0a1840" transparent opacity={0.45} roughness={0.04} metalness={0.05} />
      </mesh>

      {/* ── Front bumper / grille ── */}
      <mesh position={[2.18, 0.28, 0]}>
        <boxGeometry args={[0.07, 0.42, 1.62]} />
        <meshStandardMaterial color={COL.black} metalness={0.5} roughness={0.45} />
      </mesh>
      {/* Grille slats */}
      {[-0.35, 0, 0.35].map((z, i) => (
        <mesh key={i} position={[2.18, 0.28, z]}>
          <boxGeometry args={[0.09, 0.32, 0.04]} />
          <meshStandardMaterial color={COL.chrome} metalness={0.90} roughness={0.08} />
        </mesh>
      ))}

      {/* ── Headlights ── */}
      <mesh position={[2.18, 0.50, 0.66]}>
        <boxGeometry args={[0.07, 0.13, 0.30]} />
        <meshStandardMaterial color={COL.cyan} emissive={COL.cyan} emissiveIntensity={4.0} toneMapped={false} />
      </mesh>
      <mesh position={[2.18, 0.50, -0.66]}>
        <boxGeometry args={[0.07, 0.13, 0.30]} />
        <meshStandardMaterial color={COL.cyan} emissive={COL.cyan} emissiveIntensity={4.0} toneMapped={false} />
      </mesh>
      <pointLight position={[2.6, 0.5, 0.7]}  intensity={3.5} color={COL.cyan}    distance={5} decay={1.6} />
      <pointLight position={[2.6, 0.5, -0.7]} intensity={3.5} color={COL.cyan}    distance={5} decay={1.6} />

      {/* ── Taillights ── */}
      <mesh position={[-2.18, 0.50, 0.66]}>
        <boxGeometry args={[0.07, 0.13, 0.30]} />
        <meshStandardMaterial color={COL.magenta} emissive={COL.magenta} emissiveIntensity={3.0} toneMapped={false} />
      </mesh>
      <mesh position={[-2.18, 0.50, -0.66]}>
        <boxGeometry args={[0.07, 0.13, 0.30]} />
        <meshStandardMaterial color={COL.magenta} emissive={COL.magenta} emissiveIntensity={3.0} toneMapped={false} />
      </mesh>

      {/* ── Wheels ── */}
      {[
        [1.42, -0.05, 1.09],
        [1.42, -0.05, -1.09],
        [-1.38, -0.05, 1.09],
        [-1.38, -0.05, -1.09],
      ].map((pos, i) => (
        <group key={i} position={pos} rotation={[0, 0, 0]}>
          {/* Tyre */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.43, 0.145, 14, 32]} />
            <meshStandardMaterial color="#050508" roughness={0.92} />
          </mesh>
          {/* Rim dish */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.28, 0.28, 0.24, 12]} />
            <meshStandardMaterial color="#14141e" metalness={0.96} roughness={0.04} />
          </mesh>
          {/* Spoke cross */}
          {[0, 1, 2, 3, 4].map(s => (
            <mesh key={s} rotation={[Math.PI / 2, (s * Math.PI * 2) / 5, 0]}>
              <boxGeometry args={[0.04, 0.26, 0.2]} />
              <meshStandardMaterial color={COL.chrome} metalness={0.98} roughness={0.02} />
            </mesh>
          ))}
        </group>
      ))}

      {/* ── Underglow ── */}
      <pointLight position={[0, -0.18, 0.9]}  intensity={2.8} color={COL.cyan}    distance={3.5} decay={1.4} />
      <pointLight position={[0, -0.18, -0.9]} intensity={2.8} color={COL.magenta} distance={3.5} decay={1.4} />
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CAMERA RIG — smooth lerp between preset positions
═══════════════════════════════════════════════════════════════ */
function CameraRig({ phase }) {
  const { camera } = useThree();
  const lookAt = useRef(new THREE.Vector3(0, 0.8, 0));
  const targetPos = useRef(new THREE.Vector3(...CAMS.menu.pos));

  useFrame((_, delta) => {
    const c = CAMS[phase] || CAMS.menu;
    targetPos.current.set(...c.pos);
    lookAt.current.lerp(new THREE.Vector3(...c.look), delta * 2.0);
    camera.position.lerp(targetPos.current, delta * 1.8);
    camera.lookAt(lookAt.current);
  });

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   LABEL PROJECTOR — emits screen-space positions for HTML cards
═══════════════════════════════════════════════════════════════ */
const LABEL_DEFS = [
  { id: 'gps',      local: [-0.18, 1.70, 0.92],  icon: '📍', title: 'GPS · MAPPY',  sub: 'Navigation & Radar',  color: COL.cyan   },
  { id: 'sim',      local: [-0.18, 1.70, -0.92], icon: '🏁', title: 'SIMULATOR',    sub: 'Interactive Driving', color: COL.purple },
  { id: 'settings', local: [1.08,  1.18,  0.80], icon: '⚙️', title: 'SETTINGS',     sub: 'GPS Preferences',    color: COL.orange },
];

function LabelProjector({ carGroupRef, phase, onUpdate }) {
  const { camera, size } = useThree();
  const tmp = useRef(new THREE.Vector3()).current;
  const step = useRef(0);

  useFrame(() => {
    step.current = (step.current + 1) % 3;
    if (step.current !== 0) return;
    if (!carGroupRef.current || phase !== 'menu') { onUpdate([]); return; }

    const out = LABEL_DEFS.map(def => {
      tmp.set(...def.local);
      tmp.applyMatrix4(carGroupRef.current.matrixWorld);
      tmp.project(camera);
      const x = (tmp.x * 0.5 + 0.5) * size.width;
      const y = (-tmp.y * 0.5 + 0.5) * size.height;
      return { ...def, x, y, behind: tmp.z > 1 };
    });
    onUpdate(out);
  });

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   CAR AUTO-ROTATE wrapper
═══════════════════════════════════════════════════════════════ */
function CarScene({ phase, hovered, onHover, onLeave, onClick, carGroupRef, onLabels }) {
  const rotY = useRef(0);

  useFrame((_, delta) => {
    if (phase === 'menu') rotY.current += delta * 0.22;
    if (carGroupRef.current) carGroupRef.current.rotation.y = rotY.current;
  });

  return (
    <>
      <group ref={carGroupRef}>
        <CarBody
          phase={phase}
          hovered={hovered}
          onHover={onHover}
          onLeave={onLeave}
          onClick={onClick}
        />
      </group>
      <LabelProjector carGroupRef={carGroupRef} phase={phase} onUpdate={onLabels} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SETTINGS OVERLAY (shown when hood opens)
═══════════════════════════════════════════════════════════════ */
function SettingsPanel({ onClose }) {
  const [routeProfile, setRouteProfile] = useState(() => localStorage.getItem('mappy.routeProfile') || 'driving');
  const [voiceOn, setVoiceOn]   = useState(() => localStorage.getItem('mappy.voice') !== 'off');
  const [radarOn, setRadarOn]   = useState(() => localStorage.getItem('mappy.radar') !== 'off');
  const [mapStyle, setMapStyle] = useState(() => localStorage.getItem('mappy.style') || 'dark');

  const save = () => {
    localStorage.setItem('mappy.routeProfile', routeProfile);
    localStorage.setItem('mappy.voice',  voiceOn  ? 'on' : 'off');
    localStorage.setItem('mappy.radar',  radarOn  ? 'on' : 'off');
    localStorage.setItem('mappy.style',  mapStyle);
    onClose();
  };

  const row = (label, children) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
      <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.75)' }}>{label}</span>
      {children}
    </div>
  );

  const toggle = (val, set) => (
    <button
      onClick={() => set(!val)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
        background: val ? COL.cyan : 'rgba(255,255,255,0.14)',
        transition: 'background 0.22s', position: 'relative',
      }}
    >
      <div style={{
        position: 'absolute', top: 3, left: val ? 22 : 3, width: 18, height: 18,
        borderRadius: '50%', background: '#fff', transition: 'left 0.22s',
      }} />
    </button>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 20 }}
      transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      style={{
        position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50,
      }}
    >
      <div style={{
        background: 'rgba(8,8,18,0.92)', backdropFilter: 'blur(28px) saturate(180%)',
        border: `1px solid ${COL.orange}44`, borderRadius: 24,
        padding: '28px 32px', width: 380, maxWidth: '90vw',
        boxShadow: `0 0 60px ${COL.orange}22, 0 24px 60px rgba(0,0,0,0.6)`,
        color: '#fff',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 22 }}>
          <span style={{ fontSize: 22 }}>⚙️</span>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.25em', color: COL.orange, textTransform: 'uppercase' }}>ENGINE BAY · CONFIG</div>
            <div style={{ fontSize: 17, fontWeight: 600, marginTop: 2 }}>GPS Settings</div>
          </div>
        </div>

        {/* Route Profile */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Route Profile</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['driving','cycling','foot'].map(p => (
              <button key={p} onClick={() => setRouteProfile(p)} style={{
                flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: routeProfile === p ? `${COL.orange}22` : 'rgba(255,255,255,0.06)',
                color: routeProfile === p ? COL.orange : 'rgba(255,255,255,0.5)',
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                outline: routeProfile === p ? `1px solid ${COL.orange}66` : '1px solid rgba(255,255,255,0.08)',
              }}>
                {p === 'driving' ? '🚗' : p === 'cycling' ? '🚲' : '🚶'}<br/>{p}
              </button>
            ))}
          </div>
        </div>

        {row('Voice guidance', toggle(voiceOn, setVoiceOn))}
        {row('Radar alerts',  toggle(radarOn, setRadarOn))}
        {row('Map style',
          <div style={{ display: 'flex', gap: 6 }}>
            {['dark','satellite'].map(s => (
              <button key={s} onClick={() => setMapStyle(s)} style={{
                padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                background: mapStyle === s ? `${COL.cyan}22` : 'rgba(255,255,255,0.06)',
                color: mapStyle === s ? COL.cyan : 'rgba(255,255,255,0.4)',
                fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase',
                outline: mapStyle === s ? `1px solid ${COL.cyan}55` : '1px solid rgba(255,255,255,0.08)',
              }}>{s}</button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: '11px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
            background: 'transparent', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', fontSize: 13,
          }}>Cancel</button>
          <button onClick={save} style={{
            flex: 2, padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${COL.orange}, #ff5500)`,
            color: '#fff', fontSize: 13, fontWeight: 600,
            boxShadow: `0 6px 20px ${COL.orange}44`,
          }}>Save & Close</button>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════════════════════ */
export default function MappyCarMenu({ onBack }) {
  const [phase, setPhase]             = useState('menu');          // menu | gps | sim | settings
  const [showContent, setShowContent] = useState(false);
  const [labels, setLabels]           = useState([]);
  const [hovered, setHovered]         = useState(null);
  const carGroupRef                   = useRef();
  const contentTimer                  = useRef(null);

  /* Trigger content reveal ~1.3s after phase change (camera zooms during that time) */
  useEffect(() => {
    clearTimeout(contentTimer.current);
    if (phase !== 'menu') {
      contentTimer.current = setTimeout(() => setShowContent(true), 1350);
    } else {
      setShowContent(false);
    }
    return () => clearTimeout(contentTimer.current);
  }, [phase]);

  const handleSelect = useCallback((option) => {
    setPhase(option);
    setHovered(null);
  }, []);

  const handleBack = useCallback(() => {
    setShowContent(false);
    setPhase('menu');
  }, []);

  const handleHover = useCallback((id) => {
    setHovered(id);
    if (typeof document !== 'undefined') document.body.style.cursor = 'pointer';
  }, []);

  const handleLeave = useCallback(() => {
    setHovered(null);
    if (typeof document !== 'undefined') document.body.style.cursor = '';
  }, []);

  /* ── Which label card is hovered ── */
  const hoverLabel  = hovered === 'leftWindow' ? 'gps' : hovered === 'rightWindow' ? 'sim' : hovered === 'hood' ? 'settings' : null;

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#05060e', overflow: 'hidden' }}>

      {/* ── Three.js canvas ── */}
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: CAMS.menu.pos, fov: 40 }}
        gl={{ antialias: true, alpha: false, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.3 }}
        shadows
      >
        <color attach="background" args={['#05060e']} />
        <fog attach="fog" args={['#05060e', 14, 32]} />

        {/* Lighting */}
        <ambientLight intensity={0.08} color="#0a0f1a" />
        <pointLight position={[8, 6, 6]}   intensity={4.5} color={COL.cyan}    distance={32} decay={1.3} />
        <pointLight position={[-8, -5, 5]} intensity={3.5} color={COL.magenta} distance={28} decay={1.4} />
        <pointLight position={[0, 8, -4]}  intensity={2.0} color="#e8f4ff"     distance={24} decay={1.8} />
        <pointLight position={[0, -2, 0]}  intensity={1.2} color="#0a0e20"     distance={8}  decay={2.0} />

        {/* Ground reflection plane */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.5, 0]} receiveShadow>
          <planeGeometry args={[24, 24]} />
          <meshStandardMaterial color="#030408" metalness={0.6} roughness={0.4} />
        </mesh>

        <CarScene
          phase={phase}
          hovered={hovered}
          onHover={handleHover}
          onLeave={handleLeave}
          onClick={handleSelect}
          carGroupRef={carGroupRef}
          onLabels={setLabels}
        />
        <CameraRig phase={phase} />
      </Canvas>

      {/* ── HTML label cards (menu state only) ── */}
      {phase === 'menu' && labels.map(lp => !lp.behind && (
        <motion.button
          key={lp.id}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          onClick={() => handleSelect(lp.id)}
          style={{
            position: 'absolute',
            left: lp.x, top: lp.y,
            background: hoverLabel === lp.id ? `${lp.color}22` : 'rgba(5,6,14,0.80)',
            backdropFilter: 'blur(14px)',
            border: `1px solid ${lp.color}${hoverLabel === lp.id ? 'aa' : '44'}`,
            borderRadius: 14,
            padding: '10px 14px',
            color: '#fff',
            cursor: 'pointer',
            pointerEvents: 'auto',
            textAlign: 'center',
            minWidth: 96,
            boxShadow: `0 6px 28px ${lp.color}${hoverLabel === lp.id ? '44' : '22'}`,
            transition: 'background 0.18s, border-color 0.18s, box-shadow 0.18s, transform 0.18s',
            transform: hoverLabel === lp.id ? 'translate(-50%,-50%) translateY(-4px)' : 'translate(-50%,-50%)',
            zIndex: 10,
          }}
        >
          <div style={{ fontSize: 20 }}>{lp.icon}</div>
          <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.22em', color: lp.color, textTransform: 'uppercase', marginTop: 4 }}>{lp.title}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{lp.sub}</div>
        </motion.button>
      ))}

      {/* ── Zoom-in content overlays ── */}
      <AnimatePresence>
        {showContent && phase === 'gps' && (
          <motion.div key="gps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
            <ErrorBoundary title="GPS failed">
              <MappyMap />
            </ErrorBoundary>
          </motion.div>
        )}
        {showContent && phase === 'sim' && (
          <motion.div key="sim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            style={{ position: 'absolute', inset: 0, zIndex: 20, background: '#0a0f14' }}>
            <ErrorBoundary title="Simulator failed">
              <InteractiveModule />
            </ErrorBoundary>
          </motion.div>
        )}
        {showContent && phase === 'settings' && (
          <SettingsPanel key="settings" onClose={handleBack} />
        )}
      </AnimatePresence>

      {/* ── Top bar ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'max(14px,env(safe-area-inset-top,14px)) 18px 10px',
        pointerEvents: 'none',
      }}>
        <button
          onClick={showContent ? handleBack : onBack}
          style={{
            pointerEvents: 'auto',
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.75)', background: 'rgba(5,6,14,0.6)',
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
            padding: '8px 14px', cursor: 'pointer',
          }}
        >
          ← {showContent ? 'Garage' : 'Menu'}
        </button>
        <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.28em', color: 'rgba(255,255,255,0.28)', textTransform: 'uppercase', pointerEvents: 'none' }}>
          {phase === 'menu' ? 'MAPPY · GARAGE' : phase.toUpperCase()}
        </div>
      </div>

      {/* ── Menu hint (fade out after 3s) ── */}
      {phase === 'menu' && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          style={{
            position: 'absolute', bottom: 32, left: 0, right: 0, textAlign: 'center',
            fontFamily: MONO, fontSize: 9, letterSpacing: '0.28em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.22)', pointerEvents: 'none', zIndex: 10,
          }}
        >
          click a window or the hood to enter
        </motion.div>
      )}
    </div>
  );
}

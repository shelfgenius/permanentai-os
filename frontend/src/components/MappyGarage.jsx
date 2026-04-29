/**
 * MappyGarage — Mustang 3D showroom, white theme.
 *
 * Zones (popup cards anchored to car-local points):
 *   Right side (+X) → GPS / Mappy
 *   Left side  (-X) → Simulator
 *   Top        (+Y) → Settings
 *
 * Features:
 *   OrbitControls — free rotation + auto-rotate while idle
 *   Angle-dependent popups — only visible when that side faces the camera
 *   Auto-zoom + camera lock to "straight-on" view of the chosen side
 *   White showroom aesthetic
 */
import React, { useRef, useState, useCallback, useEffect, useMemo, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, useGLTF, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import MappyMap from './mappy/MappyMap.jsx';
import InteractiveModule from './InteractiveModule.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';

const MONO = '"IBM Plex Mono", "Space Mono", monospace';
const BLUE = '#1A73E8';

/* ─── Camera presets ──────────────────────────────────────────── */
const CAMS = {
  menu:     { pos: [6, 3.5, 8],      look: [0, 1.2, 0]       },
  gps:      { pos: [3.5, 2, 5],      look: [1.8, 1.5, 0.8]   },
  sim:      { pos: [-3.5, 2, 5],     look: [-1.8, 1.5, 0.8]  },
  settings: { pos: [0.5, 5.5, 4.5],  look: [0, 2, 1.5]       },
};

/* ─── Label definitions with surface normals (car-local space) ─ */
const LABEL_DEFS = [
  { id: 'gps',      localFn: d => [d.hw * 0.88, d.h * 0.65, d.hd * 0.15],   normal: [1, 0, 0],  icon: '\u{1F4CD}', title: 'GPS \u00B7 NAVIGATION',  sub: 'Live map & radar',   color: '#1A73E8' },
  { id: 'sim',      localFn: d => [-d.hw * 0.88, d.h * 0.65, d.hd * 0.15],  normal: [-1, 0, 0], icon: '\u{1F3C1}', title: 'SIMULATOR',         sub: 'Interactive driving', color: '#7c3aed' },
  { id: 'settings', localFn: d => [0, d.h * 0.92, d.hd * 0.55],             normal: [0, 1, 0],  icon: '\u2699\uFE0F',  title: 'SETTINGS',          sub: 'GPS preferences',    color: '#ea580c' },
];

/* ═══════════════════════════════════════════════════════════════
   MUSTANG MODEL — loads /mustang.glb, keeps ONLY the car cluster.

   Strategy: rather than guessing mesh names, we use geometric
   clustering. The largest mesh (by volume) is virtually guaranteed
   to be the car body. We compute a bounding sphere around that seed,
   expand by ~2x, and hide any mesh whose centroid falls outside.
   This cleanly drops the floor plane, backdrop cars, lights, cameras,
   and any other Blender scene dressing — regardless of their names.
═══════════════════════════════════════════════════════════════ */
// Paint candidates — heuristic: body-like names get glossy paint
const BODY_PATTERNS = [
  /^body$/i, /^arches$/i, /front bumper/i, /front bottom bumper/i,
  /front black bits/i, /rear splitters/i, /bonnet gaps/i,
  /door panel gap/i, /rear number plate slot/i, /exhaust cut out/i,
  /hood/i, /bonnet/i, /roof/i, /door/i, /fender/i, /quarter panel/i,
];
const isBodyPart = (name) => BODY_PATTERNS.some(rx => rx.test(name));

function MustangModel({ onDims }) {
  const { scene } = useGLTF('/mustang.glb');

  const { scl, offset, dims } = useMemo(() => {
    // ── Pass 1: collect all meshes + their world bboxes ─────
    const meshes = [];
    scene.updateMatrixWorld(true);
    scene.traverse((child) => {
      if (!child.isMesh || !child.geometry) return;
      const bbox = new THREE.Box3().setFromObject(child);
      const size = new THREE.Vector3(); bbox.getSize(size);
      const center = new THREE.Vector3(); bbox.getCenter(center);
      const volume = Math.max(size.x, 0.01) * Math.max(size.y, 0.01) * Math.max(size.z, 0.01);
      meshes.push({ mesh: child, bbox, size, center, volume });
    });

    // ── Pass 1b: explicitly hide known non-car nodes ─────────
    const HIDE_NODES = /^(plane|background|drape|light|alights)/i;
    scene.traverse((child) => {
      if (child.name && HIDE_NODES.test(child.name)) {
        child.visible = false;
      }
    });

    // ── Pass 2: identify the car — the largest mesh by volume ─
    // is almost always the body shell. Filter out absurdly large meshes
    // first (floor planes can be huge & flat).
    const reasonable = meshes.filter(m => {
      if (!m.mesh.visible) return false;
      // Skip anything that's very flat (huge area, tiny height) — floor plane
      const maxDim = Math.max(m.size.x, m.size.y, m.size.z);
      const minDim = Math.min(m.size.x, m.size.y, m.size.z);
      return maxDim / Math.max(minDim, 0.01) < 50;
    });

    // Seed: biggest non-flat mesh
    reasonable.sort((a, b) => b.volume - a.volume);
    const seed = reasonable[0];

    if (!seed) {
      // Fallback — keep everything if heuristic fails
      scene.traverse(c => { if (c.isMesh) { c.castShadow = c.receiveShadow = true; } });
    } else {
      // Compute a bounding radius around the seed. Cars are longer than
      // they are tall/wide — use the longest dimension × 1.3 as radius.
      const carRadius = Math.max(seed.size.x, seed.size.y, seed.size.z) * 1.3;

      // Hide anything whose centroid is further than carRadius from seed.
      for (const m of meshes) {
        const dist = m.center.distanceTo(seed.center);
        if (dist > carRadius) {
          m.mesh.visible = false;
        } else {
          m.mesh.castShadow = true;
          m.mesh.receiveShadow = true;
        }
      }
    }

    // ── Pass 3: assign PBR materials to visible meshes ──────
    const paintBody = new THREE.MeshPhysicalMaterial({
      color: '#1a1a1a', metalness: 0.95, roughness: 0.25,
      clearcoat: 1.0, clearcoatRoughness: 0.06, reflectivity: 0.85,
    });
    const paintTrim = new THREE.MeshStandardMaterial({
      color: '#0a0a0a', metalness: 0.6, roughness: 0.45,
    });
    const chrome = new THREE.MeshStandardMaterial({
      color: '#e8e8e8', metalness: 1.0, roughness: 0.12,
    });
    const rubber = new THREE.MeshStandardMaterial({
      color: '#0d0d0e', metalness: 0.05, roughness: 0.88,
    });
    const lightLens = new THREE.MeshPhysicalMaterial({
      color: '#f8f2de', metalness: 0.1, roughness: 0.08,
      transmission: 0.4, emissive: '#ffe9a8', emissiveIntensity: 0.25,
    });

    // Glass material for windows
    const glass = new THREE.MeshPhysicalMaterial({
      color: '#111118', metalness: 0.1, roughness: 0.05,
      transmission: 0.6, thickness: 0.3, ior: 1.5,
      envMapIntensity: 1.5,
    });
    // Interior / generic dark
    const interior = new THREE.MeshStandardMaterial({
      color: '#1a1a1a', metalness: 0.2, roughness: 0.7,
    });

    // Build a map of node name → parent name for context
    const parentNameOf = (child) => {
      let p = child.parent;
      while (p) {
        if (p.name) return p.name.toLowerCase();
        p = p.parent;
      }
      return '';
    };

    scene.traverse((child) => {
      if (!child.isMesh || !child.visible) return;
      // Check both the mesh's own name and its parent node name
      const n = (child.name || '').toLowerCase();
      const pn = parentNameOf(child);
      const ctx = n + ' ' + pn;  // combined context for matching

      if (isBodyPart(child.name) || isBodyPart(pn)) {
        child.material = paintBody;
      } else if (/grill|exhaust(?! cut)/.test(ctx)) {
        child.material = paintTrim;
      } else if (/spokes|hub|bolt|rim/.test(ctx)) {
        child.material = chrome;
      } else if (/rubber|brake|tyre|tire|^wheels?$/.test(n)) {
        child.material = rubber;
      } else if (/^wheels?$/.test(pn) && /circle|cylinder/i.test(n)) {
        // Wheel sub-meshes: cylinders are likely rims, circles are tires
        child.material = /circle/i.test(n) ? rubber : chrome;
      } else if (/head.?light|low.?light|rear.?number.?plate$|^light$|lamp|indicator/.test(ctx)) {
        child.material = lightLens;
      } else if (/glass|window|windshield|windscreen/.test(ctx)) {
        child.material = glass;
      } else if (/interior|seat|dash|steering|mirror/.test(ctx)) {
        child.material = interior;
      } else if (/brake.?vent|vent/.test(ctx)) {
        child.material = paintTrim;
      } else {
        // Fallback: give unmatched meshes the dark trim material so nothing stays white
        child.material = paintTrim;
      }
    });

    scene.rotation.set(0, 0, 0);
    scene.updateMatrixWorld(true);

    // ── Pass 4: recompute final bounding box from visible meshes ─
    const box = new THREE.Box3();
    scene.traverse((child) => {
      if (child.isMesh && child.visible) box.expandByObject(child);
    });
    const size = new THREE.Vector3(); box.getSize(size);
    const center = new THREE.Vector3(); box.getCenter(center);

    // Target a real car length ~4.8 m (Mustang is ~4.8 m long).
    // Assume the longest horizontal axis is the car's length.
    const lengthAxis = Math.max(size.x, size.z);
    const s = lengthAxis > 0 ? 4.8 / lengthAxis : 1;

    // Lift the car above the floor: use -box.min.y + small padding
    const yLift = (-box.min.y * s) + 0.05;

    return {
      scl: s,
      offset: new THREE.Vector3(-center.x * s, yLift, -center.z * s),
      dims: {
        w: size.x * s, h: size.y * s, d: size.z * s,
        hw: (size.x * s) / 2, hd: (size.z * s) / 2,
      },
    };
  }, [scene]);

  useEffect(() => { if (onDims) onDims(dims); }, [dims, onDims]);

  return (
    <group position={offset.toArray()}>
      <primitive object={scene} scale={[scl, scl, scl]} />
    </group>
  );
}

useGLTF.preload('/mustang.glb');

/* ═══════════════════════════════════════════════════════════════
   LABEL PROJECTOR — angle-dependent via surface-normal dot product
═══════════════════════════════════════════════════════════════ */
function LabelProjector({ carGroupRef, phase, dims, onUpdate }) {
  const { camera, size } = useThree();
  const tmpP = useMemo(() => new THREE.Vector3(), []);
  const tmpN = useMemo(() => new THREE.Vector3(), []);
  const step = useRef(0);

  useFrame(() => {
    step.current = (step.current + 1) % 3;
    if (step.current !== 0) return;
    if (!carGroupRef.current || phase !== 'menu' || !dims) { onUpdate([]); return; }

    const out = [];
    for (const def of LABEL_DEFS) {
      const pos3 = def.localFn(dims);
      tmpP.set(pos3[0], pos3[1], pos3[2]);
      tmpP.applyMatrix4(carGroupRef.current.matrixWorld);

      tmpN.set(def.normal[0], def.normal[1], def.normal[2]);
      tmpN.transformDirection(carGroupRef.current.matrixWorld);
      const toCamera = camera.position.clone().sub(tmpP).normalize();
      const dot = tmpN.dot(toCamera);
      // Stricter: only show when this side is clearly facing the viewer
      if (dot < 0.4) continue;

      const ndc = tmpP.clone().project(camera);
      if (ndc.z > 1) continue;

      out.push({
        ...def,
        x: (ndc.x * 0.5 + 0.5) * size.width,
        y: (-ndc.y * 0.5 + 0.5) * size.height,
        dot,
      });
    }
    onUpdate(out);
  });

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   CAMERA RIG — lerps camera only in non-menu phases (zoom-in)
═══════════════════════════════════════════════════════════════ */
function CameraRig({ phase, controlsRef }) {
  const { camera } = useThree();
  const lookAt = useRef(new THREE.Vector3(0, 1.2, 0));

  useFrame((_, delta) => {
    if (phase === 'menu') {
      if (controlsRef.current) controlsRef.current.enabled = true;
      return;
    }
    if (controlsRef.current) controlsRef.current.enabled = false;

    const c = CAMS[phase] || CAMS.menu;
    camera.position.lerp(new THREE.Vector3(c.pos[0], c.pos[1], c.pos[2]), delta * 1.7);
    lookAt.current.lerp(new THREE.Vector3(c.look[0], c.look[1], c.look[2]), delta * 2.0);
    camera.lookAt(lookAt.current);
  });

  return null;
}

/* ═══════════════════════════════════════════════════════════════
   SETTINGS PANEL — white themed
═══════════════════════════════════════════════════════════════ */
function SettingsPanel({ onClose }) {
  const [profile,  setProfile]  = useState(() => localStorage.getItem('mappy.routeProfile') || 'driving');
  const [voice,    setVoice]    = useState(() => localStorage.getItem('mappy.voice') !== 'off');
  const [radar,    setRadar]    = useState(() => localStorage.getItem('mappy.radar') !== 'off');
  const [mStyle,   setMStyle]   = useState(() => localStorage.getItem('mappy.style') || 'light');

  const save = () => {
    localStorage.setItem('mappy.routeProfile', profile);
    localStorage.setItem('mappy.voice',  voice ? 'on' : 'off');
    localStorage.setItem('mappy.radar',  radar ? 'on' : 'off');
    localStorage.setItem('mappy.style',  mStyle);
    onClose();
  };

  const Toggle = ({ on, set }) => (
    <button onClick={() => set(!on)} style={{
      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
      background: on ? BLUE : '#d1d5db', transition: 'background 0.2s', position: 'relative',
    }}>
      <div style={{
        position: 'absolute', top: 3, left: on ? 22 : 3, width: 18, height: 18,
        borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
        transition: 'left 0.2s',
      }} />
    </button>
  );

  const Row = ({ label, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #f0f1f3' }}>
      <span style={{ fontSize: 14, color: '#374151', fontWeight: 500 }}>{label}</span>
      {children}
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.94, y: 16 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: 16 }}
      transition={{ type: 'spring', stiffness: 280, damping: 30 }}
      style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, background: 'rgba(0,0,0,0.12)' }}
    >
      <div style={{
        background: '#fff', borderRadius: 24, padding: '28px 32px',
        width: 380, maxWidth: '90vw',
        boxShadow: '0 4px 6px rgba(0,0,0,0.07), 0 20px 50px rgba(0,0,0,0.14)',
        border: '1px solid #e5e7eb',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <span style={{ fontSize: 24 }}>{'\u2699\uFE0F'}</span>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em', color: '#ea580c', textTransform: 'uppercase' }}>GPS SETTINGS</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#111827', marginTop: 2 }}>Preferences</div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ fontFamily: MONO, fontSize: 9, color: '#6b7280', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 8 }}>Route profile</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['driving','cycling','foot'].map(p => (
              <button key={p} onClick={() => setProfile(p)} style={{
                flex: 1, padding: '9px 4px', borderRadius: 10, cursor: 'pointer',
                background: profile === p ? '#eff6ff' : '#f9fafb',
                color: profile === p ? BLUE : '#6b7280',
                border: `1.5px solid ${profile === p ? BLUE : '#e5e7eb'}`,
                fontWeight: profile === p ? 600 : 400,
              }}>
                {p === 'driving' ? '\u{1F697}' : p === 'cycling' ? '\u{1F6B2}' : '\u{1F6B6}'}<br/>
                <span style={{ fontSize: 9, fontFamily: MONO, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{p}</span>
              </button>
            ))}
          </div>
        </div>

        <Row label="Voice guidance"><Toggle on={voice} set={setVoice} /></Row>
        <Row label="Radar alerts"><Toggle on={radar} set={setRadar} /></Row>
        <Row label="Map style">
          <div style={{ display: 'flex', gap: 6 }}>
            {['light','satellite'].map(s => (
              <button key={s} onClick={() => setMStyle(s)} style={{
                padding: '5px 12px', borderRadius: 8, cursor: 'pointer', fontSize: 12,
                background: mStyle === s ? '#eff6ff' : '#f9fafb',
                color: mStyle === s ? BLUE : '#6b7280',
                border: `1.5px solid ${mStyle === s ? BLUE : '#e5e7eb'}`,
                fontWeight: mStyle === s ? 600 : 400,
              }}>{s}</button>
            ))}
          </div>
        </Row>

        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button onClick={onClose} style={{
            flex: 1, padding: 11, borderRadius: 12,
            border: '1.5px solid #e5e7eb', background: '#f9fafb',
            color: '#6b7280', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}>Cancel</button>
          <button onClick={save} style={{
            flex: 2, padding: 11, borderRadius: 12, border: 'none',
            background: BLUE, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            boxShadow: '0 4px 12px rgba(26,115,232,0.4)',
          }}>Save &amp; Close</button>
        </div>
      </div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LOADING FALLBACK — wireframe while STL downloads
═══════════════════════════════════════════════════════════════ */
function CarLoader() {
  return (
    <mesh position={[0, 1, 0]}>
      <boxGeometry args={[4, 1.8, 2]} />
      <meshStandardMaterial color="#d0d4e0" wireframe />
    </mesh>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCENE — orchestrates all Three.js children
═══════════════════════════════════════════════════════════════ */
function Scene({ phase, hovered, carGroupRef, onLabels }) {
  const controlsRef = useRef();
  const [dims, setDims] = useState(null);

  // Pause auto-rotation while hovering a popup so it stays clickable
  const autoRotate = phase === 'menu' && !hovered;

  return (
    <>
      <group ref={carGroupRef}>
        <Suspense fallback={<CarLoader />}>
          <MustangModel onDims={setDims} />
        </Suspense>
      </group>

      {/* Built-in HDRI for glossy metallic reflections on the paint */}
      <Environment preset="city" />

      {/* Soft circular shadow under the car */}
      <ContactShadows
        position={[0, 0.001, 0]}
        opacity={0.55}
        scale={12}
        blur={2.6}
        far={4}
        resolution={1024}
        color="#0a0a0a"
      />

      <OrbitControls
        ref={controlsRef}
        enabled={phase === 'menu'}
        enableDamping
        dampingFactor={0.07}
        minDistance={4}
        maxDistance={16}
        target={[0, 1.2, 0]}
        enablePan={false}
        autoRotate={autoRotate}
        autoRotateSpeed={0.6}
      />

      <CameraRig phase={phase} controlsRef={controlsRef} />
      <LabelProjector carGroupRef={carGroupRef} phase={phase} dims={dims} onUpdate={onLabels} />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN EXPORT
═══════════════════════════════════════════════════════════════ */
export default function MappyGarage({ onBack }) {
  const [phase,       setPhase]       = useState('menu');
  const [showContent, setShowContent] = useState(false);
  const [labels,      setLabels]      = useState([]);
  const [hovered,     setHovered]     = useState(null);  // now stores popup id directly
  const carGroupRef                   = useRef();
  const timer                         = useRef(null);

  useEffect(() => {
    clearTimeout(timer.current);
    if (phase !== 'menu') {
      timer.current = setTimeout(() => setShowContent(true), 1400);
    } else {
      setShowContent(false);
    }
    return () => clearTimeout(timer.current);
  }, [phase]);

  const handleSelect = useCallback((option) => { setPhase(option); setHovered(null); }, []);
  const handleBack   = useCallback(() => { setShowContent(false); setPhase('menu'); }, []);
  const handleHover  = useCallback((id) => { setHovered(id); document.body.style.cursor = 'pointer'; }, []);
  const handleLeave  = useCallback(() => { setHovered(null); document.body.style.cursor = ''; }, []);

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#f0f2f8', overflow: 'hidden' }}>

      {/* ── Three.js Canvas ── */}
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: CAMS.menu.pos, fov: 52 }}
        gl={{
          antialias: true, alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: false,
        }}
        shadows
        resize={{ debounce: 100, scroll: false }}
      >
        <color attach="background" args={['#f0f2f8']} />
        <fog attach="fog" args={['#f0f2f8', 18, 40]} />

        <ambientLight intensity={0.9} color="#ffffff" />
        <directionalLight position={[8, 12, 6]} intensity={2.5} color="#ffffff" castShadow shadow-mapSize={[2048, 2048]} />
        <directionalLight position={[-6, 8, -4]} intensity={1.2} color="#e0eaff" />
        <pointLight position={[0, 10, 0]} intensity={1.8} color="#fff8f0" distance={20} decay={1.2} />
        <hemisphereLight skyColor="#d6e4ff" groundColor="#e8edf5" intensity={0.6} />

        {/* Showroom floor */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[30, 30]} />
          <meshStandardMaterial color="#e4e6ee" metalness={0.25} roughness={0.6} />
        </mesh>

        <Scene
          phase={phase}
          hovered={hovered}
          carGroupRef={carGroupRef}
          onLabels={setLabels}
        />
      </Canvas>

      {/* ── HTML label cards — only in menu, angle-dependent ── */}
      <AnimatePresence>
        {phase === 'menu' && labels.map(lp => (
          <motion.button
            key={lp.id}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            onClick={() => handleSelect(lp.id)}
            onMouseEnter={() => handleHover(lp.id)}
            onMouseLeave={handleLeave}
            style={{
              position: 'absolute', left: lp.x, top: lp.y,
              transform: `translate(-50%,-50%)${hovered === lp.id ? ' translateY(-6px)' : ''}`,
              background: '#ffffff',
              border: `1.5px solid ${hovered === lp.id ? lp.color : '#e5e7eb'}`,
              borderRadius: 14, padding: '10px 14px',
              color: '#111827', cursor: 'pointer', textAlign: 'center', minWidth: 100,
              boxShadow: hovered === lp.id
                ? `0 8px 24px ${lp.color}30, 0 2px 8px rgba(0,0,0,0.12)`
                : '0 2px 8px rgba(0,0,0,0.10)',
              transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
              zIndex: 10, pointerEvents: 'auto',
            }}
          >
            <div style={{ fontSize: 22 }}>{lp.icon}</div>
            <div style={{ fontFamily: MONO, fontSize: 8, letterSpacing: '0.2em', color: lp.color, textTransform: 'uppercase', marginTop: 4, fontWeight: 600 }}>{lp.title}</div>
            <div style={{ fontSize: 10, color: '#6b7280', marginTop: 2 }}>{lp.sub}</div>
          </motion.button>
        ))}
      </AnimatePresence>

      {/* ── Content overlays (appear after camera zoom completes) ── */}
      <AnimatePresence>
        {showContent && phase === 'gps' && (
          <motion.div key="gps" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }} style={{ position: 'absolute', inset: 0, zIndex: 20 }}>
            <ErrorBoundary title="GPS failed"><MappyMap /></ErrorBoundary>
          </motion.div>
        )}
        {showContent && phase === 'sim' && (
          <motion.div key="sim" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }} style={{ position: 'absolute', inset: 0, zIndex: 20, background: '#f0f2f8' }}>
            <ErrorBoundary title="Simulator failed"><InteractiveModule /></ErrorBoundary>
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
        padding: 'max(14px,env(safe-area-inset-top,14px)) 18px 10px', pointerEvents: 'none',
      }}>
        <button
          onClick={showContent ? handleBack : onBack}
          style={{
            pointerEvents: 'auto',
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase',
            color: '#374151', background: 'rgba(255,255,255,0.88)',
            backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
            border: '1.5px solid #e5e7eb', borderRadius: 10,
            padding: '8px 14px', cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          }}
        >
          {'\u2190'} {showContent ? 'Garage' : 'Menu'}
        </button>
        <div style={{
          fontFamily: MONO, fontSize: 9, letterSpacing: '0.28em',
          color: '#9ca3af', textTransform: 'uppercase', pointerEvents: 'none',
          background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(8px)',
          padding: '6px 12px', borderRadius: 8, border: '1px solid #e5e7eb',
        }}>
          {phase === 'menu' ? 'MAPPY \u00B7 GARAGE' : phase.toUpperCase()}
        </div>
      </div>

      {/* ── Hint ── */}
      {phase === 'menu' && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          style={{
            position: 'absolute', bottom: 28, left: 0, right: 0, textAlign: 'center',
            fontFamily: MONO, fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase',
            color: '#9ca3af', pointerEvents: 'none', zIndex: 10,
          }}
        >
          auto-rotating {'\u00B7'} click a card when it appears
        </motion.div>
      )}

    </div>
  );
}

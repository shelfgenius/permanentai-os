import React, { useState, useEffect, useRef, Suspense, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Html, Text, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

import { SmartHomeProvider, useSmartHome } from '../components/nexus/context/SmartHomeContext';
import AlexaCard from '../components/nexus/cards/AlexaCard';
import BekoACCard from '../components/nexus/cards/BekoACCard';
import LGTVCard from '../components/nexus/cards/LGTVCard';
import LedvanceCard from '../components/nexus/cards/LedvanceCard';
import XiaomiCard from '../components/nexus/cards/XiaomiCard';
import ScenesBar from '../components/nexus/scenes/ScenesBar';
import SceneActivationOverlay from '../components/nexus/scenes/SceneActivationOverlay';
import VoiceOrb from '../components/VoiceOrb.jsx';
import NexusSetupPanel from '../components/nexus/NexusSetupPanel.jsx';
import useStore from '../store/useStore.js';
import '../components/nexus/nexus.css';

const MONO = '"Space Mono", "IBM Plex Mono", monospace';

/* ── Weather hook (Constanta, Romania) ── */
const CONSTANTA = { lat: 44.1598, lon: 28.6348 };
const WMO_MAP = {
  0: { icon: '☀️', label: 'Clear' }, 1: { icon: '🌤️', label: 'Mainly Clear' },
  2: { icon: '⛅', label: 'Partly Cloudy' }, 3: { icon: '☁️', label: 'Overcast' },
  45: { icon: '🌫️', label: 'Foggy' }, 51: { icon: '🌦️', label: 'Drizzle' },
  61: { icon: '🌧️', label: 'Rain' }, 71: { icon: '🌨️', label: 'Snow' },
  95: { icon: '⛈️', label: 'Thunderstorm' },
};

function useWeather() {
  const [weather, setWeather] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONSTANTA.lat}&longitude=${CONSTANTA.lon}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m,relative_humidity_2m&wind_speed_unit=ms&timezone=Europe%2FBucharest`;
        const data = await (await fetch(url)).json();
        const c = data.current;
        const wmo = WMO_MAP[c.weather_code] || { icon: '🌡️', label: 'Unknown' };
        setWeather({ temp: Math.round(c.temperature_2m), feelsLike: Math.round(c.apparent_temperature), wind: Math.round(c.wind_speed_10m), humidity: c.relative_humidity_2m, icon: wmo.icon, label: wmo.label });
      } catch {}
    })();
  }, []);
  return weather;
}

/* ══════════════════════════════════════════════════════
   3D APARTMENT — interactive device models
══════════════════════════════════════════════════════ */
const DEVICE_DEFS = [
  { id: 'tv',     label: 'LG TV',        color: '#FF2D78', pos: [0, 1.5, -2.95], icon: '📺' },
  { id: 'ac',     label: 'Beko AC',       color: '#00FFD1', pos: [2.9, 2.3, 0],   icon: '❄️' },
  { id: 'lights', label: 'Ledvance',      color: '#FFB800', pos: [0, 2.95, 0],    icon: '💡' },
  { id: 'vacuum', label: 'Xiaomi Vacuum', color: '#7B2FBE', pos: [-1.5, 0.12, 1], icon: '🤖' },
  { id: 'alexa',  label: 'Alexa Echo',    color: '#00AAFF', pos: [1.8, 0.85, 1.5], icon: '🔵' },
];

/* ══════════════════════════════════════════════════════
   REALISTIC DEVICE MODELS — MeshPhysicalMaterial + PBR
══════════════════════════════════════════════════════ */

/* TV — 65" LG OLED on brushed-aluminum stand */
function TVModel({ hovered }) {
  return (
    <group>
      {/* Main bezel — matte black anodised aluminum */}
      <mesh castShadow>
        <boxGeometry args={[2.4, 1.4, 0.04]} />
        <meshPhysicalMaterial color="#0a0a0a" metalness={0.92} roughness={0.15} clearcoat={0.4} clearcoatRoughness={0.1} />
      </mesh>
      {/* Thin bezel lip */}
      <mesh position={[0, 0, 0.021]}>
        <boxGeometry args={[2.44, 1.44, 0.002]} />
        <meshPhysicalMaterial color="#1a1a1a" metalness={0.95} roughness={0.08} />
      </mesh>
      {/* OLED panel — high-gloss reflective */}
      <mesh position={[0, 0, 0.022]}>
        <planeGeometry args={[2.3, 1.3]} />
        <meshPhysicalMaterial
          color={hovered ? '#0a1828' : '#020408'}
          emissive={hovered ? '#0066cc' : '#000510'}
          emissiveIntensity={hovered ? 0.8 : 0.08}
          metalness={0.1} roughness={0.05}
          clearcoat={1} clearcoatRoughness={0.02}
          reflectivity={0.9}
        />
      </mesh>
      {/* Stand neck — brushed aluminum */}
      <mesh position={[0, -0.82, 0.02]} castShadow>
        <boxGeometry args={[0.06, 0.28, 0.06]} />
        <meshPhysicalMaterial color="#c0c0c0" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* Stand base plate */}
      <mesh position={[0, -0.97, 0.08]} castShadow>
        <boxGeometry args={[0.8, 0.02, 0.22]} />
        <meshPhysicalMaterial color="#b0b0b0" metalness={0.92} roughness={0.2} clearcoat={0.3} />
      </mesh>
      {/* Logo bump */}
      <mesh position={[0, -0.66, 0.023]}>
        <boxGeometry args={[0.12, 0.02, 0.003]} />
        <meshPhysicalMaterial color="#888" metalness={0.8} roughness={0.3} />
      </mesh>
      {hovered && <pointLight position={[0, 0, 0.5]} color="#0088ff" intensity={0.6} distance={2} />}
    </group>
  );
}

/* AC — Beko wall-mount split-system with louvers */
function ACModel({ hovered }) {
  return (
    <group rotation={[0, -Math.PI / 2, 0]}>
      {/* Body — glossy white plastic */}
      <mesh castShadow>
        <boxGeometry args={[1.5, 0.36, 0.26]} />
        <meshPhysicalMaterial color="#f5f5f5" metalness={0.05} roughness={0.15} clearcoat={0.8} clearcoatRoughness={0.05} />
      </mesh>
      {/* Top panel inset */}
      <mesh position={[0, 0.17, 0]}>
        <boxGeometry args={[1.48, 0.02, 0.24]} />
        <meshPhysicalMaterial color="#eee" metalness={0.08} roughness={0.2} />
      </mesh>
      {/* Front display */}
      <mesh position={[0.45, 0.05, 0.131]}>
        <planeGeometry args={[0.35, 0.12]} />
        <meshPhysicalMaterial
          color="#111" metalness={0.3} roughness={0.1}
          emissive={hovered ? '#00FFD1' : '#003322'}
          emissiveIntensity={hovered ? 1.0 : 0.15}
          clearcoat={1} clearcoatRoughness={0.02}
        />
      </mesh>
      {/* Main air outlet */}
      <mesh position={[0, -0.14, 0.13]}>
        <boxGeometry args={[1.35, 0.06, 0.01]} />
        <meshPhysicalMaterial color={hovered ? '#f0f0f0' : '#e0e0e0'} metalness={0.1} roughness={0.3} />
      </mesh>
      {/* Louver slats */}
      {[-0.5, -0.2, 0.1, 0.4].map((x, i) => (
        <mesh key={i} position={[x, -0.16, 0.131]} rotation={[hovered ? -0.3 : 0, 0, 0]}>
          <boxGeometry args={[0.28, 0.015, 0.008]} />
          <meshPhysicalMaterial color="#e8e8e8" metalness={0.05} roughness={0.2} />
        </mesh>
      ))}
      {/* Status LED */}
      <mesh position={[-0.6, 0.05, 0.132]}>
        <sphereGeometry args={[0.015, 12, 12]} />
        <meshPhysicalMaterial color={hovered ? '#00ff88' : '#004422'} emissive={hovered ? '#00ff88' : '#002211'} emissiveIntensity={hovered ? 2 : 0.3} />
      </mesh>
      {hovered && <pointLight position={[0, -0.3, 0.5]} color="#00FFD1" intensity={0.3} distance={1.5} />}
    </group>
  );
}

/* Ceiling light — Ledvance pendant with frosted glass shade */
function LightModel({ hovered }) {
  return (
    <group>
      {/* Ceiling mount */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 0.02, 16]} />
        <meshPhysicalMaterial color="#d0d0d0" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Cord */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[0.005, 0.005, 0.24, 8]} />
        <meshPhysicalMaterial color="#333" metalness={0.3} roughness={0.5} />
      </mesh>
      {/* Outer frosted-glass shade */}
      <mesh position={[0, -0.24, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.42, 0.1, 32]} />
        <meshPhysicalMaterial
          color="#f8f6f0" metalness={0.02} roughness={0.35}
          transmission={0.25} thickness={0.5}
          clearcoat={0.3} clearcoatRoughness={0.15}
        />
      </mesh>
      {/* Inner diffuser dome */}
      <mesh position={[0, -0.22, 0]}>
        <sphereGeometry args={[0.28, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial
          color={hovered ? '#fff5e0' : '#fff8f0'}
          transmission={0.4} thickness={0.3} roughness={0.5}
          emissive={hovered ? '#FFB800' : '#ffe8b0'}
          emissiveIntensity={hovered ? 1.2 : 0.3}
        />
      </mesh>
      {/* Aluminum accent ring */}
      <mesh position={[0, -0.19, 0]}>
        <torusGeometry args={[0.36, 0.008, 8, 32]} />
        <meshPhysicalMaterial color="#c8c8c8" metalness={0.9} roughness={0.2} />
      </mesh>
      <pointLight
        color={hovered ? '#FFB800' : '#fff0d0'}
        intensity={hovered ? 5 : 2} distance={7}
        position={[0, -0.3, 0]} castShadow shadow-mapSize={[512, 512]}
      />
    </group>
  );
}

/* Vacuum — Xiaomi Roborock with LIDAR turret */
function VacuumModel({ hovered }) {
  const ringRef = useRef();
  useFrame((_, dt) => { if (ringRef.current && hovered) ringRef.current.rotation.y += dt * 2; });
  return (
    <group>
      {/* Main disc — matte white */}
      <mesh castShadow>
        <cylinderGeometry args={[0.24, 0.24, 0.085, 36]} />
        <meshPhysicalMaterial color="#f0f0f0" metalness={0.05} roughness={0.3} clearcoat={0.5} clearcoatRoughness={0.1} />
      </mesh>
      {/* Top cap — glossier */}
      <mesh position={[0, 0.044, 0]}>
        <cylinderGeometry args={[0.23, 0.23, 0.003, 36]} />
        <meshPhysicalMaterial color="#fafafa" metalness={0.08} roughness={0.15} clearcoat={0.8} />
      </mesh>
      {/* LIDAR turret */}
      <mesh position={[0.04, 0.065, -0.02]} castShadow>
        <cylinderGeometry args={[0.055, 0.06, 0.04, 24]} />
        <meshPhysicalMaterial color="#e8e8e8" metalness={0.1} roughness={0.2} clearcoat={0.6} />
      </mesh>
      {/* LIDAR dome cap — dark glass */}
      <mesh position={[0.04, 0.087, -0.02]}>
        <sphereGeometry args={[0.054, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color="#1a1a2a" metalness={0.3} roughness={0.05} clearcoat={1} clearcoatRoughness={0.02} transmission={0.15} thickness={0.5} />
      </mesh>
      {/* Bumper sensor strip */}
      <mesh position={[0, 0.02, 0.22]} rotation={[0.15, 0, 0]}>
        <boxGeometry args={[0.32, 0.04, 0.02]} />
        <meshPhysicalMaterial color="#2a2a2a" metalness={0.4} roughness={0.2} />
      </mesh>
      {/* Animated LED ring */}
      <group ref={ringRef} position={[0.04, 0.09, -0.02]}>
        <mesh>
          <torusGeometry args={[0.04, 0.004, 8, 24]} />
          <meshPhysicalMaterial
            color={hovered ? '#7B2FBE' : '#333'}
            emissive={hovered ? '#7B2FBE' : '#110022'}
            emissiveIntensity={hovered ? 2.5 : 0.1}
          />
        </mesh>
      </group>
      {/* Rubber wheels */}
      {[-0.15, 0.15].map((x, i) => (
        <mesh key={i} position={[x, -0.02, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.03, 0.03, 0.04, 12]} />
          <meshPhysicalMaterial color="#1a1a1a" metalness={0.1} roughness={0.8} />
        </mesh>
      ))}
      {hovered && <pointLight position={[0, 0.2, 0]} color="#7B2FBE" intensity={0.5} distance={1.5} />}
    </group>
  );
}

/* Alexa Echo 4th-gen sphere on walnut side table */
function AlexaModel({ hovered }) {
  const glowRef = useRef();
  useFrame((state) => {
    if (glowRef.current && hovered)
      glowRef.current.material.emissiveIntensity = 1.5 + Math.sin(state.clock.elapsedTime * 3) * 0.5;
  });
  return (
    <group>
      {/* Walnut side table top */}
      <mesh position={[0, -0.32, 0]} castShadow>
        <boxGeometry args={[0.55, 0.04, 0.55]} />
        <meshPhysicalMaterial color="#6B4226" metalness={0.05} roughness={0.55} clearcoat={0.4} clearcoatRoughness={0.15} />
      </mesh>
      {/* Table legs */}
      {[[-0.22, -0.55, -0.22], [0.22, -0.55, -0.22], [-0.22, -0.55, 0.22], [0.22, -0.55, 0.22]].map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <cylinderGeometry args={[0.018, 0.02, 0.44, 8]} />
          <meshPhysicalMaterial color="#5a3820" metalness={0.08} roughness={0.6} />
        </mesh>
      ))}
      {/* Echo sphere — charcoal fabric */}
      <mesh position={[0, -0.1, 0]} castShadow>
        <sphereGeometry args={[0.13, 32, 32]} />
        <meshPhysicalMaterial color="#252530" metalness={0.02} roughness={0.85} sheen={0.3} sheenColor="#333344" />
      </mesh>
      {/* Flat bottom ring */}
      <mesh position={[0, -0.22, 0]}>
        <cylinderGeometry args={[0.1, 0.12, 0.04, 24]} />
        <meshPhysicalMaterial color="#1a1a22" metalness={0.05} roughness={0.8} />
      </mesh>
      {/* LED light ring */}
      <mesh ref={glowRef} position={[0, -0.22, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.115, 0.006, 12, 48]} />
        <meshPhysicalMaterial
          color={hovered ? '#00AAFF' : '#0a1a2a'}
          emissive={hovered ? '#00AAFF' : '#001122'}
          emissiveIntensity={hovered ? 1.5 : 0.15}
          toneMapped={false}
        />
      </mesh>
      {/* Top matte dome */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.06, 0.09, 0.02, 24]} />
        <meshPhysicalMaterial color="#1d1d25" metalness={0.15} roughness={0.6} />
      </mesh>
      {hovered && <pointLight position={[0, -0.15, 0.3]} color="#00AAFF" intensity={0.8} distance={2} />}
    </group>
  );
}

const DEVICE_MODELS = { tv: TVModel, ac: ACModel, lights: LightModel, vacuum: VacuumModel, alexa: AlexaModel };

function DeviceHitbox({ def, hovered, onHover, onLeave, onClick }) {
  const Model = DEVICE_MODELS[def.id];
  const groupRef = useRef();
  return (
    <group position={def.pos}>
      <group
        ref={groupRef}
        onClick={(e) => { e.stopPropagation(); onClick(def.id); }}
        onPointerOver={(e) => { e.stopPropagation(); onHover(def.id); }}
        onPointerOut={onLeave}
      >
        <Model hovered={hovered === def.id} />
        <mesh visible={false}>
          <sphereGeometry args={[0.65, 8, 8]} />
          <meshBasicMaterial />
        </mesh>
      </group>
      {hovered === def.id && (
        <Html center distanceFactor={6} style={{ pointerEvents: 'none' }}>
          <div style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em',
            color: def.color, background: 'rgba(0,0,0,0.88)', padding: '5px 12px',
            borderRadius: 6, border: `1px solid ${def.color}50`, whiteSpace: 'nowrap',
            textShadow: `0 0 10px ${def.color}`,
            boxShadow: `0 0 20px ${def.color}20`,
          }}>
            {def.icon} {def.label}
          </div>
        </Html>
      )}
    </group>
  );
}

/* ══════════════════════════════════════════════════════
   REALISTIC APARTMENT INTERIOR
══════════════════════════════════════════════════════ */
function Apartment({ hovered, onHover, onLeave, onClick }) {
  /* ── Procedural wood grain texture for floor ── */
  const floorTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 512; c.height = 512;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#8a6842';
    ctx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 80; i++) {
      const y = Math.random() * 512;
      ctx.strokeStyle = `rgba(${60 + Math.random() * 40},${40 + Math.random() * 30},${20 + Math.random() * 20},${0.15 + Math.random() * 0.15})`;
      ctx.lineWidth = 0.5 + Math.random() * 1.5;
      ctx.beginPath(); ctx.moveTo(0, y + Math.sin(i) * 3); ctx.lineTo(512, y + Math.cos(i) * 4); ctx.stroke();
    }
    // Plank lines
    for (let x = 0; x < 512; x += 64) {
      ctx.strokeStyle = 'rgba(40,25,10,0.12)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(4, 4);
    tex.anisotropy = 16;
    return tex;
  }, []);

  /* ── Subtle plaster wall texture ── */
  const wallTex = useMemo(() => {
    const c = document.createElement('canvas'); c.width = 256; c.height = 256;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#ede9e3';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * 256, y = Math.random() * 256;
      ctx.fillStyle = `rgba(${180 + Math.random() * 40},${175 + Math.random() * 35},${168 + Math.random() * 30},${0.08 + Math.random() * 0.06})`;
      ctx.fillRect(x, y, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(2, 2);
    return tex;
  }, []);

  const wallMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    map: wallTex, roughness: 0.85, metalness: 0.01, side: THREE.DoubleSide,
    clearcoat: 0.03, clearcoatRoughness: 0.7,
  }), [wallTex]);
  const floorMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    map: floorTex, roughness: 0.42, metalness: 0.06,
    clearcoat: 0.4, clearcoatRoughness: 0.12,
  }), [floorTex]);
  const ceilingMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#f5f2ed', roughness: 0.95, metalness: 0, side: THREE.DoubleSide,
  }), []);
  const baseMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#f0ece6', roughness: 0.5, metalness: 0.05,
  }), []);

  return (
    <group>
      {/* Floor — polished hardwood */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow material={floorMat}>
        <planeGeometry args={[6.4, 6.4]} />
      </mesh>
      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 3.05, 0]} material={ceilingMat}>
        <planeGeometry args={[6.4, 6.4]} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, 1.525, -3.1]} material={wallMat}>
        <planeGeometry args={[6.4, 3.05]} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-3.1, 1.525, 0]} rotation={[0, Math.PI / 2, 0]} material={wallMat}>
        <planeGeometry args={[6.4, 3.05]} />
      </mesh>
      {/* Right wall */}
      <mesh position={[3.1, 1.525, 0]} rotation={[0, -Math.PI / 2, 0]} material={wallMat}>
        <planeGeometry args={[6.4, 3.05]} />
      </mesh>

      {/* ── Baseboards ── */}
      {[
        { p: [0, 0.04, -3.06], s: [6.4, 0.08, 0.02] },
        { p: [-3.06, 0.04, 0], s: [0.02, 0.08, 6.4] },
        { p: [3.06, 0.04, 0], s: [0.02, 0.08, 6.4] },
      ].map((b, i) => (
        <mesh key={`base-${i}`} position={b.p} castShadow material={baseMat}>
          <boxGeometry args={b.s} />
        </mesh>
      ))}

      {/* ── Crown moulding ── */}
      {[
        { p: [0, 2.98, -3.06], s: [6.4, 0.06, 0.04] },
        { p: [-3.06, 2.98, 0], s: [0.04, 0.06, 6.4] },
        { p: [3.06, 2.98, 0], s: [0.04, 0.06, 6.4] },
      ].map((b, i) => (
        <mesh key={`crown-${i}`} position={b.p} material={baseMat}>
          <boxGeometry args={b.s} />
        </mesh>
      ))}

      {/* ── Sofa — rounded modern sectional ── */}
      {/* Seat cushion — rounded box */}
      <mesh position={[0, 0.28, 0.6]} castShadow>
        <capsuleGeometry args={[0.16, 1.6, 4, 16]} />
        <meshPhysicalMaterial color="#38383e" roughness={0.88} metalness={0.01} sheen={0.3} sheenColor="#444450" />
      </mesh>
      {/* Seat base — wider rounded platform */}
      <mesh position={[0, 0.12, 0.6]} castShadow>
        <boxGeometry args={[2.1, 0.12, 0.95]} />
        <meshPhysicalMaterial color="#2e2e34" roughness={0.85} metalness={0.02} />
      </mesh>
      {/* Backrest — rounded cylinder */}
      <mesh position={[0, 0.58, 0.12]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <capsuleGeometry args={[0.14, 1.6, 4, 16]} />
        <meshPhysicalMaterial color="#34343a" roughness={0.9} metalness={0.01} sheen={0.2} sheenColor="#3a3a44" />
      </mesh>
      {/* Left armrest — rounded */}
      <mesh position={[-1.05, 0.38, 0.45]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.5, 4, 12]} />
        <meshPhysicalMaterial color="#36363c" roughness={0.88} metalness={0.01} />
      </mesh>
      {/* Right armrest — rounded */}
      <mesh position={[1.05, 0.38, 0.45]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <capsuleGeometry args={[0.09, 0.5, 4, 12]} />
        <meshPhysicalMaterial color="#36363c" roughness={0.88} metalness={0.01} />
      </mesh>
      {/* Sofa legs — tapered metal */}
      {[[-0.85, 0.04, 0.2], [0.85, 0.04, 0.2], [-0.85, 0.04, 0.95], [0.85, 0.04, 0.95]].map((p, i) => (
        <mesh key={`sleg-${i}`} position={p}>
          <cylinderGeometry args={[0.015, 0.025, 0.08, 8]} />
          <meshPhysicalMaterial color="#b8b8b8" metalness={0.92} roughness={0.18} />
        </mesh>
      ))}
      {/* Throw pillow — soft sphere */}
      <mesh position={[-0.6, 0.52, 0.5]} rotation={[0, 0.3, 0.1]} castShadow>
        <sphereGeometry args={[0.15, 16, 16]} />
        <meshPhysicalMaterial color="#5a6888" roughness={0.92} metalness={0.0} />
      </mesh>
      {/* Second pillow */}
      <mesh position={[0.5, 0.52, 0.48]} rotation={[0, -0.2, 0.05]} castShadow>
        <sphereGeometry args={[0.13, 16, 16]} />
        <meshPhysicalMaterial color="#886858" roughness={0.92} metalness={0.0} />
      </mesh>

      {/* ── Coffee table — glass top, metal legs ── */}
      <mesh position={[0, 0.38, 1.6]} castShadow>
        <boxGeometry args={[1.0, 0.02, 0.5]} />
        <meshPhysicalMaterial color="#ddeeff" metalness={0.05} roughness={0.02} transmission={0.7} thickness={0.3} clearcoat={1} clearcoatRoughness={0.01} />
      </mesh>
      {[[-0.42, 0.19, 1.38], [0.42, 0.19, 1.38], [-0.42, 0.19, 1.82], [0.42, 0.19, 1.82]].map((p, i) => (
        <mesh key={`cleg-${i}`} position={p}>
          <cylinderGeometry args={[0.015, 0.015, 0.36, 8]} />
          <meshPhysicalMaterial color="#b0b0b0" metalness={0.92} roughness={0.18} />
        </mesh>
      ))}

      {/* ── TV console / entertainment unit ── */}
      <mesh position={[0, 0.2, -2.75]} castShadow>
        <boxGeometry args={[2.6, 0.4, 0.4]} />
        <meshPhysicalMaterial color="#2a2a30" metalness={0.05} roughness={0.6} clearcoat={0.2} />
      </mesh>

      {/* ── Area rug under sofa — oval shape ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0.8]}>
        <circleGeometry args={[1.5, 48]} />
        <meshPhysicalMaterial color="#a89878" roughness={0.95} metalness={0} />
      </mesh>

      {/* ── Window on left wall — frosted glass pane ── */}
      <mesh position={[-2.99, 1.8, -1.2]}>
        <planeGeometry args={[0.01, 1.3]} />
        <meshPhysicalMaterial color="#666" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[-2.98, 1.8, -1.2]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.2, 1.3]} />
        <meshPhysicalMaterial color="#b8d8f8" metalness={0.02} roughness={0.1} transmission={0.6} thickness={0.2} clearcoat={1} />
      </mesh>

      {/* ── Bookshelf on left wall ── */}
      <mesh position={[-2.85, 1.2, 1.8]} castShadow>
        <boxGeometry args={[0.35, 1.8, 0.8]} />
        <meshPhysicalMaterial color="#6B4226" metalness={0.05} roughness={0.55} clearcoat={0.3} clearcoatRoughness={0.2} />
      </mesh>
      {/* Shelf dividers */}
      {[0.5, 0.9, 1.3, 1.7].map((y, i) => (
        <mesh key={`shelf-${i}`} position={[-2.85, y, 1.8]}>
          <boxGeometry args={[0.34, 0.02, 0.78]} />
          <meshPhysicalMaterial color="#5a3820" metalness={0.05} roughness={0.5} />
        </mesh>
      ))}

      {/* Devices */}
      {DEVICE_DEFS.map(d => (
        <DeviceHitbox key={d.id} def={d} hovered={hovered} onHover={onHover} onLeave={onLeave} onClick={onClick} />
      ))}
    </group>
  );
}

/* Unused — OrbitControls handles auto-rotate directly */

/* ══════════════════════════════════════════════════════
   CARD MAP — which card to show for each device
══════════════════════════════════════════════════════ */
const CARD_MAP = {
  tv: LGTVCard,
  ac: BekoACCard,
  lights: LedvanceCard,
  vacuum: XiaomiCard,
  alexa: AlexaCard,
};

/* ══════════════════════════════════════════════════════
   DASHBOARD VIEW — traditional card grid
══════════════════════════════════════════════════════ */
function DashboardView({ onClose }) {
  const { state, dispatch } = useSmartHome();
  const [activatingScene, setActivatingScene] = useState(null);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'var(--black)', overflow: 'auto' }}
    >
      <div style={{ padding: '24px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>
              SMART HOME / ALL DEVICES
            </div>
            <div style={{ fontFamily: 'var(--font-sans)', fontSize: 26, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
              All Devices
            </div>
          </div>
          <button onClick={onClose} style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.15em', padding: '8px 16px', borderRadius: 8,
            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#00AAFF', cursor: 'pointer',
          }}>
            ← 3D VIEW
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 20, alignItems: 'start' }}>
          <AlexaCard />
          <BekoACCard />
          <LGTVCard />
          <LedvanceCard />
          <XiaomiCard />
        </div>
      </div>
      <ScenesBar onActivateScene={(id) => setActivatingScene(id)} />
      <AnimatePresence>
        {activatingScene && (
          <SceneActivationOverlay sceneId={activatingScene} onClose={() => { setActivatingScene(null); dispatch({ type: 'CLEAR_SCENE' }); }} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════
   MAIN EXPORT
══════════════════════════════════════════════════════ */
export default function NexusHub({ onBack }) {
  return (
    <SmartHomeProvider>
      <NexusHubInner onBack={onBack} />
    </SmartHomeProvider>
  );
}

function NexusHubInner({ onBack }) {
  const [hovered, setHovered] = useState(null);
  const [activeDevice, setActiveDevice] = useState(null);
  const [showDashboard, setShowDashboard] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const weather = useWeather();
  const { dispatch } = useSmartHome();
  const backendUrl = useStore(s => s.backendUrl);

  const handleHover = useCallback((id) => { setHovered(id); document.body.style.cursor = 'pointer'; }, []);
  const handleLeave = useCallback(() => { setHovered(null); document.body.style.cursor = ''; }, []);
  const handleClick = useCallback((id) => { setActiveDevice(id); setHovered(null); document.body.style.cursor = ''; }, []);

  const ActiveCard = activeDevice ? CARD_MAP[activeDevice] : null;
  const activeDef = activeDevice ? DEVICE_DEFS.find(d => d.id === activeDevice) : null;

  return (
    <div className="nexus-root" style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      {/* 3D Canvas */}
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [7, 5, 9], fov: 40, near: 0.1, far: 50 }}
        gl={{
          antialias: true, toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0, physicallyCorrectLights: true,
          powerPreference: 'high-performance',
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: false,
        }}
        resize={{ debounce: 100, scroll: false }}
        shadows="soft"
      >
        <color attach="background" args={['#050810']} />
        <fog attach="fog" args={['#050810', 14, 30]} />

        {/* Ambient fill */}
        <ambientLight intensity={0.15} />

        {/* Key light — warm directional (sun through window) */}
        <directionalLight
          position={[-4, 7, 3]} intensity={2.5} color="#fff5e8"
          castShadow shadow-mapSize={[2048, 2048]}
          shadow-camera-near={0.5} shadow-camera-far={20}
          shadow-camera-left={-6} shadow-camera-right={6}
          shadow-camera-top={6} shadow-camera-bottom={-6}
          shadow-bias={-0.0003}
        />

        {/* Fill light — cool blue rim */}
        <directionalLight position={[5, 4, -3]} intensity={0.8} color="#c0d8ff" />

        {/* Overhead room light */}
        <pointLight position={[0, 2.7, 0]} intensity={1.5} color="#fff0d0" distance={8} decay={2} />

        {/* Back-wall accent bounce */}
        <pointLight position={[0, 1, -2.5]} intensity={0.3} color="#e8e0d8" distance={4} decay={2} />

        {/* Sky / ground hemisphere */}
        <hemisphereLight skyColor="#b0c0e0" groundColor="#3a2e20" intensity={0.35} />

        {/* Environment map for PBR reflections */}
        <Environment preset="apartment" background={false} />

        {/* Soft contact shadows on the floor */}
        <ContactShadows
          position={[0, 0.01, 0]} opacity={0.45} scale={12}
          blur={2.5} far={5} color="#1a1008"
        />

        <Suspense fallback={null}>
          <Apartment hovered={hovered} onHover={handleHover} onLeave={handleLeave} onClick={handleClick} />
        </Suspense>

        <OrbitControls
          enableDamping dampingFactor={0.06}
          minDistance={4.5} maxDistance={15}
          minPolarAngle={0.25} maxPolarAngle={Math.PI / 2.05}
          autoRotate autoRotateSpeed={0.6}
          target={[0, 1.2, 0]}
        />
      </Canvas>

      {/* ── Top bar ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', pointerEvents: 'none',
      }}>
        <button onClick={onBack} style={{
          pointerEvents: 'auto', fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em',
          color: '#00AAFF', background: 'rgba(0,10,20,0.85)', backdropFilter: 'blur(12px)',
          border: '1px solid rgba(0,170,255,0.25)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
        }}>
          ← MENU
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'auto' }}>
          {weather && (
            <div style={{
              fontFamily: MONO, fontSize: 11, color: '#eee', background: 'rgba(0,10,20,0.85)',
              backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span>{weather.icon}</span>
              <span style={{ fontWeight: 700 }}>{weather.temp}°C</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 9 }}>CONSTANȚA</span>
            </div>
          )}
          <button onClick={() => setShowSetup(true)} style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em',
            color: '#FFB800', background: 'rgba(0,10,20,0.85)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,184,0,0.25)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
          }}>
            ⚙ SETUP
          </button>
          <button onClick={() => setShowDashboard(true)} style={{
            fontFamily: MONO, fontSize: 10, letterSpacing: '0.12em',
            color: '#00AAFF', background: 'rgba(0,10,20,0.85)', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(0,170,255,0.25)', borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
          }}>
            DASHBOARD
          </button>
        </div>
      </div>

      {/* ── Nexus title ── */}
      <div style={{
        position: 'absolute', top: 60, left: 18, zIndex: 10, pointerEvents: 'none',
      }}>
        <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700, letterSpacing: '0.2em', color: '#00AAFF', textShadow: '0 0 20px rgba(0,170,255,0.6)' }}>
          NEXUS
        </div>
        <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', marginTop: 4 }}>
          SMART HOME CONTROL · TAP A DEVICE
        </div>
      </div>

      {/* ── Device status bar (bottom) ── */}
      <div style={{
        position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
        display: 'flex', gap: 8, pointerEvents: 'none',
      }}>
        {DEVICE_DEFS.map(d => (
          <div key={d.id} style={{
            fontFamily: MONO, fontSize: 9, letterSpacing: '0.08em',
            color: hovered === d.id ? d.color : 'rgba(255,255,255,0.35)',
            background: hovered === d.id ? `${d.color}18` : 'rgba(0,0,0,0.6)',
            border: `1px solid ${hovered === d.id ? `${d.color}50` : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 8, padding: '5px 10px',
            transition: 'all 0.2s',
          }}>
            {d.icon} {d.label.split(' ')[0]}
          </div>
        ))}
      </div>

      {/* ── Active device card overlay ── */}
      <AnimatePresence>
        {activeDevice && ActiveCard && (
          <motion.div
            key={activeDevice}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={() => setActiveDevice(null)}
            style={{
              position: 'absolute', inset: 0, zIndex: 50,
              background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 20,
            }}
          >
            <motion.div
              initial={{ scale: 0.9, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 30 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: 440, width: '100%', maxHeight: '85vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                <button onClick={() => setActiveDevice(null)} style={{
                  fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em',
                  color: activeDef?.color || '#00AAFF', background: 'rgba(255,255,255,0.06)',
                  border: `1px solid ${activeDef?.color || '#00AAFF'}40`, borderRadius: 8,
                  padding: '6px 14px', cursor: 'pointer',
                }}>
                  ✕ CLOSE
                </button>
              </div>
              <ActiveCard />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Dashboard overlay ── */}
      <AnimatePresence>
        {showDashboard && (
          <DashboardView onClose={() => setShowDashboard(false)} />
        )}
      </AnimatePresence>

      {/* ── Setup Panel ── */}
      <AnimatePresence>
        {showSetup && (
          <NexusSetupPanel backendUrl={backendUrl} onClose={() => setShowSetup(false)} />
        )}
      </AnimatePresence>

      {/* VOICE ORB — "turn off the lights", "set AC to 22", etc. */}
      <VoiceOrb
        agent="nexus"
        onTranscript={(text) => {
          window.dispatchEvent(new CustomEvent('nexus:voice-command', { detail: { text } }));
        }}
      />
    </div>
  );
}

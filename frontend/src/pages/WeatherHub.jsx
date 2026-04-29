import React, { useRef, useState, useEffect, useMemo, Suspense, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, Html } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import VoiceOrb from '../components/VoiceOrb.jsx';

const MONO = '"IBM Plex Mono", "Space Mono", monospace';

/* ═══════════════════════════════════════════════════════════
   EARTH — instant solid-color sphere + async hi-res upgrade
═══════════════════════════════════════════════════════════ */
function Earth() {
  const earthRef = useRef();
  const cloudsRef = useRef();

  // Async load textures one at a time (non-blocking, sequential to avoid GPU spike)
  useEffect(() => {
    let cancelled = false;
    const loader = new THREE.TextureLoader();
    const load = (url) => new Promise((resolve) => {
      loader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        resolve(tex);
      }, undefined, () => resolve(null));
    });
    (async () => {
      const albedo = await load('/textures/earth_albedo.jpg');
      if (cancelled || !earthRef.current) return;
      if (albedo) { earthRef.current.material.map = albedo; earthRef.current.material.needsUpdate = true; }
      const clouds = await load('/textures/earth_clouds.png');
      if (cancelled || !cloudsRef.current) return;
      if (clouds) { cloudsRef.current.material.map = clouds; cloudsRef.current.material.visible = true; cloudsRef.current.material.needsUpdate = true; }
    })();
    return () => { cancelled = true; };
  }, []);

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.04;
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.055;
  });

  return (
    <group>
      {/* Earth — starts as solid blue/green, upgrades to textured */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[2, 48, 48]} />
        <meshStandardMaterial color="#1a4a7a" roughness={0.7} metalness={0.05} />
      </mesh>
      {/* Clouds — hidden until texture loads */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[2.02, 24, 24]} />
        <meshBasicMaterial transparent opacity={0.25} depthWrite={false} visible={false} />
      </mesh>
      {/* Atmosphere rim */}
      <mesh>
        <sphereGeometry args={[2.06, 16, 16]} />
        <meshBasicMaterial transparent opacity={0.08} color="#4488ff" side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

/* ═══════════════════════════════════════════════════════════
   SPACE OBJECTS — ISS, rockets, comets, Elon's car
═══════════════════════════════════════════════════════════ */
/* ── Detailed ISS model ── */
function ISSModel() {
  return (
    <group>
      {/* Main truss — long horizontal beam */}
      <mesh><boxGeometry args={[0.5, 0.02, 0.02]} /><meshStandardMaterial color="#d0d0d0" metalness={0.9} roughness={0.2} /></mesh>
      {/* Hab modules — center cluster */}
      {[-0.04, 0.04].map((z, i) => (
        <mesh key={i} position={[0, 0, z]}><cylinderGeometry args={[0.025, 0.025, 0.15, 8]} /><meshStandardMaterial color="#e8e8e0" metalness={0.6} roughness={0.35} /></mesh>
      ))}
      {/* Solar panel arrays — 4 large golden panels */}
      {[-0.18, -0.08, 0.08, 0.18].map((x, i) => (
        <mesh key={`sp-${i}`} position={[x, 0.015, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.06, 0.12]} />
          <meshStandardMaterial color="#1a2744" emissive="#1a3366" emissiveIntensity={0.3} metalness={0.4} roughness={0.5} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Radiator panels — white vertical */}
      {[-0.12, 0.12].map((x, i) => (
        <mesh key={`rad-${i}`} position={[x, -0.015, 0]} rotation={[0, 0, 0]}>
          <planeGeometry args={[0.04, 0.05]} />
          <meshStandardMaterial color="#f0f0f0" metalness={0.3} roughness={0.6} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Detailed rocket capsule (generic — used for Artemis) ── */
function RocketModel({ color, emissiveColor }) {
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      {/* Nose cone */}
      <mesh position={[0, 0.08, 0]}><coneGeometry args={[0.025, 0.06, 8]} /><meshStandardMaterial color="#e8e0d8" metalness={0.7} roughness={0.25} /></mesh>
      {/* Capsule body */}
      <mesh><capsuleGeometry args={[0.025, 0.08, 8, 16]} /><meshStandardMaterial color={color} metalness={0.6} roughness={0.3} emissive={emissiveColor} emissiveIntensity={0.2} /></mesh>
      {/* Engine bell */}
      <mesh position={[0, -0.08, 0]}><cylinderGeometry args={[0.02, 0.035, 0.04, 8]} /><meshStandardMaterial color="#444" metalness={0.9} roughness={0.2} /></mesh>
      {/* Thruster exhaust glow */}
      <mesh position={[0, -0.12, 0]}><sphereGeometry args={[0.03, 8, 8]} /><meshBasicMaterial color="#ff6600" transparent opacity={0.7} /></mesh>
      <mesh position={[0, -0.15, 0]}><sphereGeometry args={[0.02, 6, 6]} /><meshBasicMaterial color="#ffaa00" transparent opacity={0.4} /></mesh>
    </group>
  );
}

/* ── Realistic Apollo CSM (Command + Service Module) ── */
function ApolloModel() {
  const plumeRef = useRef();
  useFrame((state) => {
    if (plumeRef.current) {
      const t = state.clock.elapsedTime;
      plumeRef.current.scale.y = 1 + Math.sin(t * 10) * 0.2 + Math.sin(t * 23) * 0.1;
    }
  });
  return (
    <group rotation={[0, 0, Math.PI / 2]}>
      {/* ── COMMAND MODULE — conical capsule at the top ── */}
      {/* Pointed apex */}
      <mesh position={[0, 0.11, 0]}>
        <coneGeometry args={[0.015, 0.025, 16]} />
        <meshStandardMaterial color="#d8d8d8" metalness={0.85} roughness={0.18} />
      </mesh>
      {/* Main CM cone (blunt end down) */}
      <mesh position={[0, 0.075, 0]}>
        <coneGeometry args={[0.04, 0.05, 20]} />
        <meshStandardMaterial color="#e4e4e8" metalness={0.7} roughness={0.22} />
      </mesh>
      {/* Ablative heat shield at CM base */}
      <mesh position={[0, 0.05, 0]} rotation={[Math.PI, 0, 0]}>
        <cylinderGeometry args={[0.042, 0.041, 0.008, 24]} />
        <meshStandardMaterial color="#3a3028" metalness={0.3} roughness={0.65} />
      </mesh>

      {/* ── SERVICE MODULE — cylindrical with gold foil ── */}
      <mesh position={[0, -0.01, 0]}>
        <cylinderGeometry args={[0.042, 0.042, 0.12, 24]} />
        <meshStandardMaterial color="#dcdcdc" metalness={0.9} roughness={0.14} />
      </mesh>
      {/* Gold MLI (mylar foil) panels — 4 strips around SM */}
      {[0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].map((rot, i) => (
        <mesh key={i} position={[Math.cos(rot) * 0.043, -0.01, Math.sin(rot) * 0.043]} rotation={[0, -rot, 0]}>
          <planeGeometry args={[0.035, 0.09]} />
          <meshStandardMaterial color="#d4a440" metalness={0.85} roughness={0.3} emissive="#6a4820" emissiveIntensity={0.25} side={THREE.DoubleSide} />
        </mesh>
      ))}

      {/* ── HIGH-GAIN ANTENNA — dish on an arm ── */}
      <mesh position={[0.055, 0.015, 0]} rotation={[0, 0, 0.3]}>
        <cylinderGeometry args={[0.002, 0.002, 0.04, 6]} />
        <meshStandardMaterial color="#888" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh position={[0.078, 0.025, 0]} rotation={[0, 0, 1.2]}>
        <cylinderGeometry args={[0.018, 0.002, 0.005, 16, 1, true]} />
        <meshStandardMaterial color="#e8e8e8" metalness={0.9} roughness={0.18} side={THREE.DoubleSide} />
      </mesh>

      {/* ── RCS thruster quads (4 clusters) ── */}
      {[0, Math.PI / 2, Math.PI, 3 * Math.PI / 2].map((rot, i) => (
        <mesh key={`rcs-${i}`} position={[Math.cos(rot) * 0.048, 0.04, Math.sin(rot) * 0.048]}>
          <boxGeometry args={[0.01, 0.01, 0.01]} />
          <meshStandardMaterial color="#9a9a9a" metalness={0.85} roughness={0.25} />
        </mesh>
      ))}

      {/* ── SPS MAIN ENGINE BELL ── */}
      <mesh position={[0, -0.085, 0]}>
        <cylinderGeometry args={[0.022, 0.038, 0.04, 18, 1, true]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.6} roughness={0.45} side={THREE.DoubleSide} />
      </mesh>
      {/* Engine throat */}
      <mesh position={[0, -0.075, 0]}>
        <cylinderGeometry args={[0.018, 0.022, 0.012, 14]} />
        <meshStandardMaterial color="#0a0a0a" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* ── ENGINE PLUME — pulsing blue-white exhaust ── */}
      <group ref={plumeRef} position={[0, -0.12, 0]}>
        <mesh>
          <coneGeometry args={[0.032, 0.08, 12]} />
          <meshBasicMaterial color="#8aafff" transparent opacity={0.55} toneMapped={false} />
        </mesh>
        <mesh scale={[0.7, 1.2, 0.7]}>
          <coneGeometry args={[0.026, 0.06, 12]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.85} toneMapped={false} />
        </mesh>
        {/* Shock diamonds */}
        {[0, 1, 2, 3].map(i => (
          <mesh key={`sd-${i}`} position={[0, -0.015 - i * 0.012, 0]}>
            <sphereGeometry args={[0.01 - i * 0.0015, 6, 4]} />
            <meshBasicMaterial color={i % 2 === 0 ? '#ffffee' : '#ffaa44'} transparent opacity={0.7 - i * 0.12} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* Subtle point light from engine for dramatic effect */}
      <pointLight position={[0, -0.14, 0]} intensity={0.8} color="#88aaff" distance={0.6} decay={2} />
    </group>
  );
}

/* ── Tesla Roadster in space ── */
function TeslaModel() {
  return (
    <group>
      {/* Car body */}
      <mesh position={[0, 0, 0]}><boxGeometry args={[0.12, 0.03, 0.05]} /><meshStandardMaterial color="#8b0000" metalness={0.8} roughness={0.2} /></mesh>
      {/* Roof / cabin */}
      <mesh position={[0.01, 0.022, 0]}><boxGeometry args={[0.06, 0.02, 0.045]} /><meshStandardMaterial color="#222" metalness={0.3} roughness={0.1} transparent opacity={0.7} /></mesh>
      {/* Wheels */}
      {[[-0.04, -0.015, 0.028], [-0.04, -0.015, -0.028], [0.04, -0.015, 0.028], [0.04, -0.015, -0.028]].map((p, i) => (
        <mesh key={i} position={p} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.01, 0.004, 6, 12]} /><meshStandardMaterial color="#222" metalness={0.8} roughness={0.3} /></mesh>
      ))}
      {/* Headlights glow */}
      <mesh position={[0.065, 0, 0]}><sphereGeometry args={[0.006, 6, 6]} /><meshBasicMaterial color="#ffffff" /></mesh>
    </group>
  );
}

/* ── Comet with glowing nucleus + ice tail ── */
function CometModel() {
  return (
    <group>
      {/* Nucleus — bright icy core */}
      <mesh><sphereGeometry args={[0.025, 8, 8]} /><meshStandardMaterial color="#b8e0ff" emissive="#44aaff" emissiveIntensity={2} metalness={0.1} roughness={0.3} toneMapped={false} /></mesh>
      {/* Coma — gas halo */}
      <mesh><sphereGeometry args={[0.05, 6, 6]} /><meshBasicMaterial color="#88ccff" transparent opacity={0.15} /></mesh>
      {/* Dust tail — long, curved, yellowish */}
      <mesh position={[-0.15, 0.02, 0]} rotation={[0, 0, 0.1]}>
        <coneGeometry args={[0.04, 0.3, 6]} />
        <meshBasicMaterial color="#ffe088" transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>
      {/* Ion tail — straight, blue */}
      <mesh position={[-0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.02, 0.4, 6]} />
        <meshBasicMaterial color="#4488ff" transparent opacity={0.18} side={THREE.DoubleSide} />
      </mesh>
      {/* Tail particles */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[-(0.05 + i * 0.05), (i % 2 ? 0.02 : -0.02), (i % 3 ? 0.01 : -0.01)]}>
          <sphereGeometry args={[0.005, 3, 3]} />
          <meshBasicMaterial color="#aaddff" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

const OBJECT_LABELS = { iss: 'ISS', artemis: 'Artemis III', apollo: 'Apollo', tesla: "Elon's Tesla", comet: 'Comet' };
const OBJECT_COLORS = { iss: '#88bbff', artemis: '#ff6600', apollo: '#aaaaff', tesla: '#ff4444', comet: '#44aaff' };

function SpaceObject({ type, onComplete }) {
  const ref = useRef();
  const startAngle = useMemo(() => Math.random() * Math.PI * 2, []);
  const speed = useMemo(() => 0.3 + Math.random() * 0.4, []);
  const orbitRadius = useMemo(() => 3 + Math.random() * 2, []);
  const tilt = useMemo(() => (Math.random() - 0.5) * 1.5, []);
  const elapsed = useRef(0);

  useFrame((_, delta) => {
    elapsed.current += delta;
    const t = elapsed.current * speed + startAngle;
    if (ref.current) {
      ref.current.position.set(
        Math.cos(t) * orbitRadius,
        Math.sin(t * 0.3) * tilt,
        Math.sin(t) * orbitRadius
      );
      ref.current.rotation.y = t;
    }
    if (elapsed.current > (Math.PI * 2) / speed + 2) {
      onComplete?.();
    }
  });

  const labelColor = OBJECT_COLORS[type] || '#ffffff';

  return (
    <group ref={ref}>
      {type === 'iss'     && <ISSModel />}
      {type === 'artemis' && <RocketModel color="#f0e8d8" emissiveColor="#ff6600" />}
      {type === 'apollo'  && <ApolloModel />}
      {type === 'tesla'   && <TeslaModel />}
      {type === 'comet'   && <CometModel />}
      <Html position={[0, 0.12, 0]} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
        <div style={{
          fontFamily: MONO, fontSize: 8, letterSpacing: '0.15em',
          color: labelColor, textTransform: 'uppercase',
          whiteSpace: 'nowrap', textShadow: '0 0 6px rgba(0,0,0,0.9)',
        }}>
          {OBJECT_LABELS[type] || ''}
        </div>
      </Html>
    </group>
  );
}

function CosmicEvents() {
  const [objects, setObjects] = useState([]);
  const types = ['iss', 'artemis', 'apollo', 'tesla', 'comet'];
  const nextSpawn = useRef(0);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (t > nextSpawn.current) {
      const type = types[Math.floor(Math.random() * types.length)];
      const id = `${type}_${Date.now()}`;
      setObjects(prev => [...prev, { id, type }]);
      // Random interval 20-40s
      nextSpawn.current = t + 20 + Math.random() * 20;
    }
  });

  const removeObject = useCallback((id) => {
    setObjects(prev => prev.filter(o => o.id !== id));
  }, []);

  return (
    <>
      {objects.map(o => (
        <SpaceObject key={o.id} type={o.type} onComplete={() => removeObject(o.id)} />
      ))}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   SCENE
═══════════════════════════════════════════════════════════ */
function Scene() {
  return (
    <>
      <ambientLight intensity={0.08} />
      <directionalLight position={[5, 3, 5]} intensity={1.8} color="#fff8e0" />

      <Stars radius={50} depth={30} count={1500} factor={2} saturation={0.1} fade speed={0.3} />

      <Earth />
      <CosmicEvents />

      <OrbitControls
        enableDamping dampingFactor={0.06}
        minDistance={3.5} maxDistance={10}
        autoRotate autoRotateSpeed={0.3}
        enablePan={false}
      />
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   WEATHER DATA PANEL
═══════════════════════════════════════════════════════════ */
function WeatherPanel() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=44.1598&longitude=28.6348' +
          '&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,' +
          'weather_code,apparent_temperature,uv_index,surface_pressure,cloud_cover,' +
          'precipitation,rain,showers,snowfall,wind_gusts_10m,is_day,dew_point_2m,' +
          'visibility,cape,shortwave_radiation,direct_radiation,diffuse_radiation,' +
          'direct_normal_irradiance,global_tilted_irradiance,terrestrial_radiation' +
          '&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,' +
          'precipitation_probability,precipitation,rain,showers,snowfall,snow_depth,' +
          'weather_code,surface_pressure,cloud_cover,cloud_cover_low,cloud_cover_mid,' +
          'cloud_cover_high,visibility,wind_speed_10m,wind_speed_80m,wind_speed_120m,' +
          'wind_direction_10m,wind_direction_80m,wind_gusts_10m,uv_index,uv_index_clear_sky,' +
          'cape,freezing_level_height,soil_temperature_0cm,soil_temperature_6cm,' +
          'soil_moisture_0_to_1cm,soil_moisture_1_to_3cm' +
          '&daily=temperature_2m_max,temperature_2m_min,apparent_temperature_max,' +
          'apparent_temperature_min,weather_code,sunrise,sunset,daylight_duration,' +
          'sunshine_duration,uv_index_max,uv_index_clear_sky_max,precipitation_sum,' +
          'rain_sum,showers_sum,snowfall_sum,precipitation_hours,precipitation_probability_max,' +
          'wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,' +
          'shortwave_radiation_sum,et0_fao_evapotranspiration' +
          '&timezone=Europe/Bucharest&forecast_days=7'
        );
        const data = await res.json();
        setWeather(data);
      } catch (err) {
        console.error('Weather fetch failed:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchWeather();
    const id = setInterval(fetchWeather, 300000);
    return () => clearInterval(id);
  }, []);

  const weatherDesc = (code) => {
    if (code <= 1) return 'Clear';
    if (code <= 3) return 'Partly Cloudy';
    if (code <= 48) return 'Foggy';
    if (code <= 57) return 'Drizzle';
    if (code <= 67) return 'Rain';
    if (code <= 77) return 'Snow';
    if (code <= 82) return 'Showers';
    if (code <= 86) return 'Snow Showers';
    if (code <= 99) return 'Thunderstorm';
    return 'Unknown';
  };

  const weatherIcon = (code) => {
    if (code <= 1) return '☀️';
    if (code <= 3) return '⛅';
    if (code <= 48) return '🌫️';
    if (code <= 57) return '🌧️';
    if (code <= 67) return '🌧️';
    if (code <= 77) return '❄️';
    if (code <= 86) return '🌨️';
    if (code <= 99) return '⛈️';
    return '🌡️';
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="w-3 h-3 rounded-full animate-pulse" style={{ background: '#00b4d8' }} />
        <span style={{ fontFamily: MONO, fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>Loading forecast...</span>
      </div>
    );
  }

  if (!weather?.current) return null;

  const c = weather.current;
  const daily = weather.daily;

  return (
    <div className="space-y-3">
      {/* Current weather */}
      <div className="rounded-2xl p-4" style={{
        background: 'rgba(0,180,216,0.08)', border: '1px solid rgba(0,180,216,0.2)',
        backdropFilter: 'blur(12px)',
      }}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-2xl">{weatherIcon(c.weather_code)}</span>
          <div>
            <div className="text-xl font-semibold" style={{ color: '#fff' }}>{c.temperature_2m}°C</div>
            <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
              Constanța, Romania
            </div>
          </div>
        </div>
        <div className="text-xs" style={{ color: 'rgba(255,255,255,0.6)' }}>
          {weatherDesc(c.weather_code)} · Wind {c.wind_speed_10m} km/h · Humidity {c.relative_humidity_2m}%
        </div>
      </div>

      {/* Extended overlay stats */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Feels Like', value: `${c.apparent_temperature ?? '--'}°C`, icon: '🌡️' },
          { label: 'UV Index', value: c.uv_index ?? '--', icon: '☀️' },
          { label: 'Pressure', value: `${c.surface_pressure ?? '--'} hPa`, icon: '📊' },
          { label: 'Cloud Cover', value: `${c.cloud_cover ?? '--'}%`, icon: '☁️' },
          { label: 'Precipitation', value: `${c.precipitation ?? 0} mm`, icon: '💧' },
          { label: 'Wind', value: `${c.wind_speed_10m} km/h`, icon: '💨' },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-2.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="flex items-center gap-1.5 mb-1">
              <span style={{ fontSize: 11 }}>{s.icon}</span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>{s.label}</span>
            </div>
            <div className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Hourly mini chart — next 12h temperatures */}
      {weather.hourly && (
        <div className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
            Next 12 Hours
          </div>
          <div className="flex items-end justify-between gap-1" style={{ height: 48 }}>
            {(() => {
              const now = new Date();
              const hourIdx = weather.hourly.time.findIndex(t => new Date(t) >= now);
              const slice = weather.hourly.temperature_2m.slice(Math.max(0, hourIdx), Math.max(0, hourIdx) + 12);
              const min = Math.min(...slice), max = Math.max(...slice);
              const range = max - min || 1;
              return slice.map((t, i) => (
                <div key={i} className="flex flex-col items-center gap-1" style={{ flex: 1 }}>
                  <div
                    className="rounded-sm"
                    style={{
                      width: '100%', maxWidth: 14,
                      height: Math.max(4, ((t - min) / range) * 40),
                      background: `rgba(0,180,216,${0.3 + ((t - min) / range) * 0.5})`,
                      borderRadius: 3,
                    }}
                  />
                  <span style={{ fontFamily: MONO, fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>{Math.round(t)}°</span>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* 7-day forecast */}
      {daily && (
        <div className="space-y-1">
          <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
            7-Day Forecast
          </div>
          {daily.time?.slice(0, 7).map((day, i) => (
            <div key={day} className="flex items-center justify-between py-1.5 px-2 rounded-lg"
              style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'transparent' }}>
              <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)', width: 60 }}>
                {new Date(day).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <span>{weatherIcon(daily.weather_code[i])}</span>
              <span className="text-[11px] font-mono" style={{ color: 'rgba(255,255,255,0.7)' }}>
                {Math.round(daily.temperature_2m_min[i])}° / {Math.round(daily.temperature_2m_max[i])}°
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Advanced Forecast Toggle ── */}
      <button
        onClick={() => setAdvancedOpen(o => !o)}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 10,
          background: advancedOpen ? 'rgba(0,180,216,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${advancedOpen ? 'rgba(0,180,216,0.3)' : 'rgba(255,255,255,0.06)'}`,
          color: advancedOpen ? '#00b4d8' : 'rgba(255,255,255,0.6)',
          cursor: 'pointer', fontFamily: MONO, fontSize: 9,
          letterSpacing: '0.15em', textTransform: 'uppercase',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          transition: 'all 0.2s',
        }}
      >
        {advancedOpen ? '▾' : '▸'} Advanced Data
      </button>

      {/* ── Advanced Sub-Menu ── */}
      {advancedOpen && (
        <div className="space-y-3" style={{ animation: 'appleIn 0.25s ease forwards' }}>

          {/* ── Current: Radiation & Atmosphere ── */}
          <div>
            <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(0,180,216,0.7)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
              Atmosphere & Radiation
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { l: 'Dew Point', v: `${c.dew_point_2m ?? '--'}°C` },
                { l: 'Visibility', v: c.visibility != null ? `${(c.visibility / 1000).toFixed(1)} km` : '--' },
                { l: 'CAPE', v: `${c.cape ?? '--'} J/kg` },
                { l: 'Wind Gusts', v: `${c.wind_gusts_10m ?? '--'} km/h` },
                { l: 'Wind Dir', v: `${c.wind_direction_10m ?? '--'}°` },
                { l: 'Snowfall', v: `${c.snowfall ?? 0} cm` },
                { l: 'Rain', v: `${c.rain ?? 0} mm` },
                { l: 'Showers', v: `${c.showers ?? 0} mm` },
                { l: 'SW Radiation', v: `${c.shortwave_radiation ?? '--'} W/m²` },
                { l: 'Direct Radiation', v: `${c.direct_radiation ?? '--'} W/m²` },
                { l: 'Diffuse Rad.', v: `${c.diffuse_radiation ?? '--'} W/m²` },
                { l: 'DNI', v: `${c.direct_normal_irradiance ?? '--'} W/m²` },
                { l: 'GTI', v: `${c.global_tilted_irradiance ?? '--'} W/m²` },
                { l: 'Terrestrial Rad.', v: `${c.terrestrial_radiation ?? '--'} W/m²` },
                { l: 'Is Day', v: c.is_day ? 'Yes' : 'No' },
              ].map(s => (
                <div key={s.l} className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div style={{ fontFamily: MONO, fontSize: 7, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.l}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{s.v}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Daily Extended ── */}
          {daily && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(0,180,216,0.7)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
                Daily Details (7 Day)
              </div>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10, fontFamily: MONO }}>
                  <thead>
                    <tr style={{ color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {['Day', 'Hi', 'Lo', 'Feel Hi', 'Feel Lo', 'Precip', 'Rain', 'Snow', 'Wind', 'Gust', 'UV', 'Sun hrs', 'Sunrise', 'Sunset'].map(h => (
                        <th key={h} style={{ padding: '4px 5px', textAlign: 'left', fontSize: 7, fontWeight: 500, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {daily.time?.slice(0, 7).map((day, i) => (
                      <tr key={day} style={{ color: 'rgba(255,255,255,0.7)', background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                        <td style={{ padding: '3px 5px', whiteSpace: 'nowrap' }}>{new Date(day).toLocaleDateString('en', { weekday: 'short' })}</td>
                        <td style={{ padding: '3px 5px' }}>{Math.round(daily.temperature_2m_max?.[i])}°</td>
                        <td style={{ padding: '3px 5px' }}>{Math.round(daily.temperature_2m_min?.[i])}°</td>
                        <td style={{ padding: '3px 5px' }}>{Math.round(daily.apparent_temperature_max?.[i] ?? 0)}°</td>
                        <td style={{ padding: '3px 5px' }}>{Math.round(daily.apparent_temperature_min?.[i] ?? 0)}°</td>
                        <td style={{ padding: '3px 5px' }}>{daily.precipitation_sum?.[i] ?? 0}mm</td>
                        <td style={{ padding: '3px 5px' }}>{daily.rain_sum?.[i] ?? 0}mm</td>
                        <td style={{ padding: '3px 5px' }}>{daily.snowfall_sum?.[i] ?? 0}cm</td>
                        <td style={{ padding: '3px 5px' }}>{Math.round(daily.wind_speed_10m_max?.[i] ?? 0)}</td>
                        <td style={{ padding: '3px 5px' }}>{Math.round(daily.wind_gusts_10m_max?.[i] ?? 0)}</td>
                        <td style={{ padding: '3px 5px' }}>{daily.uv_index_max?.[i] ?? 0}</td>
                        <td style={{ padding: '3px 5px' }}>{daily.sunshine_duration?.[i] ? (daily.sunshine_duration[i] / 3600).toFixed(1) : '--'}</td>
                        <td style={{ padding: '3px 5px', whiteSpace: 'nowrap' }}>{daily.sunrise?.[i]?.split('T')[1] ?? '--'}</td>
                        <td style={{ padding: '3px 5px', whiteSpace: 'nowrap' }}>{daily.sunset?.[i]?.split('T')[1] ?? '--'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Soil & Ground ── */}
          {weather.hourly?.soil_temperature_0cm && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(0,180,216,0.7)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
                Soil & Ground (Now)
              </div>
              {(() => {
                const now = new Date();
                const idx = weather.hourly.time.findIndex(t => new Date(t) >= now);
                const h = weather.hourly;
                return (
                  <div className="grid grid-cols-2 gap-1.5">
                    {[
                      { l: 'Soil Temp 0cm', v: `${h.soil_temperature_0cm?.[idx] ?? '--'}°C` },
                      { l: 'Soil Temp 6cm', v: `${h.soil_temperature_6cm?.[idx] ?? '--'}°C` },
                      { l: 'Soil Moist 0-1cm', v: `${h.soil_moisture_0_to_1cm?.[idx] ?? '--'} m³/m³` },
                      { l: 'Soil Moist 1-3cm', v: `${h.soil_moisture_1_to_3cm?.[idx] ?? '--'} m³/m³` },
                      { l: 'Freezing Level', v: `${h.freezing_level_height?.[idx] ?? '--'} m` },
                      { l: 'Snow Depth', v: `${h.snow_depth?.[idx] ?? 0} m` },
                      { l: 'Cloud Low', v: `${h.cloud_cover_low?.[idx] ?? '--'}%` },
                      { l: 'Cloud Mid', v: `${h.cloud_cover_mid?.[idx] ?? '--'}%` },
                      { l: 'Cloud High', v: `${h.cloud_cover_high?.[idx] ?? '--'}%` },
                      { l: 'UV Clear Sky', v: h.uv_index_clear_sky?.[idx] ?? '--' },
                    ].map(s => (
                      <div key={s.l} className="rounded-lg px-2 py-1.5" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div style={{ fontFamily: MONO, fontSize: 7, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>{s.l}</div>
                        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 500 }}>{s.v}</div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ── Multi-Altitude Wind ── */}
          {weather.hourly?.wind_speed_80m && (
            <div>
              <div style={{ fontFamily: MONO, fontSize: 8, color: 'rgba(0,180,216,0.7)', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6 }}>
                Multi-Altitude Wind (Now)
              </div>
              {(() => {
                const now = new Date();
                const idx = weather.hourly.time.findIndex(t => new Date(t) >= now);
                const h = weather.hourly;
                return (
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { l: '10m', speed: h.wind_speed_10m?.[idx], dir: h.wind_direction_10m?.[idx] },
                      { l: '80m', speed: h.wind_speed_80m?.[idx], dir: h.wind_direction_80m?.[idx] },
                      { l: '120m', speed: h.wind_speed_120m?.[idx], dir: null },
                    ].map(w => (
                      <div key={w.l} className="rounded-lg px-2 py-2 text-center" style={{ background: 'rgba(255,255,255,0.03)' }}>
                        <div style={{ fontFamily: MONO, fontSize: 7, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase' }}>{w.l}</div>
                        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', fontWeight: 600 }}>{Math.round(w.speed ?? 0)} km/h</div>
                        {w.dir != null && <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{w.dir}°</div>}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          )}

        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   WEATHER HUB — main export
═══════════════════════════════════════════════════════════ */
export default function WeatherHub({ onBack }) {
  const [panelOpen, setPanelOpen] = useState(true);
  const [voiceQuery, setVoiceQuery] = useState('');

  const handleVoice = useCallback((text) => {
    setVoiceQuery(text);
    setTimeout(() => setVoiceQuery(''), 5000);
    // User can say "weather in Paris" / "forecast for tomorrow" etc.
    // Emit event so nested WeatherPanel can react if needed.
    window.dispatchEvent(new CustomEvent('sky:voice-query', { detail: { text } }));
  }, []);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', overflow: 'hidden' }}>
      {/* 3D Canvas */}
      <Canvas
        dpr={[1, 1.25]}
        camera={{ position: [0, 1, 6], fov: 45 }}
        gl={{
          antialias: false, powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2,
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: false,
        }}
        performance={{ min: 0.5 }}
        resize={{ debounce: 100, scroll: false }}
      >
        <Scene />
      </Canvas>

      {/* Top bar */}
      <div className="sky-topbar" style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: 'max(16px, env(safe-area-inset-top, 16px)) 16px 12px',
        pointerEvents: 'none',
      }}>
        <button
          onClick={onBack}
          style={{
            pointerEvents: 'auto', fontFamily: MONO, fontSize: 10,
            letterSpacing: '0.2em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10,
            padding: '8px 14px', cursor: 'pointer',
          }}
        >
          ← Menu
        </button>

        <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.22em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
          SKY · EARTH
        </div>

        <button
          onClick={() => setPanelOpen(v => !v)}
          style={{
            pointerEvents: 'auto', fontFamily: MONO, fontSize: 10,
            letterSpacing: '0.16em', textTransform: 'uppercase',
            color: panelOpen ? '#00b4d8' : 'rgba(255,255,255,0.5)',
            background: 'rgba(0,0,0,0.35)',
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            border: `1px solid ${panelOpen ? 'rgba(0,180,216,0.3)' : 'rgba(255,255,255,0.12)'}`,
            borderRadius: 10, padding: '8px 14px', cursor: 'pointer',
          }}
        >
          {panelOpen ? 'Hide' : 'Forecast'}
        </button>
      </div>

      {/* Weather side panel */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div
            initial={{ x: 320, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 320, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 28 }}
            className="sky-weather-panel"
            style={{
              position: 'absolute', top: 70, right: 16, bottom: 16,
              width: 300, zIndex: 20,
              background: 'rgba(8,12,20,0.75)',
              backdropFilter: 'blur(20px) saturate(150%)',
              WebkitBackdropFilter: 'blur(20px) saturate(150%)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 16, padding: 16,
              overflowY: 'auto',
            }}
          >
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 12 }}>
              Current Conditions
            </div>
            <WeatherPanel />

            <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ fontFamily: MONO, fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em' }}>
                Data: Open-Meteo API · FourCastNet
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom hint */}
      <div className="sky-bottom-hint" style={{
        position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
        fontFamily: MONO, fontSize: 9, letterSpacing: '0.2em',
        color: 'rgba(255,255,255,0.2)', textTransform: 'uppercase',
        pointerEvents: 'none',
      }}>
        drag to rotate · scroll to zoom · tap mic to ask sky
      </div>

      {/* Voice query flash banner */}
      <AnimatePresence>
        {voiceQuery && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              position: 'absolute', top: 80, left: '50%', transform: 'translateX(-50%)',
              background: 'rgba(0,180,216,0.2)', border: '1px solid rgba(0,180,216,0.4)',
              borderRadius: 12, padding: '10px 18px',
              color: '#fff', fontSize: 13, maxWidth: 480, textAlign: 'center',
              backdropFilter: 'blur(12px)',
            }}
          >
            {voiceQuery}
          </motion.div>
        )}
      </AnimatePresence>

      <VoiceOrb agent="sky" onTranscript={handleVoice} />
    </div>
  );
}

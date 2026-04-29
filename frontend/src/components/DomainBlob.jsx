/**
 * DomainBlob — procedural GLSL noise sphere per domain.
 * Renders a living, animated organic orb in a small Three.js canvas.
 * Domain configs drive colors, displacement frequency/amplitude, and speed.
 */
import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/* ── Domain visual configs ─────────────────────────────────────── */
const DOMAIN_CONFIGS = {
  image_gen: {
    col1: '#e040fb', col2: '#ab47bc', col3: '#f48fb1',
    freq: 2.6, amp: 0.35, speed: 0.50, roughness: 0.45,
  },
  translation: {
    col1: '#00b8ff', col2: '#0057b8', col3: '#00e5ff',
    freq: 2.0, amp: 0.28, speed: 0.45, roughness: 0.40,
  },
  general_ai: {
    col1: '#00cc66', col2: '#00994d', col3: '#66ff99',
    freq: 2.2, amp: 0.30, speed: 0.55, roughness: 0.50,
  },
  general: {
    col1: '#8e8e93', col2: '#c7c7cc', col3: '#636366',
    freq: 1.0, amp: 0.14, speed: 0.20, roughness: 0.30,
  },
};

/* ── GLSL noise utils ──────────────────────────────────────────── */
const NOISE_GLSL = /* glsl */`
  vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g  = step(x0.yzx, x0.xyz);
    vec3 l  = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute( permute( permute(
             i.z + vec4(0.0, i1.z, i2.z, 1.0))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0))
           + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`;

const vertexShader = /* glsl */`
  ${NOISE_GLSL}
  uniform float uTime;
  uniform float uFreq;
  uniform float uAmp;
  varying vec3 vNormal;
  varying float vNoise;

  void main() {
    vNormal = normal;
    float n = snoise(normal * uFreq + uTime * 0.8);
    float n2 = snoise(normal * uFreq * 1.8 + uTime * 0.5 + 3.14);
    vNoise = n * 0.6 + n2 * 0.4;
    vec3 displaced = position + normal * vNoise * uAmp;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
  }
`;

const fragmentShader = /* glsl */`
  uniform vec3 uCol1;
  uniform vec3 uCol2;
  uniform vec3 uCol3;
  uniform float uTime;
  varying vec3 vNormal;
  varying float vNoise;

  void main() {
    float t = vNoise * 0.5 + 0.5;
    float t2 = abs(vNormal.y);
    vec3 col = mix(uCol1, uCol2, t);
    col = mix(col, uCol3, t2 * 0.35);
    // Fresnel rim
    float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.5);
    col = col + rim * uCol2 * 0.6;
    // subtle emissive highlight
    float bright = 0.5 + t * 0.5;
    gl_FragColor = vec4(col * bright, 0.92);
  }
`;

/* ── Inner blob mesh ──────────────────────────────────────────── */
function BlobMesh({ cfg }) {
  const meshRef  = useRef();
  const uniforms = useMemo(() => ({
    uTime:  { value: 0 },
    uFreq:  { value: cfg.freq },
    uAmp:   { value: cfg.amp },
    uCol1:  { value: new THREE.Color(cfg.col1) },
    uCol2:  { value: new THREE.Color(cfg.col2) },
    uCol3:  { value: new THREE.Color(cfg.col3) },
  }), [cfg]);

  useFrame((state) => {
    uniforms.uTime.value = state.clock.elapsedTime * cfg.speed;
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.003;
      meshRef.current.rotation.x += 0.001;
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[1, 32]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        transparent
        side={THREE.FrontSide}
      />
    </mesh>
  );
}

/* ── Public component ─────────────────────────────────────────── */
export default function DomainBlob({ domain = 'general', size = 220, className = '' }) {
  const cfg = DOMAIN_CONFIGS[domain] || DOMAIN_CONFIGS.general;
  return (
    <div
      className={className}
      style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 2.4], fov: 55 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.3} />
        <pointLight position={[3, 3, 3]} intensity={2.5} color={cfg.col2} />
        <pointLight position={[-3, -2, 2]} intensity={1.8} color={cfg.col1} />
        <BlobMesh cfg={cfg} key={domain} />
      </Canvas>
    </div>
  );
}

export { DOMAIN_CONFIGS };

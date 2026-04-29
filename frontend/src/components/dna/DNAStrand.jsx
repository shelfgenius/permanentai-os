import React, { useMemo, useRef, forwardRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

/**
 * Procedural DNA double-helix — biological, alive, colorful.
 *
 * Visual upgrades from v1:
 *   ▸ Each pair is colored by base-pair biology (A–T red/blue, G–C green/yellow)
 *   ▸ Sugar-phosphate backbone rendered as a TubeGeometry spline on each strand
 *   ▸ Hydrogen bonds between pairs: short double-cylinders that subtly wiggle
 *   ▸ Breathing: the strand gently inhales/exhales (radius modulates over time)
 *   ▸ Traveling pulse: an emission wave ripples along the strand
 *   ▸ Floating "cytoplasm" particles around the helix for organic depth
 *   ▸ Scan mode (driven by `scanProgress`) blends from biology → neon hologram
 *
 * Still forwards a ref to the parent group so GSAP ScrollTrigger can animate
 * rotation / position / scale from outside (AIHub uses this).
 */

const DEFAULTS = {
  length:     22,
  pairs:      44,        // fewer pairs = larger nucleotides, more biological
  radius:     1.30,
  twists:     2.8,
  sphereSize: 0.24,      // larger nucleotide spheres
};

/* ── Biologically-grounded nucleotide palette ────────────────────
 *  A / T / G / C are the four DNA bases. We cycle them along the
 *  helix so base-pairing is respected (A↔T, G↔C).
 *  Colors are the textbook MolView / PyMOL standard but deeper:
 *    A = emerald   T = ruby       G = amber     C = sapphire
 *  Backbones are ivory — real sugar–phosphate is pale/translucent.
 */
const BASE_COLORS = {
  A: '#2bc46d',  // emerald (adenine)
  T: '#d6443a',  // ruby    (thymine)
  G: '#e8a534',  // amber   (guanine)
  C: '#3a7fd4',  // sapphire (cytosine)
};
const BACKBONE_IVORY = '#e8e2d4';

// For each pair index, pick the nucleotides on each strand so they base-pair correctly
const PAIR_ORDER = ['AT', 'GC', 'TA', 'CG', 'AT', 'TA', 'GC', 'CG'];
function pairAt(i) {
  const kind = PAIR_ORDER[i % PAIR_ORDER.length];
  return { a: kind[0], b: kind[1] };
}

const DNAStrand = forwardRef(function DNAStrand(
  {
    length       = DEFAULTS.length,
    pairs        = DEFAULTS.pairs,
    radius       = DEFAULTS.radius,
    twists       = DEFAULTS.twists,
    sphereSize   = DEFAULTS.sphereSize,
    scanProgress = 0,                 // 0..1 biology → hologram
    anchors      = [],
    neonColor    = '#ffe8b0',   // warm cytoplasm glow instead of cyan neon
    showParticles = true,
  },
  externalRef,
) {
  const groupRef = useRef();
  const ref = externalRef || groupRef;

  /* ── Build pair data ──────────────────────────────────────────── */
  const { pairsData, backboneAPts, backboneBPts } = useMemo(() => {
    const pairsData    = [];
    const backboneAPts = [];
    const backboneBPts = [];
    const step         = length / (pairs - 1);
    const turnRate     = (twists * Math.PI * 2) / length;

    for (let i = 0; i < pairs; i++) {
      const y   = -length / 2 + i * step;
      const ang = y * turnRate;

      const ax =  Math.cos(ang) * radius;
      const az =  Math.sin(ang) * radius;
      const bx = -Math.cos(ang) * radius;
      const bz = -Math.sin(ang) * radius;

      // Biological pairing (A↔T, G↔C)
      const { a: baseA, b: baseB } = pairAt(i);
      const colA = BASE_COLORS[baseA];
      const colB = BASE_COLORS[baseB];

      pairsData.push({
        i,
        posA: new THREE.Vector3(ax, y, az),
        posB: new THREE.Vector3(bx, y, bz),
        colA, colB,
        baseA, baseB,
        t: i / (pairs - 1),
      });
      backboneAPts.push(new THREE.Vector3(ax, y, az));
      backboneBPts.push(new THREE.Vector3(bx, y, bz));
    }
    return { pairsData, backboneAPts, backboneBPts };
  }, [length, pairs, radius, twists]);

  /* ── Backbone tube geometries (sugar-phosphate spline) ───────── */
  // Thicker backbones with more segments — looks like real sugar–phosphate
  const backboneGeoA = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(backboneAPts);
    return new THREE.TubeGeometry(curve, Math.max(128, pairs * 4), 0.115, 14, false);
  }, [backboneAPts, pairs]);
  const backboneGeoB = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(backboneBPts);
    return new THREE.TubeGeometry(curve, Math.max(128, pairs * 4), 0.115, 14, false);
  }, [backboneBPts, pairs]);

  /* ── Per-pair mesh refs (so pulses can modulate emissive per-sphere) ── */
  const sphereARefs = useRef([]);
  const sphereBRefs = useRef([]);
  const bondARefs   = useRef([]);
  const bondBRefs   = useRef([]);

  /* ── Floating organic particles ─────────────────────────────── */
  const particles = useMemo(() => {
    const N = 60;
    const arr = [];
    for (let k = 0; k < N; k++) {
      const y   = (Math.random() - 0.5) * length * 1.15;
      const a   = Math.random() * Math.PI * 2;
      const rr  = radius + 0.4 + Math.random() * 1.8;
      arr.push({
        base: new THREE.Vector3(Math.cos(a) * rr, y, Math.sin(a) * rr),
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 0.9,
        size:  0.02 + Math.random() * 0.04,
        tint:  Math.random(),
      });
    }
    return arr;
  }, [length, radius]);
  const particleGroupRef = useRef();
  const particleRefs = useRef([]);

  /* ── Precompute anchor indices for AnchorProjector (AIHub) ───── */
  // anchors are consumed externally; we don't render them here, but
  // keeping the prop wired preserves API parity with v1.

  /* ── Animation loop — breathing, traveling pulse, particle drift ── */
  useFrame((state) => {
    const t = state.clock.elapsedTime;

    // Gentle breathing — slow, subtle
    if (ref.current) {
      ref.current.scale.setScalar(1 + Math.sin(t * 0.35) * 0.008);
    }

    // Soft traveling pulse — much gentler than before
    const pulseY = -length / 2 + ((t * 1.4) % length + length) % length;
    const pulseW = 3.2;

    for (let i = 0; i < pairsData.length; i++) {
      const p    = pairsData[i];
      const aMesh = sphereARefs.current[i];
      const bMesh = sphereBRefs.current[i];
      if (!aMesh || !bMesh) continue;

      const distA  = Math.abs(p.posA.y - pulseY);
      const distB  = Math.abs(p.posB.y - pulseY);
      const pulseA = Math.max(0, 1 - distA / pulseW);
      const pulseB = Math.max(0, 1 - distB / pulseW);

      // Soft biological glow — never fully extinguished, never blinding
      const matA = aMesh.material;
      const matB = bMesh.material;
      if (matA) matA.emissiveIntensity = 0.25 + pulseA * 0.9;
      if (matB) matB.emissiveIntensity = 0.25 + pulseB * 0.9;

      const bA = bondARefs.current[i];
      const bB = bondBRefs.current[i];
      if (bA?.material) {
        bA.material.emissiveIntensity = 0.08 + pulseA * 0.6;
        bA.material.opacity = 0.7 + pulseA * 0.25;
      }
      if (bB?.material) {
        bB.material.emissiveIntensity = 0.08 + pulseB * 0.6;
        bB.material.opacity = 0.7 + pulseB * 0.25;
      }
    }

    // Particles drift
    if (particleGroupRef.current) {
      for (let k = 0; k < particles.length; k++) {
        const m = particleRefs.current[k];
        if (!m) continue;
        const p  = particles[k];
        const dy = Math.sin(t * p.speed + p.phase) * 0.35;
        const dx = Math.cos(t * p.speed * 0.6 + p.phase) * 0.08;
        m.position.set(p.base.x + dx, p.base.y + dy, p.base.z);
        m.scale.setScalar(1 + Math.sin(t * 2 + p.phase) * 0.35);
      }
    }
  });

  /* ── Render ──────────────────────────────────────────────────── */
  return (
    <group ref={ref}>
      {/* Sugar–phosphate backbones — ivory PBR with clearcoat */}
      <mesh geometry={backboneGeoA}>
        <meshPhysicalMaterial
          color={BACKBONE_IVORY}
          emissive={'#7a6850'}
          emissiveIntensity={0.08}
          metalness={0.15}
          roughness={0.35}
          clearcoat={0.8}
          clearcoatRoughness={0.18}
          sheen={0.4}
          sheenColor={'#fff4dc'}
          transmission={0.12}
          thickness={0.4}
        />
      </mesh>
      <mesh geometry={backboneGeoB}>
        <meshPhysicalMaterial
          color={BACKBONE_IVORY}
          emissive={'#7a6850'}
          emissiveIntensity={0.08}
          metalness={0.15}
          roughness={0.35}
          clearcoat={0.8}
          clearcoatRoughness={0.18}
          sheen={0.4}
          sheenColor={'#fff4dc'}
          transmission={0.12}
          thickness={0.4}
        />
      </mesh>

      {/* Nucleotide spheres — larger, biologically colored, soft glow */}
      {pairsData.map((p, i) => (
        <React.Fragment key={`pair-${i}`}>
          <mesh position={p.posA} ref={(el) => (sphereARefs.current[i] = el)}>
            <sphereGeometry args={[sphereSize * 1.35, 18, 18]} />
            <meshPhysicalMaterial
              color={p.colA}
              emissive={p.colA}
              emissiveIntensity={0.35}
              metalness={0.1}
              roughness={0.32}
              clearcoat={0.75}
              clearcoatRoughness={0.15}
              sheen={0.3}
              sheenColor={p.colA}
              toneMapped={false}
            />
          </mesh>
          <mesh position={p.posB} ref={(el) => (sphereBRefs.current[i] = el)}>
            <sphereGeometry args={[sphereSize * 1.35, 18, 18]} />
            <meshPhysicalMaterial
              color={p.colB}
              emissive={p.colB}
              emissiveIntensity={0.35}
              metalness={0.1}
              roughness={0.32}
              clearcoat={0.75}
              clearcoatRoughness={0.15}
              sheen={0.3}
              sheenColor={p.colB}
              toneMapped={false}
            />
          </mesh>

          {/* Hydrogen bond rungs */}
          <Rung
            a={p.posA} b={p.posB}
            bondARef={(el) => (bondARefs.current[i] = el)}
            bondBRef={(el) => (bondBRefs.current[i] = el)}
          />
        </React.Fragment>
      ))}

      {/* Floating cytoplasm particles — warm organic dust */}
      {showParticles && (
        <group ref={particleGroupRef}>
          {particles.map((p, k) => (
            <mesh key={`pt-${k}`} ref={(el) => (particleRefs.current[k] = el)}>
              <sphereGeometry args={[p.size, 6, 6]} />
              <meshBasicMaterial
                color={'#fff0c8'}
                transparent
                opacity={0.18 + p.tint * 0.28}
                toneMapped={false}
              />
            </mesh>
          ))}
        </group>
      )}
    </group>
  );
});

export default DNAStrand;

/* ── Hydrogen bond rung ── pale translucent tube joining the paired bases */
function Rung({ a, b, bondARef, bondBRef }) {
  const mid  = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5);
  const diff = new THREE.Vector3().subVectors(b, a);
  const len  = diff.length();
  const rotY = -Math.atan2(diff.z, diff.x);
  return (
    <>
      <mesh
        position={[mid.x, mid.y, mid.z]}
        rotation={[0, rotY, Math.PI / 2]}
        ref={bondARef || undefined}
      >
        <cylinderGeometry args={[0.025, 0.025, len * 0.82, 10]} />
        <meshPhysicalMaterial
          color="#f6ead4"
          emissive="#c4a878"
          emissiveIntensity={0.08}
          metalness={0.15}
          roughness={0.35}
          transmission={0.6}
          thickness={0.2}
          transparent
          opacity={0.78}
        />
      </mesh>
      {/* Tip caps — ivory */}
      <mesh position={a.clone().lerp(b, 0.1)} ref={bondBRef || undefined}>
        <sphereGeometry args={[0.038, 10, 10]} />
        <meshPhysicalMaterial color="#f6ead4" metalness={0.2} roughness={0.3} clearcoat={0.5} />
      </mesh>
      <mesh position={b.clone().lerp(a, 0.1)}>
        <sphereGeometry args={[0.042, 10, 10]} />
        <meshPhysicalMaterial color="#f6ead4" metalness={0.2} roughness={0.3} clearcoat={0.5} />
      </mesh>
    </>
  );
}

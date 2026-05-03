import React, { useRef, useState, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import DNAStrand from './DNAStrand.jsx';

const IS_MOBILE = typeof window !== 'undefined' && (window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));

/**
 * DNAScene — fixed full-viewport Three.js canvas with moody lighting
 * and a procedural DNA double-helix.
 *
 * Parent controls the rotation / vertical position / scan material blend
 * via `dnaProgress` (0..1) — mapped externally from page scroll.
 *
 * Anchors (categories) positions are reported back via `onAnchorsUpdate`
 * so HTML overlays can project themselves next to the right base pair.
 */

export default function DNAScene({
  dnaProgress   = 0,           // 0..1 from scroll
  anchors       = [],           // domain anchors
  onAnchorsUpdate,              // cb(anchorsScreen)
  rotations     = 2.4,          // total Y-axis turns over full scroll
  floatRange    = 3.5,          // world-units vertical travel over full scroll
  zoomStart     = 11,           // camera distance at progress=0
  zoomEnd       = 7.5,          // camera distance at progress=1
}) {
  const groupRef = useRef();

  // Update DNA transform each animation frame based on progress
  const handleFrame = useCallback((state) => {
    if (!groupRef.current) return;

    const p = dnaProgress;
    // Y-rotation over entire scroll
    groupRef.current.rotation.y = p * rotations * Math.PI * 2;
    // slight X tilt for drama
    groupRef.current.rotation.x = Math.sin(p * Math.PI) * 0.15;
    // vertical float: moves up as we scroll
    groupRef.current.position.y = p * floatRange;

    // camera dolly-in (scanning closeup)
    const targetZ = zoomStart + (zoomEnd - zoomStart) * p;
    state.camera.position.z += (targetZ - state.camera.position.z) * 0.08;
    state.camera.lookAt(0, groupRef.current.position.y, 0);
  }, [dnaProgress, rotations, floatRange, zoomStart, zoomEnd]);

  // scanProgress: starts ramping after section 1→2 transition (≈33%) and
  // fully completes around 66% scroll for the "data analysis" phase
  const scanProgress = Math.min(1, Math.max(0, (dnaProgress - 0.33) / 0.33));

  return (
    <div
      style={{
        position: 'sticky', top: 0, left: 0,
        width: '100%', height: '100dvh',
        zIndex: 0, marginBottom: '-100dvh',  // pulls subsequent content up so it overlaps
        pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, #0a0e18 0%, #03050b 65%, #000 100%)',
      }}
    >
      <Canvas
        dpr={[1, 1]}
        camera={{ position: [0, 0, zoomStart], fov: 42 }}
        gl={{
          antialias: false, alpha: false, powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.1,
          failIfMajorPerformanceCaveat: false,
          preserveDrawingBuffer: false,
        }}
        performance={{ min: 0.3 }}
        resize={{ debounce: 200, scroll: false }}
      >
        <color attach="background" args={['#020408']} />
        {/* Deep space fog — fades strand ends into darkness */}
        <fog attach="fog" args={['#020408', 10, 30]} />

        {/* Microscope-style lighting — warm key, cool fill, rim */}
        <ambientLight intensity={0.25} color="#1c2030" />
        {/* Warm key from upper right — incandescent bulb feel */}
        <pointLight position={[7, 5, 6]}   intensity={2.6} color="#ffd098" distance={30} decay={1.6} />
        {/* Cool fill from lower left — fluorescent microscope base */}
        <pointLight position={[-7, -4, 5]} intensity={1.8} color="#a8c4ff" distance={28} decay={1.7} />
        {/* Subtle rim from behind — defines the silhouette */}
        <pointLight position={[0, 2, -8]}  intensity={1.2} color="#e8d4b8" distance={24} decay={1.9} />
        {/* Gentle under-glow */}
        <pointLight position={[0, -6, 3]}  intensity={0.8} color="#ffcf9a" distance={20} decay={2.0} />

        <FrameDriver onFrame={handleFrame} />

        <DNAStrand
          ref={groupRef}
          scanProgress={scanProgress}
          anchors={anchors}
          onAnchorUpdate={() => { if (!onAnchorsUpdate) return; }}
        />

        <AnchorProjector
          groupRef={groupRef}
          anchors={anchors}
          onAnchorsUpdate={onAnchorsUpdate}
        />

        {/* Subtle bloom — disabled on mobile for performance */}
        {!IS_MOBILE && (
          <EffectComposer multisampling={0}>
            <Bloom
              luminanceThreshold={0.5}
              luminanceSmoothing={0.9}
              intensity={0.35}
              radius={0.4}
              mipmapBlur
            />
          </EffectComposer>
        )}
      </Canvas>
    </div>
  );
}

/* ───── helpers ───── */

import { useFrame, useThree } from '@react-three/fiber';

function FrameDriver({ onFrame }) {
  useFrame((state) => onFrame(state));
  return null;
}

/** Projects each anchor's base-pair world position into screen % each frame */
function AnchorProjector({ groupRef, anchors, onAnchorsUpdate }) {
  const { camera, size } = useThree();
  const tmp = useRef(new THREE.Vector3()).current;
  const step = useRef(0);

  useFrame(() => {
    if (!onAnchorsUpdate || !groupRef.current || anchors.length === 0) return;
    // throttle to every 3rd frame for performance
    step.current = (step.current + 1) % 3;
    if (step.current !== 0) return;

    const out = [];
    // compute world position for each anchor's pair index
    // DNAStrand lays out spheres with y in [-length/2, length/2] and strand A at cos/sin
    const { length = 22, pairs = 52, radius = 1.25, twists = 3.2 } = getStrandParams();
    const turnRate = (twists * Math.PI * 2) / length;

    for (const a of anchors) {
      const i = Math.min(pairs - 1, Math.max(0, Math.round(a.t * (pairs - 1))));
      const yLocal = -length / 2 + i * (length / (pairs - 1));
      const ang    = yLocal * turnRate;
      const sign   = a.strand === 'b' ? -1 : 1;
      tmp.set(Math.cos(ang) * radius * sign, yLocal, Math.sin(ang) * radius * sign);
      tmp.applyMatrix4(groupRef.current.matrixWorld);
      // project to NDC then to CSS pixels
      tmp.project(camera);
      const x = (tmp.x * 0.5 + 0.5) * size.width;
      const y = (-tmp.y * 0.5 + 0.5) * size.height;
      const behind = tmp.z > 1; // rough: treat >1 as out of frustum
      out.push({ id: a.id, x, y, behind, z: tmp.z });
    }
    onAnchorsUpdate(out);
  });
  return null;
}

// shared defaults (kept in sync with DNAStrand)
function getStrandParams() {
  return { length: 22, pairs: 52, radius: 1.25, twists: 3.2 };
}

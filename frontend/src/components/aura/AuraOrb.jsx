import { useRef, useMemo, useEffect, useState } from 'react';
import { useFrame, Canvas } from '@react-three/fiber';
import { Environment } from '@react-three/drei';
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import * as THREE from 'three';
import { vertexShader, fragmentShader } from './shaders';

const SPHERE_R = 2;
const IS_MOBILE = typeof window !== 'undefined' && (window.innerWidth < 768 || /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent));
const GEO_DETAIL = IS_MOBILE ? 24 : 64;

function OrbMesh({ audioData, orbState }) {
  const meshRef = useRef(null);
  const materialRef = useRef(null);
  const basePositionsRef = useRef(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uAmplitude: { value: 1.0 },
    uFrequency: { value: 1.0 },
    uColorSilver: { value: new THREE.Color('#C0C0C0') },
    uColorBronze: { value: new THREE.Color('#B87333') },
    uStateBlend: { value: 0.0 },
    uPulseIntensity: { value: 0.3 },
    uDeformStrength: { value: 0.15 },
    uGlowStrength: { value: 0.5 },
  }), []);

  useEffect(() => {
    if (meshRef.current && !basePositionsRef.current) {
      const posAttr = meshRef.current.geometry.attributes.position;
      basePositionsRef.current = new Float32Array(posAttr.array);
    }
  }, []);

  useFrame((state) => {
    if (!materialRef.current) return;
    const mat = materialRef.current;
    mat.uniforms.uTime.value = state.clock.elapsedTime;

    let targetBlend = 0, targetPulse = 0.2, targetDeform = 0.1, targetGlow = 0.4, targetFreq = 0.8;

    switch (orbState) {
      case 'listening': {
        // Gentle breathing with subtle audio reactivity — NOT wild deformation
        const avg = audioData.length > 0 ? audioData.reduce((a, b) => a + b, 0) / audioData.length / 255 : 0;
        targetBlend = 0.5; targetPulse = 0.25 + avg * 0.15; targetDeform = 0.06 + avg * 0.06;
        targetGlow = 0.45 + avg * 0.15; targetFreq = 0.9; break;
      }
      case 'thinking':
        targetBlend = 1; targetPulse = 0.5; targetDeform = 0.15; targetGlow = 0.6; targetFreq = 1.5; break;
      case 'speaking': {
        // Moderate audio-reactive — capped to avoid violent deformation
        const avg = audioData.length > 0 ? audioData.reduce((a, b) => a + b, 0) / audioData.length / 255 : 0;
        const clamped = Math.min(avg, 0.6);
        targetBlend = 1; targetPulse = 0.3 + clamped * 0.35; targetDeform = 0.1 + clamped * 0.15;
        targetGlow = 0.5 + clamped * 0.3; targetFreq = 1.0 + clamped * 1.0; break;
      }
      case 'working':
        targetBlend = 1; targetPulse = 0.4; targetDeform = 0.12; targetGlow = 0.5; targetFreq = 1.2; break;
      default: break;
    }

    // Slower lerp (0.03) for smoother, non-jarring transitions
    mat.uniforms.uStateBlend.value = THREE.MathUtils.lerp(mat.uniforms.uStateBlend.value, targetBlend, 0.03);
    mat.uniforms.uPulseIntensity.value = THREE.MathUtils.lerp(mat.uniforms.uPulseIntensity.value, targetPulse, 0.03);
    mat.uniforms.uDeformStrength.value = THREE.MathUtils.lerp(mat.uniforms.uDeformStrength.value, targetDeform, 0.03);
    mat.uniforms.uGlowStrength.value = THREE.MathUtils.lerp(mat.uniforms.uGlowStrength.value, targetGlow, 0.03);
    mat.uniforms.uFrequency.value = THREE.MathUtils.lerp(mat.uniforms.uFrequency.value, targetFreq, 0.03);

    if (meshRef.current && basePositionsRef.current) {
      const geometry = meshRef.current.geometry;
      const positionAttr = geometry.attributes.position;
      const positions = positionAttr.array;
      const basePositions = basePositionsRef.current;
      const freqData = Array.from(audioData);
      const numFreqBins = Math.min(freqData.length, 128);
      const deformStrength = mat.uniforms.uDeformStrength.value;

      for (let i = 0; i < positions.length / 3; i++) {
        const idx = i * 3;
        const bx = basePositions[idx], by = basePositions[idx + 1], bz = basePositions[idx + 2];
        const len = Math.sqrt(bx * bx + by * by + bz * bz);
        const nx = bx / len, ny = by / len, nz = bz / len;

        if ((orbState === 'speaking' || orbState === 'listening') && numFreqBins > 0) {
          const theta = Math.atan2(ny, nx);
          const freqIdx = Math.floor(((theta + Math.PI) / (2 * Math.PI)) * numFreqBins) % numFreqBins;
          const rawAmplitude = freqData[freqIdx] / 255;
          // Clamp amplitude to prevent vertices from flying apart
          const amplitude = Math.min(rawAmplitude, 0.5) * (orbState === 'listening' ? 0.3 : 0.6);
          const noiseVal = Math.sin(nx * 2 + state.clock.elapsedTime * 0.3) * Math.cos(ny * 2) * Math.sin(nz * 2 + state.clock.elapsedTime * 0.2);
          const displacement = amplitude * deformStrength * (1.0 + noiseVal * 0.3);
          const newRadius = SPHERE_R * (1.0 + displacement);
          positions[idx] = nx * newRadius; positions[idx + 1] = ny * newRadius; positions[idx + 2] = nz * newRadius;
        } else {
          const breath = Math.sin(state.clock.elapsedTime * 1.5) * 0.02 * deformStrength;
          const newRadius = SPHERE_R * (1.0 + breath);
          positions[idx] = nx * newRadius; positions[idx + 1] = ny * newRadius; positions[idx + 2] = nz * newRadius;
        }
      }
      positionAttr.needsUpdate = true;
      geometry.computeVertexNormals();
    }
  });

  return (
    <mesh ref={meshRef}>
      <icosahedronGeometry args={[SPHERE_R, GEO_DETAIL]} />
      <shaderMaterial ref={materialRef} vertexShader={vertexShader} fragmentShader={fragmentShader} uniforms={uniforms} transparent />
    </mesh>
  );
}

export default function AuraOrbCanvas({ audioData, orbState }) {
  const [contextLost, setContextLost] = useState(false);
  const camZ = IS_MOBILE ? 8 : 6;

  // Handle WebGL context loss gracefully
  const onCreated = ({ gl }) => {
    const canvas = gl.domElement;
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      setContextLost(true);
    });
    canvas.addEventListener('webglcontextrestored', () => setContextLost(false));
  };

  if (contextLost) {
    return (
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(184,115,51,0.15), transparent)', animation: 'edgeBreathe 4s ease-in-out infinite' }} />
      </div>
    );
  }

  return (
    <Canvas
      camera={{ position: [0, 0, camZ], fov: 45, near: 0.1, far: 100 }}
      style={{ position: 'absolute', inset: 0, zIndex: 1 }}
      dpr={IS_MOBILE ? [1, 1.5] : [1, 2]}
      gl={{ antialias: !IS_MOBILE, alpha: true, powerPreference: IS_MOBILE ? 'low-power' : 'high-performance' }}
      onCreated={onCreated}
    >
      <ambientLight intensity={0.4} color="#FFFFFF" />
      <directionalLight position={[5, 5, 5]} intensity={1.5} color="#FFF5EB" />
      {!IS_MOBILE && <directionalLight position={[-3, 2, -3]} intensity={0.6} color="#E8F0FF" />}
      {!IS_MOBILE && <directionalLight position={[0, -5, 2]} intensity={0.4} color="#B87333" />}
      <pointLight position={[2, 3, 2]} intensity={0.8} color="#CD7F32" distance={20} />
      <OrbMesh audioData={audioData} orbState={orbState} />
      {!IS_MOBILE && <Environment preset="studio" />}
      {!IS_MOBILE && (
        <EffectComposer>
          <Bloom intensity={0.4} luminanceThreshold={0.8} luminanceSmoothing={0.5} radius={0.5} />
        </EffectComposer>
      )}
    </Canvas>
  );
}

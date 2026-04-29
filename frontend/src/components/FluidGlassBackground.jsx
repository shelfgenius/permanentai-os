/**
 * FluidGlassBackground — animated wavy glass background.
 *
 *   Three.js fragment shader on a fullscreen quad.
 *   Layered simplex-noise waves + gloss highlights + fine grain overlay.
 *   Colors: periwinkle, deep indigo, lavender.
 *   Seamless loop, slow and organic — "lava lamp" / "underwater light".
 *
 * Drop-in: <FluidGlassBackground /> — fills parent, position: absolute.
 */
import React, { useEffect, useRef } from 'react';

const FRAG = /* glsl */`
  precision highp float;
  uniform vec2  uResolution;
  uniform float uTime;

  // ─── Simplex noise 3D (Ashima) ─────────────────────────────
  vec3 mod289(vec3 x){return x - floor(x * (1.0/289.0)) * 289.0;}
  vec4 mod289(vec4 x){return x - floor(x * (1.0/289.0)) * 289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute( permute( permute(
                i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
              + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
              + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );
    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;
    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }

  float fbm(vec3 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * snoise(p);
      p *= 2.02;
      a *= 0.5;
    }
    return v;
  }

  // Hash for fine grain noise
  float hash(vec2 p){
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  void main(){
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 p  = (gl_FragCoord.xy - 0.5 * uResolution.xy) / min(uResolution.x, uResolution.y);

    float t = uTime * 0.06; // slow

    // ── Three wave layers with distinct speeds/directions ──────
    // Layer 1 — slow, large features, flowing left→right
    float n1 = fbm(vec3(p * 1.3 + vec2(t * 0.9, t * 0.2), t * 0.3));
    // Layer 2 — mid freq, slight upward drift
    float n2 = fbm(vec3(p * 2.5 + vec2(-t * 0.6, -t * 0.4 + 2.0), t * 0.5 + 5.0));
    // Layer 3 — finer, slow
    float n3 = fbm(vec3(p * 4.0 + vec2(t * 0.4, t * 0.15 - 3.0), t * 0.25 + 9.0));

    // Combine into a wave height field for "glass peaks"
    float wave = 0.55 * n1 + 0.30 * n2 + 0.15 * n3;
    wave = wave * 0.5 + 0.5; // 0..1

    // Secondary sine ripples for rhythmic horizontal flow
    float ripple = 0.04 * sin(uv.y * 12.0 + n1 * 3.0 + t * 2.0);
    wave = clamp(wave + ripple, 0.0, 1.0);

    // ── Color palette — periwinkle, deep indigo, lavender ────
    vec3 periwinkle = vec3(0.62, 0.67, 0.96); // soft blue
    vec3 indigo     = vec3(0.16, 0.14, 0.45); // deep indigo
    vec3 lavender   = vec3(0.78, 0.72, 0.95); // pale lavender
    vec3 skyTop     = vec3(0.85, 0.85, 0.98); // very soft top highlight

    // Three-stop gradient driven by wave height
    vec3 col = mix(indigo, periwinkle, smoothstep(0.15, 0.65, wave));
    col = mix(col, lavender, smoothstep(0.55, 0.95, wave));
    col = mix(col, skyTop,   smoothstep(0.85, 1.0,  wave) * 0.45);

    // ── Gloss highlights — specular on wave peaks ───────────
    float peak = smoothstep(0.78, 0.94, wave);
    float glint = pow(peak, 4.0) * 0.55;
    col += glint * vec3(0.95, 0.92, 1.0);

    // ── Soft vignette — darken edges for text legibility ────
    float vig = smoothstep(1.3, 0.2, length(p));
    col *= mix(0.75, 1.0, vig);

    // ── Lower-band darkening for readable text on bottom half ─
    float bottomShade = smoothstep(0.85, 0.15, uv.y) * 0.18;
    col *= (1.0 - bottomShade);

    // ── Fine grain noise overlay ────────────────────────────
    float grain = (hash(gl_FragCoord.xy + uTime * 40.0) - 0.5) * 0.035;
    col += grain;

    // Gamma-ish lift for a slightly glowy look
    col = pow(col, vec3(0.97));

    gl_FragColor = vec4(col, 1.0);
  }
`;

const VERT = /* glsl */`
  void main(){
    gl_Position = vec4(position, 1.0);
  }
`;

export default function FluidGlassBackground({ style }) {
  const mountRef = useRef(null);

  useEffect(() => {
    let THREE;
    let cleanup = () => {};
    let cancelled = false;

    (async () => {
      THREE = await import('three');
      if (cancelled || !mountRef.current) return;

      const mount = mountRef.current;
      const renderer = new THREE.WebGLRenderer({
        antialias: false, alpha: false, powerPreference: 'default',
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
      renderer.setSize(mount.clientWidth, mount.clientHeight, false);
      mount.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.Camera(); // no transforms — full screen quad

      const uniforms = {
        uResolution: { value: new THREE.Vector2(mount.clientWidth, mount.clientHeight) },
        uTime:       { value: 0 },
      };

      const mat = new THREE.ShaderMaterial({
        vertexShader: VERT,
        fragmentShader: FRAG,
        uniforms,
        depthTest: false,
        depthWrite: false,
      });
      const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
      scene.add(quad);

      let raf = 0;
      const start = performance.now();
      const loop = (now) => {
        uniforms.uTime.value = (now - start) * 0.001;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);

      const onResize = () => {
        const w = mount.clientWidth, h = mount.clientHeight;
        renderer.setSize(w, h, false);
        uniforms.uResolution.value.set(w, h);
      };
      window.addEventListener('resize', onResize);

      // Pause when tab is hidden — saves battery
      const onVisibility = () => {
        if (document.hidden) {
          cancelAnimationFrame(raf);
        } else {
          raf = requestAnimationFrame(loop);
        }
      };
      document.addEventListener('visibilitychange', onVisibility);

      cleanup = () => {
        cancelAnimationFrame(raf);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibility);
        mat.dispose();
        quad.geometry.dispose();
        renderer.dispose();
        if (renderer.domElement.parentNode) {
          renderer.domElement.parentNode.removeChild(renderer.domElement);
        }
      };
    })();

    return () => { cancelled = true; cleanup(); };
  }, []);

  return (
    <div
      ref={mountRef}
      aria-hidden
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}

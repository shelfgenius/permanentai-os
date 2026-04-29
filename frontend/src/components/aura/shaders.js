export const vertexShader = `
  uniform float uTime;
  uniform float uDeformStrength;
  uniform float uFrequency;
  uniform float uAmplitude;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vDisplacement;

  vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
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

  void main() {
    vUv = uv;
    vNormal = normal;
    vec3 pos = position;
    float theta = atan(pos.y, pos.x);
    float phi = acos(pos.z / length(pos));
    vec3 noiseCoord = vec3(sin(phi) * cos(theta), sin(phi) * sin(theta), cos(phi));
    float timeScale = uTime * uFrequency * 0.5;
    float displacement = snoise(noiseCoord * 2.0 + timeScale) * uDeformStrength * uAmplitude;
    float detail = snoise(noiseCoord * 4.0 - timeScale * 0.8) * uDeformStrength * 0.3 * uAmplitude;
    float totalDisplacement = displacement + detail;
    vDisplacement = totalDisplacement;
    pos += normal * totalDisplacement;
    vec4 worldPosition = modelMatrix * vec4(pos, 1.0);
    vPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

export const fragmentShader = `
  uniform float uTime;
  uniform vec3 uColorSilver;
  uniform vec3 uColorBronze;
  uniform float uStateBlend;
  uniform float uPulseIntensity;
  uniform float uGlowStrength;

  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec2 vUv;
  varying float vDisplacement;

  #define PI 3.14159265359

  vec4 permute(vec4 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod(i, 289.0);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 1.0/7.0;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
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

  void main() {
    vec3 viewPosition = cameraPosition - vPosition;
    vec3 viewDir = normalize(viewPosition);
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(vec3(1.0, 1.0, 1.0));
    vec3 halfVector = normalize(lightDir + viewDir);

    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 3.0);

    float pulse = sin(uTime * 1.5) * 0.5 + 0.5;
    float pulseEffect = 1.0 + pulse * uPulseIntensity;

    float pattern = snoise(vPosition * 0.5 + uTime * 0.1);
    float pattern2 = snoise(vPosition * 1.0 - uTime * 0.2);

    float blendNoise = snoise(vPosition * 0.3 + uTime * 0.05);
    float blendFactor = smoothstep(-1.0, 1.0, blendNoise) * 0.3 + uStateBlend * 0.7;
    vec3 baseColor = mix(uColorSilver, uColorBronze, blendFactor);
    baseColor *= pulseEffect;

    float specPower1 = 64.0;
    float specPower2 = 128.0;
    float specular = pow(max(dot(normal, halfVector), 0.0), specPower1);
    float specular2 = pow(max(dot(normal, halfVector), 0.0), specPower2);

    vec3 specularColor = mix(vec3(1.0, 0.92, 0.85), vec3(1.0, 0.78, 0.58), uStateBlend);
    specularColor = (specular * 0.6 + specular2 * 0.4) * specularColor;

    vec3 reflectionColor = mix(vec3(0.9, 0.9, 0.95), vec3(0.95, 0.82, 0.7), blendFactor);

    vec3 envReflect = reflect(-viewDir, normal);
    vec3 envColor = mix(vec3(0.8, 0.8, 0.85), vec3(0.9, 0.75, 0.6), blendFactor);
    vec3 envReflection = envColor * fresnel * 0.5;

    vec3 displacementColor = vec3(0.9, 0.75, 0.6) * vDisplacement * 2.0;

    vec3 glowColor = mix(vec3(0.8, 0.85, 0.9), vec3(0.9, 0.7, 0.5), blendFactor);
    vec3 glow = glowColor * pulse * uGlowStrength * 0.3;

    vec3 finalColor = baseColor + specularColor + envReflection + displacementColor + glow;

    float rimPower = 3.0;
    float rim = pow(1.0 - max(dot(normal, viewDir), 0.0), rimPower);
    vec3 rimColor = mix(vec3(0.85, 0.9, 0.95), vec3(1.0, 0.8, 0.6), blendFactor);
    finalColor += rimColor * rim * 0.4;

    float iridescence = sin(fresnel * PI * 2.0 + uTime) * 0.5 + 0.5;
    vec3 iridColor = mix(vec3(0.7, 0.75, 0.8), vec3(0.85, 0.7, 0.55), blendFactor);
    finalColor += iridColor * iridescence * fresnel * 0.1;

    float opacity = 0.95 + fresnel * 0.05;
    gl_FragColor = vec4(finalColor, opacity);
  }
`;

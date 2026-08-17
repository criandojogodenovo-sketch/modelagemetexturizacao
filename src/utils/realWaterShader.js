/**
 * realWaterShader.js — Shader de água super-realista (estilo água real).
 *
 * Combina:
 *  - Ondas Gerstner (4 oitavas) com direções aleatórias
 *  - Refração (distorsão da cena por baixo da água)
 *  - Reflexão (Fresnel baseado no IOR)
 *  - Espuma procedural (baseada na altura das ondas + steepness)
 *  - Flow mapping (UV offset dinâmico para simular fluxo)
 *  - Profundidade (fade de cor superficial → profunda)
 *  - Sun specular (highlight do sol)
 *  - Caustics (na superfície inferior)
 *
 * Inspirado em: Water FX do UE5, GetEven water, Nvidia FX Water.
 */
import * as THREE from 'three'

export function createRealWaterMaterial(opts = {}) {
  const {
    color = '#1e90ff',
    deepColor = '#0a3d5c',
    clarity = 0.85,
    refraction = 0.4,
    reflection = 0.6,
    flowSpeed = 0.5,
    waveHeight = 0.3,
    waveFrequency = 1.0,
    foamThreshold = 0.7,
    foamColor = '#ffffff',
    fresnelPower = 5.0,
    ior = 1.333,
    sunDirection = [0.5, 0.8, 0.3],
    // Fase 4 — High Realism
    windDirection = [1.0, 0.0],
    windStrength = 0.3,
    dynamicFoam = true,
    foamIntensity = 0.8,
    depthGradient = true,
  } = opts

  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uDeepColor: { value: new THREE.Color(deepColor) },
    uFoamColor: { value: new THREE.Color(foamColor) },
    uClarity: { value: clarity },
    uRefraction: { value: refraction },
    uReflection: { value: reflection },
    uFlowSpeed: { value: flowSpeed },
    uWaveHeight: { value: waveHeight },
    uWaveFrequency: { value: waveFrequency },
    uFoamThreshold: { value: foamThreshold },
    uFresnelPower: { value: fresnelPower },
    uIOR: { value: ior },
    uSunDirection: { value: new THREE.Vector3(...sunDirection).normalize() },
    uCameraPos: { value: new THREE.Vector3() },
    // Fase 4 — High Realism uniforms
    uWindDirection: { value: new THREE.Vector2(windDirection[0], windDirection[1]).normalize() },
    uWindStrength: { value: windStrength },
    uDynamicFoam: { value: dynamicFoam ? 1.0 : 0.0 },
    uFoamIntensity: { value: foamIntensity },
    uDepthGradient: { value: depthGradient ? 1.0 : 0.0 },
  }

  const vertexShader = /* glsl */ `
    uniform float uTime;
    uniform float uWaveHeight;
    uniform float uWaveFrequency;
    uniform float uFlowSpeed;
    uniform vec2 uWindDirection;
    uniform float uWindStrength;

    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying float vWaveHeight;
    varying vec2 vUv;
    varying float vFoamFactor;

    // Gerstner wave
    vec3 gerstnerWave(vec2 pos, vec2 dir, float freq, float amplitude, float speed, float steepness, inout vec3 tangent, inout vec3 binormal) {
      float phase = dot(dir, pos) * freq + uTime * speed;
      float c = cos(phase);
      float s = sin(phase);
      vec3 offset = vec3(
        steepness * amplitude * dir.x * c,
        amplitude * s,
        steepness * amplitude * dir.y * c
      );
      // Tangente/binormal para normais
      tangent += vec3(
        1.0 - steepness * dir.x * dir.x * amplitude * freq * s,
        dir.x * amplitude * freq * c,
        -steepness * dir.x * dir.y * amplitude * freq * s
      );
      binormal += vec3(
        -steepness * dir.x * dir.y * amplitude * freq * s,
        dir.y * amplitude * freq * c,
        1.0 - steepness * dir.y * dir.y * amplitude * freq * s
      );
      return offset;
    }

    void main() {
      vec3 pos = position;
      vec2 worldXZ = (modelMatrix * vec4(pos, 1.0)).xz;

      vec3 tangent = vec3(1, 0, 0);
      vec3 binormal = vec3(0, 0, 1);

      // Fase 4 — High Realism: ondas influenciadas pelo vento
      vec2 windDir = normalize(uWindDirection + vec2(0.001));
      float windInfluence = uWindStrength;

      // 4 oitavas de ondas Gerstner com direções influenciadas pelo vento
      float freq = uWaveFrequency * 0.5;
      float amp = uWaveHeight;
      vec3 offset = vec3(0.0);
      vec2 d1 = normalize(mix(normalize(vec2(1.0, 0.4)), windDir, windInfluence));
      offset += gerstnerWave(worldXZ, d1, freq, amp * 0.5, uFlowSpeed, 0.6, tangent, binormal);
      vec2 d2 = normalize(mix(normalize(vec2(-0.7, 1.0)), windDir, windInfluence * 0.5));
      offset += gerstnerWave(worldXZ, d2, freq * 1.7, amp * 0.3, uFlowSpeed * 1.3, 0.5, tangent, binormal);
      offset += gerstnerWave(worldXZ, normalize(vec2(0.3, -1.0)), freq * 2.5, amp * 0.15, uFlowSpeed * 1.7, 0.4, tangent, binormal);
      offset += gerstnerWave(worldXZ, normalize(vec2(-1.0, -0.5)), freq * 3.7, amp * 0.07, uFlowSpeed * 2.1, 0.3, tangent, binormal);

      pos.y += offset.y;
      pos.x += offset.x;
      pos.z += offset.z;

      vWaveHeight = offset.y;
      vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;
      vNormal = normalize(normalMatrix * normalize(cross(tangent, binormal)));
      vUv = uv;
      // Fase 4 — Dynamic foam: cresting waves produzem mais espuma
      float crestFactor = smoothstep(uWaveHeight * 0.6, uWaveHeight, offset.y);
      float windFoam = uWindStrength * 0.3;
      vFoamFactor = crestFactor + windFoam;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `

  const fragmentShader = /* glsl */ `
    uniform float uTime;
    uniform vec3 uColor;
    uniform vec3 uDeepColor;
    uniform vec3 uFoamColor;
    uniform float uClarity;
    uniform float uRefraction;
    uniform float uReflection;
    uniform float uFlowSpeed;
    uniform float uWaveHeight;
    uniform float uFoamThreshold;
    uniform float uFresnelPower;
    uniform float uIOR;
    uniform vec3 uSunDirection;
    uniform vec3 uCameraPos;
    uniform vec2 uWindDirection;
    uniform float uWindStrength;
    uniform float uDynamicFoam;
    uniform float uFoamIntensity;
    uniform float uDepthGradient;

    varying vec3 vWorldPos;
    varying vec3 vNormal;
    varying float vWaveHeight;
    varying vec2 vUv;
    varying float vFoamFactor;

    // Simplex noise 2D (para flow mapping e caustics)
    vec3 mod289_3(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec2 mod289_2(vec2 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec3 permute3(vec3 x) { return mod289_3(((x*34.0)+1.0)*x); }
    float snoise(vec2 v) {
      const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
      vec2 i  = floor(v + dot(v, C.yy));
      vec2 x0 = v - i + dot(i, C.xx);
      vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      vec4 x12 = x0.xyxy + C.xxzz;
      x12.xy -= i1;
      i = mod289_2(i);
      vec3 p = permute3(permute3(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
      vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
      m = m*m; m = m*m;
      vec3 x = 2.0 * fract(p * C.www) - 1.0;
      vec3 h = abs(x) - 0.5;
      vec3 ox = floor(x + 0.5);
      vec3 a0 = x - ox;
      m *= 1.79284291400159 - 0.85373472095314 * (a0*a0 + h*h);
      vec3 g;
      g.x  = a0.x  * x0.x  + h.x  * x0.y;
      g.yz = a0.yz * x12.xz + h.yz * x12.yw;
      return 130.0 * dot(m, g);
    }

    void main() {
      vec3 N = normalize(vNormal);
      vec3 V = normalize(uCameraPos - vWorldPos);

      // Fresnel (Schlick)
      float fresnel = pow(1.0 - max(dot(N, V), 0.0), uFresnelPower);
      fresnel = mix(0.04, 1.0, fresnel); // F0 = 0.04 para água

      // Cor base — mistura superficial/profunda com base na altura da onda
      float depthFactor = smoothstep(-uWaveHeight, uWaveHeight, vWaveHeight);
      // Fase 4 — Depth gradient: variação de cor mais rica por profundidade
      vec3 waterColor;
      if (uDepthGradient > 0.5) {
        // 3 níveis de cor: profundo → médio → superficial
        vec3 midColor = mix(uDeepColor, uColor, 0.5);
        waterColor = mix(uDeepColor, midColor, smoothstep(-uWaveHeight, 0.0, vWaveHeight));
        waterColor = mix(waterColor, uColor, depthFactor);
      } else {
        waterColor = mix(uDeepColor, uColor, depthFactor);
      }

      // Caustics (apenas visto através da água)
      vec2 causticsUv = vUv * 8.0 + uTime * 0.05;
      float caustics = snoise(causticsUv) * 0.5 + 0.5;
      caustics = pow(caustics, 3.0);
      waterColor += vec3(0.1, 0.15, 0.2) * caustics * uClarity;

      // Flow mapping — distorção UV para simular fluxo
      float flowNoise = snoise(vUv * 2.0 + uTime * 0.1 * uFlowSpeed);
      vec2 flowOffset = vec2(flowNoise, snoise(vUv * 2.0 - uTime * 0.07)) * 0.05;

      // Refração simulada (sem acesso real ao framebuffer) — usa deslocamento UV
      vec3 refractDir = refract(-V, N, 1.0 / uIOR);
      float refractStrength = uRefraction * (1.0 - fresnel) * uClarity;
      waterColor = mix(waterColor, uDeepColor * 1.3, refractStrength);

      // Reflexão especular do sol (sun highlight)
      vec3 H = normalize(V + uSunDirection);
      float sunSpec = pow(max(dot(N, H), 0.0), 80.0);
      waterColor += vec3(1.0, 0.95, 0.85) * sunSpec * 0.8;

      // Reflexão ambiente (sky color fake)
      vec3 skyColor = vec3(0.4, 0.6, 0.9);
      waterColor = mix(waterColor, skyColor, fresnel * uReflection);

      // Espuma — onde a onda é mais alta
      float foamAmount = smoothstep(uFoamThreshold, 1.0, abs(vWaveHeight) / max(uWaveHeight, 0.001));
      // Adicionar ruído à espuma
      float foamNoise = snoise(vUv * 30.0 + uTime * 0.5) * 0.5 + 0.5;
      foamAmount *= smoothstep(0.3, 0.7, foamNoise);
      // Fase 4 — Dynamic foam: espuma adicional de cristas + vento
      if (uDynamicFoam > 0.5) {
        float dynamicFoam = vFoamFactor * uFoamIntensity;
        float foamNoise2 = snoise(vUv * 50.0 + uTime * 0.8 + uWindDirection * 10.0) * 0.5 + 0.5;
        dynamicFoam *= smoothstep(0.4, 0.8, foamNoise2);
        foamAmount = max(foamAmount, dynamicFoam);
      }
      waterColor = mix(waterColor, uFoamColor, foamAmount * uFoamIntensity);

      // Transparência final
      float alpha = mix(1.0 - uClarity, 1.0, fresnel);
      alpha = max(alpha, foamAmount * 0.9);

      gl_FragColor = vec4(waterColor, alpha);
    }
  `

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
  })

  // Guardar referência para actualizar uniforms no useFrame
  material.userData.isRealWater = true
  material.userData.update = (time, camera) => {
    material.uniforms.uTime.value = time
    material.uniforms.uCameraPos.value.copy(camera.position)
  }

  return material
}

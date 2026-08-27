/**
 * waterShader.js — Shader profissional de água para mobile WebGL.
 *
 * Funcionalidades:
 *  - Ondas Gerstner (mais realistas que ondas senoidais simples)
 *  - Espuma nas cristas das ondas e margens
 *  - Gradiente de cor por profundidade (mais clara perto da margem, escura em profundidade)
 *  - Modo lago (ondas circulares) vs rio (movimento direcional)
 *  - Reflexo aproximado (não SSR — apenas cor do céu baseada na normal)
 *  - Transparente com Fresnel (mais transparente de cima, reflexivo de ângulo raso)
 *
 * Otimizado para mobile: usa poucos uniforms e operações simples.
 */

import * as THREE from 'three'

export const waterVertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uWaveHeight;
  uniform float uWaveSpeed;
  uniform int uWaterMode; // 0 = lago, 1 = rio
  uniform float uFlowDirection; // radians, para rio

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vWaveHeight;
  varying float vFoamFactor;

  // Onda Gerstner — retorna deslocamento (x, y, z) para um vértice dado
  // direction: vec2 normalizado, steepness: 0..1, wavelength: tamanho
  vec3 gerstnerWave(vec2 pos, vec2 direction, float steepness, float wavelength, float time, inout vec3 tangent, inout vec3 binormal) {
    float k = 2.0 * 3.14159265 / wavelength;
    float c = sqrt(9.8 / k) * 0.5; // velocidade (escala para visual)
    vec2 d = normalize(direction);
    float f = k * (dot(d, pos) - c * time);
    float a = steepness / k;

    // Derivadas para a normal
    float sinF = sin(f);
    float cosF = cos(f);

    tangent += vec3(
      -d.x * d.x * (steepness * sinF),
      d.x * (steepness * cosF),
      -d.x * d.y * (steepness * sinF)
    );
    binormal += vec3(
      -d.x * d.y * (steepness * sinF),
      d.y * (steepness * cosF),
      -d.y * d.y * (steepness * sinF)
    );

    return vec3(
      d.x * (a * cosF),
      a * sinF,
      d.y * (a * cosF)
    );
  }

  void main() {
    vUv = uv;
    vec3 pos = position;
    vec3 tangent = vec3(1, 0, 0);
    vec3 binormal = vec3(0, 0, 1);

    float time = uTime * uWaveSpeed;

    if (uWaterMode == 0) {
      // Lago: 3 ondas Gerstner em direções diferentes
      vec3 wave1 = gerstnerWave(pos.xz, vec2(1.0, 0.6), 0.15, 4.0, time, tangent, binormal);
      vec3 wave2 = gerstnerWave(pos.xz, vec2(-0.7, 1.0), 0.10, 2.5, time, tangent, binormal);
      vec3 wave3 = gerstnerWave(pos.xz, vec2(0.3, -0.8), 0.08, 1.5, time, tangent, binormal);
      pos += wave1 + wave2 + wave3;
      vWaveHeight = wave1.y + wave2.y + wave3.y;
    } else {
      // Rio: ondas direcionais + fluxo
      float flowX = cos(uFlowDirection);
      float flowZ = sin(uFlowDirection);
      vec3 wave1 = gerstnerWave(pos.xz, vec2(flowX, flowZ), 0.12, 3.0, time, tangent, binormal);
      vec3 wave2 = gerstnerWave(pos.xz, vec2(flowX * 0.5, flowZ * 0.5), 0.08, 1.5, time, tangent, binormal);
      pos += wave1 + wave2;
      vWaveHeight = wave1.y + wave2.y;
    }

    // Escala pela altura das ondas configurável
    pos.y *= uWaveHeight * 2.0;
    vWaveHeight *= uWaveHeight * 2.0;

    // Normal = cross(tangent, binormal)
    vec3 normal = normalize(cross(binormal, tangent));
    vNormal = normalMatrix * normal;

    // Posição no mundo
    vec4 worldPos = modelMatrix * vec4(pos, 1.0);
    vWorldPos = worldPos.xyz;

    // Fator de espuma: maior nas cristas das ondas
    vFoamFactor = max(0.0, vWaveHeight / max(0.001, uWaveHeight * 2.0));

    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`

export const waterFragmentShader = /* glsl */ `
  uniform vec3 uColor;
  uniform vec3 uDeepColor;
  uniform float uOpacity;
  uniform vec3 uCameraPos;
  uniform vec3 uSkyColor;
  uniform float uFoamThreshold;
  uniform int uFoamEnabled;
  uniform int uDepthGradient;

  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying vec3 vNormal;
  varying float vWaveHeight;
  varying float vFoamFactor;

  void main() {
    vec3 normal = normalize(vNormal);

    // Fresnel — mais reflexivo de ângulo raso
    vec3 viewDir = normalize(uCameraPos - vWorldPos);
    float fresnel = pow(1.0 - max(0.0, dot(viewDir, normal)), 3.0);
    fresnel = clamp(fresnel, 0.0, 1.0);

    // Cor base: mistura entre cor superficial e profunda
    // (gradiente por profundidade — simplificado: usa a altura da onda como proxy)
    vec3 baseColor = uColor;
    if (uDepthGradient == 1) {
      // Ondas mais altas = mais superficial (mais clara); mais baixas = mais profunda (escura)
      float depthFactor = clamp(0.5 - vWaveHeight * 0.5, 0.0, 1.0);
      baseColor = mix(uColor, uDeepColor, depthFactor);
    }

    // Reflexo aproximado do céu (sem SSR real)
    vec3 skyReflection = mix(uSkyColor, vec3(1.0), fresnel * 0.3);

    // Cor final = mistura entre água e reflexo do céu via fresnel
    vec3 color = mix(baseColor, skyReflection, fresnel * 0.4);

    // Espuma nas cristas das ondas
    if (uFoamEnabled == 1) {
      float foam = smoothstep(uFoamThreshold, 1.0, vFoamFactor);
      color = mix(color, vec3(1.0), foam * 0.6);
    }

    // Espuma nas margens (baseada na UV — aproximado)
    // Quanto mais perto da borda do plano, mais espuma
    float edgeFactor = max(
      smoothstep(0.0, 0.05, vUv.x) * smoothstep(0.0, 0.05, 1.0 - vUv.x),
      smoothstep(0.0, 0.05, vUv.y) * smoothstep(0.0, 0.05, 1.0 - vUv.y)
    );
    if (uFoamEnabled == 1) {
      float edgeFoam = (1.0 - edgeFactor) * 0.3;
      color = mix(color, vec3(1.0), edgeFoam);
    }

    // Opacidade com Fresnel — mais transparente de cima
    float alpha = uOpacity * (0.4 + fresnel * 0.6);

    gl_FragColor = vec4(color, alpha);
  }
`

/**
 * Cria um ShaderMaterial de água pronto a usar.
 * @param {Object} options — { color, deepColor, opacity, waveHeight, waveSpeed, waterMode, flowDirection, foamEnabled, foamThreshold, depthGradient, skyColor }
 * @returns {THREE.ShaderMaterial}
 */
export function createWaterMaterial(options = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(options.color || '#2f81f7') },
      uDeepColor: { value: new THREE.Color(options.deepColor || '#0a3d5c') },
      uOpacity: { value: options.opacity ?? 0.85 },
      uWaveHeight: { value: options.waveHeight ?? 0.2 },
      uWaveSpeed: { value: options.waveSpeed ?? 0.5 },
      uWaterMode: { value: options.waterMode === 'river' ? 1 : 0 },
      uFlowDirection: { value: ((options.flowDirection || 0) * Math.PI) / 180 },
      uFoamEnabled: { value: options.foamEnabled === false || options.foamEnabled === 'false' ? 0 : 1 },
      uFoamThreshold: { value: options.foamThreshold ?? 0.7 },
      uDepthGradient: { value: options.depthGradient === false || options.depthGradient === 'false' ? 0 : 1 },
      uSkyColor: { value: new THREE.Color(options.skyColor || '#88aacc') },
      uCameraPos: { value: new THREE.Vector3() },
    },
    vertexShader: waterVertexShader,
    fragmentShader: waterFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
}

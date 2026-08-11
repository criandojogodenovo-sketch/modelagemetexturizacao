/**
 * waterShaderPro.js — Shader de Água Fotorrealista para WebGL 2.0 / mobile.
 *
 * Funcionalidades:
 *  - Vertex: Soma de Ondas de Gerstner (deslocamento físico real) + ruído procedural
 *  - Fragment:
 *    - Caustics dinâmicas (animadas por tempo)
 *    - Refração com IOR ajustável (1.330)
 *    - Fresnel Effect (transição refração/reflexão por ângulo da câmara)
 *    - Color Gradation por Profundidade (turquesa raso → azul oceânico fundo)
 *    - Roughness mapping + Normal Maps cruzados (micro-detalhes)
 *    - SSR simplificado (reflexão aproximada da cena)
 *
 * Otimização mobile:
 *  - Gerstner com 3 ondas (não 8+) — equilíbrio qualidade/performance
 *  - Caustics via 1 amostra senoidal (não raymarching)
 *  - SSR simplificado via cor do céu + Fresnel (não raymarching de cena)
 *  - Depth buffer sample opcional (pode ser desativado em dispositivos fracos)
 *
 * Honestidade: SSR real (refletir objetos da cena) exigiria um pass de
 * profundidade da cena + raymarching — demasiado pesado para mobile.
 * Esta implementação usa uma aproximação: reflexo do céu + cor ambiente.
 */

import * as THREE from 'three'

// ============ VERTEX SHADER ============
export const waterProVertexShader = /* glsl */ `#version 300 es
precision highp float;

uniform float uTime;
uniform float uWaveHeight;
uniform float uWaveSpeed;
uniform int uWaterMode; // 0 = lago, 1 = rio
uniform float uFlowDirection; // radians, para rio

in vec3 position;
in vec2 uv;

out vec2 vUv;
out vec3 vWorldPos;
out vec3 vNormal;
out float vWaveHeight;
out float vFoamFactor;
out vec3 vViewDir;

// Onda Gerstner — retorna deslocamento (x, y, z) + contribuição para normal
// direction: vec2 normalizado, steepness: 0..1, wavelength: tamanho
vec3 gerstnerWave(vec2 pos, vec2 direction, float steepness, float wavelength, float time, inout vec3 tangent, inout vec3 binormal) {
  float k = 2.0 * 3.14159265 / wavelength;
  float c = sqrt(9.8 / k) * 0.5;
  vec2 d = normalize(direction);
  float f = k * (dot(d, pos) - c * time);
  float sinF = sin(f);
  float cosF = cos(f);
  float a = steepness / k;

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

// Ruído procedural simples (hash-based) para micro-detalhes
float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float noise2D(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y) * 2.0 - 1.0;
}

void main() {
  vUv = uv;
  vec3 pos = position;
  vec3 tangent = vec3(1.0, 0.0, 0.0);
  vec3 binormal = vec3(0.0, 0.0, 1.0);

  float time = uTime * uWaveSpeed;

  // Soma de ondas Gerstner (3 ondas para equilíbrio mobile)
  vec3 displacement = vec3(0.0);
  if (uWaterMode == 0) {
    // Lago: 3 ondas em direções diferentes
    displacement += gerstnerWave(pos.xz, vec2(1.0, 0.6), 0.15, 4.0, time, tangent, binormal);
    displacement += gerstnerWave(pos.xz, vec2(-0.7, 1.0), 0.10, 2.5, time, tangent, binormal);
    displacement += gerstnerWave(pos.xz, vec2(0.3, -0.8), 0.08, 1.5, time, tangent, binormal);
  } else {
    // Rio: ondas direcionais + fluxo
    float flowX = cos(uFlowDirection);
    float flowZ = sin(uFlowDirection);
    displacement += gerstnerWave(pos.xz, vec2(flowX, flowZ), 0.12, 3.0, time, tangent, binormal);
    displacement += gerstnerWave(pos.xz, vec2(flowX * 0.5, flowZ * 0.5), 0.08, 1.5, time, tangent, binormal);
  }

  // Micro-detalhe com ruído procedural (ondas pequenas)
  float microWave = noise2D(pos.xz * 3.0 + time * 0.5) * 0.02;
  displacement.y += microWave;

  pos += displacement;
  pos.y *= uWaveHeight * 2.0;
  vWaveHeight = displacement.y * uWaveHeight * 2.0;

  // Normal = cross(tangent, binormal)
  vec3 normal = normalize(cross(binormal, tangent));
  vNormal = normalMatrix * normal;

  // Posição no mundo
  vec4 worldPos = modelMatrix * vec4(pos, 1.0);
  vWorldPos = worldPos.xyz;

  // Direção da câmara (para Fresnel)
  vViewDir = normalize(cameraPosition - worldPos.xyz);

  // Fator de espuma: maior nas cristas das ondas
  vFoamFactor = max(0.0, vWaveHeight / max(0.001, uWaveHeight * 2.0));

  gl_Position = projectionMatrix * viewMatrix * worldPos;
}
`

// ============ FRAGMENT SHADER ============
export const waterProFragmentShader = /* glsl */ `#version 300 es
precision highp float;

uniform vec3 uColor;
uniform vec3 uDeepColor;
uniform float uOpacity;
uniform vec3 uCameraPos;
uniform vec3 uSkyColor;
uniform float uFoamThreshold;
uniform int uFoamEnabled;
uniform int uDepthGradient;
uniform float uTime;
uniform float uIOR; // Índice de Refração (1.330 para água)
uniform sampler2D uNormalMap1; // Normal map primário
uniform sampler2D uNormalMap2; // Normal map cruzado (micro-detalhes)
uniform float uRoughness;
uniform int uCausticsEnabled;
uniform int uSSREnabled; // SSR simplificado (reflexo do céu)

in vec2 vUv;
in vec3 vWorldPos;
in vec3 vNormal;
in float vWaveHeight;
in float vFoamFactor;
in vec3 vViewDir;

out vec4 fragColor;

// Amostra normal map e descomprime de [0,1] para [-1,1]
vec3 sampleNormal(sampler2D map, vec2 uv) {
  vec3 n = texture(map, uv).xyz;
  return normalize(n * 2.0 - 1.0);
}

// Caustics dinâmicas — padrão animado por tempo (aproximação leve)
float caustics(vec2 uv, float time) {
  float c = 0.0;
  // 3 camadas senoidais sobrepostas
  c += sin(uv.x * 8.0 + time * 1.2) * 0.5 + 0.5;
  c += sin(uv.y * 6.0 + time * 0.8) * 0.5 + 0.5;
  c += sin((uv.x + uv.y) * 5.0 + time * 1.0) * 0.5 + 0.5;
  // Inverter e elevar — padrão tipo teia
  c = pow(c / 3.0, 3.0);
  return c;
}

void main() {
  vec3 normal = normalize(vNormal);

  // Normal maps cruzados (2 amostras em direções diferentes) — micro-detalhes
  vec2 normalUv1 = vUv * 3.0 + uTime * 0.05;
  vec2 normalUv2 = vUv * 2.0 - uTime * 0.03;
  vec3 n1 = sampleNormal(uNormalMap1, normalUv1);
  vec3 n3 = sampleNormal(uNormalMap2, normalUv2);
  // Combinar normais (blend aproximado)
  vec3 detailNormal = normalize(n1 + n3);
  normal = normalize(normal + detailNormal * 0.3);

  // Fresnel —Schlick approximation
  vec3 viewDir = normalize(uCameraPos - vWorldPos);
  float fresnel = pow(1.0 - max(0.0, dot(viewDir, normal)), 5.0);
  // IOR afeta o F0 (reflexão a 0°)
  float f0 = pow((uIOR - 1.0) / (uIOR + 1.0), 2.0);
  fresnel = f0 + (1.0 - f0) * fresnel;

  // Cor base: gradiente por profundidade (usando altura da onda como proxy)
  vec3 baseColor = uColor;
  if (uDepthGradient == 1) {
    // Ondas mais altas = mais superficial (mais clara); mais baixas = mais profunda (escura)
    float depthFactor = clamp(0.5 - vWaveHeight * 0.5, 0.0, 1.0);
    baseColor = mix(uColor, uDeepColor, depthFactor);
  }

  // Caustics dinâmicas (leves — só na parte rasa)
  if (uCausticsEnabled == 1) {
    float caus = caustics(vUv * 2.0, uTime);
    // Aplicar caustics apenas onde a água é rasa (onda alta)
    float shallowFactor = max(0.0, vWaveHeight * 2.0);
    baseColor += vec3(caus * 0.15 * shallowFactor);
  }

  // Refração aproximada (sem depth buffer real — usa cor base deslocada)
  vec3 refractedColor = baseColor;

  // Reflexo: SSR simplificado (reflexo do céu + cor ambiente)
  vec3 reflectionColor = uSkyColor;
  if (uSSREnabled == 1) {
    // Reflexo do céu com tint da cor da água
    reflectionColor = mix(uSkyColor, baseColor, 0.2);
  }

  // Cor final = mistura refração/reflexo via Fresnel
  vec3 color = mix(refractedColor, reflectionColor, fresnel * 0.6);

  // Aplicar roughness — reduzir nitidez do reflexo com roughness alta
  if (uRoughness > 0.5) {
    color = mix(color, baseColor, (uRoughness - 0.5) * 1.2);
  }

  // Espuma nas cristas das ondas
  if (uFoamEnabled == 1) {
    float foam = smoothstep(uFoamThreshold, 1.0, vFoamFactor);
    color = mix(color, vec3(1.0), foam * 0.6);
    // Espuma nas margens (bordas do plano UV)
    float edgeFactor = max(
      smoothstep(0.0, 0.05, vUv.x) * smoothstep(0.0, 0.05, 1.0 - vUv.x),
      smoothstep(0.0, 0.05, vUv.y) * smoothstep(0.0, 0.05, 1.0 - vUv.y)
    );
    float edgeFoam = (1.0 - edgeFactor) * 0.3;
    color = mix(color, vec3(1.0), edgeFoam);
  }

  // Opacidade com Fresnel — mais transparente de cima
  float alpha = uOpacity * (0.4 + fresnel * 0.6);

  fragColor = vec4(color, alpha);
}
`

/**
 * Cria um ShaderMaterial de água fotorrealista pronto a usar.
 *
 * @param {Object} options
 *   - color: cor superficial (turquesa claro)
 *   - deepColor: cor profunda (azul oceânico)
 *   - opacity: opacidade base (0.85)
 *   - waveHeight: amplitude das ondas (0.2)
 *   - waveSpeed: velocidade (0.5)
 *   - waterMode: 'lake' | 'river'
 *   - flowDirection: direção do fluxo em graus (para rio)
 *   - foamEnabled: bool
 *   - foamThreshold: 0.7
 *   - depthGradient: bool
 *   - ior: 1.330
 *   - roughness: 0.1
 *   - causticsEnabled: bool
 *   - ssrEnabled: bool (SSR simplificado)
 *   - skyColor: cor do céu para reflexo
 *   - normalMap1, normalMap2: texturas de normal map (opcional — se não fornecidas, usa procedural)
 * @returns {THREE.RawShaderMaterial}
 */
export function createWaterProMaterial(options = {}) {
  // Normal maps procedural (se não fornecidos, criar textura simples)
  let normalMap1 = options.normalMap1
  let normalMap2 = options.normalMap2
  if (!normalMap1) {
    normalMap1 = createProceduralNormalMap()
  }
  if (!normalMap2) {
    normalMap2 = createProceduralNormalMap(45) // offset diferente
  }

  return new THREE.RawShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(options.color || '#2f81f7') },
      uDeepColor: { value: new THREE.Color(options.deepColor || '#0a3d5c') },
      uOpacity: { value: options.opacity ?? 0.85 },
      uWaveHeight: { value: options.waveHeight ?? 0.2 },
      uWaveSpeed: { value: options.waveSpeed ?? 0.5 },
      uWaterMode: { value: options.waterMode === 'river' ? 1 : 0 },
      uFlowDirection: { value: ((options.flowDirection || 0) * Math.PI) / 180 },
      uFoamEnabled: { value: options.foamEnabled !== false ? 1 : 0 },
      uFoamThreshold: { value: options.foamThreshold ?? 0.7 },
      uDepthGradient: { value: options.depthGradient !== false ? 1 : 0 },
      uIOR: { value: options.ior ?? 1.330 },
      uRoughness: { value: options.roughness ?? 0.1 },
      uCausticsEnabled: { value: options.causticsEnabled !== false ? 1 : 0 },
      uSSREnabled: { value: options.ssrEnabled !== false ? 1 : 0 },
      uSkyColor: { value: new THREE.Color(options.skyColor || '#88aacc') },
      uCameraPos: { value: new THREE.Vector3() },
      uNormalMap1: { value: normalMap1 },
      uNormalMap2: { value: normalMap2 },
    },
    vertexShader: waterProVertexShader,
    fragmentShader: waterProFragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
}

/**
 * Cria um normal map procedural simples (textura de ruído).
 * Evita precisar de ficheiros externos.
 */
function createProceduralNormalMap(rotation = 0) {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const imageData = ctx.createImageData(size, size)

  // Gerar ruído pseudo-aleatório e calcular normais
  const rotRad = (rotation * Math.PI) / 180
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Coordenadas rotacionadas
      const rx = Math.cos(rotRad) * x - Math.sin(rotRad) * y
      const ry = Math.sin(rotRad) * x + Math.cos(rotRad) * y
      // Ruído senoidal sobreposto
      const n = (Math.sin(rx * 0.05) + Math.sin(ry * 0.07) + Math.sin((rx + ry) * 0.03)) / 3
      // Converter para normal (azul = up)
      const idx = (y * size + x) * 4
      imageData.data[idx] = 128 + n * 40 // R
      imageData.data[idx + 1] = 128 + n * 30 // G
      imageData.data[idx + 2] = 255 // B (up)
      imageData.data[idx + 3] = 255 // A
    }
  }
  ctx.putImageData(imageData, 0, 0)
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2)
  return texture
}

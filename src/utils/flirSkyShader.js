/**
 * flirSkyShader.js — Shader custom completo para céu procedural realista.
 *
 * Não depende do THREE.Sky nem do tone mapping do renderer.
 * Calcula as cores directamente em sRGB (0-1), sem HDR, para evitar
 * a compressão do ACESFilmicToneMapping que esconde os tons quentes.
 *
 * Features:
 *  - Gradiente atmosférico (azul zénite → claro horizonte)
 *  - Sol com glow (disco + halo)
 *  - Tons de pôr do sol (laranja/vermelho quando sol baixo)
 *  - Estrelas à noite (quando sol abaixo do horizonte)
 *  - Nuvens procedurais simples (opcional)
 *
 * Uniforms:
 *  - sunPosition: vec3 (direção normalizada do sol)
 *  - turbidity: float (0-30, quantidade de partículas)
 *  - rayleigh: float (0-10, espalhamento atmosférico)
 *  - time: float (para animação de nuvens)
 *  - starsEnabled: float (0 ou 1)
 */

export const flirSkyVertexShader = /* glsl */`
  varying vec3 vWorldPosition;
  varying vec3 vWorldDirection;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldDirection = normalize(worldPos.xyz - cameraPosition);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const flirSkyFragmentShader = /* glsl */`
  varying vec3 vWorldPosition;
  varying vec3 vWorldDirection;

  uniform vec3 sunPosition;
  uniform float turbidity;
  uniform float rayleigh;
  uniform float time;
  uniform float starsEnabled;

  // Hash e noise para estrelas
  float hash(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  // Hash 2D para nuvens
  float hash2d(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise2d(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash2d(i);
    float b = hash2d(i + vec2(1.0, 0.0));
    float c = hash2d(i + vec2(0.0, 1.0));
    float d = hash2d(i + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * noise2d(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 dir = normalize(vWorldDirection);
    vec3 sunDir = normalize(sunPosition);

    // === 1. GRADIENTE ATMOSFÉRICO BASE ===
    // Y do direction: -1 (baixo) a 1 (cima)
    float upDot = clamp(dir.y, -1.0, 1.0);

    // Cores base do céu (em sRGB, já convertidas)
    // Zénite: azul profundo; Horizonte: azul claro
    vec3 zenithColor = vec3(0.15, 0.35, 0.75);
    vec3 horizonColor = vec3(0.55, 0.75, 0.95);

    // Misturar consoante altura (0=horizonte, 1=zénite)
    float skyMix = pow(clamp(upDot, 0.0, 1.0), 0.4);
    vec3 skyColor = mix(horizonColor, zenithColor, skyMix);

    // Abaixo do horizonte: cor do chão (mais escura)
    if (upDot < 0.0) {
      skyColor = mix(horizonColor * 0.3, vec3(0.1, 0.08, 0.06), -upDot);
    }

    // === 2. SOL E GLOW ===
    float sunDot = max(0.0, dot(dir, sunDir));
    float sunHeight = sunDir.y; // -1 a 1

    // Disco do sol (pequeno e brilhante)
    float sunDisc = smoothstep(0.9995, 0.9998, sunDot);

    // Halo do sol (glow amplo)
    float sunHalo = pow(sunDot, 8.0) * 0.3;
    float sunGlow = pow(sunDot, 64.0) * 0.8;

    // Cor do sol baseada na altura
    vec3 sunColor;
    if (sunHeight > 0.3) {
      // Sol alto: branco-amarelado
      sunColor = vec3(1.0, 0.95, 0.8);
    } else if (sunHeight > 0.1) {
      // Sol médio: amarelo
      sunColor = vec3(1.0, 0.8, 0.5);
    } else if (sunHeight > 0.0) {
      // Sol baixo: laranja
      sunColor = vec3(1.0, 0.5, 0.2);
    } else {
      // Sol abaixo do horizonte: vermelho
      sunColor = vec3(0.8, 0.2, 0.1);
    }

    // Aplicar sol + halo
    skyColor += sunColor * (sunDisc * 2.0 + sunHalo + sunGlow);

    // === 3. TONS DE PÔR DO SOL ===
    // Quando o sol está baixo, o horizonte fica alaranjado
    float sunsetFactor = 1.0 - smoothstep(0.0, 0.3, sunHeight);
    float horizonProximity = pow(1.0 - abs(upDot), 3.0);

    // Cor alaranjada do pôr do sol
    vec3 sunsetOrange = vec3(1.0, 0.45, 0.15);
    vec3 sunsetRed = vec3(0.9, 0.25, 0.1);

    // Misturar tons quentes no horizonte
    float sunsetMix = horizonProximity * sunsetFactor;
    skyColor = mix(skyColor, sunsetOrange, sunsetMix * 0.7);

    // Glow alaranjado perto do sol
    float sunNearby = pow(sunDot, 3.0) * sunsetFactor;
    skyColor = mix(skyColor, sunsetRed, sunNearby * 0.5);

    // === 4. RAYLEIGH SCATTERING (simplificado) ===
    // Mais scattering = céu mais azul; menos = mais transparente
    // Aplicar ANTES dos tons de pôr do sol (não sobrescrever)
    float rayleighFactor = clamp(rayleigh / 10.0, 0.0, 1.0);
    // Rayleigh afeta apenas a intensidade do azul, não substitui os tons de pôr do sol
    skyColor *= mix(0.5, 1.0, rayleighFactor);

    // === 5. TURBIDEZ (partículas no ar) ===
    // Mais turbidez = céu mais acinzentado/amarelado
    float turbFactor = turbidity / 30.0;
    skyColor = mix(skyColor, vec3(0.7, 0.65, 0.55), turbFactor * 0.3);

    // === 6. NOITE / ESTRELAS ===
    // Quando o sol está abaixo do horizonte, escurecer o céu
    float nightFactor = 1.0 - smoothstep(-0.2, 0.1, sunHeight);
    vec3 nightColor = vec3(0.02, 0.02, 0.05);
    skyColor = mix(skyColor, nightColor, nightFactor * 0.8);

    // Estrelas (se ativadas)
    if (starsEnabled > 0.5 && upDot > 0.0) {
      // Usar hash 3D para gerar estrelas pseudo-aleatórias
      vec3 starPos = floor(dir * 200.0);
      float starHash = hash(starPos);
      // Só algumas posições têm estrelas
      if (starHash > 0.992) {
        float starBrightness = (starHash - 0.992) / 0.008;
        // Twinkle (piscar)
        float twinkle = 0.7 + 0.3 * sin(time * 3.0 + starHash * 100.0);
        skyColor += vec3(starBrightness * twinkle);
      }
    }

    // === 7. NUVENS SIMPLES (opcional) ===
    if (upDot > 0.0) {
      vec2 cloudUV = dir.xz / (dir.y + 0.01);
      cloudUV *= 3.0;
      cloudUV += time * 0.02;

      float clouds = fbm(cloudUV);
      clouds = smoothstep(0.4, 0.7, clouds);

      // Cor das nuvens baseada na altura do sol
      vec3 cloudColor = mix(vec3(0.9), sunColor, 0.3);
      if (sunHeight < 0.1) {
        cloudColor = mix(cloudColor, sunsetOrange, sunsetFactor * 0.5);
      }
      // Nuvens mais escuras à noite
      cloudColor = mix(cloudColor, vec3(0.1), nightFactor * 0.7);

      // Fade das nuvens perto do horizonte
      float cloudFade = smoothstep(0.0, 0.15, upDot);
      skyColor = mix(skyColor, cloudColor, clouds * cloudFade * 0.6);
    }

    // Clamp final (garantir 0-1)
    skyColor = clamp(skyColor, 0.0, 1.0);

    gl_FragColor = vec4(skyColor, 1.0);
  }
`

/**
 * Cria um material ShaderMaterial para o céu custom.
 * @param {Object} options - { sunPosition, turbidity, rayleigh, time, starsEnabled }
 * @returns {THREE.ShaderMaterial}
 */
export function createFlirSkyMaterial(options = {}) {
  const THREE = require('three')
  return new THREE.ShaderMaterial({
    uniforms: {
      sunPosition: { value: options.sunPosition || new THREE.Vector3(0, 1, 0) },
      turbidity: { value: options.turbidity ?? 10 },
      rayleigh: { value: options.rayleigh ?? 1 },
      time: { value: 0 },
      starsEnabled: { value: options.starsEnabled ? 1.0 : 0.0 },
    },
    vertexShader: flirSkyVertexShader,
    fragmentShader: flirSkyFragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
  })
}

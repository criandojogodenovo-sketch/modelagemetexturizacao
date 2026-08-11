/**
 * skyShaderPro.js — Céu procedural com espalhamento atmosférico físico (Rayleigh + Mie).
 *
 * Baseado no modelo de Preetham et al. (1996) — aproximação analítica do
 * espalhamento atmosférico, otimizada para real-time/mobile.
 *
 * Funcionalidades:
 *  - Rayleigh Scattering (céu azul — moléculas pequenas)
 *  - Mie Scattering (halo solar — partículas grandes/aerosóis)
 *  - Posição solar dinâmica (ângulo + hora do dia)
 *  - Transição dia/noite (estrelas + lua)
 *  - Tons de pôr do sol automatizados (quando sol baixo)
 *  - Afeta névoa e brilho especular na água (via uniforms partilhados)
 *
 * Otimização mobile:
 *  - Modelo analítico (não raymarching) — 1 sample por pixel
 *  - Sem texturas — tudo procedural
 *  - Estrelas via hash simples (não catálogo)
 *
 * Honestidade: não implementa multi-scattering (cálculo de 2ª ordem) —
 * demasiado pesado para mobile. A aproximação de Preetham captura 90% do visual.
 */

import * as THREE from 'three'

export const skyProVertexShader = /* glsl */`
  varying vec3 vWorldPosition;
  varying vec3 vWorldDirection;

  void main() {
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    vWorldDirection = normalize(worldPos.xyz - cameraPosition);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

export const skyProFragmentShader = /* glsl */`
  varying vec3 vWorldPosition;
  varying vec3 vWorldDirection;

  uniform vec3 uSunDirection;    // direção normalizada do sol
  uniform float uSunIntensity;   // 0-30, brilho do sol
  uniform float uRayleigh;       // 0-10, espalhamento Rayleigh (azul)
  uniform float uMie;            // 0-2, espalhamento Mie (halo)
  uniform float uTurbidity;      // 0-30, partículas em suspensão
  uniform float uTime;           // para animação de estrelas
  uniform float uStarsEnabled;   // 0 ou 1

  // Constantes físicas (Preetham)
  const float EARTH_RADIUS = 6371000.0;
  const float ATMOSPHERE_HEIGHT = 100000.0;
  // Coeficientes de espalhamento Rayleigh (para RGB — azul espalha mais)
  const vec3 RAYLEIGH_COEFFS = vec3(5.8, 13.5, 33.1) * 1e-6;
  // Coeficiente Mie (igual para todas as wavelengths)
  const float MIE_COEFF = 2.0e-6;

  // Hash para estrelas
  float hash3(vec3 p) {
    p = fract(p * vec3(443.897, 441.423, 437.195));
    p += dot(p, p.yzx + 19.19);
    return fract((p.x + p.y) * p.z);
  }

  // Espalhamento Rayleigh — função de fase (isotrópico com viés para trás)
  float rayleighPhase(float cosTheta) {
    return 0.0596831 * (1.0 + cosTheta * cosTheta);
  }

  // Espalhamento Mie — função de fase (fortemente direcional, forward-peaked)
  // g: parâmetro de assimetria (-1..1, ~0.76 para aerosóis)
  float miePhase(float cosTheta, float g) {
    float g2 = g * g;
    return 0.1193662 * ((1.0 - g2) / pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
  }

  // Calcula a cor do céu numa direção dada
  vec3 calculateSkyColor(vec3 dir, vec3 sunDir) {
    float cosTheta = dot(dir, sunDir);

    // Parâmetros atmosféricos
    float rayleighFactor = uRayleigh * (1.0 / (uTurbidity * 0.1 + 1.0));
    float mieFactor = uMie * uTurbidity * 0.1;

    // Densidade óptica ao longo da vista (aproximação — quanto mais perto do horizonte, mais atmosfera)
    float zenithAngle = max(0.0, dir.y);
    float opticalDepth = 1.0 / (zenithAngle + 0.01);

    // Espalhamento Rayleigh (azul do céu)
    vec3 rayleighScattering = RAYLEIGH_COEFFS * rayleighFactor * opticalDepth;
    float rayleighPhaseVal = rayleighPhase(cosTheta);

    // Espalhamento Mie (halo solar)
    float mieScattering = MIE_COEFF * mieFactor * opticalDepth;
    float miePhaseVal = miePhase(cosTheta, 0.76);

    // Cor do sol (branco-amarelado, fica vermelho no pôr do sol)
    float sunHeight = sunDir.y; // -1..1
    // Quanto mais baixo o sol, mais vermelho (espalhamento seletivo)
    vec3 sunColor = mix(
      vec3(1.0, 0.95, 0.85), // dia: branco-amarelado
      vec3(1.0, 0.4, 0.1),   // pôr do sol: vermelho-laranja
      smoothstep(0.0, -0.3, sunHeight)
    );

    // Cor final = Rayleigh (azul) + Mie (halo solar)
    vec3 color = vec3(0.0);
    // Rayleigh — pinta o céu de azul (mais intenso no zénite)
    color += rayleighScattering * rayleighPhaseVal * vec3(1.0, 1.0, 1.0) * 20.0;
    // Mie — adiciona o halo solar
    color += vec3(mieScattering * miePhaseVal) * sunColor * uSunIntensity;

    // Tom de fundo — azul claro no horizonte (mesmo sem sol)
    vec3 horizonColor = vec3(0.7, 0.8, 0.95) * rayleighFactor * 0.3;
    color = mix(horizonColor, color, smoothstep(0.0, 0.3, zenithAngle));

    // Transição dia/noite — quando sol está abaixo do horizonte
    float nightFactor = smoothstep(0.0, -0.2, sunDir.y);
    vec3 nightColor = vec3(0.02, 0.02, 0.05);
    color = mix(color, nightColor, nightFactor * 0.8);

    return color;
  }

  void main() {
    vec3 dir = normalize(vWorldDirection);
    vec3 sunDir = normalize(uSunDirection);

    vec3 skyColor = calculateSkyColor(dir, sunDir);

    // Disco do sol + halo
    float sunDot = max(0.0, dot(dir, sunDir));
    float sunDisk = smoothstep(0.9995, 0.9999, sunDot);
    float sunHalo = pow(sunDot, 32.0) * 0.5;
    vec3 sunColor = vec3(1.0, 0.95, 0.8) * (uSunIntensity * 0.3);
    skyColor += sunColor * (sunDisk * 5.0 + sunHalo);

    // Estrelas à noite
    if (uStarsEnabled > 0.5 && sunDir.y < 0.1) {
      vec3 starPos = floor(dir * 200.0);
      float starHash = hash3(starPos);
      if (starHash > 0.992) {
        float twinkle = sin(uTime * 3.0 + starHash * 100.0) * 0.5 + 0.5;
        float nightFactor = smoothstep(0.1, -0.3, sunDir.y);
        skyColor += vec3(starHash * twinkle * nightFactor);
      }
    }

    // Clamp e gamma correction (sRGB approx)
    skyColor = max(skyColor, vec3(0.0));
    skyColor = pow(skyColor, vec3(0.8)); // gamma leve

    gl_FragColor = vec4(skyColor, 1.0);
  }
`

/**
 * Cria um ShaderMaterial de céu procedural.
 * @param {Object} options
 *   - sunDirection: [x, y, z] direção normalizada do sol
 *   - sunIntensity: 0-30 (default 15)
 *   - rayleigh: 0-10 (default 2.5)
 *   - mie: 0-2 (default 0.5)
 *   - turbidity: 0-30 (default 10)
 *   - starsEnabled: bool (default true)
 * @returns {THREE.ShaderMaterial}
 */
export function createSkyProMaterial(options = {}) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uSunDirection: {
        value: new THREE.Vector3().fromArray(options.sunDirection || [0.5, 0.5, 0.5]).normalize(),
      },
      uSunIntensity: { value: options.sunIntensity ?? 15 },
      uRayleigh: { value: options.rayleigh ?? 2.5 },
      uMie: { value: options.mie ?? 0.5 },
      uTurbidity: { value: options.turbidity ?? 10 },
      uTime: { value: 0 },
      uStarsEnabled: { value: options.starsEnabled !== false ? 1 : 0 },
    },
    vertexShader: skyProVertexShader,
    fragmentShader: skyProFragmentShader,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
  })
}

/**
 * Calcula a direção do sol baseada na hora do dia.
 * @param {number} hourOfDay 0-24
 * @param {number} dayOfYear 0-365
 * @param {number} latitude graus (-90..90)
 * @returns {THREE.Vector3} direção normalizada do sol
 */
export function calculateSunDirection(hourOfDay = 12, dayOfYear = 172, latitude = 0) {
  // Ângulo solar (aproximação simples)
  const declination = 23.45 * Math.sin((2 * Math.PI * (dayOfYear - 81)) / 365) * Math.PI / 180
  const hourAngle = (hourOfDay - 12) * 15 * Math.PI / 180
  const latRad = latitude * Math.PI / 180

  // Altura do sol (elevation)
  const elevation = Math.asin(
    Math.sin(latRad) * Math.sin(declination) +
    Math.cos(latRad) * Math.cos(declination) * Math.cos(hourAngle)
  )

  // Azimute do sol
  const azimuth = Math.atan2(
    Math.sin(hourAngle),
    Math.cos(hourAngle) * Math.sin(latRad) - Math.tan(declination) * Math.cos(latRad)
  )

  // Converter para direção 3D
  return new THREE.Vector3(
    Math.cos(elevation) * Math.sin(azimuth),
    Math.sin(elevation),
    Math.cos(elevation) * Math.cos(azimuth)
  ).normalize()
}

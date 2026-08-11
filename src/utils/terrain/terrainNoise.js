/**
 * terrainNoise.js — Ruídos procedurais para terreno (Simplex, Voronoi, Terracing).
 *
 * Extensão do terrainMath.js (que já tem Perlin + fBm).
 *
 * Funcionalidades:
 *  1. Simplex Noise (melhoria sobre Perlin — menos artefactos de alinhamento)
 *  2. Voronoi Noise (Cellular) — picos escarpados e cristas (ridges)
 *  3. Terracing — degraus para formações rochosas em camadas
 *  4. Domain Warping — distorção do domínio para terreno mais orgânico
 *  5. Erosão térmica leve — desgaste de encostas altas + acumulação nos vales
 *
 * Otimização mobile:
 *  - Tudo calculado em JS (não shader) — para uso na geração de heightmap
 *  - Cache de tabelas de permutação (uma vez por seed)
 *  - Versão GLSL disponível para shaders de terreno em tempo real
 */

import { mulberry32, perlin2, buildPermutation } from './terrainMath.js'

// ============================================================
//  SIMPLEX NOISE 2D
// ============================================================
// Melhoria sobre Perlin: sem artefactos de alinhamento em grelha.
// Implementação baseada em Stefan Gustavson (2005).

const SQRT3 = Math.sqrt(3)
const F2 = 0.5 * (SQRT3 - 1)
const G2 = (3 - SQRT3) / 6

const grad3 = [
  [1, 1], [-1, 1], [1, -1], [-1, -1],
  [1, 0], [-1, 0], [0, 1], [0, -1],
]

/**
 * Simplex Noise 2D — retorna valor em [-1, 1].
 * @param {number} x
 * @param {number} y
 * @param {Uint8Array} perm — tabela de permutação (de buildPermutation)
 * @returns {number}
 */
export function simplex2(x, y, perm) {
  let n0 = 0, n1 = 0, n2 = 0

  // Skew das coordenadas de input
  const s = (x + y) * F2
  const i = Math.floor(x + s)
  const j = Math.floor(y + s)

  // Unskew
  const t = (i + j) * G2
  const X0 = i - t
  const Y0 = j - t
  const x0 = x - X0
  const y0 = y - Y0

  // Determinar qual simplex estamos
  let i1, j1
  if (x0 > y0) { i1 = 1; j1 = 0 }
  else { i1 = 0; j1 = 1 }

  const x1 = x0 - i1 + G2
  const y1 = y0 - j1 + G2
  const x2 = x0 - 1 + 2 * G2
  const y2 = y0 - 1 + 2 * G2

  // Hash das cantos
  const ii = i & 255
  const jj = j & 255
  const gi0 = perm[ii + perm[jj]] % 8
  const gi1 = perm[ii + i1 + perm[jj + j1]] % 8
  const gi2 = perm[ii + 1 + perm[jj + 1]] % 8

  // Contribuições dos cantos
  let t0 = 0.5 - x0 * x0 - y0 * y0
  if (t0 >= 0) {
    t0 *= t0
    n0 = t0 * t0 * (grad3[gi0][0] * x0 + grad3[gi0][1] * y0)
  }

  let t1 = 0.5 - x1 * x1 - y1 * y1
  if (t1 >= 0) {
    t1 *= t1
    n1 = t1 * t1 * (grad3[gi1][0] * x1 + grad3[gi1][1] * y1)
  }

  let t2 = 0.5 - x2 * x2 - y2 * y2
  if (t2 >= 0) {
    t2 *= t2
    n2 = t2 * t2 * (grad3[gi2][0] * x2 + grad3[gi2][1] * y2)
  }

  return 70 * (n0 + n1 + n2)
}

/**
 * fBm com Simplex Noise (fractal Brownian motion).
 * @param {number} x
 * @param {number} y
 * @param {Object} opts - { seed, octaves, persistence, lacunarity, scale }
 * @returns {number} valor em [-1, 1]
 */
export function simplexFBM(x, y, opts = {}) {
  const {
    seed = 12345,
    octaves = 4,
    persistence = 0.5,
    lacunarity = 2,
    scale = 20,
  } = opts
  const perm = buildPermutation(seed)
  let total = 0
  let frequency = 1 / scale
  let amplitude = 1
  let maxValue = 0
  for (let i = 0; i < octaves; i++) {
    total += simplex2(x * frequency, y * frequency, perm) * amplitude
    maxValue += amplitude
    amplitude *= persistence
    frequency *= lacunarity
  }
  return total / maxValue
}

// ============================================================
//  VORONOI NOISE (CELLULAR)
// ============================================================
// Gera células baseadas em pontos aleatórios. Usado para cristas (ridges)
// quando combinado com Perlin (multiplicação + inversão).

/**
 * Voronoi Noise 2D — retorna distância ao ponto mais próximo.
 * @param {number} x
 * @param {number} y
 * @param {Object} opts - { seed, frequency, metric }
 *   - metric: 'euclidean' | 'manhattan' | 'chebyshev'
 * @returns {Object} { F1 (1ª distância), F2 (2ª distância), cellId }
 */
export function voronoi2(x, y, opts = {}) {
  const {
    seed = 12345,
    frequency = 1,
    metric = 'euclidean',
  } = opts
  const rng = mulberry32(seed)

  const fx = x * frequency
  const fy = y * frequency
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)

  let F1 = Infinity
  let F2 = Infinity
  let cellId = 0

  // Procurar nas 9 células vizinhas (3x3)
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = ix + dx
      const cy = iy + dy
      // Ponto aleatório dentro da célula (hash-based)
      const hash = mulberry32(cx * 374761393 + cy * 668265263 + seed * 1013904223)
      const px = cx + hash()
      const py = cy + hash()

      let dist
      const ddx = px - fx
      const ddy = py - fy
      if (metric === 'manhattan') {
        dist = Math.abs(ddx) + Math.abs(ddy)
      } else if (metric === 'chebyshev') {
        dist = Math.max(Math.abs(ddx), Math.abs(ddy))
      } else {
        dist = Math.sqrt(ddx * ddx + ddy * ddy)
      }

      if (dist < F1) {
        F2 = F1
        F1 = dist
        cellId = cx * 1000 + cy
      } else if (dist < F2) {
        F2 = dist
      }
    }
  }

  return { F1, F2, cellId }
}

/**
 * Ridged Multifractal — gera cristas afiadas (para montanhas).
 * Combina Perlin com inversão (1 - |noise|) elevada a uma potência.
 *
 * @param {number} x
 * @param {number} y
 * @param {Object} opts - { seed, octaves, lacunarity, gain, offset }
 * @returns {number} valor em [0, 1]
 */
export function ridgedMultifractal(x, y, opts = {}) {
  const {
    seed = 12345,
    octaves = 4,
    lacunarity = 2,
    gain = 0.5,
    offset = 1,
  } = opts
  const perm = buildPermutation(seed)
  let frequency = 1 / 20
  let amplitude = 0.5
  let sum = 0
  let prev = 1
  for (let i = 0; i < octaves; i++) {
    let n = perlin2(x * frequency, y * frequency, perm)
    n = offset - Math.abs(n)
    n = n * n
    sum += n * amplitude * prev
    prev = n
    frequency *= lacunarity
    amplitude *= gain
  }
  return Math.max(0, Math.min(1, sum))
}

// ============================================================
//  TERRACING — DEGRAUS PARA FORMAÇÕES ROCHOSAS
// ============================================================

/**
 * Aplica terracing a um valor de altura — arredonda para o degrau mais próximo.
 * @param {number} height - valor em [-1, 1]
 * @param {number} numSteps - número de degraus (ex: 8)
 * @param {number} sharpness - 0 = suave, 1 = degraus afiados
 * @returns {number} valor com terracing aplicado
 */
export function applyTerracing(height, numSteps = 8, sharpness = 0.5) {
  // Normalizar de [-1, 1] para [0, 1]
  const normalized = (height + 1) * 0.5
  // Quantizar para numSteps níveis
  const stepped = Math.floor(normalized * numSteps) / numSteps
  // Misturar entre suave e afiado
  const mixed = sharpness > 0
    ? mix(normalized, stepped, sharpness)
    : normalized
  // Voltar para [-1, 1]
  return mixed * 2 - 1
}

function mix(a, b, t) {
  return a + (b - a) * t
}

// ============================================================
//  DOMAIN WARPING — DISTORÇÃO DO DOMÍNIO
// ============================================================

/**
 * Domain Warping — distorce as coordenadas de input antes de amostrar o ruído,
 * criando padrões mais orgânicos (sem alinhamento óbvio com a grelha).
 *
 * @param {number} x
 * @param {number} y
 * @param {Object} opts - { seed, warpStrength, warpScale }
 * @returns {number} valor de ruído com domínio distorcido
 */
export function warpedNoise(x, y, opts = {}) {
  const {
    seed = 12345,
    warpStrength = 1.0,
    warpScale = 0.5,
  } = opts
  const perm = buildPermutation(seed)
  // Distorcer as coordenadas com ruído
  const wx = perlin2(x * warpScale, y * warpScale, perm) * warpStrength
  const wy = perlin2((x + 5.2) * warpScale, (y + 1.3) * warpScale, perm) * warpStrength
  // Amostrar ruído com coordenadas distorcidas
  return perlin2(x + wx, y + wy, perm)
}

// ============================================================
//  EROSÃO TÉRMICA LEVE (CPU-side, para geração de heightmap)
// ============================================================
// Erosão térmica: desgaste de encostas altas (talus) + acumulação nos vales.
// Implementação simplificada: para cada célula, se a diferença de altura
// com vizinhos excede o ângulo de repouso, mover material.

/**
 * Aplica erosão térmica leve a um heightmap (in-place).
 * @param {Float32Array} heightmap - array (seg+1)²
 * @param {number} seg - resolução
 * @param {Object} opts - { iterations, talusAngle, amount }
 *   - talusAngle: ângulo de repouso (radianos, default ~30°)
 *   - amount: fração de material a mover por iteração (0-1)
 */
export function applyThermalErosion(heightmap, seg, opts = {}) {
  const {
    iterations = 5,
    talusAngle = Math.PI / 6, // 30°
    amount = 0.5,
  } = opts

  // Talus = diferença máxima de altura permitida entre vizinhos
  const cellSize = 1 // assume células de tamanho 1
  const talus = Math.tan(talusAngle) * cellSize

  for (let iter = 0; iter < iterations; iter++) {
    const snapshot = new Float32Array(heightmap)
    for (let z = 0; z <= seg; z++) {
      for (let x = 0; x <= seg; x++) {
        const idx = z * (seg + 1) + x
        const h = snapshot[idx]
        let totalDiff = 0
        let movableNeighbors = 0

        // Verificar 4 vizinhos
        const neighbors = [
          [x - 1, z], [x + 1, z], [x, z - 1], [x, z + 1],
        ]
        for (const [nx, nz] of neighbors) {
          if (nx < 0 || nx > seg || nz < 0 || nz > seg) continue
          const nIdx = nz * (seg + 1) + nx
          const nh = snapshot[nIdx]
          const diff = h - nh
          if (diff > talus) {
            totalDiff += diff - talus
            movableNeighbors++
          }
        }

        if (movableNeighbors > 0) {
          // Mover material dos vizinhos mais altos para os mais baixos
          const moveAmount = (totalDiff * amount) / movableNeighbors / 4
          heightmap[idx] -= moveAmount * movableNeighbors
          // Distribuir aos vizinhos
          for (const [nx, nz] of neighbors) {
            if (nx < 0 || nx > seg || nz < 0 || nz > seg) continue
            const nIdx = nz * (seg + 1) + nx
            const nh = snapshot[nIdx]
            const diff = h - nh
            if (diff > talus) {
              heightmap[nIdx] += moveAmount
            }
          }
        }
      }
    }
  }
}

/**
 * Gera um heightmap completo usando combinação de ruídos.
 *
 * Combinação recomendada (estilo Unreal Engine Landscape):
 *  - Base: fBm Perlin (montanhas + vales)
 *  - Cr: ridgedMultifractal (cristas afiadas)
 *  - Detalhe: Simplex (micro-detalhe)
 *  - Terracing opcional (formações rochosas)
 *  - Domain warping (organicidade)
 *  - Erosão térmica no final
 *
 * @param {number} seg - resolução (heightmap é (seg+1)²)
 * @param {Object} opts
 * @returns {Float32Array} heightmap em [-1, 1]
 */
export function generateTerrainHeightmap(seg, opts = {}) {
  const {
    seed = 12345,
    scale = 50,
    octaves = 4,
    persistence = 0.5,
    lacunarity = 2,
    ridgedAmount = 0.3,
    warpStrength = 1.0,
    terracing = false,
    terraceSteps = 8,
    terraceSharpness = 0.3,
    erosion = false,
    erosionIterations = 3,
  } = opts

  const heightmap = new Float32Array((seg + 1) * (seg + 1))
  let min = Infinity, max = -Infinity

  for (let z = 0; z <= seg; z++) {
    for (let x = 0; x <= seg; x++) {
      // Coordenadas normalizadas
      const nx = x / scale
      const nz = z / scale

      // 1. fBm Perlin (base)
      let h = simplexFBM(nx, nz, { seed, octaves, persistence, lacunarity, scale: 1 })

      // 2. Domain warping (organicidade)
      if (warpStrength > 0) {
        h = warpedNoise(nx, nz, { seed: seed + 1, warpStrength: warpStrength * 0.5, warpScale: 0.3 })
      }

      // 3. Ridged multifractal (cristas)
      if (ridgedAmount > 0) {
        const ridge = ridgedMultifractal(nx, nz, { seed: seed + 2, octaves: octaves - 1 }) * 2 - 1
        h = h * (1 - ridgedAmount) + ridge * ridgedAmount
      }

      // 4. Terracing (opcional)
      if (terracing) {
        h = applyTerracing(h, terraceSteps, terraceSharpness)
      }

      heightmap[z * (seg + 1) + x] = h
      if (h < min) min = h
      if (h > max) max = h
    }
  }

  // Normalizar para [-1, 1]
  const range = max - min || 1
  for (let i = 0; i < heightmap.length; i++) {
    heightmap[i] = ((heightmap[i] - min) / range) * 2 - 1
  }

  // 5. Erosão térmica (opcional)
  if (erosion) {
    applyThermalErosion(heightmap, seg, { iterations: erosionIterations })
  }

  return heightmap
}

// ============================================================
//  VERSÃO GLSL (para shaders de terreno em tempo real)
// ============================================================
// Estas funções podem ser injetadas em shaders para gerar terreno na GPU.

export const TERRAIN_NOISE_GLSL = /* glsl */ `
  // Simplex Noise 2D (GLSL) — Stefan Gustavson
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x*34.0)+1.0)*x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                       -0.577350269189626, 0.024390243902439);
    vec2 i  = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
           + i.x + vec3(0.0, i1.x, 1.0));
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

  // fBm com Simplex
  float fbm(vec2 p, int octaves, float persistence, float lacunarity) {
    float total = 0.0;
    float frequency = 1.0;
    float amplitude = 1.0;
    float maxValue = 0.0;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      total += snoise(p * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= persistence;
      frequency *= lacunarity;
    }
    return total / maxValue;
  }

  // Ridged multifractal
  float ridged(vec2 p, int octaves, float gain, float offset) {
    float sum = 0.0;
    float frequency = 1.0;
    float amplitude = 0.5;
    float prev = 1.0;
    for (int i = 0; i < 8; i++) {
      if (i >= octaves) break;
      float n = offset - abs(snoise(p * frequency));
      n = n * n;
      sum += n * amplitude * prev;
      prev = n;
      frequency *= 2.0;
      amplitude *= gain;
    }
    return sum;
  }

  // Terracing
  float terrace(float h, float numSteps, float sharpness) {
    float normalized = (h + 1.0) * 0.5;
    float stepped = floor(normalized * numSteps) / numSteps;
    return mix(normalized, stepped, sharpness) * 2.0 - 1.0;
  }
`

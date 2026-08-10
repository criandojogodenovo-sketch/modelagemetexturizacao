/**
 * terrainMath.js — Matemática pura para o editor de terrenos (Unity-aligned).
 *
 * Inclui:
 *  - Ruído Perlin + fBm (fractal Brownian Motion) com seed determinística
 *  - Funções de falloff do pincel: smooth (cosine), constant, linear, sharp
 *  - Operações de pincel sobre heightmap: raise, lower, smooth, flatten, setHeight, noise
 *  - Blending de splatmap multi-camada (até 4 camadas, pesos normalizados)
 *  - Import/export de heightmap como PNG grayscale (8-bit e 16-bit LE)
 *
 * Tudo é puro e testável — sem dependência de React/Three.js.
 */

// ============================================================
//  RNG + Perlin
// ============================================================

/** PRNG Mulberry32 — pequeno e determinístico. */
export function mulberry32(seed) {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Constrói uma tabela de permutação de Perlin a partir de uma seed. */
function buildPermutation(seed) {
  const rng = mulberry32(seed)
  const p = new Uint8Array(512)
  const base = new Uint8Array(256)
  for (let i = 0; i < 256; i++) base[i] = i
  // Fisher-Yates shuffle
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    const tmp = base[i]
    base[i] = base[j]
    base[j] = tmp
  }
  for (let i = 0; i < 512; i++) p[i] = base[i & 255]
  return p
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10)
}

function lerp(a, b, t) {
  return a + (b - a) * t
}

function grad2(hash, x, y) {
  const h = hash & 7
  const u = h < 4 ? x : y
  const v = h < 4 ? y : x
  return ((h & 1) ? -u : u) + ((h & 2) ? -2 * v : 2 * v)
}

/**
 * Perlin 2D melhorado (Ken Perlin 2002) — retorna valor em [-1, 1].
 * Usa uma tabela de permutação determinística por seed.
 */
export function perlin2(x, y, perm) {
  const X = Math.floor(x) & 255
  const Y = Math.floor(y) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const u = fade(xf)
  const v = fade(yf)
  const aa = perm[perm[X] + Y]
  const ab = perm[perm[X] + Y + 1]
  const ba = perm[perm[X + 1] + Y]
  const bb = perm[perm[X + 1] + Y + 1]
  const x1 = lerp(grad2(aa, xf, yf), grad2(ba, xf - 1, yf), u)
  const x2 = lerp(grad2(ab, xf, yf - 1), grad2(bb, xf - 1, yf - 1), u)
  return lerp(x1, x2, v) * 0.4 // ~normalizar para [-1, 1]
}

/**
 * Fractal Brownian Motion (fBm) — soma de oitavas de Perlin.
 * @param {number} x  Coordenada X (não normalizada)
 * @param {number} y  Coordenada Y
 * @param {object} opts  { seed, octaves, persistence, lacunarity, scale }
 * @returns {number}  valor em [-1, 1] (aproximadamente)
 */
export function fbm(x, y, opts) {
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
    total += perlin2(x * frequency, y * frequency, perm) * amplitude
    maxValue += amplitude
    amplitude *= persistence
    frequency *= lacunarity
  }
  return total / maxValue
}

/** Versão com cache da permutação para gerar heightmaps rapidamente. */
export function generateHeightmap(segments, opts) {
  const seg = segments
  const hm = new Float32Array((seg + 1) * (seg + 1))
  const perm = buildPermutation(opts.seed ?? 12345)
  let min = Infinity
  let max = -Infinity
  for (let z = 0; z <= seg; z++) {
    for (let x = 0; x <= seg; x++) {
      const nx = x
      const nz = z
      let total = 0
      let frequency = 1 / (opts.scale ?? 20)
      let amplitude = 1
      let maxValue = 0
      for (let i = 0; i < (opts.octaves ?? 4); i++) {
        total += perlin2(nx * frequency, nz * frequency, perm) * amplitude
        maxValue += amplitude
        amplitude *= opts.persistence ?? 0.5
        frequency *= opts.lacunarity ?? 2
      }
      const v = total / maxValue
      hm[z * (seg + 1) + x] = v
      if (v < min) min = v
      if (v > max) max = v
    }
  }
  // Normalizar para [-1, 1] (preserva sinal para raising/lowering)
  const range = max - min || 1
  for (let i = 0; i < hm.length; i++) {
    hm[i] = ((hm[i] - min) / range) * 2 - 1
  }
  return hm
}

// ============================================================
//  Falloff do pincel — diferentes perfis (Unity-style)
// ============================================================

export const FALLOFF_TYPES = [
  { id: 'smooth',  label: 'Smooth',  desc: 'Curva cosine — bordas suaves (padrão Unity)' },
  { id: 'linear',  label: 'Linear',  desc: 'Decaimento linear — bordas duras' },
  { id: 'constant',label: 'Constant',desc: 'Sem decaimento — topo plano' },
  { id: 'sharp',   label: 'Sharp',   desc: 'Pico acentuado no centro' },
]

/**
 * Calcula o peso de falloff (0..1) para um ponto à distância `dist` do centro
 * do pincel de raio `radius`, dado o tipo de faloff.
 */
export function falloff(dist, radius, type = 'smooth') {
  if (dist >= radius) return 0
  const t = dist / radius // 0 no centro, 1 na borda
  switch (type) {
    case 'linear':
      return 1 - t
    case 'constant':
      return 1
    case 'sharp':
      // 1 - t^2 * 2 + t^4 → pico acentuado
      return 1 - (t * t)
    case 'smooth':
    default:
      // Cosine smoothstep — perfil padrão do Unity
      return 0.5 * (Math.cos(Math.PI * t) + 1)
  }
}

// ============================================================
//  Operações de pincel sobre o heightmap
// ============================================================

/**
 * Aplica uma operação de pincel numa área circular do heightmap.
 *
 * @param {Float32Array} hm       Heightmap (modificado in-place)
 * @param {number} seg            Resolução (heightmap é (seg+1)²)
 * @param {number} cx             Centro X (em células)
 * @param {number} cz             Centro Z (em células)
 * @param {object} opts
 *   - mode: 'raise' | 'lower' | 'smooth' | 'flatten' | 'setHeight' | 'noise'
 *   - size: raio em células
 *   - strength: 0..1
 *   - falloff: 'smooth' | 'linear' | 'constant' | 'sharp'
 *   - targetHeight: valor alvo (para flatten/setHeight)
 *   - deltaTime: fator temporal (para drag contínuo)
 */
export function applyBrush(hm, seg, cx, cz, opts) {
  const {
    mode = 'raise',
    size = 8,
    strength = 0.5,
    falloff: falloffType = 'smooth',
    targetHeight = 0,
    deltaTime = 1,
  } = opts

  const radius = size
  const r2 = radius * radius
  const dt = deltaTime

  // Pré-calcular valores do modo smooth (precisa dos vizinhos)
  if (mode === 'smooth') {
    // Box blur 3x3 dentro da área do pincel
    const tmp = new Float32Array(hm) // snapshot
    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const d2 = dx * dx + dz * dz
        if (d2 > r2) continue
        const px = cx + dx
        const pz = cz + dz
        if (px < 0 || px > seg || pz < 0 || pz > seg) continue
        const dist = Math.sqrt(d2)
        const f = falloff(dist, radius, falloffType)
        const idx = pz * (seg + 1) + px
        // Média 3x3
        let sum = 0
        let count = 0
        for (let sz = -1; sz <= 1; sz++) {
          for (let sx = -1; sx <= 1; sx++) {
            const nx = px + sx
            const nz = pz + sz
            if (nx >= 0 && nx <= seg && nz >= 0 && nz <= seg) {
              sum += tmp[nz * (seg + 1) + nx]
              count++
            }
          }
        }
        const avg = sum / count
        hm[idx] += (avg - hm[idx]) * f * strength * dt
      }
    }
    return
  }

  // Outros modos — operam célula a célula
  const rng = mode === 'noise' ? mulberry32(Date.now() & 0x7fffffff) : null

  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d2 = dx * dx + dz * dz
      if (d2 > r2) continue
      const px = cx + dx
      const pz = cz + dz
      if (px < 0 || px > seg || pz < 0 || pz > seg) continue
      const dist = Math.sqrt(d2)
      const f = falloff(dist, radius, falloffType)
      const idx = pz * (seg + 1) + px
      const amount = f * strength * dt * 0.2

      switch (mode) {
        case 'raise':
          hm[idx] += amount
          break
        case 'lower':
          hm[idx] -= amount
          break
        case 'flatten':
          // Suaviza em direção ao targetHeight
          hm[idx] += (targetHeight - hm[idx]) * f * strength * dt
          break
        case 'setHeight':
          // Define exatamente para targetHeight (com falloff)
          hm[idx] += (targetHeight - hm[idx]) * f * strength * dt * 1.5
          break
        case 'noise': {
          // Adiciona ruído aleatório
          const n = (rng() - 0.5) * 2 // [-1, 1]
          hm[idx] += n * amount
          break
        }
      }
    }
  }
}

/**
 * Aplica uma rampa suave entre 2 pontos (interpola linear entre alturas).
 */
export function applyRamp(hm, seg, p1, p2, opts) {
  const { size = 8, strength = 0.5, falloff: falloffType = 'smooth' } = opts
  const dx = p2[0] - p1[0]
  const dz = p2[1] - p1[1]
  const dist = Math.sqrt(dx * dx + dz * dz)
  const steps = Math.ceil(dist)
  const h1 = hm[p1[1] * (seg + 1) + p1[0]]
  const h2 = hm[p2[1] * (seg + 1) + p2[0]]
  const radius = size
  const r2 = radius * radius
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const px = Math.round(p1[0] + dx * t)
    const pz = Math.round(p1[1] + dz * t)
    const targetH = h1 + (h2 - h1) * t
    for (let oz = -radius; oz <= radius; oz++) {
      for (let ox = -radius; ox <= radius; ox++) {
        const d2 = ox * ox + oz * oz
        if (d2 > r2) continue
        const nx = px + ox
        const nz = pz + oz
        if (nx < 0 || nx > seg || nz < 0 || nz > seg) continue
        const f = falloff(Math.sqrt(d2), radius, falloffType)
        const idx = nz * (seg + 1) + nx
        hm[idx] += (targetH - hm[idx]) * f * strength
      }
    }
  }
}

// ============================================================
//  Splatmap — multi-camada com blending suave
// ============================================================

/**
 * Cria um splatmap "vazio" onde a camada 0 tem peso 1 em todas as células.
 * Layout: Float32Array(cells * maxLayers), em que cada célula tem `maxLayers`
 * pesos (até 4). Os pesos são normalizados (somam 1).
 */
export function createSplatmap(cellCount, maxLayers = 4) {
  const sm = new Float32Array(cellCount * maxLayers)
  for (let i = 0; i < cellCount; i++) {
    sm[i * maxLayers] = 1 // camada 0 dominante
  }
  return sm
}

/**
 * Pinta a camada `layerIdx` no splatmap numa área circular, com blending
 * suave. Os pesos da célula são ajustados: a camada alvo ganha peso e as
 * outras perdem proporcionalmente, mantendo soma = 1.
 */
export function paintSplat(splat, seg, cx, cz, layerIdx, opts) {
  const {
    size = 8,
    strength = 0.5,
    falloff: falloffType = 'smooth',
    maxLayers = 4,
    deltaTime = 1,
  } = opts
  const radius = size
  const r2 = radius * radius
  for (let dz = -radius; dz <= radius; dz++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const d2 = dx * dx + dz * dz
      if (d2 > r2) continue
      const px = cx + dx
      const pz = cz + dz
      if (px < 0 || px > seg || pz < 0 || pz > seg) continue
      const f = falloff(Math.sqrt(d2), radius, falloffType)
      const idx = pz * (seg + 1) + px
      const base = idx * maxLayers
      // Quantidade a transferir para a camada alvo
      const transfer = f * strength * deltaTime
      // Lerp: novos pesos = pesos antigos * (1 - transfer) + target * transfer
      // target = vetor unitário na direção layerIdx
      for (let l = 0; l < maxLayers; l++) {
        const target = l === layerIdx ? 1 : 0
        splat[base + l] = splat[base + l] * (1 - transfer) + target * transfer
      }
    }
  }
}

/**
 * Gera um splatmap procedural baseado em altura E inclinação.
 * Regras (Unity-style, ajustadas para máxima distinção visual):
 *  - altitude < 0.35 → relva (peso 0.9)
 *  - altitude 0.35–0.6 → terra
 *  - altitude > 0.6 + inclinação baixa → pedra/neve mistura
 *  - alta inclinação (>0.15) → pedra sempre
 *  - altitude > 0.8 → neve
 */
export function autoSplatByHeight(hm, seg, layers, maxLayers = 4) {
  const cellCount = (seg + 1) * (seg + 1)
  const sm = new Float32Array(cellCount * maxLayers)
  let min = Infinity, max = -Infinity
  for (let i = 0; i < hm.length; i++) {
    if (hm[i] < min) min = hm[i]
    if (hm[i] > max) max = hm[i]
  }
  const range = max - min || 1

  const layerIdx = {}
  layers.forEach((l, i) => { layerIdx[l.id] = i })

  for (let z = 0; z <= seg; z++) {
    for (let x = 0; x <= seg; x++) {
      const idx = z * (seg + 1) + x
      const h = (hm[idx] - min) / range // 0..1
      // Inclinação (magnitude do gradiente)
      const xL = x > 0 ? hm[idx - 1] : hm[idx]
      const xR = x < seg ? hm[idx + 1] : hm[idx]
      const zU = z > 0 ? hm[idx - (seg + 1)] : hm[idx]
      const zD = z < seg ? hm[idx + (seg + 1)] : hm[idx]
      const slope = Math.sqrt((xR - xL) * (xR - xL) + (zD - zU) * (zD - zU)) / range

      const weights = new Array(maxLayers).fill(0)

      // Pedra em inclinações altas (override quase total)
      const rockW = Math.min(1, slope * 8) // mais sensível a inclinação
      // Neve no topo (acima de 0.65 — mais ampla para ser visível)
      const snowW = h > 0.65 ? Math.min(1, (h - 0.65) * 4) : 0
      // Relva em altitude baixa (abaixo de 0.5) — bastante ampla
      const grassW = h < 0.5 ? Math.max(0, 1 - h * 1.2) : Math.max(0, 0.4 - (h - 0.5) * 2)
      // Terra no meio (transição)
      const dirtW = Math.max(0, 1 - rockW - snowW - grassW)

      if (layerIdx.rock !== undefined)   weights[layerIdx.rock]   = rockW
      if (layerIdx.snow !== undefined)   weights[layerIdx.snow]   = snowW
      if (layerIdx.grass !== undefined)  weights[layerIdx.grass]  = grassW
      if (layerIdx.dirt !== undefined)   weights[layerIdx.dirt]   = dirtW

      // Normalizar
      const sum = weights.reduce((a, b) => a + b, 0) || 1
      for (let l = 0; l < maxLayers; l++) {
        sm[idx * maxLayers + l] = weights[l] / sum
      }
    }
  }
  return sm
}

/**
 * Mistura as cores das camadas usando os pesos do splatmap, retornando
 * um array de RGB por célula (Uint8ClampedArray, length = cellCount * 4 RGBA).
 */
export function splatToColors(splat, cellCount, layerColors, maxLayers = 4) {
  const out = new Uint8ClampedArray(cellCount * 4)
  for (let i = 0; i < cellCount; i++) {
    let r = 0, g = 0, b = 0
    for (let l = 0; l < maxLayers; l++) {
      const w = splat[i * maxLayers + l]
      const c = layerColors[l] || [90, 125, 58]
      r += c[0] * w
      g += c[1] * w
      b += c[2] * w
    }
    out[i * 4] = r
    out[i * 4 + 1] = g
    out[i * 4 + 2] = b
    out[i * 4 + 3] = 255
  }
  return out
}

// ============================================================
//  Import / Export heightmap PNG
// ============================================================

/**
 * Converte um heightmap (Float32Array) num PNG grayscale 8-bit.
 * @param {Float32Array} hm
 * @param {number} seg
 * @returns {string}  dataURL PNG (base64)
 */
export function heightmapToPNG(hm, seg) {
  // Normalizar para 0..255
  let min = Infinity, max = -Infinity
  for (let i = 0; i < hm.length; i++) {
    if (hm[i] < min) min = hm[i]
    if (hm[i] > max) max = hm[i]
  }
  const range = max - min || 1
  const size = seg + 1
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  const imageData = ctx.createImageData(size, size)
  for (let i = 0; i < hm.length; i++) {
    const v = Math.floor(((hm[i] - min) / range) * 255)
    imageData.data[i * 4] = v
    imageData.data[i * 4 + 1] = v
    imageData.data[i * 4 + 2] = v
    imageData.data[i * 4 + 3] = 255
  }
  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL('image/png')
}

/**
 * Carrega um heightmap a partir de um ficheiro PNG (grayscale).
 * @param {File} file
 * @param {number} seg  Resolução alvo (será redimensionado)
 * @returns {Promise<Float32Array>}  Heightmap em [-1, 1]
 */
export function pngToHeightmap(file, seg) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const size = seg + 1
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.drawImage(img, 0, 0, size, size)
      const data = ctx.getImageData(0, 0, size, size).data
      const hm = new Float32Array(size * size)
      for (let i = 0; i < hm.length; i++) {
        const v = data[i * 4] / 255 // 0..1
        hm[i] = v * 2 - 1 // [-1, 1]
      }
      resolve(hm)
    }
    img.onerror = () => reject(new Error('Falha ao carregar PNG'))
    img.src = URL.createObjectURL(file)
  })
}

// ============================================================
//  Helpers de cor
// ============================================================

export function hexToRgb(hex) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.floor(v))).toString(16).padStart(2, '0')).join('')
}

export function applyShade(hex, factor) {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`
}

/** Statísticas do heightmap — útil para mostrar min/max/avg ao utilizador. */
export function heightmapStats(hm) {
  let min = Infinity, max = -Infinity, sum = 0
  for (let i = 0; i < hm.length; i++) {
    if (hm[i] < min) min = hm[i]
    if (hm[i] > max) max = hm[i]
    sum += hm[i]
  }
  return { min, max, avg: sum / hm.length, range: max - min }
}

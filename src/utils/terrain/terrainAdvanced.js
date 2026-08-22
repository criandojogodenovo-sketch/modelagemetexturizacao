/**
 * terrainAdvanced.js — Funcionalidades avançadas de terreno (inspirado em UE5 Landscape).
 *
 * **Realista para mobile WebGL**:
 *  - LOD por distância (nível de subdivisão baseado na distância à câmara)
 *  - Subdivisão em blocos independentes (tiles) com load/unload
 *  - Splines para estradas e rios (esculpir terreno ao longo de PathObject)
 *  - Máscaras de textura combinadas (altura + inclinação + proximidade a água)
 *
 * **Não realista para mobile WebGL (documentado)**:
 *  - Streaming de mipmaps real com page-in/page-out de disco → mobile não tem
 *    disco acessível; usamos LOD geométrico em vez disso
 *  - Nanite/Lumen-style virtualized geometry → demasiado pesado
 *  - World Partition / World Origin shifting → complexidade desnecessária para mobile
 */

import * as THREE from 'three'
import { perlin2, mulberry32 } from './terrainMath'

// ============================================================
//  LOD POR DISTÂNCIA — escolher nível de subdivisão por tile
// ============================================================

/**
 * Calcula o nível de LOD para um tile baseado na distância ao centro da câmara.
 *
 * Níveis:
 *  - LOD 0: resolução máxima (próximo da câmara)
 *  - LOD 1: metade da resolução
 *  - LOD 2: 1/4 da resolução
 *  - LOD 3: 1/8 da resolução (muito distante)
 *
 * @param {THREE.Vector3} cameraPos — posição da câmara
 * @param {THREE.Vector3} tileCenter — centro do tile
 * @param {Object} thresholds — { lod0: 30, lod1: 60, lod2: 100 } (distâncias)
 * @returns {number} nível LOD (0..3)
 */
export function calcTileLOD(cameraPos, tileCenter, thresholds = {}) {
  const dist = cameraPos.distanceTo(tileCenter)
  const { lod0 = 30, lod1 = 60, lod2 = 100 } = thresholds
  if (dist < lod0) return 0
  if (dist < lod1) return 1
  if (dist < lod2) return 2
  return 3
}

/**
 * Gera a geometria de um tile com um dado nível de LOD.
 * O LOD reduz o número de segmentos do tile.
 *
 * @param {Object} tile — { x, z, size, heightmap } (heightmap é Float32Array (seg+1)²)
 * @param {number} baseSegs — segmentos no LOD 0
 * @param {number} lod — nível LOD (0..3)
 * @returns {THREE.BufferGeometry} — geometria do tile
 */
export function buildTileGeometry(tile, baseSegs = 32, lod = 0) {
  // Reduzir resolução por LOD: cada nível divide segmentos por 2
  const segs = Math.max(2, Math.floor(baseSegs / Math.pow(2, lod)))
  const { x: tileX, z: tileZ, size: tileSize, heightmap } = tile

  const positions = []
  const uvs = []
  const indices = []

  // Samplear heightmap com passo adequado ao LOD
  const hmSegs = Math.sqrt(heightmap.length) - 1 // heightmap é quadrado
  const step = hmSegs / segs

  for (let z = 0; z <= segs; z++) {
    for (let x = 0; x <= segs; x++) {
      // Samplear heightmap na posição correspondente
      const hmX = Math.min(hmSegs, Math.floor(x * step))
      const hmZ = Math.min(hmSegs, Math.floor(z * step))
      const h = heightmap[hmZ * (hmSegs + 1) + hmX]

      // Posição no mundo
      const px = tileX + (x / segs) * tileSize
      const pz = tileZ + (z / segs) * tileSize
      const py = h * tileSize * 0.3 // escala de altura
      positions.push(px, py, pz)
      uvs.push(x / segs, z / segs)
    }
  }

  // Índices
  for (let z = 0; z < segs; z++) {
    for (let x = 0; x < segs; x++) {
      const a = z * (segs + 1) + x
      const b = a + 1
      const c = a + (segs + 1)
      const d = c + 1
      indices.push(a, c, b)
      indices.push(b, c, d)
    }
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// ============================================================
//  SUBDIVISÃO EM BLOCOS INDEPENDENTES (TILES)
// ============================================================

/**
 * Divide um heightmap grande numa grelha de tiles.
 * Cada tile pode ser gerido independentemente (load/unload, LOD).
 *
 * @param {Float32Array} heightmap — heightmap completo
 * @param {number} segs — resolução do heightmap (seg+1)²
 * @param {number} tileSize — tamanho do tile em unidades do mundo
 * @param {number} tilesPerSide — número de tiles por lado
 * @returns {Array} — array de tiles { x, z, size, heightmap, lod }
 */
export function splitIntoTiles(heightmap, segs, tileSize, tilesPerSide) {
  const tiles = []
  const hmSegsPerTile = segs / tilesPerSide
  const tileSegs = Math.floor(hmSegsPerTile)

  for (let tz = 0; tz < tilesPerSide; tz++) {
    for (let tx = 0; tx < tilesPerSide; tx++) {
      // Extrair sub-heightmap para este tile
      const subHm = new Float32Array((tileSegs + 1) * (tileSegs + 1))
      for (let z = 0; z <= tileSegs; z++) {
        for (let x = 0; x <= tileSegs; x++) {
          const srcX = tx * tileSegs + x
          const srcZ = tz * tileSegs + z
          const srcIdx = srcZ * (segs + 1) + srcX
          subHm[z * (tileSegs + 1) + x] = heightmap[srcIdx] || 0
        }
      }
      tiles.push({
        x: tx * tileSize,
        z: tz * tileSize,
        size: tileSize,
        heightmap: subHm,
        lod: 0,
        loaded: true,
        tileX: tx,
        tileZ: tz,
      })
    }
  }
  return tiles
}

/**
 * Atualiza o LOD de cada tile com base na posição da câmara.
 * Retorna a lista de tiles que mudaram de LOD (precisam de reconstrução).
 *
 * @param {Array} tiles — array de tiles
 * @param {THREE.Vector3} cameraPos — posição da câmara
 * @param {Object} thresholds — { lod0, lod1, lod2 } distâncias
 * @returns {Array} — tiles que mudaram de LOD
 */
export function updateTileLODs(tiles, cameraPos, thresholds) {
  const changed = []
  for (const tile of tiles) {
    const center = new THREE.Vector3(
      tile.x + tile.size / 2,
      0,
      tile.z + tile.size / 2
    )
    const newLod = calcTileLOD(cameraPos, center, thresholds)
    if (newLod !== tile.lod) {
      tile.lod = newLod
      changed.push(tile)
    }
  }
  return changed
}

// ============================================================
//  SPLINES PARA ESTRADAS E RIOS
// ============================================================

/**
 * Esculpe o terreno ao longo de um PathObject para criar uma estrada ou leito de rio.
 *
 * Para estradas: aplaina (flatten) o terreno ao longo do caminho, com largura configurável.
 * Para rios: desce o terreno para criar um canal, com profundidade configurável.
 *
 * @param {Float32Array} hm — heightmap (modificado in-place)
 * @param {number} segs — resolução (seg+1)²
 * @param {number} worldSize — tamanho do terreno em unidades do mundo
 * @param {Array} pathPoints — array de [x, y, z] pontos do caminho (em coords do mundo)
 * @param {Object} options
 *   - type: 'road' | 'river'
 *   - width: largura em unidades do mundo
 *   - depth: profundidade (apenas para rio)
 *   - smooth: suavizar bordas (true/false)
 */
export function carvePathOnTerrain(hm, segs, worldSize, pathPoints, options = {}) {
  const {
    type = 'road',
    width = 4,
    depth = 1.5,
    smooth = true,
  } = options

  if (!pathPoints || pathPoints.length < 2) return

  // Converter pathPoints para coords do heightmap
  const pathHm = pathPoints.map(p => ({
    x: Math.round((p[0] / worldSize) * segs),
    z: Math.round((p[2] / worldSize) * segs),
    worldY: p[1] || 0,
  }))

  // Para cada segmento do caminho, aplainar/desce ao longo
  const widthInCells = Math.max(1, Math.round((width / worldSize) * segs))
  const width2 = widthInCells * widthInCells

  // Primeiro, calcular a altura média ao longo do caminho (para estradas)
  let avgHeight = 0
  let heightCount = 0
  if (type === 'road') {
    for (let i = 0; i < pathHm.length; i++) {
      const p = pathHm[i]
      if (p.x >= 0 && p.x <= segs && p.z >= 0 && p.z <= segs) {
        avgHeight += hm[p.z * (segs + 1) + p.x]
        heightCount++
      }
    }
    avgHeight = heightCount > 0 ? avgHeight / heightCount : 0
  }

  // Para cada ponto do caminho, aplicar brush
  for (let i = 0; i < pathHm.length - 1; i++) {
    const p1 = pathHm[i]
    const p2 = pathHm[i + 1]
    // Interpolar ao longo do segmento
    const dx = p2.x - p1.x
    const dz = p2.z - p1.z
    const segLen = Math.sqrt(dx * dx + dz * dz)
    const steps = Math.max(1, Math.ceil(segLen))

    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const cx = Math.round(p1.x + dx * t)
      const cz = Math.round(p1.z + dz * t)
      // Para estradas, interpolar altura entre pontos consecutivos
      const targetH = type === 'road'
        ? avgHeight
        : (hm[cz * (segs + 1) + cx] || 0) - depth

      // Aplicar brush circular
      for (let oz = -widthInCells; oz <= widthInCells; oz++) {
        for (let ox = -widthInCells; ox <= widthInCells; ox++) {
          const d2 = ox * ox + oz * oz
          if (d2 > width2) continue
          const px = cx + ox
          const pz = cz + oz
          if (px < 0 || px > segs || pz < 0 || pz > segs) continue
          const idx = pz * (segs + 1) + px

          // Falloff suave nas bordas
          const dist = Math.sqrt(d2)
          const falloff = smooth
            ? 0.5 * (Math.cos(Math.PI * dist / widthInCells) + 1)
            : 1

          if (type === 'road') {
            // Aplainar para a altura alvo
            hm[idx] += (targetH - hm[idx]) * falloff
          } else {
            // Rio: descer o terreno, mas só no centro (preservar margens)
            const riverDepth = depth * falloff
            hm[idx] -= riverDepth
          }
        }
      }
    }
  }
}

/**
 * Gera a malha de uma estrada (faixa de asfalto) que segue um PathObject.
 * Retorna uma geometria plana que pode ser colocada sobre o terreno.
 *
 * @param {Array} pathPoints — array de [x, y, z] pontos do caminho
 * @param {Object} options — { width: 4, color: 0x333333 }
 * @returns {THREE.BufferGeometry} — geometria da estrada
 */
export function buildRoadGeometry(pathPoints, options = {}) {
  const { width = 4 } = options
  if (!pathPoints || pathPoints.length < 2) return null

  const points = pathPoints.map(p => new THREE.Vector3(p[0], p[1] || 0, p[2]))
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5)

  const segments = Math.max(32, points.length * 16)
  const positions = []
  const uvs = []
  const indices = []

  for (let i = 0; i <= segments; i++) {
    const t = i / segments
    const point = curve.getPoint(t)
    const tangent = curve.getTangent(t).normalize()
    // Normal perpendicular à tangente (no plano XZ)
    const normal = new THREE.Vector3(-tangent.z, 0, tangent.x)

    const left = point.clone().addScaledVector(normal, width / 2)
    const right = point.clone().addScaledVector(normal, -width / 2)

    positions.push(left.x, left.y + 0.05, left.z) // ligeiramente acima do terreno
    positions.push(right.x, right.y + 0.05, right.z)
    uvs.push(0, t * segments / 4)
    uvs.push(1, t * segments / 4)
  }

  for (let i = 0; i < segments; i++) {
    const a = i * 2
    const b = a + 1
    const c = a + 2
    const d = a + 3
    indices.push(a, c, b)
    indices.push(b, c, d)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

// ============================================================
//  MÁSCARAS DE TEXTURA POR REGRAS COMBINADAS
// ============================================================

/**
 * Gera splatmap combinando múltiplas regras: altura + inclinação + proximidade a água.
 *
 * Regras (combinadas com pesos):
 *  - Próximo de água (altura < waterLevel) → areia/terra (margem)
 *  - Altura baixa + inclinação baixa → relva
 *  - Altura média + inclinação baixa → floresta/terra
 *  - Altura alta + inclinação baixa → pedra
 *  - Altura muito alta → neve
 *  - Alta inclinação (>threshold) → pedra sempre (override)
 *
 * @param {Float32Array} hm — heightmap
 * @param {number} segs — resolução (seg+1)²
 * @param {Object} options
 *   - waterLevel: -1..1 (altura da água)
 *   - beachWidth: largura da margem (em unidades de altura)
 *   - slopeThreshold: inclinação acima da qual é pedra
 *   - snowLevel: altura acima da qual é neve
 * @param {number} maxLayers — máximo de camadas (default 4)
 * @returns {Float32Array} splatmap com pesos por camada
 */
export function autoSplatCombinedRules(hm, segs, options = {}, maxLayers = 4) {
  const {
    waterLevel = -0.2,
    beachWidth = 0.1,
    slopeThreshold = 0.15,
    snowLevel = 0.7,
  } = options

  const cellCount = (segs + 1) * (segs + 1)
  const sm = new Float32Array(cellCount * maxLayers)
  // Layers: 0=areia (margem), 1=relva, 2=terra/floresta, 3=pedra/neve

  let min = Infinity, max = -Infinity
  for (let i = 0; i < hm.length; i++) {
    if (hm[i] < min) min = hm[i]
    if (hm[i] > max) max = hm[i]
  }
  const range = max - min || 1

  for (let z = 0; z <= segs; z++) {
    for (let x = 0; x <= segs; x++) {
      const idx = z * (segs + 1) + x
      const h = (hm[idx] - min) / range // 0..1 normalizado
      // Inclinação
      const xL = x > 0 ? hm[idx - 1] : hm[idx]
      const xR = x < segs ? hm[idx + 1] : hm[idx]
      const zU = z > 0 ? hm[idx - (segs + 1)] : hm[idx]
      const zD = z < segs ? hm[idx + (segs + 1)] : hm[idx]
      const slope = Math.sqrt((xR - xL) ** 2 + (zD - zU) ** 2) / range

      const weights = [0, 0, 0, 0]

      // Regra 1: proximidade a água → areia (margem)
      const waterNorm = (waterLevel - min) / range
      if (h < waterNorm + beachWidth) {
        // Quanto mais perto da água, mais areia
        const beachFactor = Math.max(0, 1 - (h - waterNorm) / beachWidth)
        weights[0] = beachFactor
      }

      // Regra 2: inclinação alta → pedra (override)
      if (slope > slopeThreshold) {
        const rockFactor = Math.min(1, (slope - slopeThreshold) * 5)
        weights[3] = Math.max(weights[3], rockFactor)
      }

      // Regra 3: altura alta → neve
      if (h > snowLevel) {
        const snowFactor = Math.min(1, (h - snowLevel) * 3)
        weights[3] = Math.max(weights[3], snowFactor) // neve vai para layer 3 (misturada com pedra)
      }

      // Regra 4: altura baixa → relva (se não for margem nem pedra)
      if (h < 0.5 && weights[0] < 0.5 && weights[3] < 0.5) {
        weights[1] = Math.max(0, 1 - h * 1.5)
      }

      // Regra 5: altura média → terra/floresta (se não for dominado por outro)
      if (h >= 0.3 && h < snowLevel && weights[3] < 0.5) {
        weights[2] = Math.max(0, 1 - Math.abs(h - 0.5) * 2)
      }

      // Normalizar para que soma = 1
      const sum = weights.reduce((a, b) => a + b, 0) || 1
      for (let l = 0; l < maxLayers; l++) {
        sm[idx * maxLayers + l] = weights[l] / sum
      }
    }
  }
  return sm
}

// ============================================================
//  HONESTIDADE: o que é vs não é realista em mobile WebGL
// ============================================================
export const TERRAIN_UE5_FEATURES = {
  // Implementado e realista para mobile
  lodByDistance: {
    implemented: true,
    description: 'LOD geométrico por distância — reduz segmentos de tiles distantes',
    mobileFriendly: true,
  },
  tileSubdivision: {
    implemented: true,
    description: 'Terreno dividido em tiles independentes com LOD próprio',
    mobileFriendly: true,
  },
  splinesForRoads: {
    implemented: true,
    description: 'Estradas e rios seguem PathObject, esculpindo o terreno',
    mobileFriendly: true,
  },
  combinedTextureMasks: {
    implemented: true,
    description: 'Auto-paint combinando altura + inclinação + proximidade a água',
    mobileFriendly: true,
  },
  // Não realista para mobile (documentado)
  mipmapStreaming: {
    implemented: false,
    description: 'Streaming de mipmaps de disco — mobile não tem disco acessível',
    mobileFriendly: false,
    alternative: 'Usamos LOD geométrico em vez de streaming de texturas',
  },
  naniteGeometry: {
    implemented: false,
    description: 'Nanite-style virtualized geometry — demasiado pesado para mobile',
    mobileFriendly: false,
    alternative: 'Usar decimate modifier em objetos complexos',
  },
  worldPartition: {
    implemented: false,
    description: 'World Partition com page-in/out — complexidade desnecessária para mobile',
    mobileFriendly: false,
    alternative: 'Usar NavigatorObject para transição entre cenas',
  },
}

/**
 * forestGenerator.js — Gerador procedural de florestas para Flir Engine.
 *
 * Fase 3 — Gerador de Florestas.
 *
 * Espalha árvores/vegetação automaticamente numa área, usando objetos do
 * catálogo + instâncias na cena ativa. Variação de escala/rotação/tipo.
 *
 * Tipos de árvore (3):
 *  - Pine (pinheiro): cone + cylinder (tronco)
 *  - Oak (carvalho): sphere + cylinder
 *  - Birch (bétula): cone estreito + cylinder fino
 *
 * Vegetação extra:
 *  - Bush (arbusto): sphere achatada
 *  - Rock (pedra): cube com escala irregular
 *
 * Respeita regras de inclinação/altura do terreno se um TerrainObject
 * estiver presente na cena (lê heightmap para posicionar árvores na
 * superfície do terreno).
 *
 * Uso:
 *   import { generateForest } from '../utils/forestGenerator'
 *   generateForest(useStore.getState(), { count: 30, area: 40, types: ['pine','oak','birch'] })
 */

import { createSceneObject, defaultMaterial } from './primitives'

// ===== Helpers =====

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

// Garante que um objeto com certo nome+tipo existe no catálogo
function ensureCatalogObject(store, name, type, args, material) {
  const existing = store.objects.find(o => o.name === name && o.type === type)
  if (existing) return existing.id

  const obj = store.addObject(type, [0, 0, 0])
  store.updateObject(obj.id, {
    name,
    args: { ...args },
    material: material || defaultMaterial(),
  })
  return obj.id
}

// Adiciona instância à cena ativa
function addInstance(store, objectId, position) {
  return store.addObjectToScene(objectId, position)
}

// ===== Paletas de cores =====

const TRUNK_COLORS = ['#4a3a28', '#5a4a30', '#3a2a18', '#6a5a40']
const PINE_COLORS = ['#2d4a2a', '#3a5a38', '#1e3a1e', '#456b3a']
const OAK_COLORS = ['#3a6a2a', '#4a7a3a', '#2d5a2d', '#5a8a4a']
const BIRCH_COLORS = ['#5a8a5a', '#6a9a6a', '#4a7a4a', '#7aaa7a']
const BUSH_COLORS = ['#3a5a2a', '#4a6a3a', '#2d4a2d', '#5a7a4a']
const ROCK_COLORS = ['#6a6a6a', '#7a7a7a', '#5a5a5a', '#8a8a8a']

// ===== Gerador de Floresta =====

/**
 * Gera uma floresta com árvores e vegetação.
 *
 * @param {object} store — useStore.getState()
 * @param {object} options
 *   - position: [x, y, z] (centro da área, default [0, 0, 0])
 *   - count: número de árvores (default 30)
 *   - area: área de dispersão em unidades (default 40)
 *   - types: array de tipos de árvore (default ['pine', 'oak', 'birch'])
 *   - includeBushes: incluir arbustos (default true)
 *   - includeRocks: incluir pedras (default true)
 *   - bushRatio: proporção de arbustos relativos a árvores (default 0.3)
 *   - rockRatio: proporção de pedras (default 0.2)
 *   - terrainHeightmap: Float32Array opcional do heightmap do terreno
 *   - terrainSize: tamanho do terreno (para mapear posição → heightmap)
 *   - terrainHeightScale: escala de altura do terreno
 * @returns {object} — { instanceIds: string[], treeCount, bushCount, rockCount }
 */
export function generateForest(store, options = {}) {
  if (!store || !store.activeSceneId) {
    store.toast?.('Crie uma cena primeiro', 'error')
    return { instanceIds: [], treeCount: 0, bushCount: 0, rockCount: 0 }
  }

  const {
    position = [0, 0, 0],
    count = 30,
    area = 40,
    types = ['pine', 'oak', 'birch'],
    includeBushes = true,
    includeRocks = true,
    bushRatio = 0.3,
    rockRatio = 0.2,
    terrainHeightmap = null,
    terrainSize = 50,
    terrainHeightScale = 5,
  } = options

  const instanceIds = []
  let treeCount = 0
  let bushCount = 0
  let rockCount = 0

  store._pushHistory?.()

  // ===== Criar objetos no catálogo (uma vez por tipo) =====

  // Pinheiro: tronco (cylinder) + cone (folhagem)
  const pineTrunkId = ensureCatalogObject(store, 'Floresta_Pinheiro_Tronco', 'cylinder', {
    radius: 0.2,
    height: 2,
    segments: 8,
  }, { ...defaultMaterial(), color: pick(TRUNK_COLORS), roughness: 0.9 })

  const pineFoliageId = ensureCatalogObject(store, 'Floresta_Pinheiro_Folhagem', 'cone', {
    radius: 1.2,
    height: 3,
    segments: 8,
  }, { ...defaultMaterial(), color: pick(PINE_COLORS), roughness: 0.85 })

  // Carvalho: tronco (cylinder) + sphere (folhagem)
  const oakTrunkId = ensureCatalogObject(store, 'Floresta_Carvalho_Tronco', 'cylinder', {
    radius: 0.3,
    height: 2.5,
    segments: 8,
  }, { ...defaultMaterial(), color: pick(TRUNK_COLORS), roughness: 0.9 })

  const oakFoliageId = ensureCatalogObject(store, 'Floresta_Carvalho_Folhagem', 'sphere', {
    radius: 1.5,
    segments: 16,
  }, { ...defaultMaterial(), color: pick(OAK_COLORS), roughness: 0.85 })

  // Bétula: tronco fino (cylinder) + cone estreito (folhagem)
  const birchTrunkId = ensureCatalogObject(store, 'Floresta_Betula_Tronco', 'cylinder', {
    radius: 0.15,
    height: 3,
    segments: 8,
  }, { ...defaultMaterial(), color: '#e0e0e0', roughness: 0.7 })

  const birchFoliageId = ensureCatalogObject(store, 'Floresta_Betula_Folhagem', 'cone', {
    radius: 0.8,
    height: 2.5,
    segments: 8,
  }, { ...defaultMaterial(), color: pick(BIRCH_COLORS), roughness: 0.85 })

  // Arbusto: sphere achatada
  const bushId = ensureCatalogObject(store, 'Floresta_Arbusto', 'sphere', {
    radius: 0.6,
    segments: 12,
  }, { ...defaultMaterial(), color: pick(BUSH_COLORS), roughness: 0.9 })

  // Pedra: cube com escala irregular
  const rockId = ensureCatalogObject(store, 'Floresta_Pedra', 'cube', {
    size: 1,
  }, { ...defaultMaterial(), color: pick(ROCK_COLORS), roughness: 0.95 })

  // ===== Helper: obter altura do terreno numa posição =====
  function getTerrainHeight(x, z) {
    if (!terrainHeightmap) return 0
    // Mapear posição do mundo para coordenadas do heightmap
    const halfSize = terrainSize / 2
    const normalizedX = (x - position[0] + halfSize) / terrainSize
    const normalizedZ = (z - position[2] + halfSize) / terrainSize
    // Verificar se está dentro do terreno
    if (normalizedX < 0 || normalizedX > 1 || normalizedZ < 0 || normalizedZ > 1) return 0
    // Tamanho do heightmap (assumindo quadrado)
    const seg = Math.sqrt(terrainHeightmap.length) - 1
    const hx = Math.floor(normalizedX * seg)
    const hz = Math.floor(normalizedZ * seg)
    const idx = hz * (seg + 1) + hx
    return (terrainHeightmap[idx] || 0) * terrainHeightScale
  }

  // ===== Gerar árvores =====

  for (let i = 0; i < count; i++) {
    // Posição aleatória na área
    const x = position[0] + rand(-area / 2, area / 2)
    const z = position[2] + rand(-area / 2, area / 2)
    const baseY = getTerrainHeight(x, z)

    // Escolher tipo de árvore
    const treeType = pick(types)

    // Variação de escala
    const scale = rand(0.7, 1.4)
    const rotationY = rand(0, Math.PI * 2)

    if (treeType === 'pine') {
      // Pinheiro: tronco + cone
      const trunkY = baseY + 1 * scale
      addInstance(store, pineTrunkId, [x, trunkY, z])
      const foliageY = baseY + (2 + 1.5) * scale
      addInstance(store, pineFoliageId, [x, foliageY, z])
      treeCount += 2
    } else if (treeType === 'oak') {
      // Carvalho: tronco + sphere
      const trunkY = baseY + 1.25 * scale
      addInstance(store, oakTrunkId, [x, trunkY, z])
      const foliageY = baseY + (2.5 + 1.5) * scale
      addInstance(store, oakFoliageId, [x, foliageY, z])
      treeCount += 2
    } else if (treeType === 'birch') {
      // Bétula: tronco fino + cone estreito
      const trunkY = baseY + 1.5 * scale
      addInstance(store, birchTrunkId, [x, trunkY, z])
      const foliageY = baseY + (3 + 1.25) * scale
      addInstance(store, birchFoliageId, [x, foliageY, z])
      treeCount += 2
    }

    instanceIds.push(treeType) // tracking
  }

  // ===== Gerar arbustos =====

  if (includeBushes) {
    const numBushes = Math.floor(count * bushRatio)
    for (let i = 0; i < numBushes; i++) {
      const x = position[0] + rand(-area / 2, area / 2)
      const z = position[2] + rand(-area / 2, area / 2)
      const baseY = getTerrainHeight(x, z)
      const scale = rand(0.5, 1.2)
      addInstance(store, bushId, [x, baseY + 0.3 * scale, z])
      bushCount++
      instanceIds.push('bush')
    }
  }

  // ===== Gerar pedras =====

  if (includeRocks) {
    const rockCountTarget = Math.floor(count * rockRatio)
    for (let i = 0; i < rockCountTarget; i++) {
      const x = position[0] + rand(-area / 2, area / 2)
      const z = position[2] + rand(-area / 2, area / 2)
      const baseY = getTerrainHeight(x, z)
      const scale = rand(0.3, 0.8)
      addInstance(store, rockId, [x, baseY + 0.2 * scale, z])
      rockCount++
      instanceIds.push('rock')
    }
  }

  const totalTrees = Math.floor(treeCount / 2) // cada árvore = 2 instâncias (tronco + folhagem)
  store.toast?.(`Floresta gerada: ${totalTrees} árvores, ${bushCount} arbustos, ${rockCount} pedras`, 'success', 2000)

  return {
    instanceIds,
    treeCount: totalTrees,
    bushCount,
    rockCount,
  }
}

// ===== Lista de tipos de árvore (para UI) =====

export const TREE_TYPES = [
  { id: 'pine', label: 'Pinheiro', description: 'Cone + tronco (clássico)' },
  { id: 'oak', label: 'Carvalho', description: 'Esfera + tronco (denso)' },
  { id: 'birch', label: 'Bétula', description: 'Cone estreito + tronco fino (delicado)' },
]

export default { generateForest, TREE_TYPES }

/**
 * proceduralBuilders.js — Construtores profissionais para Flir Engine.
 *
 * Fase 2 — Construtores Profissionais.
 *
 * Gera cenas complexas (cidades, edifícios, carros, mobiliário urbano) usando
 * objetos do catálogo (store.objects) + instâncias na cena ativa.
 *
 * Cada gerador:
 *  - Cria N objetos no catálogo (store.addObject) se ainda não existirem
 *  - Adiciona instâncias à cena ativa (store.addObjectToScene)
 *  - Aplica variação automática (altura, rotação, escala, cor) para evitar repetição
 *  - Usa primitivas existentes (cube, cylinder, cone, plane, sphere, torus)
 *  - NÃO cria geometrias custom — usa o sistema de objetos existente
 *
 * Construtores:
 *  - generateCity(store, options) — cidade com quarteirões e edifícios
 *  - generateBuilding(store, options) — edifício modular (andares + telhado)
 *  - generateCar(store, options) — carro com carroçaria + jantes + faróis
 *  - generateStreetFurniture(store, options) — postes, bancos, sinais
 *
 * Uso:
 *   import { generateCity, generateBuilding, generateCar, generateStreetFurniture } from '../utils/proceduralBuilders'
 *   generateCity(useStore.getState(), { blocks: 3, buildingsPerBlock: 4 })
 */

import { createSceneObject, defaultMaterial } from './primitives'

// ===== Helpers =====

function uid() {
  return `obj_${Math.random().toString(36).slice(2, 10)}`
}

function rand(min, max) {
  return min + Math.random() * (max - min)
}

function pickColor(palette) {
  return palette[Math.floor(Math.random() * palette.length)]
}

// Garante que um objeto com certo nome+tipo existe no catálogo; cria se não existir
function ensureCatalogObject(store, name, type, args, material) {
  const existing = store.objects.find(o => o.name === name && o.type === type)
  if (existing) return existing.id

  // Criar via store.addObject e depois atualizar nome/args/material
  const obj = store.addObject(type, [0, 0, 0])
  store.updateObject(obj.id, {
    name,
    args: { ...args },
    material: material || defaultMaterial(),
  })
  return obj.id
}

// Adiciona instância à cena ativa
function addInstance(store, objectId, position, rotation, scale) {
  return store.addObjectToScene(objectId, position)
  // Nota: addObjectToScene não suporta rotation/scale diretamente — usamos updateSceneInstance
}

// ===== Paletas de cores =====

const BUILDING_COLORS = [
  '#8b8b8b', '#a0a0a0', '#b5b5b5', '#7a7a7a',
  '#9c9c9c', '#888888', '#b0b0b0', '#8f8f8f',
  '#c4b89a', '#a8a098', '#d4c8b0', '#988878',
]

const ROOF_COLORS = ['#3a3a3a', '#4a4a4a', '#2a2a2a', '#5a3a3a', '#4a3a2a']

const CAR_COLORS = [
  '#e63946', '#457b9d', '#2a9d8f', '#f4a261',
  '#264653', '#e9c46a', '#1d3557', '#a8dadc',
  '#000000', '#ffffff', '#333333', '#6c757d',
]

// Fase 14 — Paletas realistas baseadas em referências reais
const REALISTIC_BUILDING_MATERIALS = [
  { color: '#c4b89a', roughness: 0.9, metalness: 0.0 }, // arenito
  { color: '#a8a098', roughness: 0.85, metalness: 0.0 }, // concreto
  { color: '#6b5b4f', roughness: 0.95, metalness: 0.0 }, // tijolo escuro
  { color: '#d4c8b0', roughness: 0.8, metalness: 0.0 }, // arenito claro
  { color: '#8a8a8a', roughness: 0.7, metalness: 0.1 }, // metal pintado
  { color: '#4a4a4a', roughness: 0.6, metalness: 0.3 }, // vidro escuro
]

const REALISTIC_CAR_MATERIALS = {
  sedan: { roughness: 0.2, metalness: 0.8 },
  suv: { roughness: 0.3, metalness: 0.7 },
  sports: { roughness: 0.1, metalness: 0.9 },
  truck: { roughness: 0.4, metalness: 0.6 },
}

const FURNITURE_COLORS = {
  pole: '#4a4a4a',
  bench: '#8b6f47',
  sign: '#c0392b',
}

// ===== Gerador de Edifício =====

/**
 * Gera um edifício modular com andares + telhado.
 * Cria objetos no catálogo (base, andar, telhado) e adiciona instâncias à cena.
 *
 * @param {object} store — useStore.getState()
 * @param {object} options
 *   - position: [x, y, z] (default [0, 0, 0])
 *   - floors: número de andares (default 3, variação automática ±1)
 *   - width: largura (default 4)
 *   - depth: profundidade (default 4)
 *   - floorHeight: altura de cada andar (default 3)
 *   - style: 'modern' | 'classic' | 'industrial'
 * @returns {object} — { buildingIds: string[], instanceIds: string[] }
 */
export function generateBuilding(store, options = {}) {
  if (!store || !store.activeSceneId) {
    store.toast?.('Crie uma cena primeiro', 'error')
    return { buildingIds: [], instanceIds: [] }
  }

  const {
    position = [0, 0, 0],
    floors: baseFloors = 3,
    width = 4,
    depth = 4,
    floorHeight = 3,
    style = 'modern',
  } = options

  // Variação automática
  const floors = Math.max(1, baseFloors + Math.floor(rand(-1, 2)))
  const actualWidth = width + rand(-0.5, 0.5)
  const actualDepth = depth + rand(-0.5, 0.5)
  // Fase 14 — Material realista (referência: arenito, concreto, tijolo, vidro)
  const realMat = pick(REALISTIC_BUILDING_MATERIALS)
  const buildingColor = realMat.color
  const roofColor = pickColor(ROOF_COLORS)

  const buildingIds = []
  const instanceIds = []

  // 1. Base (fundação — ligeiramente maior)
  const baseId = ensureCatalogObject(store, `Edifício_Base_${style}`, 'cube', {
    size: 1,
  }, { ...defaultMaterial(), color: '#555555', roughness: 0.9 })
  buildingIds.push(baseId)

  const baseInstance = addInstance(store, baseId,
    [position[0], position[1] + 0.25, position[2]],
    [0, 0, 0], [actualWidth + 0.4, 0.5, actualDepth + 0.4])
  instanceIds.push(baseInstance)

  // 2. Andares (cada um é um cube)
  const floorId = ensureCatalogObject(store, `Edifício_Andar_${style}`, 'cube', {
    size: 1,
  }, { ...defaultMaterial(), color: buildingColor, roughness: buildingRoughness, metalness: buildingMetalness })
  buildingIds.push(floorId)

  for (let f = 0; f < floors; f++) {
    const y = position[1] + 0.5 + f * floorHeight + floorHeight / 2
    const inst = addInstance(store, floorId,
      [position[0], y, position[2]],
      [0, 0, 0], [actualWidth, floorHeight, actualDepth])
    instanceIds.push(inst)
  }

  // 3. Telhado (cone ou plano dependendo do estilo)
  if (style === 'classic') {
    // Telhado inclinado (cone)
    const roofId = ensureCatalogObject(store, `Edifício_Telhado_${style}`, 'cone', {
      radius: Math.max(actualWidth, actualDepth) * 0.7,
      height: 2,
      segments: 4,
    }, { ...defaultMaterial(), color: roofColor, roughness: 0.85 })
    buildingIds.push(roofId)

    const roofY = position[1] + 0.5 + floors * floorHeight + 1
    const roofInst = addInstance(store, roofId,
      [position[0], roofY, position[2]],
      [0, Math.PI / 4, 0], [1, 1, 1])
    instanceIds.push(roofInst)
  } else {
    // Telhado plano (cube fino)
    const roofId = ensureCatalogObject(store, `Edifício_Telhado_${style}`, 'cube', {
      size: 1,
    }, { ...defaultMaterial(), color: roofColor, roughness: 0.9 })
    buildingIds.push(roofId)

    const roofY = position[1] + 0.5 + floors * floorHeight + 0.15
    const roofInst = addInstance(store, roofId,
      [position[0], roofY, position[2]],
      [0, 0, 0], [actualWidth + 0.2, 0.3, actualDepth + 0.2])
    instanceIds.push(roofInst)
  }

  // 4. Varandas (se estilo modern, adicionar 1 varanda no 1º andar)
  if (style === 'modern' && floors > 1) {
    const balconyId = ensureCatalogObject(store, 'Edifício_Varanda', 'cube', {
      size: 1,
    }, { ...defaultMaterial(), color: '#666666', roughness: 0.7 })
    buildingIds.push(balconyId)

    const balconyY = position[1] + 0.5 + floorHeight + 0.1
    const balconyInst = addInstance(store, balconyId,
      [position[0] + actualWidth / 2 + 0.5, balconyY, position[2]],
      [0, 0, 0], [1.2, 0.2, actualDepth * 0.6])
    instanceIds.push(balconyInst)
  }

  store.toast?.(`Edifício ${style} gerado (${floors} andares)`, 'success', 1500)
  return { buildingIds, instanceIds }
}

// ===== Gerador de Cidade =====

/**
 * Gera uma cidade com quarteirões e edifícios.
 * Organiza edifícios em grid de quarteirões com ruas entre eles.
 *
 * @param {object} store — useStore.getState()
 * @param {object} options
 *   - blocks: número de quarteirões por lado (default 2 → 4 quarteirões)
 *   - buildingsPerBlock: edifícios por quarteirão (default 2)
 *   - blockSize: tamanho do quarteirão (default 12)
 *   - streetWidth: largura da rua (default 4)
 *   - styles: array de estilos (default ['modern', 'classic', 'industrial'])
 * @returns {object} — { instanceIds: string[] }
 */
export function generateCity(store, options = {}) {
  if (!store || !store.activeSceneId) {
    store.toast?.('Crie uma cena primeiro', 'error')
    return { instanceIds: [] }
  }

  const {
    blocks = 2,
    buildingsPerBlock = 2,
    blockSize = 12,
    streetWidth = 4,
    styles = ['modern', 'classic', 'industrial'],
  } = options

  const allInstanceIds = []
  const totalSpan = blocks * blockSize + (blocks - 1) * streetWidth
  const offset = -totalSpan / 2

  store._pushHistory?.()

  for (let bx = 0; bx < blocks; bx++) {
    for (let bz = 0; bz < blocks; bz++) {
      const blockX = offset + bx * (blockSize + streetWidth)
      const blockZ = offset + bz * (blockSize + streetWidth)

      // Gerar edifícios dentro do quarteirão
      for (let b = 0; b < buildingsPerBlock; b++) {
        const buildingX = blockX + rand(-blockSize / 3, blockSize / 3)
        const buildingZ = blockZ + rand(-blockSize / 3, blockSize / 3)
        const style = styles[Math.floor(rand(0, styles.length))]
        const floors = Math.floor(rand(2, 6))

        const result = generateBuilding(store, {
          position: [buildingX, 0, buildingZ],
          floors,
          width: rand(3, 5),
          depth: rand(3, 5),
          floorHeight: rand(2.5, 3.5),
          style,
        })
        allInstanceIds.push(...result.instanceIds)
      }
    }
  }

  // Gerar mobiliário urbano ao longo das ruas
  const furnitureResult = generateStreetFurniture(store, {
    count: blocks * 2,
    area: totalSpan,
  })
  allInstanceIds.push(...furnitureResult.instanceIds)

  store.toast?.(`Cidade gerada: ${blocks * blocks} quarteirões, ${allInstanceIds.length} instâncias`, 'success', 2000)
  return { instanceIds: allInstanceIds }
}

// ===== Gerador de Carro =====

/**
 * Gera um carro com carroçaria + jantes + faróis + spoilers.
 * Cria objetos no catálogo e adiciona instâncias à cena.
 *
 * @param {object} store — useStore.getState()
 * @param {object} options
 *   - position: [x, y, z] (default [0, 0, 0])
 *   - bodyType: 'sedan' | 'suv' | 'sports' | 'truck'
 *   - color: cor da carroçaria (default aleatório)
 * @returns {object} — { instanceIds: string[] }
 */
export function generateCar(store, options = {}) {
  if (!store || !store.activeSceneId) {
    store.toast?.('Crie uma cena primeiro', 'error')
    return { instanceIds: [] }
  }

  const {
    position = [0, 0, 0],
    bodyType = 'sedan',
    color = pickColor(CAR_COLORS),
  } = options

  const instanceIds = []

  // Dimensões por tipo de carroçaria
  const dims = {
    sedan:  { length: 4.2, width: 1.8, height: 1.2, cabinH: 1.0, cabinL: 2.0, rideH: 0.5 },
    suv:    { length: 4.5, width: 2.0, height: 1.5, cabinH: 1.2, cabinL: 2.4, rideH: 0.6 },
    sports: { length: 4.0, width: 1.9, height: 1.0, cabinH: 0.8, cabinL: 1.6, rideH: 0.4 },
    truck:  { length: 5.5, width: 2.2, height: 1.8, cabinH: 1.0, cabinL: 1.8, rideH: 0.7 },
  }
  const d = dims[bodyType] || dims.sedan

  store._pushHistory?.()

  // 1. Carroçaria inferior (cube) — Fase 14: material realista com metalness
  const carMat = REALISTIC_CAR_MATERIALS[bodyType] || REALISTIC_CAR_MATERIALS.sedan
  const bodyId = ensureCatalogObject(store, `Carro_Carroçaria_${bodyType}`, 'cube', {
    size: 1,
  }, { ...defaultMaterial(), color, roughness: carMat.roughness, metalness: carMat.metalness })
  const bodyInst = addInstance(store, bodyId,
    [position[0], position[1] + d.rideH + d.height / 2, position[2]],
    [0, 0, 0], [d.length, d.height, d.width])
  instanceIds.push(bodyInst)

  // 2. Cabine (cube mais pequeno em cima)
  const cabinId = ensureCatalogObject(store, `Carro_Cabine_${bodyType}`, 'cube', {
    size: 1,
  }, { ...defaultMaterial(), color: '#222222', roughness: 0.2, metalness: 0.5, transparent: true, opacity: 0.7 })
  const cabinOffset = bodyType === 'sports' ? 0 : d.length * 0.1
  const cabinInst = addInstance(store, cabinId,
    [position[0] + cabinOffset, position[1] + d.rideH + d.height + d.cabinH / 2, position[2]],
    [0, 0, 0], [d.cabinL, d.cabinH, d.width * 0.9])
  instanceIds.push(cabinInst)

  // 3. Rodas (4 cylinders)
  const wheelId = ensureCatalogObject(store, 'Carro_Roda', 'cylinder', {
    radius: d.rideH * 0.6,
    height: 0.3,
    segments: 16,
  }, { ...defaultMaterial(), color: '#1a1a1a', roughness: 0.9 })
  const wheelOffsets = [
    [d.length * 0.35, d.rideH * 0.4, d.width * 0.5],
    [d.length * 0.35, d.rideH * 0.4, -d.width * 0.5],
    [-d.length * 0.35, d.rideH * 0.4, d.width * 0.5],
    [-d.length * 0.35, d.rideH * 0.4, -d.width * 0.5],
  ]
  for (const [ox, oy, oz] of wheelOffsets) {
    const inst = addInstance(store, wheelId,
      [position[0] + ox, position[1] + oy, position[2] + oz],
      [0, 0, Math.PI / 2], [1, 1, 1])
    instanceIds.push(inst)
  }

  // 4. Faróis (2 cubes pequenos)
  const headlightId = ensureCatalogObject(store, 'Carro_Farol', 'cube', {
    size: 1,
  }, { ...defaultMaterial(), color: '#ffffcc', emissive: '#ffffaa', emissiveIntensity: 0.8 })
  for (const side of [-1, 1]) {
    const inst = addInstance(store, headlightId,
      [position[0] + d.length * 0.5, position[1] + d.rideH + d.height * 0.4, position[2] + side * d.width * 0.35],
      [0, 0, 0], [0.2, 0.2, 0.3])
    instanceIds.push(inst)
  }

  // 5. Spoiler (se sports)
  if (bodyType === 'sports') {
    const spoilerId = ensureCatalogObject(store, 'Carro_Spoiler', 'cube', {
      size: 1,
    }, { ...defaultMaterial(), color: '#1a1a1a', roughness: 0.5 })
    const spoilerInst = addInstance(store, spoilerId,
      [position[0] - d.length * 0.5, position[1] + d.rideH + d.height + 0.2, position[2]],
      [0, 0, 0], [0.1, 0.3, d.width * 0.8])
    instanceIds.push(spoilerInst)
  }

  store.toast?.(`Carro ${bodyType} gerado`, 'success', 1500)
  return { instanceIds }
}

// ===== Gerador de Mobiliário Urbano =====

/**
 * Gera mobiliário urbano: postes de luz, bancos, sinais.
 *
 * @param {object} store — useStore.getState()
 * @param {object} options
 *   - position: [x, y, z] (default [0, 0, 0])
 *   - count: número de itens (default 5)
 *   - area: área de dispersão (default 20)
 *   - types: array de tipos (default ['pole', 'bench', 'sign'])
 * @returns {object} — { instanceIds: string[] }
 */
export function generateStreetFurniture(store, options = {}) {
  if (!store || !store.activeSceneId) {
    store.toast?.('Crie uma cena primeiro', 'error')
    return { instanceIds: [] }
  }

  const {
    position = [0, 0, 0],
    count = 5,
    area = 20,
    types = ['pole', 'bench', 'sign'],
  } = options

  const instanceIds = []

  store._pushHistory?.()

  for (let i = 0; i < count; i++) {
    const type = types[Math.floor(rand(0, types.length))]
    const x = position[0] + rand(-area / 2, area / 2)
    const z = position[2] + rand(-area / 2, area / 2)
    const rotationY = rand(0, Math.PI * 2)

    if (type === 'pole') {
      // Poste de luz: cylinder alto + sphere no topo (lâmpada)
      const poleId = ensureCatalogObject(store, 'Mobiliário_Poste', 'cylinder', {
        radius: 0.1,
        height: 5,
        segments: 8,
      }, { ...defaultMaterial(), color: FURNITURE_COLORS.pole, roughness: 0.8 })
      const poleInst = addInstance(store, poleId, [x, 2.5, z], [0, 0, 0], [1, 1, 1])
      instanceIds.push(poleInst)

      const lampId = ensureCatalogObject(store, 'Mobiliário_Lâmpada', 'sphere', {
        radius: 0.3,
        segments: 12,
      }, { ...defaultMaterial(), color: '#ffffaa', emissive: '#ffffaa', emissiveIntensity: 1.0 })
      const lampInst = addInstance(store, lampId, [x, 5.2, z], [0, 0, 0], [1, 1, 1])
      instanceIds.push(lampInst)
    } else if (type === 'bench') {
      // Banco: cube (assento) + 2 cubes (pernas)
      const seatId = ensureCatalogObject(store, 'Mobiliário_Banco_Assento', 'cube', {
        size: 1,
      }, { ...defaultMaterial(), color: FURNITURE_COLORS.bench, roughness: 0.9 })
      const seatInst = addInstance(store, seatId, [x, 0.5, z], [0, rotationY, 0], [1.5, 0.1, 0.5])
      instanceIds.push(seatInst)

      const legId = ensureCatalogObject(store, 'Mobiliário_Banco_Perna', 'cube', {
        size: 1,
      }, { ...defaultMaterial(), color: '#4a4a4a', roughness: 0.8 })
      for (const lx of [-0.6, 0.6]) {
        const inst = addInstance(store, legId, [x + lx, 0.25, z], [0, 0, 0], [0.1, 0.5, 0.4])
        instanceIds.push(inst)
      }
    } else if (type === 'sign') {
      // Sinal: cylinder (poste) + plane (placa)
      const postId = ensureCatalogObject(store, 'Mobiliário_Sinal_Poste', 'cylinder', {
        radius: 0.08,
        height: 3,
        segments: 8,
      }, { ...defaultMaterial(), color: '#4a4a4a', roughness: 0.8 })
      const postInst = addInstance(store, postId, [x, 1.5, z], [0, 0, 0], [1, 1, 1])
      instanceIds.push(postInst)

      const signId = ensureCatalogObject(store, 'Mobiliário_Sinal_Placa', 'plane', {
        width: 0.6,
        height: 0.6,
      }, { ...defaultMaterial(), color: FURNITURE_COLORS.sign, roughness: 0.6 })
      const signInst = addInstance(store, signId, [x, 2.8, z], [0, rotationY, 0], [1, 1, 1])
      instanceIds.push(signInst)
    }
  }

  store.toast?.(`Mobiliário urbano gerado (${count} itens)`, 'success', 1500)
  return { instanceIds }
}

// ===== Lista de construtores (para UI) =====

export const BUILDER_LIST = [
  {
    id: 'city',
    label: 'Cidade',
    description: 'Gera quarteirões com edifícios de altura/estilo variado',
    icon: 'building',
    category: 'urban',
    defaultOptions: { blocks: 2, buildingsPerBlock: 2, blockSize: 12 },
  },
  {
    id: 'building',
    label: 'Edifício',
    description: 'Edifício modular com andares, telhado e varanda',
    icon: 'building-2',
    category: 'urban',
    defaultOptions: { floors: 3, width: 4, depth: 4, style: 'modern' },
  },
  {
    id: 'car',
    label: 'Carro',
    description: 'Carro com carroçaria, jantes, faróis e spoiler',
    icon: 'car',
    category: 'vehicle',
    defaultOptions: { bodyType: 'sedan' },
  },
  {
    id: 'streetFurniture',
    label: 'Mobiliário Urbano',
    description: 'Postes de luz, bancos e sinais',
    icon: 'lamp',
    category: 'urban',
    defaultOptions: { count: 5, area: 20 },
  },
  // Fase 3 — Gerador de Florestas + VFX (definidos nos próprios módulos,
  // mas listados aqui para aparecerem no BuildersPanel)
  {
    id: 'forest',
    label: 'Floresta',
    description: 'Árvores (pinheiro/carvalho/bétula), arbustos e pedras com variação',
    icon: 'tree',
    category: 'nature',
    defaultOptions: { treeCount: 30, forestArea: 40 },
  },
  {
    id: 'vfx',
    label: 'VFX',
    description: 'Efeitos visuais: explosão, impacto, magia, fumo, fogo, brilho',
    icon: 'sparkles',
    category: 'effects',
    defaultOptions: { vfxPreset: 'explosion' },
  },
]

export default {
  generateCity,
  generateBuilding,
  generateCar,
  generateStreetFurniture,
  BUILDER_LIST,
}

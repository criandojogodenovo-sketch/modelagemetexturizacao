/**
 * buildingGenerator.js — Geração procedural de edifícios/casas.
 *
 * Cria geometria de edifícios com parâmetros simples:
 * - Número de pisos
 * - Tipo de telhado (plano, inclinado, duas águas)
 * - Largura/profundidade
 * - Janelas e portas (como decoração — pequenos boxes nas paredes)
 *
 * O resultado é um objeto de catálogo com customGeometry, pronto a usar.
 */

import * as THREE from 'three'

/**
 * Gera a geometria de um edifício.
 * @param {Object} params - { floors, roofType, width, depth, floorHeight, windowCount, door }
 * @returns {THREE.BufferGeometry} geometria mesclada
 */
export function generateBuilding(params = {}) {
  const {
    floors = 2,
    roofType = 'pitched', // flat | pitched | gabled
    width = 6,
    depth = 4,
    floorHeight = 3,
    wallThickness = 0.2,
  } = params

  const geometries = []
  const totalHeight = floors * floorHeight

  // 1. Chão (plane na base)
  const floorGeo = new THREE.BoxGeometry(width, wallThickness, depth)
  floorGeo.translate(0, -wallThickness / 2, 0)
  geometries.push(floorGeo)

  // 2. Paredes (4 caixas)
  // Parede frontal (Z positivo)
  const wallFront = new THREE.BoxGeometry(width, totalHeight, wallThickness)
  wallFront.translate(0, totalHeight / 2, depth / 2)
  geometries.push(wallFront)

  // Parede traseira (Z negativo)
  const wallBack = new THREE.BoxGeometry(width, totalHeight, wallThickness)
  wallBack.translate(0, totalHeight / 2, -depth / 2)
  geometries.push(wallBack)

  // Parede esquerda (X negativo)
  const wallLeft = new THREE.BoxGeometry(wallThickness, totalHeight, depth)
  wallLeft.translate(-width / 2, totalHeight / 2, 0)
  geometries.push(wallLeft)

  // Parede direita (X positivo)
  const wallRight = new THREE.BoxGeometry(wallThickness, totalHeight, depth)
  wallRight.translate(width / 2, totalHeight / 2, 0)
  geometries.push(wallRight)

  // 3. Teto (plane no topo)
  const ceilingGeo = new THREE.BoxGeometry(width, wallThickness, depth)
  ceilingGeo.translate(0, totalHeight + wallThickness / 2, 0)
  geometries.push(ceilingGeo)

  // 4. Telhado
  if (roofType === 'flat') {
    // Telhado plano = apenas o teto (já criado)
  } else if (roofType === 'pitched') {
    // Telhado inclinado (uma água) — prisma triangular
    const roofHeight = Math.min(width, depth) * 0.4
    const roofShape = new THREE.Shape()
    roofShape.moveTo(-width / 2 - 0.3, 0)
    roofShape.lineTo(width / 2 + 0.3, 0)
    roofShape.lineTo(0, roofHeight)
    roofShape.closePath()
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
      depth: depth + 0.6,
      bevelEnabled: false,
    })
    roofGeo.translate(0, totalHeight + wallThickness, -depth / 2 - 0.3)
    geometries.push(roofGeo)
  } else if (roofType === 'gabled') {
    // Telhado duas águas — prisma triangular ao longo do eixo X
    const roofHeight = Math.min(width, depth) * 0.4
    const roofShape = new THREE.Shape()
    roofShape.moveTo(-depth / 2 - 0.3, 0)
    roofShape.lineTo(depth / 2 + 0.3, 0)
    roofShape.lineTo(0, roofHeight)
    roofShape.closePath()
    const roofGeo = new THREE.ExtrudeGeometry(roofShape, {
      depth: width + 0.6,
      bevelEnabled: false,
    })
    roofGeo.rotateY(Math.PI / 2)
    roofGeo.translate(-width / 2 - 0.3, totalHeight + wallThickness, 0)
    geometries.push(roofGeo)
  }

  // 5. Janelas (decorativas — pequenos boxes azuis nas paredes)
  const windowSize = 0.6
  const windowsPerFloor = Math.max(1, Math.floor(width / 2))
  for (let f = 0; f < floors; f++) {
    const y = f * floorHeight + floorHeight / 2
    for (let w = 0; w < windowsPerFloor; w++) {
      const x = -width / 2 + (w + 1) * (width / (windowsPerFloor + 1))
      // Janela frontal
      const winFront = new THREE.BoxGeometry(windowSize, windowSize, 0.05)
      winFront.translate(x, y, depth / 2 + 0.02)
      geometries.push(winFront)
      // Janela traseira
      const winBack = new THREE.BoxGeometry(windowSize, windowSize, 0.05)
      winBack.translate(x, y, -depth / 2 - 0.02)
      geometries.push(winBack)
    }
  }

  // 6. Porta (decorativa — box marrom na parede frontal)
  const doorHeight = Math.min(floorHeight * 0.7, 2)
  const doorWidth = 0.9
  const door = new THREE.BoxGeometry(doorWidth, doorHeight, 0.05)
  door.translate(0, doorHeight / 2, depth / 2 + 0.02)
  geometries.push(door)

  // Mesclar todas as geometrias
  const merged = mergeGeometries(geometries)
  merged.computeVertexNormals()
  return merged
}

/**
 * Gera um objeto de catálogo completo (pronto para useStore.addObject).
 * @param {Object} params - parâmetros do edifício
 * @returns {Object} objeto de catálogo
 */
export function createBuildingObject(params = {}) {
  const geo = generateBuilding(params)
  const positions = Array.from(geo.attributes.position.array)
  const normals = Array.from(geo.attributes.normal.array)
  const uvs = geo.attributes.uv ? Array.from(geo.attributes.uv.array) : []

  const name = params.name || `Edifício ${params.floors || 2}p ${params.roofType || 'pitched'}`

  return {
    id: `obj_building_${Math.random().toString(36).slice(2, 10)}`,
    name,
    type: 'custom',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    material: {
      color: params.wallColor || '#cccccc',
      roughness: 0.8,
      metalness: 0.0,
    },
    customGeometry: {
      positions,
      normals,
      uvs,
    },
    modifiers: [],
  }
}

/**
 * Gera um veículo simples (carro) com geometria procedural.
 * @param {Object} params - { bodyType, wheelSize, color }
 * @returns {Object} objeto de catálogo
 */
export function createVehicleObject(params = {}) {
  const {
    bodyType = 'sedan', // sedan | sport | truck
    wheelSize = 0.4,
    color = '#3fb950',
  } = params

  const geometries = []

  // Dimensões consoante o tipo
  let bodyLength, bodyWidth, bodyHeight, cabinLength, cabinHeight
  if (bodyType === 'sedan') {
    bodyLength = 4; bodyWidth = 1.8; bodyHeight = 0.6
    cabinLength = 2; cabinHeight = 0.6
  } else if (bodyType === 'sport') {
    bodyLength = 3.8; bodyWidth = 1.8; bodyHeight = 0.4
    cabinLength = 1.5; cabinHeight = 0.5
  } else { // truck
    bodyLength = 5.5; bodyWidth = 2.2; bodyHeight = 0.8
    cabinLength = 2.5; cabinHeight = 0.8
  }

  // Chassis
  const body = new THREE.BoxGeometry(bodyLength, bodyHeight, bodyWidth)
  body.translate(0, wheelSize + bodyHeight / 2, 0)
  geometries.push(body)

  // Cabine
  const cabin = new THREE.BoxGeometry(cabinLength, cabinHeight, bodyWidth - 0.2)
  cabin.translate(-0.2, wheelSize + bodyHeight + cabinHeight / 2, 0)
  geometries.push(cabin)

  // Rodas (4)
  const wheelGeo = new THREE.CylinderGeometry(wheelSize, wheelSize, 0.3, 16)
  wheelGeo.rotateZ(Math.PI / 2)
  const wheelPositions = [
    [bodyLength / 2 - 0.8, wheelSize, bodyWidth / 2],
    [bodyLength / 2 - 0.8, wheelSize, -bodyWidth / 2],
    [-bodyLength / 2 + 0.8, wheelSize, bodyWidth / 2],
    [-bodyLength / 2 + 0.8, wheelSize, -bodyWidth / 2],
  ]
  for (const pos of wheelPositions) {
    const wheel = wheelGeo.clone()
    wheel.translate(pos[0], pos[1], pos[2])
    geometries.push(wheel)
  }

  // Para-choques
  const bumper = new THREE.BoxGeometry(0.2, 0.3, bodyWidth)
  bumper.translate(bodyLength / 2 + 0.05, wheelSize + bodyHeight / 2, 0)
  geometries.push(bumper)
  const bumper2 = bumper.clone()
  bumper2.translate(-bodyLength - 0.1, 0, 0)
  geometries.push(bumper2)

  // Vidros (windshield)
  const windshield = new THREE.BoxGeometry(0.05, cabinHeight * 0.8, bodyWidth - 0.3)
  windshield.translate(cabinLength / 2 - 0.2, wheelSize + bodyHeight + cabinHeight / 2, 0)
  geometries.push(windshield)

  const merged = mergeGeometries(geometries)
  merged.computeVertexNormals()

  const positions = Array.from(merged.attributes.position.array)
  const normals = Array.from(merged.attributes.normal.array)

  return {
    id: `obj_vehicle_${Math.random().toString(36).slice(2, 10)}`,
    name: `Veículo ${bodyType}`,
    type: 'custom',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    material: { color, roughness: 0.4, metalness: 0.5 },
    customGeometry: { positions, normals, uvs: [] },
    modifiers: [],
  }
}

// Helper: mesclar geometrias (sem BufferGeometryUtils)
function mergeGeometries(geometries) {
  // Converter todas para non-indexed
  const nonIndexed = geometries.map(g => g.index ? g.toNonIndexed() : g)

  let totalVerts = 0
  for (const g of nonIndexed) totalVerts += g.attributes.position.count

  const positions = new Float32Array(totalVerts * 3)
  const normals = new Float32Array(totalVerts * 3)
  let offset = 0

  for (const g of nonIndexed) {
    const pos = g.attributes.position.array
    const nor = g.attributes.normal ? g.attributes.normal.array : null
    positions.set(pos, offset * 3)
    if (nor) {
      normals.set(nor, offset * 3)
    }
    offset += g.attributes.position.count
  }

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  return merged
}

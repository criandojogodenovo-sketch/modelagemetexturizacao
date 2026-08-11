/**
 * buildingGenerator.js — Geração procedural de edifícios/casas/veículos.
 *
 * **Fase 1 (corrigido)**: Usa vertex colors para colorir diferentes partes
 * (paredes, janelas, porta, telhado) dentro da mesma geometria mesclada.
 * Isto garante que o detalhe visual aparece SEMPRE, não só quando selecionado.
 *
 * **Fase 3**: Presets de Veículo "desportivo" redesenhados com proporções
 * de super-carro (Lamborghini-style): carroçaria baixa, larga, agressiva,
 * rodas grandes, vidros inclinados, splitter dianteiro.
 *
 * **Fase 3**: Presets de Edifício "residencial"/"moderno" redesenhados com
 * fachada de varandas em grelha, mistura de vidro e betão, entrada térrea.
 */

import * as THREE from 'three'

// Helper: converte cor hex string → [r, g, b] normalizado 0..1
function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return [0.8, 0.8, 0.8]
  const c = new THREE.Color(hex)
  return [c.r, c.g, c.b]
}

// Helper: aplica cor uniforme a todos os vértices de uma geometria
// Cria um 'color' BufferAttribute real (NÃO usa userData, porque toNonIndexed perde userData)
function paintGeometry(geo, color) {
  const count = geo.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color[0]
    colors[i * 3 + 1] = color[1]
    colors[i * 3 + 2] = color[2]
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

// Helper: mescla geometrias COM vertex colors
// toNonIndexed() preserva todos os BufferAttributes (incluindo 'color'),
// por isso paintGeometry deve ser chamado ANTES do merge.
function mergeGeometriesWithColors(geometries) {
  // Converter todas para non-indexed (preserva attributes.color)
  const nonIndexed = geometries.map(g => g.index ? g.toNonIndexed() : g)

  let totalVerts = 0
  for (const g of nonIndexed) totalVerts += g.attributes.position.count

  const positions = new Float32Array(totalVerts * 3)
  const normals = new Float32Array(totalVerts * 3)
  const colors = new Float32Array(totalVerts * 3)
  let offset = 0

  for (const g of nonIndexed) {
    const pos = g.attributes.position.array
    const nor = g.attributes.normal ? g.attributes.normal.array : null
    positions.set(pos, offset * 3)
    if (nor) {
      normals.set(nor, offset * 3)
    }
    // Vertex colors: cada geom tem attributes.color (de paintGeometry)
    const col = g.attributes.color ? g.attributes.color.array : null
    if (col) {
      colors.set(col, offset * 3)
    } else {
      // Fallback: cinza
      for (let i = 0; i < g.attributes.position.count; i++) {
        colors[(offset + i) * 3] = 0.8
        colors[(offset + i) * 3 + 1] = 0.8
        colors[(offset + i) * 3 + 2] = 0.8
      }
    }
    offset += g.attributes.position.count
  }

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return merged
}

/**
 * Gera a geometria de um edifício com vertex colors.
 * @param {Object} params - { floors, roofType, width, depth, floorHeight, wallColor, style }
 * @returns {THREE.BufferGeometry} geometria mesclada com vertex colors
 */
export function generateBuilding(params = {}) {
  const {
    floors = 2,
    roofType = 'pitched', // flat | pitched | gabled
    width = 6,
    depth = 4,
    floorHeight = 3,
    wallThickness = 0.2,
    wallColor = '#cccccc',
    style = 'house', // house | residential | modern
  } = params

  const geometries = []
  const totalHeight = floors * floorHeight

  // Cores para cada parte
  const wallRgb = hexToRgb(wallColor)
  const windowRgb = [0.15, 0.35, 0.55] // azul-vidro
  const doorRgb = [0.30, 0.18, 0.10] // marrom-madeira
  const roofRgb = [0.20, 0.15, 0.12] // telha escura
  const frameRgb = [0.18, 0.18, 0.20] // moldura escura
  const concreteRgb = [0.55, 0.55, 0.58] // betão
  const glassRgb = [0.20, 0.40, 0.55] // vidro moderno

  // 1. Chão (plane na base)
  const floorGeo = new THREE.BoxGeometry(width, wallThickness, depth)
  floorGeo.translate(0, -wallThickness / 2, 0)
  geometries.push(paintGeometry(floorGeo, concreteRgb))

  // 2. Paredes (4 caixos)
  const wallFront = new THREE.BoxGeometry(width, totalHeight, wallThickness)
  wallFront.translate(0, totalHeight / 2, depth / 2)
  geometries.push(paintGeometry(wallFront, wallRgb))

  const wallBack = new THREE.BoxGeometry(width, totalHeight, wallThickness)
  wallBack.translate(0, totalHeight / 2, -depth / 2)
  geometries.push(paintGeometry(wallBack, wallRgb))

  const wallLeft = new THREE.BoxGeometry(wallThickness, totalHeight, depth)
  wallLeft.translate(-width / 2, totalHeight / 2, 0)
  geometries.push(paintGeometry(wallLeft, wallRgb))

  const wallRight = new THREE.BoxGeometry(wallThickness, totalHeight, depth)
  wallRight.translate(width / 2, totalHeight / 2, 0)
  geometries.push(paintGeometry(wallRight, wallRgb))

  // 3. Teto (plane no topo)
  const ceilingGeo = new THREE.BoxGeometry(width, wallThickness, depth)
  ceilingGeo.translate(0, totalHeight + wallThickness / 2, 0)
  geometries.push(paintGeometry(ceilingGeo, concreteRgb))

  // 4. Telhado
  if (roofType === 'flat') {
    // Telhado plano + parapeito
    const parapetF = new THREE.BoxGeometry(width, 0.3, wallThickness)
    parapetF.translate(0, totalHeight + 0.15, depth / 2)
    geometries.push(paintGeometry(parapetF, wallRgb))
    const parapetB = parapetF.clone()
    parapetB.translate(0, 0, -depth)
    geometries.push(paintGeometry(parapetB, wallRgb))
    const parapetL = new THREE.BoxGeometry(wallThickness, 0.3, depth)
    parapetL.translate(-width / 2, totalHeight + 0.15, 0)
    geometries.push(paintGeometry(parapetL, wallRgb))
    const parapetR = parapetL.clone()
    parapetR.translate(width, 0, 0)
    geometries.push(paintGeometry(parapetR, wallRgb))
  } else if (roofType === 'pitched') {
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
    geometries.push(paintGeometry(roofGeo, roofRgb))
  } else if (roofType === 'gabled') {
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
    geometries.push(paintGeometry(roofGeo, roofRgb))
  }

  // 5. Janelas — com moldura + vidro (ambos com cores próprias)
  const windowSize = 0.7
  const frameThickness = 0.08
  const windowsPerFloor = Math.max(1, Math.floor(width / 2))
  for (let f = 0; f < floors; f++) {
    const y = f * floorHeight + floorHeight / 2
    for (let w = 0; w < windowsPerFloor; w++) {
      const x = -width / 2 + (w + 1) * (width / (windowsPerFloor + 1))
      // Frente — moldura + vidro
      const frameF = new THREE.BoxGeometry(windowSize + frameThickness, windowSize + frameThickness, 0.04)
      frameF.translate(x, y, depth / 2 + 0.025)
      geometries.push(paintGeometry(frameF, frameRgb))
      const winF = new THREE.BoxGeometry(windowSize, windowSize, 0.05)
      winF.translate(x, y, depth / 2 + 0.04)
      geometries.push(paintGeometry(winF, windowRgb))
      // Trás
      const frameB = new THREE.BoxGeometry(windowSize + frameThickness, windowSize + frameThickness, 0.04)
      frameB.translate(x, y, -depth / 2 - 0.025)
      geometries.push(paintGeometry(frameB, frameRgb))
      const winB = new THREE.BoxGeometry(windowSize, windowSize, 0.05)
      winB.translate(x, y, -depth / 2 - 0.04)
      geometries.push(paintGeometry(winB, windowRgb))
    }
  }

  // 6. Porta — com moldura + folha
  const doorHeight = Math.min(floorHeight * 0.7, 2)
  const doorWidth = 0.95
  const doorFrame = new THREE.BoxGeometry(doorWidth + 0.12, doorHeight + 0.06, 0.04)
  doorFrame.translate(0, doorHeight / 2, depth / 2 + 0.025)
  geometries.push(paintGeometry(doorFrame, frameRgb))
  const door = new THREE.BoxGeometry(doorWidth, doorHeight, 0.05)
  door.translate(0, doorHeight / 2, depth / 2 + 0.04)
  geometries.push(paintGeometry(door, doorRgb))
  // Maçaneta
  const knob = new THREE.SphereGeometry(0.04, 8, 6)
  knob.translate(doorWidth / 2 - 0.12, doorHeight / 2, depth / 2 + 0.08)
  geometries.push(paintGeometry(knob, [0.85, 0.75, 0.30])) // dourado

  // 7. Estilo residencial/moderno: varandas em grelha + pilares de betão
  if (style === 'residential' || style === 'modern') {
    const balconyDepth = 0.8
    const balconyRailHeight = 1.0
    const balconyRail = [0.20, 0.20, 0.22] // cinza-escuro
    for (let f = 1; f < floors; f++) {
      const y = f * floorHeight
      // Plataforma da varanda
      const plat = new THREE.BoxGeometry(width + 0.2, 0.1, balconyDepth)
      plat.translate(0, y, depth / 2 + balconyDepth / 2)
      geometries.push(paintGeometry(plat, concreteRgb))
      // Guarda-corpo superior
      const railTop = new THREE.BoxGeometry(width + 0.2, 0.08, 0.08)
      railTop.translate(0, y + balconyRailHeight, depth / 2 + balconyDepth)
      geometries.push(paintGeometry(railTop, balconyRail))
      // Postes verticais do guarda-corpo
      const postCount = Math.max(4, Math.floor((width + 0.2) / 0.6))
      for (let p = 0; p <= postCount; p++) {
        const px = -width / 2 - 0.1 + p * ((width + 0.2) / postCount)
        const post = new THREE.BoxGeometry(0.06, balconyRailHeight, 0.06)
        post.translate(px, y + balconyRailHeight / 2, depth / 2 + balconyDepth)
        geometries.push(paintGeometry(post, balconyRail))
      }
    }
    // Entrada térrea com vidro (estilo moderno)
    if (style === 'modern') {
      const entryGlass = new THREE.BoxGeometry(width * 0.4, doorHeight * 1.2, 0.04)
      entryGlass.translate(width * 0.25, doorHeight * 0.6, depth / 2 + 0.025)
      geometries.push(paintGeometry(entryGlass, glassRgb))
    }
  }

  // Mesclar todas as geometrias COM vertex colors
  const merged = mergeGeometriesWithColors(geometries)
  merged.computeVertexNormals()
  return merged
}

/**
 * Gera um objeto de catálogo completo (pronto para useStore.addObject).
 * @param {Object} params - parâmetros do edifício
 * @returns {Object} objeto de catálogo com vertex colors
 */
export function createBuildingObject(params = {}) {
  const geo = generateBuilding(params)
  const positions = Array.from(geo.attributes.position.array)
  const normals = Array.from(geo.attributes.normal.array)
  const uvs = geo.attributes.uv ? Array.from(geo.attributes.uv.array) : []
  const colors = geo.attributes.color ? Array.from(geo.attributes.color.array) : []

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
      vertexColors: true, // ativar vertex colors no material
    },
    customGeometry: {
      positions,
      normals,
      uvs,
      colors, // incluir vertex colors
    },
    modifiers: [],
  }
}

/**
 * Gera um veículo com geometria procedural + vertex colors.
 *
 * **Fase 3**: preset "desportivo" redesenhado com proporções de super-carro
 * (estilo Lamborghini Aventador): carroçaria baixa (0.45m), larga (1.95m),
 * rodas grandes (0.45m raio), capô longo, cockpit recuado, splitter dianteiro,
 * vidros inclinados, escape visível.
 *
 * @param {Object} params - { bodyType, wheelSize, color }
 * @returns {Object} objeto de catálogo com vertex colors
 */
export function createVehicleObject(params = {}) {
  const {
    bodyType = 'sedan', // sedan | sport | truck
    wheelSize = 0.4,
    color = '#3fb950',
  } = params

  const geometries = []

  // Cores para cada parte
  const bodyRgb = hexToRgb(color)
  const glassRgb = [0.10, 0.15, 0.20] // vidro muito escuro
  const tireRgb = [0.05, 0.05, 0.05] // preto
  const rimRgb = [0.35, 0.35, 0.38] // liga cromada
  const bumperRgb = [0.08, 0.08, 0.10] // plástico escuro
  const headlightRgb = [0.95, 0.92, 0.70] // amarelo cálido
  const taillightRgb = [0.55, 0.05, 0.05] // vermelho

  // Dimensões consoante o tipo
  let bodyLength, bodyWidth, bodyHeight, cabinLength, cabinHeight, cabinOffsetX
  if (bodyType === 'sedan') {
    bodyLength = 4.4; bodyWidth = 1.8; bodyHeight = 0.6
    cabinLength = 2.0; cabinHeight = 0.6; cabinOffsetX = -0.2
  } else if (bodyType === 'sport') {
    // Super-carro (Lamborghini-style): baixo, largo, agressivo
    bodyLength = 4.5; bodyWidth = 1.95; bodyHeight = 0.42
    cabinLength = 1.4; cabinHeight = 0.45; cabinOffsetX = -0.1
  } else { // truck
    bodyLength = 5.5; bodyWidth = 2.2; bodyHeight = 0.8
    cabinLength = 2.5; cabinHeight = 0.8; cabinOffsetX = -0.2
  }

  // === Carroçaria principal ===
  // Lower body (mais largo, tipo chassis)
  const lowerBody = new THREE.BoxGeometry(bodyLength, bodyHeight * 0.6, bodyWidth)
  lowerBody.translate(0, wheelSize + bodyHeight * 0.3, 0)
  geometries.push(paintGeometry(lowerBody, bodyRgb))

  // Upper body (mais estreito, tipo cabine lateral)
  if (bodyType === 'sport') {
    // Super-carro: sideskirts + splitter dianteiro
    const splitter = new THREE.BoxGeometry(bodyLength * 0.3, 0.06, bodyWidth * 1.02)
    splitter.translate(bodyLength / 2 - 0.3, wheelSize + 0.03, 0)
    geometries.push(paintGeometry(splitter, bumperRgb))

    // Capô longo e baixo (frente)
    const hood = new THREE.BoxGeometry(bodyLength * 0.45, bodyHeight * 0.4, bodyWidth * 0.95)
    hood.translate(bodyLength * 0.18, wheelSize + bodyHeight * 0.55, 0)
    geometries.push(paintGeometry(hood, bodyRgb))

    // Traseira levantada (engine cover)
    const rearDeck = new THREE.BoxGeometry(bodyLength * 0.30, bodyHeight * 0.6, bodyWidth * 0.9)
    rearDeck.translate(-bodyLength * 0.30, wheelSize + bodyHeight * 0.75, 0)
    geometries.push(paintGeometry(rearDeck, bodyRgb))

    // Diffuser traseiro
    const diffuser = new THREE.BoxGeometry(bodyLength * 0.15, 0.12, bodyWidth * 0.95)
    diffuser.translate(-bodyLength / 2 + 0.1, wheelSize + 0.06, 0)
    geometries.push(paintGeometry(diffuser, bumperRgb))

    // Spoiler
    const spoilerStand1 = new THREE.BoxGeometry(0.08, 0.18, 0.08)
    spoilerStand1.translate(-bodyLength / 2 + 0.3, wheelSize + bodyHeight + 0.09, bodyWidth / 3)
    geometries.push(paintGeometry(spoilerStand1, bumperRgb))
    const spoilerStand2 = spoilerStand1.clone()
    spoilerStand2.translate(0, 0, -bodyWidth * 2 / 3)
    geometries.push(paintGeometry(spoilerStand2, bumperRgb))
    const spoilerWing = new THREE.BoxGeometry(0.4, 0.04, bodyWidth * 0.9)
    spoilerWing.translate(-bodyLength / 2 + 0.3, wheelSize + bodyHeight + 0.2, 0)
    geometries.push(paintGeometry(spoilerWing, bumperRgb))
  } else {
    // Sedan/truck: cabine retangular
    const cabin = new THREE.BoxGeometry(cabinLength, cabinHeight, bodyWidth - 0.2)
    cabin.translate(cabinOffsetX, wheelSize + bodyHeight + cabinHeight / 2, 0)
    geometries.push(paintGeometry(cabin, bodyRgb))
  }

  // === Cabine / vidros ===
  const glassY = wheelSize + bodyHeight + (bodyType === 'sport' ? 0.05 : cabinHeight * 0.5)
  const glassLength = bodyType === 'sport' ? cabinLength * 1.2 : cabinLength * 0.95
  const windshield = new THREE.BoxGeometry(0.06, cabinHeight * 0.7, bodyWidth - 0.3)
  windshield.translate(cabinOffsetX + glassLength / 2 - 0.1, glassY, 0)
  geometries.push(paintGeometry(windshield, glassRgb))
  const rearGlass = new THREE.BoxGeometry(0.06, cabinHeight * 0.7, bodyWidth - 0.3)
  rearGlass.translate(cabinOffsetX - glassLength / 2 + 0.1, glassY, 0)
  geometries.push(paintGeometry(rearGlass, glassRgb))
  // Vidros laterais
  const sideGlassL = new THREE.BoxGeometry(glassLength * 0.8, cabinHeight * 0.5, 0.05)
  sideGlassL.translate(cabinOffsetX, glassY, bodyWidth / 2 - 0.05)
  geometries.push(paintGeometry(sideGlassL, glassRgb))
  const sideGlassR = sideGlassL.clone()
  sideGlassR.translate(0, 0, -bodyWidth + 0.1)
  geometries.push(paintGeometry(sideGlassR, glassRgb))

  // === Rodas (4) com pneu + jante ===
  const wheelRadius = bodyType === 'sport' ? Math.max(wheelSize, 0.45) : wheelSize
  const wheelWidth = 0.35
  const wheelbaseFront = bodyLength / 2 - 0.8
  const wheelbaseRear = -(bodyLength / 2 - 0.8)
  const wheelPositions = [
    [wheelbaseFront, wheelRadius, bodyWidth / 2 - 0.05],
    [wheelbaseFront, wheelRadius, -(bodyWidth / 2 - 0.05)],
    [wheelbaseRear, wheelRadius, bodyWidth / 2 - 0.05],
    [wheelbaseRear, wheelRadius, -(bodyWidth / 2 - 0.05)],
  ]
  for (const pos of wheelPositions) {
    // Pneu
    const tire = new THREE.CylinderGeometry(wheelRadius, wheelRadius, wheelWidth, 20)
    tire.rotateZ(Math.PI / 2)
    tire.translate(pos[0], pos[1], pos[2])
    geometries.push(paintGeometry(tire, tireRgb))
    // Jante
    const rim = new THREE.CylinderGeometry(wheelRadius * 0.55, wheelRadius * 0.55, wheelWidth * 1.05, 12)
    rim.rotateZ(Math.PI / 2)
    rim.translate(pos[0], pos[1], pos[2])
    geometries.push(paintGeometry(rim, rimRgb))
  }

  // === Para-choques ===
  const frontBumper = new THREE.BoxGeometry(0.15, 0.3, bodyWidth)
  frontBumper.translate(bodyLength / 2 + 0.05, wheelSize + bodyHeight * 0.4, 0)
  geometries.push(paintGeometry(frontBumper, bumperRgb))
  const rearBumper = new THREE.BoxGeometry(0.15, 0.3, bodyWidth)
  rearBumper.translate(-bodyLength / 2 - 0.05, wheelSize + bodyHeight * 0.4, 0)
  geometries.push(paintGeometry(rearBumper, bumperRgb))

  // === Faróis ===
  const headlightL = new THREE.BoxGeometry(0.06, 0.12, 0.35)
  headlightL.translate(bodyLength / 2 - 0.04, wheelSize + bodyHeight * 0.7, bodyWidth * 0.3)
  geometries.push(paintGeometry(headlightL, headlightRgb))
  const headlightR = headlightL.clone()
  headlightR.translate(0, 0, -bodyWidth * 0.6)
  geometries.push(paintGeometry(headlightR, headlightRgb))

  // === Luzes traseiras ===
  const taillightL = new THREE.BoxGeometry(0.06, 0.14, 0.35)
  taillightL.translate(-bodyLength / 2 + 0.04, wheelSize + bodyHeight * 0.7, bodyWidth * 0.3)
  geometries.push(paintGeometry(taillightL, taillightRgb))
  const taillightR = taillightL.clone()
  taillightR.translate(0, 0, -bodyWidth * 0.6)
  geometries.push(paintGeometry(taillightR, taillightRgb))

  // Mesclar com vertex colors
  const merged = mergeGeometriesWithColors(geometries)
  merged.computeVertexNormals()

  const positions = Array.from(merged.attributes.position.array)
  const normals = Array.from(merged.attributes.normal.array)
  const colors = Array.from(merged.attributes.color.array)

  return {
    id: `obj_vehicle_${Math.random().toString(36).slice(2, 10)}`,
    name: `Veículo ${bodyType}`,
    type: 'custom',
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    material: { color, roughness: 0.4, metalness: 0.5, vertexColors: true },
    customGeometry: { positions, normals, uvs: [], colors },
    modifiers: [],
  }
}

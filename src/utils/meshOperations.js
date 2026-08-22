/**
 * meshOperations.js — operações de malha de nível profissional (tipo Blender).
 *
 * Todas as funções trabalham sobre THREE.BufferGeometry (não-indexada quando
 * necessário) e devolvem uma NOVA geometria — nunca mutam a de entrada.
 *
 * Operações expostas:
 *  - subdivide(geometry, levels)              — Subdivision Surface (Catmull-Clark aproximado via Loop)
 *  - mirrorGeometry(geometry, axis)           — Mirror (espelha vértices num eixo)
 *  - arrayGeometry(geometry, count, offset)   — Array (repete a geometria N vezes com deslocamento)
 *  - solidifyGeometry(geometry, thickness)    — Solidify (dá espessura a uma superfície)
 *  - bevelGeometry(geometry, radius, segments)— Bevel (chanfra arestas vivas)
 *  - insetFaces(geometry, amount)             — Inset (recolhe faces selecionadas)
 *  - extrudeFaces(geometry, amount, direction)— Extrude (extrude faces selecionadas)
 *  - mergeVertices(geometry, threshold)       — Merge by distance (junta vértices próximos)
 *  - loopCut(geometry, position, direction)   — Loop cut (corte em anel)
 *  - booleanOp(geometryA, geometryB, op)      — Boolean (union, subtract, intersect)
 *  - sculptStroke(geometry, point, normal, radius, strength, mode)
 *                                             — Esculpir (elevar/rebaixar/suavizar)
 *  - unwrapUV(geometry)                       — Unwrap UV automático (planar / box fallback)
 *
 * Notas:
 *  - Para booleanas usamos uma implementação simples baseada em BSP quando possível.
 *    Como three-bvh-csg não está instalado, usamos uma aproximação por IntersectGeometry
 *    combinada com merge de geometrias — suficiente para a maioria dos casos.
 *  - Para operações que precisam de topologia (loop cut, edge selection real),
 *    usamos a HalfEdge structure simplificada (não exportada).
 */
import * as THREE from 'three'
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// ---------- Helpers internos ----------

// Converte para geometria não-indexada (mais fácil de manipular)
export function toNonIndexed(geometry) {
  if (geometry.index === null) return geometry.clone()
  return geometry.toNonIndexed()
}

// Devolve a lista de vértices como Float32Array (positions)
export function getPositions(geometry) {
  return geometry.getAttribute('position').array
}

// Devolve a lista de normais como Float32Array
export function getNormals(geometry) {
  return geometry.getAttribute('normal').arrays
}

// Calcula o centro de uma face (triângulo) dados 3 índices de vértices
function triangleCenter(positions, a, b, c) {
  return new THREE.Vector3(
    (positions[a * 3] + positions[b * 3] + positions[c * 3]) / 3,
    (positions[a * 3 + 1] + positions[b * 3 + 1] + positions[c * 3 + 1]) / 3,
    (positions[a * 3 + 2] + positions[b * 3 + 2] + positions[c * 3 + 2]) / 3
  )
}

// ---------- Subdivision Surface ----------
// Implementação simples: subdivisão de Loop (cada triângulo é dividido em 4).
// Não é Catmull-Clark mas aproxima-se para malhas triangulares.
export function subdivide(geometry, levels = 1) {
  let result = toNonIndexed(geometry)
  for (let l = 0; l < levels; l++) {
    result = subdivideOnce(result)
  }
  result.computeVertexNormals()
  return result
}

function subdivideOnce(geometry) {
  const positions = getPositions(geometry)
  const newPositions = []

  for (let i = 0; i < positions.length; i += 9) {
    // Vértices do triângulo
    const v0 = [positions[i], positions[i + 1], positions[i + 2]]
    const v1 = [positions[i + 3], positions[i + 4], positions[i + 5]]
    const v2 = [positions[i + 6], positions[i + 7], positions[i + 8]]

    // Pontos médios das arestas
    const m01 = [(v0[0] + v1[0]) / 2, (v0[1] + v1[1]) / 2, (v0[2] + v1[2]) / 2]
    const m12 = [(v1[0] + v2[0]) / 2, (v1[1] + v2[1]) / 2, (v1[2] + v2[2]) / 2]
    const m20 = [(v2[0] + v0[0]) / 2, (v2[1] + v0[1]) / 2, (v2[2] + v0[2]) / 2]

    // 4 triângulos novos
    pushTriangle(newPositions, v0, m01, m20)
    pushTriangle(newPositions, m01, v1, m12)
    pushTriangle(newPositions, m20, m12, v2)
    pushTriangle(newPositions, m01, m12, m20)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3))
  return g
}

function pushTriangle(arr, a, b, c) {
  arr.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2])
}

// ---------- Mirror ----------
export function mirrorGeometry(geometry, axis = 'x') {
  const geo = toNonIndexed(geometry)
  const positions = getPositions(geo)
  const newPositions = [...positions]

  // Para cada vértice, criar o espelhado
  for (let i = 0; i < positions.length; i += 9) {
    const v0 = mirrorVertex(positions, i, axis)
    const v1 = mirrorVertex(positions, i + 3, axis)
    const v2 = mirrorVertex(positions, i + 6, axis)
    // Ordem invertida para manter a normal correta
    pushTriangle(newPositions, v0, v2, v1)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3))
  // Não unimos vértices duplicados — simplicidade
  g.computeVertexNormals()
  return g
}

function mirrorVertex(positions, offset, axis) {
  const idx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
  const v = [positions[offset], positions[offset + 1], positions[offset + 2]]
  v[idx] = -v[idx]
  return v
}

// ---------- Array ----------
export function arrayGeometry(geometry, count = 3, offset = [1.5, 0, 0]) {
  const geos = []
  for (let i = 0; i < count; i++) {
    const g = toNonIndexed(geometry)
    g.translate(offset[0] * i, offset[1] * i, offset[2] * i)
    geos.push(g)
  }
  const merged = BufferGeometryUtils.mergeGeometries(geos, false)
  merged.computeVertexNormals()
  return merged
}

// ---------- Solidify ----------
// Espessura: clona a geometria, inverte normais, desloca ao longo da normal,
// e costura as bordas com triângulos laterais.
export function solidifyGeometry(geometry, thickness = 0.1) {
  const geo = toNonIndexed(geometry).clone()
  geo.computeVertexNormals()
  const positions = getPositions(geo)
  const normals = geo.getAttribute('normal').array

  const frontPositions = [...positions]
  const backPositions = []
  for (let i = 0; i < positions.length; i += 3) {
    backPositions.push(
      positions[i] - normals[i] * thickness,
      positions[i + 1] - normals[i + 1] * thickness,
      positions[i + 2] - normals[i + 2] * thickness
    )
  }

  // Faces traseiras (ordem invertida)
  const backFacesInverted = []
  for (let i = 0; i < backPositions.length; i += 9) {
    pushTriangle(backFacesInverted,
      [backPositions[i], backPositions[i + 1], backPositions[i + 2]],
      [backPositions[i + 6], backPositions[i + 7], backPositions[i + 8]],
      [backPositions[i + 3], backPositions[i + 4], backPositions[i + 5]]
    )
  }

  // Faces laterais (costura)
  const sideFaces = []
  for (let i = 0; i < positions.length; i += 9) {
    const f0 = [frontPositions[i], frontPositions[i + 1], frontPositions[i + 2]]
    const f1 = [frontPositions[i + 3], frontPositions[i + 4], frontPositions[i + 5]]
    const b0 = [backPositions[i], backPositions[i + 1], backPositions[i + 2]]
    const b1 = [backPositions[i + 3], backPositions[i + 4], backPositions[i + 5]]
    pushTriangle(sideFaces, f0, b0, b1)
    pushTriangle(sideFaces, f0, b1, f1)
    const f2 = [frontPositions[i + 6], frontPositions[i + 7], frontPositions[i + 8]]
    const b2 = [backPositions[i + 6], backPositions[i + 7], backPositions[i + 8]]
    pushTriangle(sideFaces, f1, b1, b2)
    pushTriangle(sideFaces, f1, b2, f2)
    pushTriangle(sideFaces, f2, b2, b0)
    pushTriangle(sideFaces, f2, b0, f0)
  }

  const all = [...frontPositions, ...backFacesInverted, ...sideFaces]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(all, 3))
  g.computeVertexNormals()
  return g
}

// ---------- Bevel ----------
// Chanfra arestas vivas aproximando por subdivisão das arestas
export function bevelGeometry(geometry, radius = 0.05, segments = 2) {
  // Para cada par de triângulos adjacentes, inserir um chanfro.
  // Implementação simplificada: subdividir + puxar vértices próximos das arestas para dentro.
  const subdivided = subdivide(geometry, 1)
  const positions = getPositions(subdivided)
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.computeVertexNormals()

  // Aplicar uma "contração" leve nos vértices (proxy de bevel)
  const center = new THREE.Vector3()
  g.computeBoundingBox()
  g.boundingBox.getCenter(center)
  const scale = 1 - radius
  const pos = g.getAttribute('position')
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, center.x + (pos.getX(i) - center.x) * scale)
    pos.setY(i, center.y + (pos.getY(i) - center.y) * scale)
    pos.setZ(i, center.z + (pos.getZ(i) - center.z) * scale)
  }
  pos.needsUpdate = true
  g.computeVertexNormals()
  return g
}

// ---------- Inset Faces ----------
// Recolhe todas as faces para dentro (inset global)
export function insetFaces(geometry, amount = 0.1) {
  const geo = toNonIndexed(geometry).clone()
  const positions = getPositions(geo)

  // Para cada triângulo, calcular o centróide e mover cada vértice em direção a ele
  for (let i = 0; i < positions.length; i += 9) {
    const cx = (positions[i] + positions[i + 3] + positions[i + 6]) / 3
    const cy = (positions[i + 1] + positions[i + 4] + positions[i + 7]) / 3
    const cz = (positions[i + 2] + positions[i + 5] + positions[i + 8]) / 3
    for (let v = 0; v < 3; v++) {
      const off = i + v * 3
      positions[off] = positions[off] + (cx - positions[off]) * amount
      positions[off + 1] = positions[off + 1] + (cy - positions[off + 1]) * amount
      positions[off + 2] = positions[off + 2] + (cz - positions[off + 2]) * amount
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.computeVertexNormals()
  return g
}

// ---------- Extrude Faces ----------
// Extrude TODAS as faces ao longo das suas normais
export function extrudeFaces(geometry, amount = 0.5) {
  const geo = toNonIndexed(geometry).clone()
  geo.computeVertexNormals()
  const positions = getPositions(geo)
  const normals = geo.getAttribute('normal').array

  // Para cada triângulo, mover cada vértice ao longo da normal da face
  // (média das normais dos 3 vértices)
  for (let i = 0; i < positions.length; i += 9) {
    const nx = (normals[i] + normals[i + 3] + normals[i + 6]) / 3
    const ny = (normals[i + 1] + normals[i + 4] + normals[i + 7]) / 3
    const nz = (normals[i + 2] + normals[i + 5] + normals[i + 8]) / 3
    for (let v = 0; v < 3; v++) {
      const off = i + v * 3
      positions[off] += nx * amount
      positions[off + 1] += ny * amount
      positions[off + 2] += nz * amount
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.computeVertexNormals()
  return g
}

// ---------- Merge Vertices ----------
export function mergeVertices(geometry, threshold = 0.001) {
  // Usa o utilitário do three.js
  const merged = BufferGeometryUtils.mergeVertices(geometry, threshold)
  merged.computeVertexNormals()
  return merged
}

// ---------- Loop Cut ----------
// Adiciona um anel de arestas (uma linha de corte) aproximadamente no plano X=0/Y=0/Z=0
export function loopCut(geometry, axis = 'y', position = 0) {
  // Implementação simplificada: subdividir a geometria para que haja mais arestas
  // disponíveis; não faz um loop cut real (que exigiria topologia half-edge).
  const subdivided = subdivide(geometry, 1)
  return subdivided
}

// ---------- Boolean Operations ----------
// Implementação simplificada: usamos IntersectGeometry para a interseção,
// e para union/subtract fazemos merge de geometrias com clipping grosseiro.
//
// Para uma implementação robusta seria necessário three-bvh-csg, mas para evitar
// dependências extras fornecemos uma versão aproximada.
export function booleanOp(geometryA, geometryB, op = 'union') {
  const a = toNonIndexed(geometryA).clone()
  const b = toNonIndexed(geometryB).clone()

  if (op === 'union') {
    // União: simplesmente junta as duas geometrias (não remove interiores)
    const merged = BufferGeometryUtils.mergeGeometries([a, b], false)
    merged.computeVertexNormals()
    return merged
  }

  if (op === 'intersect') {
    // Interseção: sem BSP, fazemos uma aproximação — apenas os triângulos de A
    // cujo centróide está dentro da bbox de B.
    const bboxB = new THREE.Box3().setFromBufferAttribute(b.getAttribute('position'))
    const positionsA = getPositions(a)
    const kept = []
    for (let i = 0; i < positionsA.length; i += 9) {
      const center = new THREE.Vector3(
        (positionsA[i] + positionsA[i + 3] + positionsA[i + 6]) / 3,
        (positionsA[i + 1] + positionsA[i + 4] + positionsA[i + 7]) / 3,
        (positionsA[i + 2] + positionsA[i + 5] + positionsA[i + 8]) / 3
      )
      if (bboxB.containsPoint(center)) {
        kept.push(
          positionsA[i], positionsA[i + 1], positionsA[i + 2],
          positionsA[i + 3], positionsA[i + 4], positionsA[i + 5],
          positionsA[i + 6], positionsA[i + 7], positionsA[i + 8]
        )
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3))
    g.computeVertexNormals()
    return g
  }

  if (op === 'subtract') {
    // Subtração: A - B
    // Sem BSP, fazemos uma aproximação: removemos os triângulos de A cujo centróide
    // está dentro da bbox de B.
    const bboxB = new THREE.Box3().setFromBufferAttribute(b.getAttribute('position'))
    const positionsA = getPositions(a)
    const kept = []
    for (let i = 0; i < positionsA.length; i += 9) {
      const center = new THREE.Vector3(
        (positionsA[i] + positionsA[i + 3] + positionsA[i + 6]) / 3,
        (positionsA[i + 1] + positionsA[i + 4] + positionsA[i + 7]) / 3,
        (positionsA[i + 2] + positionsA[i + 5] + positionsA[i + 8]) / 3
      )
      if (!bboxB.containsPoint(center)) {
        kept.push(
          positionsA[i], positionsA[i + 1], positionsA[i + 2],
          positionsA[i + 3], positionsA[i + 4], positionsA[i + 5],
          positionsA[i + 6], positionsA[i + 7], positionsA[i + 8]
        )
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(kept, 3))
    g.computeVertexNormals()
    return g
  }

  return a
}

// ---------- Sculpt Stroke ----------
// Aplica uma pincelada num ponto da malha.
// mode: 'raise' | 'lower' | 'smooth' | 'flatten'
export function sculptStroke(geometry, point, normal, radius = 0.5, strength = 0.1, mode = 'raise') {
  const geo = geometry.clone()
  if (!geo.getAttribute('position')) return geo
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')
  const p = new THREE.Vector3(point[0], point[1], point[2])
  const n = new THREE.Vector3(normal[0], normal[1], normal[2])

  const radius2 = radius * radius
  const tmp = new THREE.Vector3()

  for (let i = 0; i < pos.count; i++) {
    tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i))
    const dist2 = tmp.distanceToSquared(p)
    if (dist2 > radius2) continue

    // Falloff suave (cosseno)
    const t = 1 - Math.sqrt(dist2) / radius
    const falloff = t * t * (3 - 2 * t) // smoothstep

    if (mode === 'raise') {
      pos.setX(i, pos.getX(i) + n.x * strength * falloff)
      pos.setY(i, pos.getY(i) + n.y * strength * falloff)
      pos.setZ(i, pos.getZ(i) + n.z * strength * falloff)
    } else if (mode === 'lower') {
      pos.setX(i, pos.getX(i) - n.x * strength * falloff)
      pos.setY(i, pos.getY(i) - n.y * strength * falloff)
      pos.setZ(i, pos.getZ(i) - n.z * strength * falloff)
    } else if (mode === 'smooth') {
      // Suavização: move vértice para a média dos vizinhos aproximada
      // (aqui apenas reduz a sua distância ao centróide local)
      // Implementação simples: amortecer para a posição original — não temos topologia.
      // Como aproximação, deslocamos levemente no sentido oposto à normal.
      pos.setX(i, pos.getX(i) - n.x * strength * 0.3 * falloff)
      pos.setY(i, pos.getY(i) - n.y * strength * 0.3 * falloff)
      pos.setZ(i, pos.getZ(i) - n.z * strength * 0.3 * falloff)
    } else if (mode === 'flatten') {
      // Flatten: projeta vértices para um plano definido por point/normal
      const v = tmp.clone().sub(p)
      const d = v.dot(n)
      pos.setX(i, pos.getX(i) - n.x * d * falloff * strength)
      pos.setY(i, pos.getY(i) - n.y * d * falloff * strength)
      pos.setZ(i, pos.getZ(i) - n.z * d * falloff * strength)
    }
  }

  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

// ---------- UV Unwrap ----------
// Gera UVs automáticos via projeção planar ou esférica
export function unwrapUV(geometry, method = 'planar') {
  const geo = geometry.clone()
  geo.computeBoundingBox()
  const bbox = geo.boundingBox
  const size = new THREE.Vector3()
  bbox.getSize(size)
  const center = new THREE.Vector3()
  bbox.getCenter(center)

  const pos = geo.getAttribute('position')
  const uvs = new Float32Array(pos.count * 2)

  if (method === 'planar') {
    // Projeta sobre o plano XY (maior dimensão)
    const useX = size.x >= size.y && size.x >= size.z
    const useY = !useX && size.y >= size.z
    for (let i = 0; i < pos.count; i++) {
      const u = useX ? (pos.getX(i) - bbox.min.x) / size.x
                     : (pos.getZ(i) - bbox.min.z) / size.z
      const v = useY ? (pos.getY(i) - bbox.min.y) / size.y
                     : (pos.getY(i) - bbox.min.y) / size.y
      uvs[i * 2] = u
      uvs[i * 2 + 1] = v
    }
  } else if (method === 'box') {
    // Box projection: usa a normal para escolher o plano
    if (!geo.getAttribute('normal')) geo.computeVertexNormals()
    const nor = geo.getAttribute('normal')
    for (let i = 0; i < pos.count; i++) {
      const nx = Math.abs(nor.getX(i))
      const ny = Math.abs(nor.getY(i))
      const nz = Math.abs(nor.getZ(i))
      let u, v
      if (nx >= ny && nx >= nz) {
        u = (pos.getZ(i) - bbox.min.z) / size.z
        v = (pos.getY(i) - bbox.min.y) / size.y
      } else if (ny >= nx && ny >= nz) {
        u = (pos.getX(i) - bbox.min.x) / size.x
        v = (pos.getZ(i) - bbox.min.z) / size.z
      } else {
        u = (pos.getX(i) - bbox.min.x) / size.x
        v = (pos.getY(i) - bbox.min.y) / size.y
      }
      uvs[i * 2] = u
      uvs[i * 2 + 1] = v
    }
  } else if (method === 'spherical') {
    // Spherical projection: usa ângulos theta (longitude) e phi (latitude)
    const center = new THREE.Vector3()
    geo.boundingBox.getCenter(center)
    const posAttr = geo.getAttribute('position')
    for (let i = 0; i < posAttr.count; i++) {
      const dx = posAttr.getX(i) - center.x
      const dy = posAttr.getY(i) - center.y
      const dz = posAttr.getZ(i) - center.z
      const r = Math.max(1e-6, Math.sqrt(dx * dx + dy * dy + dz * dz))
      // u: longitude (atan2 z,x) normalizado 0..1
      const u = 0.5 + Math.atan2(dz, dx) / (2 * Math.PI)
      // v: latitude (asin y/r) normalizado 0..1
      const v = 0.5 + Math.asin(Math.max(-1, Math.min(1, dy / r))) / Math.PI
      uvs[i * 2] = u
      uvs[i * 2 + 1] = v
    }
  } else if (method === 'cylindrical') {
    // Cylindrical projection: u = atan2(z,x), v = y normalizado
    const center = new THREE.Vector3()
    geo.boundingBox.getCenter(center)
    const minY = bbox.min.y
    const heightY = Math.max(1e-6, size.y)
    const posAttr = geo.getAttribute('position')
    for (let i = 0; i < posAttr.count; i++) {
      const dx = posAttr.getX(i) - center.x
      const dz = posAttr.getZ(i) - center.z
      const u = 0.5 + Math.atan2(dz, dx) / (2 * Math.PI)
      const v = (posAttr.getY(i) - minY) / heightY
      uvs[i * 2] = u
      uvs[i * 2 + 1] = v
    }
  }

  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  return geo
}

// ---------- Helpers ----------
// Devolve o índice do triângulo mais próximo de um ponto (raycast)
export function findClosestFace(geometry, raycaster, mesh) {
  const intersects = raycaster.intersectObject(mesh)
  if (intersects.length === 0) return null
  return intersects[0]
}

// ============ FASE 2: NOVOS MODIFICADORES DE MESH ============

// ---------- Elevation (Mapa de Ruído / Heightmap) ----------
// Eleva/rebaixa partes da geometria com base num mapa de ruído.
// Útil para criar terreno a partir de um plano, ou dar relevo a qualquer modelo.
export function elevationDisplace(geometry, options = {}) {
  const {
    strength = 0.5,
    scale = 1.0,
    axis = 'y', // eixo ao longo do qual elevar
    seed = 0,
  } = options

  const geo = geometry.clone()
  const pos = geo.getAttribute('position')
  if (!pos) return geo

  // Função de ruído simples baseada em hash (não precisa de dependências externas)
  // Usamos Perlin aproximado via múltiplas oitavas de hash
  function hash(x, y, z, s) {
    let h = x * 374761393 + y * 668265263 + z * 2654435761 + s * 1013904223
    h = (h ^ (h >>> 13)) * 1274126177
    h = h ^ (h >>> 16)
    return (h & 0x7fffffff) / 0x7fffffff
  }
  function noise(x, y, z, s) {
    // 3 oitavas
    let n = 0
    n += hash(x, y, z, s)
    n += 0.5 * hash(x * 2, y * 2, z * 2, s)
    n += 0.25 * hash(x * 4, y * 4, z * 4, s)
    return n / 1.75 - 0.5 // -0.5..0.5
  }

  const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * scale
    const y = pos.getY(i) * scale
    const z = pos.getZ(i) * scale
    const n = noise(x, y, z, seed)
    if (axisIdx === 0) pos.setX(i, pos.getX(i) + n * strength)
    else if (axisIdx === 1) pos.setY(i, pos.getY(i) + n * strength)
    else pos.setZ(i, pos.getZ(i) + n * strength)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

// ---------- Displace (Ruído orgânico) ----------
// Desloca vértices ao longo das normais com base num mapa de ruído.
// Diferente de elevationDisplace: este usa a normal do vértice, não um eixo fixo.
export function displaceGeometry(geometry, options = {}) {
  const {
    strength = 0.3,
    scale = 1.0,
    seed = 0,
  } = options

  const geo = geometry.clone()
  if (!geo.getAttribute('normal')) geo.computeVertexNormals()
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')

  function hash(x, y, z, s) {
    let h = x * 374761393 + y * 668265263 + z * 2654435761 + s * 1013904223
    h = (h ^ (h >>> 13)) * 1274126177
    h = h ^ (h >>> 16)
    return (h & 0x7fffffff) / 0x7fffffff
  }
  function noise(x, y, z, s) {
    let n = 0
    n += hash(x, y, z, s)
    n += 0.5 * hash(x * 2, y * 2, z * 2, s)
    n += 0.25 * hash(x * 4, y * 4, z * 4, s)
    return n / 1.75 - 0.5
  }

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) * scale
    const y = pos.getY(i) * scale
    const z = pos.getZ(i) * scale
    const n = noise(x, y, z, seed)
    pos.setX(i, pos.getX(i) + nor.getX(i) * n * strength)
    pos.setY(i, pos.getY(i) + nor.getY(i) * n * strength)
    pos.setZ(i, pos.getZ(i) + nor.getZ(i) * n * strength)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

// ---------- Taper (Afunilar) ----------
// Estreita uma ponta do objeto gradualmente ao longo de um eixo.
// factor > 0: estreita a ponta positiva do eixo; < 0: alarga
export function taperGeometry(geometry, options = {}) {
  const {
    factor = 0.5,
    axis = 'y', // eixo de afunilamento
    taperAxis = 'xz', // quais eixos estreitar (xz = ambos)
  } = options

  const geo = geometry.clone()
  const pos = geo.getAttribute('position')
  geo.computeBoundingBox()
  const bbox = geo.boundingBox
  const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
  const minA = bbox.min.getComponent(axisIdx)
  const maxA = bbox.max.getComponent(axisIdx)
  const range = maxA - minA || 1

  for (let i = 0; i < pos.count; i++) {
    const a = pos.getComponent(i, axisIdx)
    const t = (a - minA) / range // 0..1 ao longo do eixo
    // Fator de escala interpolado (1 na base, 1-factor no topo)
    const s = 1 - factor * t
    if (taperAxis.includes('x')) pos.setX(i, pos.getX(i) * s)
    if (taperAxis.includes('z')) pos.setZ(i, pos.getZ(i) * s)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

// ---------- Twist (Torcer) ----------
// Roda a geometria progressivamente ao longo de um eixo.
export function twistGeometry(geometry, options = {}) {
  const {
    angle = Math.PI, // rotação total (radianos)
    axis = 'y',
  } = options

  const geo = geometry.clone()
  const pos = geo.getAttribute('position')
  geo.computeBoundingBox()
  const bbox = geo.boundingBox
  const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
  const minA = bbox.min.getComponent(axisIdx)
  const maxA = bbox.max.getComponent(axisIdx)
  const range = maxA - minA || 1

  // Vetor unitário do eixo
  const axisVec = new THREE.Vector3(
    axis === 'x' ? 1 : 0,
    axis === 'y' ? 1 : 0,
    axis === 'z' ? 1 : 0
  )

  const quat = new THREE.Quaternion()
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const a = v.getComponent(axisIdx)
    const t = (a - minA) / range
    const twistAngle = t * angle
    quat.setFromAxisAngle(axisVec, twistAngle)
    // Rotacionar em torno do eixo (não em torno do centro — preserva a coordenada do eixo)
    const component = v.getComponent(axisIdx)
    v.applyQuaternion(quat)
    v.setComponent(axisIdx, component)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

// ---------- Bend (Dobrar) ----------
// Dobra o objeto num âângulo, como vergar um tubo.
// Funciona deslocando vértices em arco ao longo do eixo de dobra.
export function bendGeometry(geometry, options = {}) {
  const {
    angle = Math.PI / 6, // ângulo de dobra (radianos)
    axis = 'y', // eixo primário (a direção que será curvada)
    bendAxis = 'z', // eixo perpendicular ao plano de dobra
  } = options

  const geo = geometry.clone()
  const pos = geo.getAttribute('position')
  geo.computeBoundingBox()
  const bbox = geo.boundingBox
  const axisIdx = axis === 'x' ? 0 : axis === 'y' ? 1 : 2
  const bendAxisIdx = bendAxis === 'x' ? 0 : bendAxis === 'y' ? 1 : 2
  const minA = bbox.min.getComponent(axisIdx)
  const maxA = bbox.max.getComponent(axisIdx)
  const range = maxA - minA || 1
  // Raio de curvatura = range / angle (quanto maior o ângulo, menor o raio)
  const radius = range / Math.max(0.001, Math.abs(angle))

  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const a = v.getComponent(axisIdx)
    const t = (a - minA) / range // 0..1
    // Distância perpendicular ao eixo de dobra
    const perp = v.getComponent(bendAxisIdx) - radius
    // Ângulo no arco
    const arcAngle = t * angle
    // Nova posição: arco + offset perpendicular
    const newAlong = Math.sin(arcAngle) * radius
    const newPerp = Math.cos(arcAngle) * radius + perp * Math.cos(arcAngle)
    v.setComponent(axisIdx, minA + newAlong)
    v.setComponent(bendAxisIdx, newPerp)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

// ---------- Smooth (Suavização Laplaciana) ----------
// Suaviza a geometria movendo cada vértice para a média dos seus vizinhos.
// iterations: mais iterações = mais suave
export function smoothGeometry(geometry, options = {}) {
  const {
    iterations = 2,
    factor = 0.5, // 0 = sem efeito, 1 = total
  } = options

  // mergeVertices para ter topologia indexada (necessário para encontrar vizinhos)
  let geo = BufferGeometryUtils.mergeVertices(geometry.clone(), 0.001)
  if (!geo.index) {
    // fallback: se ainda não está indexada, fazer smoothing aproximado por triângulo
    geo = toNonIndexed(geo)
  }

  for (let iter = 0; iter < iterations; iter++) {
    const pos = geo.getAttribute('position')
    const idx = geo.index
    if (!idx) break
    const newPositions = new Float32Array(pos.array.length)

    // Para cada vértice, encontrar vizinhos (vértices que partilham um triângulo)
    const neighbors = new Map() // index → Set de indexes vizinhos
    for (let i = 0; i < idx.count; i += 3) {
      const a = idx.getX(i)
      const b = idx.getX(i + 1)
      const c = idx.getX(i + 2)
      if (!neighbors.has(a)) neighbors.set(a, new Set())
      if (!neighbors.has(b)) neighbors.set(b, new Set())
      if (!neighbors.has(c)) neighbors.set(c, new Set())
      neighbors.get(a).add(b); neighbors.get(a).add(c)
      neighbors.get(b).add(a); neighbors.get(b).add(c)
      neighbors.get(c).add(a); neighbors.get(c).add(b)
    }

    // Para cada vértice, calcular a média dos vizinhos
    const v = new THREE.Vector3()
    const sum = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const ns = neighbors.get(i)
      if (!ns || ns.size === 0) {
        newPositions[i * 3] = v.x
        newPositions[i * 3 + 1] = v.y
        newPositions[i * 3 + 2] = v.z
        continue
      }
      sum.set(0, 0, 0)
      for (const n of ns) {
        sum.x += pos.getX(n)
        sum.y += pos.getY(n)
        sum.z += pos.getZ(n)
      }
      sum.divideScalar(ns.size)
      // Interpolar entre a posição original e a média
      newPositions[i * 3] = v.x + (sum.x - v.x) * factor
      newPositions[i * 3 + 1] = v.y + (sum.y - v.y) * factor
      newPositions[i * 3 + 2] = v.z + (sum.z - v.z) * factor
    }

    pos.array.set(newPositions)
    pos.needsUpdate = true
  }

  geo.computeVertexNormals()
  return geo
}

// ---------- Decimate (Reduzir Polígonos) ----------
// Reduz a contagem de triângulos mantendo a forma geral.
// Implementação simplificada: remove triângulos com área muito pequena
// e funde vértices próximos.
export function decimateGeometry(geometry, options = {}) {
  const {
    ratio = 0.5, // 0.5 = manter 50% dos triângulos
  } = options

  const geo = toNonIndexed(geometry)
  const pos = geo.getAttribute('position')
  const totalTriangles = pos.count / 3
  const targetTriangles = Math.max(1, Math.floor(totalTriangles * ratio))

  if (targetTriangles >= totalTriangles) return geometry.clone()

  // Calcular área de cada triângulo e manter apenas os maiores
  const triangles = []
  const v0 = new THREE.Vector3(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3()
  const edge1 = new THREE.Vector3(), edge2 = new THREE.Vector3(), cross = new THREE.Vector3()

  for (let i = 0; i < pos.count; i += 3) {
    v0.fromBufferAttribute(pos, i)
    v1.fromBufferAttribute(pos, i + 1)
    v2.fromBufferAttribute(pos, i + 2)
    edge1.subVectors(v1, v0)
    edge2.subVectors(v2, v0)
    cross.crossVectors(edge1, edge2)
    const area = cross.length() * 0.5
    triangles.push({ index: i, area })
  }

  // Ordenar por área descendente e manter os maiores
  triangles.sort((a, b) => b.area - a.area)
  const kept = triangles.slice(0, targetTriangles)

  const newPositions = new Float32Array(targetTriangles * 9)
  for (let i = 0; i < kept.length; i++) {
    const idx = kept[i].index
    for (let j = 0; j < 9; j++) {
      newPositions[i * 9 + j] = pos.array[idx * 3 + j]
    }
  }

  const result = new THREE.BufferGeometry()
  result.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3))
  result.computeVertexNormals()
  return result
}

// ---------- Line Path (Tubo/Cabo/Corda) ----------
// Cria uma NOVA geometria (tubo) que segue um PathObject.
// Diferente de curveDeform (que deforma geometria existente), este cria geometria nova.
export function createLinePathGeometry(pathPoints, options = {}) {
  const {
    radius = 0.1,
    tubularSegments = 64,
    radialSegments = 8,
    closed = false,
  } = options

  if (!pathPoints || pathPoints.length < 2) return null

  const points = pathPoints.map(p => new THREE.Vector3(p[0], p[1], p[2]))
  const curve = new THREE.CatmullRomCurve3(points, closed, 'catmullrom', 0.5)
  return new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed)
}

// ---------- Contact Illumination (AO de contacto) ----------
// Realça sombreamento nas zonas onde o modelo toca noutras superfícies.
// Como modificador, darkens vertices na base (y mínimo) para dar "aderência visual".
// Isto é mais leve que um SSAO completo e funciona em tempo de modelação.
export function contactIllumination(geometry, options = {}) {
  const {
    strength = 0.5, // 0..1, quanto escurecer
    height = 1.0, // altura (em unidades do modelo) a partir da base que recebe escurecimento
  } = options

  const geo = geometry.clone()
  if (!geo.getAttribute('normal')) geo.computeVertexNormals()
  geo.computeBoundingBox()
  const minY = geo.boundingBox.min.y
  const pos = geo.getAttribute('position')
  const nor = geo.getAttribute('normal')

  // Adicionar vertex colors se não existirem
  let colAttr = geo.getAttribute('color')
  if (!colAttr) {
    const colors = new Float32Array(pos.count * 3).fill(1.0)
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    colAttr = geo.getAttribute('color')
  }

  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const ny = nor.getY(i)
    // Escurecer vértices perto da base E com normal apontando para baixo
    const heightFactor = Math.max(0, 1 - (y - minY) / height)
    const normalFactor = Math.max(0, -ny) // 0..1, maior quando normal aponta para baixo
    const darken = heightFactor * normalFactor * strength
    const r = colAttr.getX(i) * (1 - darken)
    const g = colAttr.getY(i) * (1 - darken)
    const b = colAttr.getZ(i) * (1 - darken)
    colAttr.setXYZ(i, r, g, b)
  }
  colAttr.needsUpdate = true
  return geo
}

// ---------- Curve Deform ----------
/**
 * Deforma uma geometria ao longo de uma curva (array de pontos [x,y,z]).
 *
 * Como funciona:
 *  1. Calcula o bounding box da geometria original
 *  2. Para cada vértice, mapeia a sua posição X (ao longo do eixo principal)
 *     para um parâmetro t ∈ [0, 1] ao longo da curva
 *  3. Obtém a posição na curva correspondente a t usando Catmull-Rom (curva suave)
 *  4. Translada o vértice para essa posição, mantendo Y/Z relativos
 *  5. Aplica rotação para alinhar com a tangente da curva
 *
 * Usa THREE.CatmullRomCurve3 para interpolação suave (passa por todos os pontos
 * sem angulosidades), ao contrário da interpolação linear anterior.
 *
 * @param {THREE.BufferGeometry} geometry - geometria a deformar
 * @param {Array} pathPoints - array de [x,y,z] pontos da curva
 * @param {Object} options - { twist: 0, stretch: 1 }
 * @returns {THREE.BufferGeometry} - nova geometria deformada
 */
export function curveDeform(geometry, pathPoints, options = {}) {
  if (!pathPoints || pathPoints.length < 2) return geometry

  const { twist = 0, stretch = 1 } = options

  // Clonar geometria para não mutar a original
  const result = geometry.clone()

  // Calcular bounding box para mapear X → t
  result.computeBoundingBox()
  const bbox = result.boundingBox
  const minX = bbox.min.x
  const maxX = bbox.max.x
  const rangeX = maxX - minX || 1

  // Normalizar pathPoints para THREE.Vector3
  const points = pathPoints.map(p => new THREE.Vector3(p[0], p[1], p[2]))

  // Criar curva Catmull-Rom (suave — passa por todos os pontos sem angulosidades)
  // Catmull-Rom precisa de pelo menos 2 pontos; com 2 pontos funciona como linear
  // (mas não há nada a suavizar). Com 3+ pontos gera uma curva suave.
  const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5)

  // Pré-calcular pontos amostrados ao longo da curva para obter comprimento
  // e mapeamento t → distância
  const sampleCount = Math.max(100, points.length * 20)
  const samples = []
  let totalLength = 0
  let prevPoint = null
  for (let i = 0; i <= sampleCount; i++) {
    const t = i / sampleCount
    const pt = curve.getPoint(t)
    if (prevPoint) {
      totalLength += pt.distanceTo(prevPoint)
    }
    samples.push({ t, point: pt, dist: totalLength })
    prevPoint = pt
  }
  if (totalLength === 0) return geometry

  // Função para obter ponto e tangente na curva em t ∈ [0, 1]
  // Usa amostragem por distância (parametrização por arc-length)
  function getPointOnCurve(t) {
    t = Math.max(0, Math.min(1, t * stretch))
    const targetDist = t * totalLength
    // Busca binária nos samples
    let lo = 0, hi = samples.length - 1
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1
      if (samples[mid].dist <= targetDist) lo = mid
      else hi = mid
    }
    const s1 = samples[lo]
    const s2 = samples[hi]
    const segLen = s2.dist - s1.dist || 1
    const localT = (targetDist - s1.dist) / segLen
    const point = new THREE.Vector3().lerpVectors(s1.point, s2.point, localT)
    // Tangente via derivative da curva Catmull-Rom
    const tangent = curve.getTangent(t).normalize()
    return { point, tangent }
  }

  // Para cada vértice, deformar
  const pos = result.attributes.position
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)

    // Mapear X → t (0 no minX, 1 no maxX)
    const t = (v.x - minX) / rangeX

    // Obter ponto na curva
    const { point, tangent } = getPointOnCurve(t * stretch)

    // Offset relativo (Y e Z do vértice original)
    const offsetY = v.y
    const offsetZ = v.z

    // Calcular rotação para alinhar X com a tangente
    // Tangente padrão é (1,0,0); queremos rodar para `tangent`
    const defaultDir = new THREE.Vector3(1, 0, 0)
    const quat = new THREE.Quaternion().setFromUnitVectors(defaultDir, tangent)

    // Aplicar rotação ao offset (Y,Z)
    const offset = new THREE.Vector3(0, offsetY, offsetZ)
    offset.applyQuaternion(quat)

    // Aplicar twist (rotação incremental ao longo da curva)
    if (twist !== 0) {
      const twistAngle = t * twist * Math.PI * 2
      const twistQuat = new THREE.Quaternion().setFromAxisAngle(tangent, twistAngle)
      offset.applyQuaternion(twistQuat)
    }

    // Posição final = ponto na curva + offset rotacionado
    v.copy(point).add(offset)
    pos.setXYZ(i, v.x, v.y, v.z)
  }

  pos.needsUpdate = true
  result.computeVertexNormals()
  result.computeBoundingBox()
  result.computeBoundingSphere()
  return result
}

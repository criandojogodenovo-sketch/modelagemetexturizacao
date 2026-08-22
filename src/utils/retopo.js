/**
 * retopo.js — Retopologia.
 *
 * Funções expostas:
 *  - decimate(geometry, targetRatio)      — vertex clustering + rebuild de triângulos
 *  - remesh(geometry, voxelSize)          — marching cubes a partir de SDF binário
 *  - quadRemesh(geometry, targetQuadCount) — funde pares de triângulos adjacentes em quads
 *  - fillHoles(geometry)                  — fecha edge loops abertos com fan triangulation
 *  - cleanUp(geometry)                     — merge vertices + remove triângulos degenerados + unused
 *
 * Todas as funções DEVOLVEM uma NOVA BufferGeometry (não mutam a entrada).
 */
import * as THREE from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { edgeTable, triTable } from 'three/examples/jsm/objects/MarchingCubes.js'

// ---------- decimate ----------
// Vertex clustering: snap a grid de tamanho `cellSize` (derivado de targetRatio),
// funde vértices que caem na mesma célula, reconstrói triângulos (skip degenerados).
// targetRatio: 0..1 (triângulos finais / iniciais).
export function decimate(geometry, targetRatio = 0.5) {
  const src = toIndexedOrFlat(geometry)
  const pos = src.getAttribute('position')
  const srcIndex = src.index ? src.index.array : buildAutoIndex(src)

  // Bounding box
  src.computeBoundingBox()
  const bbox = src.boundingBox
  const size = new THREE.Vector3()
  bbox.getSize(size)
  const triCount = Math.floor(srcIndex.length / 3)
  const targetTri = Math.max(1, Math.floor(triCount * Math.max(0.05, Math.min(1, targetRatio))))

  // cellSize: escolhido para aproximar targetTri (heurística: cellSize ~ maxDim / k,
  // k = cbrt(targetTri)).
  const k = Math.max(2, Math.cbrt(targetTri))
  const cellSize = Math.max(size.x, size.y, size.z) / k
  if (cellSize < 1e-6) return src.clone()

  // Snap + merge por célula
  const cellMap = new Map() // key -> newIndex
  const newPositions = []
  const keyTmp = [0, 0, 0]
  const remap = new Int32Array(pos.count).fill(-1)

  for (let i = 0; i < pos.count; i++) {
    keyTmp[0] = Math.floor((pos.getX(i) - bbox.min.x) / cellSize)
    keyTmp[1] = Math.floor((pos.getY(i) - bbox.min.y) / cellSize)
    keyTmp[2] = Math.floor((pos.getZ(i) - bbox.min.z) / cellSize)
    const key = `${keyTmp[0]}_${keyTmp[1]}_${keyTmp[2]}`
    let idx = cellMap.get(key)
    if (idx === undefined) {
      idx = newPositions.length / 3
      newPositions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
      cellMap.set(key, idx)
    }
    remap[i] = idx
  }

  // Rebuild triângulos, saltando degenerados (vértices que colapsam para a mesma célula)
  const newIndices = []
  for (let t = 0; t < triCount; t++) {
    const a = remap[srcIndex[t * 3]]
    const b = remap[srcIndex[t * 3 + 1]]
    const c = remap[srcIndex[t * 3 + 2]]
    if (a === b || b === c || a === c) continue
    newIndices.push(a, b, c)
  }

  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3))
  out.setIndex(newIndices)
  out.computeVertexNormals()
  return out
}

// ---------- remesh ----------
// Marching Cubes simplificado:
//  1) Computar bbox + grid de voxels com resolução derivada de voxelSize.
//  2) Para cada voxel, determinar inside/outside via ray-mesh parity test (+X).
//  3) Densidade binária (+1 inside, -1 outside).
//  4) Marching cubes usando edgeTable/triTable exportados por three/addons.
//
// Fallback: se mesh > 5000 tris ou grid > 64³, usa subdivide(2x) + decimate
// (aproximação de remesh — não é voxel-perfect mas produz topologia regular).
export function remesh(geometry, voxelSize = 0.1) {
  const src = toIndexedOrFlat(geometry)
  const pos = src.getAttribute('position')
  const idx = src.index ? src.index.array : buildAutoIndex(src)
  const triCount = Math.floor(idx.length / 3)

  if (triCount > 5000) return remeshFallback(src, voxelSize)

  src.computeBoundingBox()
  const bbox = src.boundingBox
  const padding = voxelSize
  const min = bbox.min.clone().subScalar(padding)
  const max = bbox.max.clone().addScalar(padding)
  const dim = max.clone().sub(min)
  const resX = clampInt(Math.ceil(dim.x / voxelSize), 4, 64)
  const resY = clampInt(Math.ceil(dim.y / voxelSize), 4, 64)
  const resZ = clampInt(Math.ceil(dim.z / voxelSize), 4, 64)
  if (resX * resY * resZ > 64 * 64 * 64) return remeshFallback(src, voxelSize)

  // Tris em formato plano para teste rápido
  const tris = new Float32Array(triCount * 9)
  for (let t = 0; t < triCount; t++) {
    const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2]
    tris[t * 9 + 0] = pos.getX(a); tris[t * 9 + 1] = pos.getY(a); tris[t * 9 + 2] = pos.getZ(a)
    tris[t * 9 + 3] = pos.getX(b); tris[t * 9 + 4] = pos.getY(b); tris[t * 9 + 5] = pos.getZ(b)
    tris[t * 9 + 6] = pos.getX(c); tris[t * 9 + 7] = pos.getY(c); tris[t * 9 + 8] = pos.getZ(c)
  }

  // Densidade: +1 inside, -1 outside
  const field = new Float32Array(resX * resY * resZ)
  const voxelCenter = new THREE.Vector3()
  const rayDir = new THREE.Vector3(1, 0, 0)
  for (let zi = 0; zi < resZ; zi++) {
    for (let yi = 0; yi < resY; yi++) {
      for (let xi = 0; xi < resX; xi++) {
        voxelCenter.set(
          min.x + (xi + 0.5) * voxelSize,
          min.y + (yi + 0.5) * voxelSize,
          min.z + (zi + 0.5) * voxelSize
        )
        const inside = isPointInsideMesh(voxelCenter, rayDir, tris, triCount)
        field[zi * resX * resY + yi * resX + xi] = inside ? 1 : -1
      }
    }
  }

  const positions = []
  marchCubes(field, resX, resY, resZ, min, voxelSize, positions)
  if (positions.length === 0) return remeshFallback(src, voxelSize)

  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  out.computeVertexNormals()
  return out
}

// Fallback: subdivide 2x + decimate (documentado). Não é remesh verdadeiro mas
// produz topologia mais regular. Usado quando a mesh é demasiado grande para MC.
function remeshFallback(geometry, voxelSize) {
  let g = subdivideOnce(geometry)
  g = subdivideOnce(g)
  g.computeBoundingBox()
  const sz = new THREE.Vector3()
  g.boundingBox.getSize(sz)
  const maxDim = Math.max(sz.x, sz.y, sz.z)
  const targetRatio = Math.min(1, Math.max(0.2, (voxelSize / Math.max(0.01, maxDim)) * 4))
  return decimate(g, targetRatio)
}

// Subdivisão simples (1 tri → 4 tris) — usado pelo fallback.
function subdivideOnce(geometry) {
  const pos = geometry.getAttribute('position')
  const idx = geometry.index ? geometry.index.array : buildAutoIndex(geometry)
  const triCount = Math.floor(idx.length / 3)
  const newPositions = []
  for (let i = 0; i < pos.count; i++) {
    newPositions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
  }
  const addVertex = (x, y, z) => {
    newPositions.push(x, y, z)
    return (newPositions.length / 3) - 1
  }
  const newIdx = []
  for (let t = 0; t < triCount; t++) {
    const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2]
    const ax = pos.getX(a), ay = pos.getY(a), az = pos.getZ(a)
    const bx = pos.getX(b), by = pos.getY(b), bz = pos.getZ(b)
    const cx = pos.getX(c), cy = pos.getY(c), cz = pos.getZ(c)
    const ab = addVertex((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2)
    const bc = addVertex((bx + cx) / 2, (by + cy) / 2, (bz + cz) / 2)
    const ca = addVertex((cx + ax) / 2, (cy + ay) / 2, (cz + az) / 2)
    newIdx.push(a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca)
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3))
  out.setIndex(newIdx)
  out.computeVertexNormals()
  return out
}

// ---------- quadRemesh ----------
// Heurística: para cada par de triângulos adjacentes (partilham um edge),
// reorganiza os 4 vértices como 2 tris equivalentes a um quad.
// targetQuadCount limita o número de pares processados.
export function quadRemesh(geometry, targetQuadCount = Infinity) {
  const src = toIndexedOrFlat(geometry)
  const pos = src.getAttribute('position')
  const idx = src.index ? src.index.array : buildAutoIndex(src)
  const triCount = Math.floor(idx.length / 3)

  const edgeMap = new Map() // "a_b" -> [{tri, opp}]
  for (let t = 0; t < triCount; t++) {
    const a = idx[t * 3], b = idx[t * 3 + 1], c = idx[t * 3 + 2]
    addEdge(edgeMap, a, b, t, c)
    addEdge(edgeMap, b, c, t, a)
    addEdge(edgeMap, c, a, t, b)
  }

  const used = new Uint8Array(triCount)
  const newPositions = []
  for (let i = 0; i < pos.count; i++) {
    newPositions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
  }
  const newIndices = []
  let quadCount = 0

  for (const [, info] of edgeMap) {
    if (info.length !== 2) continue
    if (quadCount >= targetQuadCount) break
    const { tri: t1, opp: o1 } = info[0]
    const { tri: t2, opp: o2 } = info[1]
    if (used[t1] || used[t2]) continue
    const ai = idx[t1 * 3], bi = idx[t1 * 3 + 1]
    if (o1 === o2 || o1 === ai || o1 === bi || o2 === ai || o2 === bi) continue
    // 2 tris formando um quad: o1-a-b-o2 → 2 triângulos (o1,a,o2)+(a,b,o2)
    newIndices.push(o1, ai, o2, ai, bi, o2)
    used[t1] = 1
    used[t2] = 1
    quadCount++
  }

  for (let t = 0; t < triCount; t++) {
    if (used[t]) continue
    newIndices.push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2])
  }

  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3))
  out.setIndex(newIndices)
  out.computeVertexNormals()
  return out
}

// ---------- fillHoles ----------
// Encontra edges abertos (partilhados por 1 triângulo), agrupa em loops,
// fecha cada loop com fan triangulation a partir do centroid.
export function fillHoles(geometry) {
  const src = toIndexedOrFlat(geometry)
  const pos = src.getAttribute('position')
  const idx = src.index ? src.index.array : buildAutoIndex(src)
  const triCount = Math.floor(idx.length / 3)

  // Edge -> count
  const edgeCount = new Map()
  const addE = (a, b) => {
    const k = a < b ? `${a}_${b}` : `${b}_${a}`
    edgeCount.set(k, (edgeCount.get(k) || 0) + 1)
  }
  for (let t = 0; t < triCount; t++) {
    addE(idx[t * 3], idx[t * 3 + 1])
    addE(idx[t * 3 + 1], idx[t * 3 + 2])
    addE(idx[t * 3 + 2], idx[t * 3])
  }

  // Open edges (count == 1)
  const openEdges = []
  for (const [k, c] of edgeCount) {
    if (c === 1) {
      const [a, b] = k.split('_').map(Number)
      openEdges.push([a, b])
    }
  }
  if (openEdges.length === 0) return src.clone()

  // Adjacency of open-edge vertices
  const adj = new Map()
  for (const [a, b] of openEdges) {
    if (!adj.has(a)) adj.set(a, [])
    if (!adj.has(b)) adj.set(b, [])
    adj.get(a).push(b)
    adj.get(b).push(a)
  }

  // Walk open edges to form loops
  const visitedEdges = new Set()
  const loops = []
  for (const [a, b] of openEdges) {
    const ek = a < b ? `${a}_${b}` : `${b}_${a}`
    if (visitedEdges.has(ek)) continue
    const loop = []
    let cur = a, prev = -1
    while (true) {
      loop.push(cur)
      const next = (adj.get(cur) || []).find((n) => {
        if (n === prev) return false
        const k = cur < n ? `${cur}_${n}` : `${n}_${cur}`
        return !visitedEdges.has(k)
      })
      if (next === undefined) break
      const k = cur < next ? `${cur}_${next}` : `${next}_${cur}`
      visitedEdges.add(k)
      prev = cur
      cur = next
      if (cur === a) break
    }
    if (loop.length >= 3) loops.push(loop)
  }
  if (loops.length === 0) return src.clone()

  // Build output: existing triangles + fan per loop
  const existingIndices = []
  for (let t = 0; t < triCount; t++) {
    existingIndices.push(idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2])
  }
  return buildWithCentroidFan(src, existingIndices, loops)
}

// Helper: adiciona um vértice centroid por loop + fan triangulation.
function buildWithCentroidFan(src, existingIndices, loops) {
  const pos = src.getAttribute('position')
  const newPositions = []
  for (let i = 0; i < pos.count; i++) {
    newPositions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
  }
  const allIndices = existingIndices.slice()
  for (const loop of loops) {
    let cx = 0, cy = 0, cz = 0
    for (const vi of loop) {
      cx += pos.getX(vi); cy += pos.getY(vi); cz += pos.getZ(vi)
    }
    cx /= loop.length; cy /= loop.length; cz /= loop.length
    newPositions.push(cx, cy, cz)
    const centroidIdx = (newPositions.length / 3) - 1
    for (let i = 0; i < loop.length; i++) {
      const a = loop[i]
      const b = loop[(i + 1) % loop.length]
      allIndices.push(a, b, centroidIdx)
    }
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3))
  out.setIndex(allIndices)
  out.computeVertexNormals()
  return out
}

// ---------- cleanUp ----------
// mergeVertices do BufferGeometryUtils (threshold 1e-4) + remove triângulos
// degenerados (zero area) + remove vértices não referenciados.
export function cleanUp(geometry) {
  const indexed = ensureIndexed(geometry)
  let merged = mergeVertices(indexed, 1e-4)
  merged = removeDegenerateTriangles(merged)
  merged = removeUnusedVertices(merged)
  merged.computeVertexNormals()
  return merged
}

function removeDegenerateTriangles(geometry) {
  const pos = geometry.getAttribute('position')
  const idx = geometry.index ? geometry.index.array : buildAutoIndex(geometry)
  const triCount = Math.floor(idx.length / 3)
  const out = []
  const ab = new THREE.Vector3(), ac = new THREE.Vector3()
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  for (let t = 0; t < triCount; t++) {
    const ia = idx[t * 3], ib = idx[t * 3 + 1], ic = idx[t * 3 + 2]
    if (ia === ib || ib === ic || ia === ic) continue
    a.set(pos.getX(ia), pos.getY(ia), pos.getZ(ia))
    b.set(pos.getX(ib), pos.getY(ib), pos.getZ(ib))
    c.set(pos.getX(ic), pos.getY(ic), pos.getZ(ic))
    ab.subVectors(b, a)
    ac.subVectors(c, a)
    const area = ab.cross(ac).length()
    if (area < 1e-10) continue
    out.push(ia, ib, ic)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', pos.clone())
  g.setIndex(out)
  return g
}

function removeUnusedVertices(geometry) {
  const pos = geometry.getAttribute('position')
  const idx = geometry.index ? geometry.index.array : buildAutoIndex(geometry)
  const used = new Uint8Array(pos.count)
  for (let i = 0; i < idx.length; i++) used[idx[i]] = 1
  const remap = new Int32Array(pos.count).fill(-1)
  let nextIdx = 0
  const newPositions = []
  for (let i = 0; i < pos.count; i++) {
    if (used[i]) {
      remap[i] = nextIdx++
      newPositions.push(pos.getX(i), pos.getY(i), pos.getZ(i))
    }
  }
  const newIdx = new Int32Array(idx.length)
  for (let i = 0; i < idx.length; i++) newIdx[i] = remap[idx[i]]
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3))
  g.setIndex(new THREE.BufferAttribute(newIdx, 1))
  return g
}

// ---------- Internal: mesh helpers ----------

function toIndexedOrFlat(geometry) {
  if (geometry.index) return geometry
  const g = geometry.clone()
  const count = g.getAttribute('position').count
  const idx = new Uint32Array(count)
  for (let i = 0; i < count; i++) idx[i] = i
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  return g
}

function ensureIndexed(geometry) {
  return toIndexedOrFlat(geometry)
}

function buildAutoIndex(geometry) {
  const count = geometry.getAttribute('position').count
  const arr = new Uint32Array(count)
  for (let i = 0; i < count; i++) arr[i] = i
  return arr
}

function addEdge(edgeMap, a, b, tri, opp) {
  const key = a < b ? `${a}_${b}` : `${b}_${a}`
  if (!edgeMap.has(key)) edgeMap.set(key, [])
  edgeMap.get(key).push({ tri, opp })
}

function clampInt(v, lo, hi) {
  return Math.max(lo, Math.min(hi, Math.floor(v)))
}

// ---------- Internal: point-in-mesh (ray casting parity) ----------

function isPointInsideMesh(origin, dir, tris, triCount) {
  let count = 0
  const ox = origin.x, oy = origin.y, oz = origin.z
  const dx = dir.x, dy = dir.y, dz = dir.z
  for (let t = 0; t < triCount; t++) {
    const o = t * 9
    if (rayTriIntersect(
      ox, oy, oz, dx, dy, dz,
      tris[o], tris[o + 1], tris[o + 2],
      tris[o + 3], tris[o + 4], tris[o + 5],
      tris[o + 6], tris[o + 7], tris[o + 8]
    )) {
      count++
    }
  }
  return count % 2 === 1
}

// Möller–Trumbore. Retorna true se há interseção em t > epsilon.
function rayTriIntersect(ox, oy, oz, dx, dy, dz, ax, ay, az, bx, by, bz, cx, cy, cz) {
  const EPS = 1e-8
  const e1x = bx - ax, e1y = by - ay, e1z = bz - az
  const e2x = cx - ax, e2y = cy - ay, e2z = cz - az
  const px = dy * e2z - dz * e2y
  const py = dz * e2x - dx * e2z
  const pz = dx * e2y - dy * e2x
  const det = e1x * px + e1y * py + e1z * pz
  if (det > -EPS && det < EPS) return false
  const invDet = 1 / det
  const tx = ox - ax, ty = oy - ay, tz = oz - az
  const u = (tx * px + ty * py + tz * pz) * invDet
  if (u < 0 || u > 1) return false
  const qx = ty * e1z - tz * e1y
  const qy = tz * e1x - tx * e1z
  const qz = tx * e1y - ty * e1x
  const v = (dx * qx + dy * qy + dz * qz) * invDet
  if (v < 0 || u + v > 1) return false
  const tt = (e2x * qx + e2y * qy + e2z * qz) * invDet
  return tt > EPS
}

// ---------- Internal: marching cubes ----------

// Corner offsets (8 vértices do cubo unitário).
const CORNER_OFFSETS = [
  [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
  [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]
]

// Edge → par de corners (índices 0..7).
const EDGE_CORNERS = [
  [0, 1], [1, 2], [2, 3], [3, 0],
  [4, 5], [5, 6], [6, 7], [7, 4],
  [0, 4], [1, 5], [2, 6], [3, 7]
]

function marchCubes(field, resX, resY, resZ, min, voxelSize, outPositions) {
  const idx = (x, y, z) => z * resX * resY + y * resX + x

  for (let z = 0; z < resZ - 1; z++) {
    for (let y = 0; y < resY - 1; y++) {
      for (let x = 0; x < resX - 1; x++) {
        const v = new Array(8)
        let cubeIdx = 0
        for (let c = 0; c < 8; c++) {
          const cx = x + CORNER_OFFSETS[c][0]
          const cy = y + CORNER_OFFSETS[c][1]
          const cz = z + CORNER_OFFSETS[c][2]
          v[c] = field[idx(cx, cy, cz)]
          if (v[c] < 0) cubeIdx |= (1 << c)
        }

        const edges = edgeTable[cubeIdx]
        if (edges === 0) continue

        const verts = new Array(12).fill(null)
        for (let e = 0; e < 12; e++) {
          if (!(edges & (1 << e))) continue
          const [ca, cb] = EDGE_CORNERS[e]
          const va = v[ca], vb = v[cb]
          let t = 0.5
          if (Math.abs(vb - va) > 1e-6) t = (0 - va) / (vb - va)
          t = Math.max(0, Math.min(1, t))
          const ax = x + CORNER_OFFSETS[ca][0]
          const ay = y + CORNER_OFFSETS[ca][1]
          const az = z + CORNER_OFFSETS[ca][2]
          const bx = x + CORNER_OFFSETS[cb][0]
          const by = y + CORNER_OFFSETS[cb][1]
          const bz = z + CORNER_OFFSETS[cb][2]
          const wx = min.x + (ax + t * (bx - ax)) * voxelSize
          const wy = min.y + (ay + t * (by - ay)) * voxelSize
          const wz = min.z + (az + t * (bz - az)) * voxelSize
          verts[e] = [wx, wy, wz]
        }

        // triTable é Int32Array flat de 4096 entries (256 cubes × 16 ints)
        const base = cubeIdx * 16
        let i = 0
        while (i < 16 && triTable[base + i] !== -1) {
          const v0 = verts[triTable[base + i]]
          const v1 = verts[triTable[base + i + 1]]
          const v2 = verts[triTable[base + i + 2]]
          if (v0 && v1 && v2) {
            outPositions.push(v0[0], v0[1], v0[2])
            outPositions.push(v1[0], v1[1], v1[2])
            outPositions.push(v2[0], v2[1], v2[2])
          }
          i += 3
        }
      }
    }
  }
}

export { isPointInsideMesh, rayTriIntersect, marchCubes }

export default {
  decimate,
  remesh,
  quadRemesh,
  fillHoles,
  cleanUp
}

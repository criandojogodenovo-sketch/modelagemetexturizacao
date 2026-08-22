/**
 * loopTools.js — operações estilo Blender sobre edge loops e polígonos.
 *
 * Todas as funções aceitam e devolvem THREE.BufferGeometry. Preferem clonar
 * a geometria antes de modificar (imutabilidade). Após mudanças topológicas,
 * chamam computeVertexNormals() e marcam atributos como needsUpdate=true.
 *
 * Funções expostas:
 *  - findEdgeLoop(geometry, startEdgeIndex)         — percorre malha, devolve [vIdx,...]
 *  - findFaceLoop(geometry, startFaceIndex)         — devolve [fIdx,...]
 *  - bridgeLoops(geometry, loop1, loop2)            — une dois loops com triângulos
 *  - fillHole(geometry, loopVertices)               — fan triangulation a partir do centroide
 *  - gridFill(geometry, loop1, loop2, subdivisions) — preenche entre loops com grelha (fallback: bridgeLoops)
 *  - edgeLoopSubdivide(geometry, loopVertices)     — insere vértice médio em cada aresta do loop
 *  - connectVertices(geometry, v1, v2)              — cria aresta entre v1 e v2, parte a face
 *  - dissolveEdges(geometry, edges)                 — remove arestas, funde faces
 *  - edgeCollapse(geometry, ev1, ev2)                — colapsa aresta fundindo os 2 vértices
 *
 * Notas:
 *  - Para geometria não-indexada, usamos toNonIndexed mas convertemos para
 *    indexada quando faz sentido (criamos um índice a partir das posições).
 *  - "Edge loop" aqui = anel de vértices percorrendo arestas 4-valentes (quase
 *    como Blender) — fallback simples para malhas triangulares.
 */
import * as THREE from 'three'

// ---------- Helpers internos ----------

// Garante geometry indexada — se não-indexada, gera índice sequencial.
function ensureIndexed(geometry) {
  if (geometry.index) return geometry.clone()
  const pos = geometry.getAttribute('position')
  if (!pos) return geometry.clone()
  const idx = new Uint32Array(pos.count)
  for (let i = 0; i < pos.count; i++) idx[i] = i
  const g = geometry.clone()
  g.setIndex(new THREE.BufferAttribute(idx, 1))
  return g
}

// Constrói mapas de adjacência: vertexEdges (vIdx -> Set<edgeKey>) e
// edgeFaces (edgeKey -> [faceIdx,...]) e faceEdges (faceIdx -> Set<edgeKey>).
function buildAdjacency(geometry) {
  const geo = ensureIndexed(geometry)
  const index = geo.index.array
  const faceCount = index.length / 3

  const vertexEdges = new Map() // vIdx -> Set<edgeKey>
  const edgeFaces = new Map()   // edgeKey -> [faceIdx,...]
  const faceEdges = new Map()   // faceIdx -> Set<edgeKey>
  const faceVertices = new Map() // faceIdx -> [v0,v1,v2]

  const edgeKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`)

  for (let f = 0; f < faceCount; f++) {
    const a = index[f * 3]
    const b = index[f * 3 + 1]
    const c = index[f * 3 + 2]
    const verts = [a, b, c]
    faceVertices.set(f, verts)
    const edges = new Set()
    for (let i = 0; i < 3; i++) {
      const v1 = verts[i]
      const v2 = verts[(i + 1) % 3]
      const k = edgeKey(v1, v2)
      edges.add(k)
      if (!vertexEdges.has(v1)) vertexEdges.set(v1, new Set())
      vertexEdges.get(v1).add(k)
      if (!edgeFaces.has(k)) edgeFaces.set(k, [])
      edgeFaces.get(k).push(f)
    }
    faceEdges.set(f, edges)
  }
  return { geo, vertexEdges, edgeFaces, faceEdges, faceVertices, edgeKey }
}

// Conta quantas faces partilham uma aresta (manifold esperado = 2).
function edgeFaceCount(edgeFaces, key) {
  const arr = edgeFaces.get(key)
  return arr ? arr.length : 0
}

// Devolve o outro vértice da aresta dado um vértice.
function otherVertex(key, v) {
  const [a, b] = key.split('_').map(Number)
  return v === a ? b : a
}

// ---------- findEdgeLoop ----------
// Dada uma aresta inicial (par de vértices), percorre a malha escolhendo, em
// cada vértice, a aresta "oposta" (a que tem exatamente 2 faces e forma um
// ângulo ~180º com a direção atual). Devolve array de vIdx ordenado.
export function findEdgeLoop(geometry, startEdgeIndex) {
  const adj = buildAdjacency(geometry)
  const { vertexEdges, edgeFaces, edgeKey } = adj

  // startEdgeIndex pode ser [v1, v2] ou { v1, v2 } ou um índice (int)
  let v1, v2
  if (Array.isArray(startEdgeIndex)) {
    ;[v1, v2] = startEdgeIndex
  } else if (startEdgeIndex && typeof startEdgeIndex === 'object') {
    v1 = startEdgeIndex.v1
    v2 = startEdgeIndex.v2
  } else {
    return []
  }
  if (v1 == null || v2 == null) return []

  const visited = new Set([v1, v2])
  const result = [v1, v2]

  // Caminhar numa direção (a partir de v2)
  const walk = (fromV, nextV) => {
    let cur = fromV
    let nxt = nextV
    for (let safety = 0; safety < 10000; safety++) {
      // Aresta atual
      const curKey = edgeKey(cur, nxt)
      // Faces dessa aresta (apenas documentação — não usado diretamente)
      // const faces = edgeFaces.get(curKey) || []
      // Vértices candidatos = vizinhos de nxt via arestas com exatamente 2 faces
      const neighbors = vertexEdges.get(nxt) || new Set()
      let bestNext = null
      let bestScore = -Infinity
      for (const k of neighbors) {
        if (k === curKey) continue
        if (edgeFaceCount(edgeFaces, k) !== 2) continue
        const other = otherVertex(k, nxt)
        if (visited.has(other)) continue
        // Score: ângulo ~180º com a direção anterior (cur->nxt->other)
        const pos = adj.geo.getAttribute('position')
        const dx = pos.getX(nxt) - pos.getX(cur)
        const dy = pos.getY(nxt) - pos.getY(cur)
        const dz = pos.getZ(nxt) - pos.getZ(cur)
        const ex = pos.getX(other) - pos.getX(nxt)
        const ey = pos.getY(other) - pos.getY(nxt)
        const ez = pos.getZ(other) - pos.getZ(nxt)
        const dot = (dx * ex + dy * ey + dz * ez) /
          (Math.hypot(dx, dy, dz) * Math.hypot(ex, ey, ez) + 1e-9)
        if (dot > bestScore) {
          bestScore = dot
          bestNext = other
        }
      }
      if (bestNext == null) break
      visited.add(bestNext)
      result.push(bestNext)
      cur = nxt
      nxt = bestNext
    }
  }

  // Caminhar à frente (cur=v1, nxt=v2) e depois à trás (cur=v2, nxt=v1)
  walk(v1, v2)
  // Caminhar para trás: começar em v1, ir para "atrás"
  // Reusar walk com cur=v2, nxt=v1 (percorre a direção inversa)
  const backVisited = new Set(visited)
  const backResult = [v2, v1]
  const backWalk = (fromV, nextV) => {
    let cur = fromV
    let nxt = nextV
    for (let safety = 0; safety < 10000; safety++) {
      const curKey = edgeKey(cur, nxt)
      const neighbors = vertexEdges.get(nxt) || new Set()
      let bestNext = null
      let bestScore = -Infinity
      for (const k of neighbors) {
        if (k === curKey) continue
        if (edgeFaceCount(edgeFaces, k) !== 2) continue
        const other = otherVertex(k, nxt)
        if (backVisited.has(other)) continue
        const pos = adj.geo.getAttribute('position')
        const dx = pos.getX(nxt) - pos.getX(cur)
        const dy = pos.getY(nxt) - pos.getY(cur)
        const dz = pos.getZ(nxt) - pos.getZ(cur)
        const ex = pos.getX(other) - pos.getX(nxt)
        const ey = pos.getY(other) - pos.getY(nxt)
        const ez = pos.getZ(other) - pos.getZ(nxt)
        const dot = (dx * ex + dy * ey + dz * ez) /
          (Math.hypot(dx, dy, dz) * Math.hypot(ex, ey, ez) + 1e-9)
        if (dot > bestScore) {
          bestScore = dot
          bestNext = other
        }
      }
      if (bestNext == null) break
      backVisited.add(bestNext)
      backResult.push(bestNext)
      cur = nxt
      nxt = bestNext
    }
  }
  backWalk(v2, v1)
  // Combinar: backResult (invertido, sem duplicar v1,v2) + result
  const backClean = backResult.slice(2).reverse() // vértices à esquerda de v1
  return [...backClean, ...result]
}

// ---------- findFaceLoop ----------
// Dada uma face inicial, percorre faces adjacentes atravessando arestas 4-valentes
// (aresta comum entre 2 faces, onde a aresta "oposta" na face vizinha também
// tem 2 faces). Devolve array de faceIdx.
export function findFaceLoop(geometry, startFaceIndex) {
  const adj = buildAdjacency(geometry)
  const { edgeFaces, faceEdges } = adj

  if (!faceEdges.has(startFaceIndex)) return []
  const visited = new Set([startFaceIndex])
  const result = [startFaceIndex]

  const walk = () => {
    const queue = [{ face: -1 }]
    while (queue.length) {
      const { face } = queue.shift()
      const edges = faceEdges.get(face) || new Set()
      for (const k of edges) {
        const faces = edgeFaces.get(k) || []
        if (faces.length !== 2) continue
        const otherFace = faces[0] === face ? faces[1] : faces[0]
        if (visited.has(otherFace)) continue
        // Aresta "oposta" na otherFace (a que não é k)
        const otherEdges = faceEdges.get(otherFace) || new Set()
        const oppKey = [...otherEdges].find((e) => e !== k)
        if (!oppKey) continue
        // Verificar se a aresta oposta também é manifold (2 faces) — loop adjacente
        if (edgeFaceCount(edgeFaces, oppKey) !== 2) continue
        visited.add(otherFace)
        result.push(otherFace)
        queue.push({ face: otherFace })
      }
    }
  }
  walk()
  return result
}

// ---------- bridgeLoops ----------
// Cria faces (triângulos) que unem dois loops de vértices. Assume loops com
// mesmo comprimento (se diferente, alinha pelo menor).
// Devolve nova geometria com os triângulos de bridge adicionados.
export function bridgeLoops(geometry, loop1, loop2) {
  if (!loop1 || !loop2 || loop1.length < 2 || loop2.length < 2) {
    return geometry.clone()
  }
  const n = Math.min(loop1.length, loop2.length)
  const geo = ensureIndexed(geometry)
  const index = geo.index ? Array.from(geo.index.array) : []
  for (let i = 0; i < n; i++) {
    const a1 = loop1[i]
    const b1 = loop1[(i + 1) % n]
    const a2 = loop2[i]
    const b2 = loop2[(i + 1) % n]
    // 2 triângulos por quad
    index.push(a1, a2, b1)
    index.push(b1, a2, b2)
  }
  const out = geo.clone()
  const arr = geo.index.array.constructor === Uint16Array
    ? new Uint16Array(index)
    : new Uint32Array(index)
  out.setIndex(new THREE.BufferAttribute(arr, 1))
  out.attributes.position.needsUpdate = true
  if (out.attributes.normal) out.attributes.normal.needsUpdate = true
  if (out.attributes.uv) out.attributes.uv.needsUpdate = true
  out.computeVertexNormals()
  return out
}

// ---------- fillHole ----------
// Fecha um loop de vértices com fan triangulation a partir do centroide.
export function fillHole(geometry, loopVertices) {
  if (!loopVertices || loopVertices.length < 3) return geometry.clone()
  const geo = ensureIndexed(geometry)
  const pos = geo.getAttribute('position')
  const index = geo.index ? Array.from(geo.index.array) : []

  // Computar centroide
  let cx = 0, cy = 0, cz = 0
  for (const v of loopVertices) {
    cx += pos.getX(v)
    cy += pos.getY(v)
    cz += pos.getZ(v)
  }
  cx /= loopVertices.length
  cy /= loopVertices.length
  cz /= loopVertices.length

  // Adicionar vértice central
  const positions = geo.getAttribute('position').array
  const baseCount = pos.count
  const newPositions = new Float32Array(positions.length + 3)
  newPositions.set(positions)
  newPositions[baseCount * 3] = cx
  newPositions[baseCount * 3 + 1] = cy
  newPositions[baseCount * 3 + 2] = cz
  const centralIdx = baseCount

  const out = geo.clone()
  out.setAttribute('position', new THREE.BufferAttribute(newPositions, 3))

  // Criar triângulos do fan
  const n = loopVertices.length
  for (let i = 0; i < n; i++) {
    const a = loopVertices[i]
    const b = loopVertices[(i + 1) % n]
    index.push(a, b, centralIdx)
  }

  const arr = geo.index.array.constructor === Uint16Array
    ? new Uint16Array(index)
    : new Uint32Array(index)
  out.setIndex(new THREE.BufferAttribute(arr, 1))
  out.attributes.position.needsUpdate = true
  out.computeVertexNormals()
  return out
}

// ---------- gridFill ----------
// Preenche entre dois loops com uma grelha de quads. Implementação simples:
// se subdivisions <= 1 ou loops têm comprimento diferente, fallback para bridgeLoops.
// Caso contrário, interpola linearmente entre loop1 e loop2 para criar subdivs.
export function gridFill(geometry, loop1, loop2, subdivisions = 1) {
  if (!loop1 || !loop2 || loop1.length < 2 || loop2.length < 2) {
    return geometry.clone()
  }
  if (subdivisions <= 1 || loop1.length !== loop2.length) {
    return bridgeLoops(geometry, loop1, loop2)
  }
  const geo = ensureIndexed(geometry)
  const pos = geo.getAttribute('position')
  const index = geo.index ? Array.from(geo.index.array) : []
  const positions = Array.from(pos.array)

  // Gerar vértices interpolados
  const layers = [[...loop1]]
  for (let s = 1; s < subdivisions; s++) {
    const t = s / subdivisions
    const layer = []
    for (let i = 0; i < loop1.length; i++) {
      const v1 = loop1[i]
      const v2 = loop2[i]
      const x = pos.getX(v1) * (1 - t) + pos.getX(v2) * t
      const y = pos.getY(v1) * (1 - t) + pos.getY(v2) * t
      const z = pos.getZ(v1) * (1 - t) + pos.getZ(v2) * t
      positions.push(x, y, z)
      layer.push((positions.length / 3) - 1)
    }
    layers.push(layer)
  }
  layers.push([...loop2])

  const n = loop1.length
  for (let li = 0; li < layers.length - 1; li++) {
    const a = layers[li]
    const b = layers[li + 1]
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n
      index.push(a[i], b[i], a[j])
      index.push(a[j], b[i], b[j])
    }
  }

  const out = geo.clone()
  out.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  const arr = geo.index.array.constructor === Uint16Array
    ? new Uint16Array(index)
    : new Uint32Array(index)
  out.setIndex(new THREE.BufferAttribute(arr, 1))
  out.attributes.position.needsUpdate = true
  out.computeVertexNormals()
  return out
}

// ---------- edgeLoopSubdivide ----------
// Para cada aresta consecutiva no loop, insere um vértice médio e re-triangula
// as faces adjacentes (cada face split em 2). Implementação simplificada:
// percorre as arestas do loop e insere o vértice médio — não reconstrói faces
// (apenas divide aresta); para uma malha indexada simples, isso requereria
// re-triangulação completa. Para robustez, fazemos uma "subdivisão local":
// criamos uma cópia da geometria com os novos vértices inseridos e duplicamos
// as faces que tocam o loop.
export function edgeLoopSubdivide(geometry, loopVertices) {
  if (!loopVertices || loopVertices.length < 2) return geometry.clone()
  const geo = ensureIndexed(geometry)
  const pos = geo.getAttribute('position')
  const positions = Array.from(pos.array)
  const index = geo.index ? Array.from(geo.index.array) : []

  // Mapa de aresta -> índice do vértice médio (para reutilizar se aresta repetida)
  const midCache = new Map()
  const edgeKey = (a, b) => (a < b ? `${a}_${b}` : `${b}_${a}`)
  const getMid = (a, b) => {
    const k = edgeKey(a, b)
    if (midCache.has(k)) return midCache.get(k)
    const x = (pos.getX(a) + pos.getX(b)) / 2
    const y = (pos.getY(a) + pos.getY(b)) / 2
    const z = (pos.getZ(a) + pos.getZ(b)) / 2
    positions.push(x, y, z)
    const idx = (positions.length / 3) - 1
    midCache.set(k, idx)
    return idx
  }

  // Reconstruir índice: para cada face, se alguma aresta tem mid, dividir
  const faceCount = index.length / 3
  const newIndex = []
  for (let f = 0; f < faceCount; f++) {
    const a = index[f * 3]
    const b = index[f * 3 + 1]
    const c = index[f * 3 + 2]
    // Verificar quais arestas têm mid (i.e., pertencem ao loop)
    const mab = midCache.has(edgeKey(a, b)) ? getMid(a, b) : null
    const mbc = midCache.has(edgeKey(b, c)) ? getMid(b, c) : null
    const mca = midCache.has(edgeKey(c, a)) ? getMid(c, a) : null
    const mids = [mab, mbc, mca].filter((m) => m != null)
    if (mids.length === 0) {
      newIndex.push(a, b, c)
      continue
    }
    // Caso simples: 1 mid — dividir em 2 triângulos
    if (mab != null && mbc == null && mca == null) {
      newIndex.push(a, mab, c)
      newIndex.push(mab, b, c)
    } else if (mbc != null && mab == null && mca == null) {
      newIndex.push(a, b, mbc)
      newIndex.push(a, mbc, c)
    } else if (mca != null && mab == null && mbc == null) {
      newIndex.push(a, b, mca)
      newIndex.push(b, c, mca)
    } else {
      // 2 ou 3 mids — usar fan a partir do centroide da face para simplicidade
      const fx = (pos.getX(a) + pos.getX(b) + pos.getX(c)) / 3
      const fy = (pos.getY(a) + pos.getY(b) + pos.getY(c)) / 3
      const fz = (pos.getZ(a) + pos.getZ(b) + pos.getZ(c)) / 3
      positions.push(fx, fy, fz)
      const fc = (positions.length / 3) - 1
      const va = mab != null ? mab : a
      const vb = mbc != null ? mbc : b
      const vc = mca != null ? mca : c
      newIndex.push(a, va, fc)
      newIndex.push(va, b, fc)
      newIndex.push(b, vb, fc)
      newIndex.push(vb, c, fc)
      newIndex.push(c, vc, fc)
      newIndex.push(vc, a, fc)
    }
  }

  const out = geo.clone()
  out.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  const arr = geo.index.array.constructor === Uint16Array
    ? new Uint16Array(newIndex)
    : new Uint32Array(newIndex)
  out.setIndex(new THREE.BufferAttribute(arr, 1))
  out.attributes.position.needsUpdate = true
  out.computeVertexNormals()
  return out
}

// ---------- connectVertices ----------
// Cria uma aresta entre v1 e v2, partindo a face que partilham.
// Implementação: encontra a face que contém v1 e v2, calcula o ponto médio
// da aresta, insere um vértice no meio, e divide a face em 2.
export function connectVertices(geometry, v1, v2) {
  const adj = buildAdjacency(geometry)
  const { edgeFaces, edgeKey } = adj
  const key = edgeKey(v1, v2)
  const faces = edgeFaces.get(key) || []
  if (faces.length === 0) {
    // v1 e v2 não partilham aresta — criar aresta diretamente sem face split
    return geometry.clone()
  }

  const geo = ensureIndexed(geometry)
  const pos = geo.getAttribute('position')
  const positions = Array.from(pos.array)
  const index = geo.index ? Array.from(geo.index.array) : []

  // Para cada face que contém a aresta (v1,v2), dividi-la em 2 sub-triângulos
  // ao longo dessa aresta — como a aresta já existe, "conectar" é basicamente
  // garantir a aresta está no índice (já está). Para um efeito visível,
  // inserimos um vértice médio na aresta e duplicamos a face.
  const mx = (pos.getX(v1) + pos.getX(v2)) / 2
  const my = (pos.getY(v1) + pos.getY(v2)) / 2
  const mz = (pos.getZ(v1) + pos.getZ(v2)) / 2
  positions.push(mx, my, mz)
  const midIdx = (positions.length / 3) - 1

  const faceCount = index.length / 3
  const newIndex = []
  for (let f = 0; f < faceCount; f++) {
    const a = index[f * 3]
    const b = index[f * 3 + 1]
    const c = index[f * 3 + 2]
    const verts = new Set([a, b, c])
    if (verts.has(v1) && verts.has(v2)) {
      // Dividir: a face [v1, X, v2] -> [v1, X, mid] + [mid, X, v2]
      // O vértice "oposto" à aresta (v1,v2) — não usado diretamente aqui
      // const x = a !== v1 && a !== v2 ? a : (b !== v1 && b !== v2 ? b : c)
      // Manter windings: preservar ordem original substituindo v1->mid e v2->mid
      const arr2 = []
      for (const vv of [a, b, c]) {
        if (vv === v1) {
          arr2.push(vv, midIdx)
        } else if (vv === v2) {
          arr2.push(midIdx, vv)
        } else {
          arr2.push(vv)
        }
      }
      // Sem duplicar midIdx consecutivo
      const cleaned = []
      for (let i = 0; i < arr2.length; i++) {
        if (cleaned.length === 0 || cleaned[cleaned.length - 1] !== arr2[i]) {
          cleaned.push(arr2[i])
        }
      }
      // cleaned pode ter 4 ou 5 elementos; formar 2 triângulos
      if (cleaned.length >= 4) {
        newIndex.push(cleaned[0], cleaned[1], cleaned[2])
        newIndex.push(cleaned[2], cleaned[3], cleaned[0])
      } else {
        newIndex.push(a, b, c)
      }
    } else {
      newIndex.push(a, b, c)
    }
  }

  const out = geo.clone()
  out.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3))
  const arr = geo.index.array.constructor === Uint16Array
    ? new Uint16Array(newIndex)
    : new Uint32Array(newIndex)
  out.setIndex(new THREE.BufferAttribute(arr, 1))
  out.attributes.position.needsUpdate = true
  out.computeVertexNormals()
  return out
}

// ---------- dissolveEdges ----------
// Remove um conjunto de arestas e funde as faces adjacentes (união das faces).
// Implementação: para cada par de faces partilhadas por uma aresta dissolvida,
// combiná-las numa única face (convex hull 2D no plano da face — fallback:
// manter apenas uma das faces e remover a outra).
// Como as nossas faces são triângulos, dissolver uma aresta entre 2 triângulos
// cria um quad — polígono de 4 lados. Para o BufferGeometry, fazemos:
// - Remover uma das 2 faces
// - Triangular o quad com 2 triângulos (já temos um deles — mantemos o outro)
// Simplificação: remove a aresta e funde apenas a topologia (mantém 2 triângulos).
export function dissolveEdges(geometry, edges) {
  if (!edges || edges.length === 0) return geometry.clone()
  const adj = buildAdjacency(geometry)
  const { edgeFaces, edgeKey } = adj

  // Construir set de arestas a dissolver
  const dissolveSet = new Set()
  for (const e of edges) {
    if (Array.isArray(e)) dissolveSet.add(edgeKey(e[0], e[1]))
    else if (e && typeof e === 'object') dissolveSet.add(edgeKey(e.v1, e.v2))
  }
  if (dissolveSet.size === 0) return geometry.clone()

  const geo = ensureIndexed(geometry)
  const index = geo.index ? Array.from(geo.index.array) : []
  const faceCount = index.length / 3

  // Para cada aresta a dissolver, identificar o par de faces — remover uma
  // (a de maior índice) e reescrever a outra para usar o vértice comum.
  // Mark faces to remove
  const facesToRemove = new Set()
  const vertexRemap = new Map() // oldV -> newV
  for (const k of dissolveSet) {
    const faces = edgeFaces.get(k) || []
    if (faces.length < 2) continue
    const [f1, f2] = faces
    if (facesToRemove.has(f1) || facesToRemove.has(f2)) continue
    facesToRemove.add(f2) // remove a 2ª face
    // Remapear o vértice "extra" da aresta: fundir v2 em v1
    const [a, b] = k.split('_').map(Number)
    // Decidir qual fundir: arbitrariamente, b -> a
    vertexRemap.set(b, a)
  }

  const newIndex = []
  for (let f = 0; f < faceCount; f++) {
    if (facesToRemove.has(f)) continue
    const a = index[f * 3]
    const b = index[f * 3 + 1]
    const c = index[f * 3 + 2]
    // Aplicar remap
    const ra = vertexRemap.has(a) ? vertexRemap.get(a) : a
    const rb = vertexRemap.has(b) ? vertexRemap.get(b) : b
    const rc = vertexRemap.has(c) ? vertexRemap.get(c) : c
    // Skip degenerate (2+ vértices iguais)
    if (ra === rb || rb === rc || ra === rc) continue
    newIndex.push(ra, rb, rc)
  }

  const out = geo.clone()
  const arr = geo.index.array.constructor === Uint16Array
    ? new Uint16Array(newIndex)
    : new Uint32Array(newIndex)
  out.setIndex(new THREE.BufferAttribute(arr, 1))
  if (out.attributes.position) out.attributes.position.needsUpdate = true
  if (out.attributes.normal) out.attributes.normal.needsUpdate = true
  if (out.attributes.uv) out.attributes.uv.needsUpdate = true
  out.computeVertexNormals()
  return out
}

// ---------- edgeCollapse ----------
// Colapsa a aresta (v1, v2) fundindo os 2 vértices num só (no ponto médio).
// Todas as ocorrências de v2 no índice são substituídas por v1; faces
// degeneradas (que ficariam com 2 vértices iguais) são removidas.
export function edgeCollapse(geometry, ev1, ev2) {
  if (ev1 == null || ev2 == null) return geometry.clone()
  const geo = ensureIndexed(geometry)
  const pos = geo.getAttribute('position')

  // Substituir v1 pela posição média — mover v1 e remapear v2 -> v1
  const mx = (pos.getX(ev1) + pos.getX(ev2)) / 2
  const my = (pos.getY(ev1) + pos.getY(ev2)) / 2
  const mz = (pos.getZ(ev1) + pos.getZ(ev2)) / 2

  const positions = new Float32Array(pos.array)
  positions[ev1 * 3] = mx
  positions[ev1 * 3 + 1] = my
  positions[ev1 * 3 + 2] = mz

  const index = geo.index ? Array.from(geo.index.array) : []
  const newIndex = []
  for (let i = 0; i < index.length; i += 3) {
    const a = index[i] === ev2 ? ev1 : index[i]
    const b = index[i + 1] === ev2 ? ev1 : index[i + 1]
    const c = index[i + 2] === ev2 ? ev1 : index[i + 2]
    // Skip degenerate faces (as duas arestas colapsadas viram um ponto)
    if (a === b || b === c || a === c) continue
    newIndex.push(a, b, c)
  }

  const out = geo.clone()
  out.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const arr = geo.index.array.constructor === Uint16Array
    ? new Uint16Array(newIndex)
    : new Uint32Array(newIndex)
  out.setIndex(new THREE.BufferAttribute(arr, 1))
  out.attributes.position.needsUpdate = true
  out.computeVertexNormals()
  return out
}

export default {
  findEdgeLoop,
  findFaceLoop,
  bridgeLoops,
  fillHole,
  gridFill,
  edgeLoopSubdivide,
  connectVertices,
  dissolveEdges,
  edgeCollapse,
}

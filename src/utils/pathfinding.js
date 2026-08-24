/**
 * pathfinding.js — A* pathfinding para NPC AI.
 *
 * Grid-based: divide o mundo em células de `cellSize` (default 1.0).
 * Marca células ocupadas por obstáculos (StaticObjects via suas AABBs).
 * Calcula rota de start → goal usando A* com heurística octile
 * (variant de Manhattan que também contabiliza diagonais).
 *
 * Notas:
 *  - O grid é top-down (XZ) — o eixo Y é ignorado (assume NPCs no plano horizontal).
 *  - `addObstacle(minX, minZ, maxX, maxZ)` marca TODAS as células cobertas pela AABB retangular.
 *    Rotações dos corpos são ignoradas (AABB axis-aligned).
 *  - A* suporta 8 direcções; cortes de quina são proibidos (prevenir atravessar paredes em diagonal).
 *  - `simplifyPath` remove waypoints colineares para reduzir o nº de segmentos.
 *
 * API:
 *   - new Pathfinder(cellSize = 1.0)
 *   - pathfinder.addObstacle(minX, minZ, maxX, maxZ)
 *   - pathfinder.clear()
 *   - pathfinder.findPath(startX, startZ, goalX, goalZ, maxIterations = 1000)
 *       → retorna [{x, z}, ...] ou null se sem rota
 *   - pathfinder.simplifyPath(path) → versão com menos waypoints
 *
 * Helpers exportados:
 *   - worldToCell(x, z, cellSize) → [cx, cz]
 *   - cellToWorld(cx, cz, cellSize) → {x, z} (centro da célula)
 */

// Direções: 4 cardeais + 4 diagonais
const NEIGHBORS = [
  [1, 0, 1.0],
  [-1, 0, 1.0],
  [0, 1, 1.0],
  [0, -1, 1.0],
  [1, 1, Math.SQRT2],
  [1, -1, Math.SQRT2],
  [-1, 1, Math.SQRT2],
  [-1, -1, Math.SQRT2],
]

export function worldToCell(x, z, cellSize) {
  return [Math.floor(x / cellSize), Math.floor(z / cellSize)]
}

export function cellToWorld(cx, cz, cellSize) {
  return { x: (cx + 0.5) * cellSize, z: (cz + 0.5) * cellSize }
}

/**
 * Min-heap binário para a fronteira aberta do A*.
 * Melhor performance do que iterar sobre Map para encontrar o menor f.
 * Armazena nós como { key, f } e mantém um Map paralelo com os dados.
 */
class OpenSet {
  constructor() {
    this._heap = [] // { key, f }
    this._index = new Map() // key → posição no heap
  }

  get size() {
    return this._heap.length
  }

  push(key, f) {
    const heap = this._heap
    const idx = this._index.get(key)
    if (idx !== undefined) {
      // Já existe — actualizar se o novo f for menor
      if (f < heap[idx].f) {
        heap[idx].f = f
        this._bubbleUp(idx)
      }
      return
    }
    const node = { key, f }
    heap.push(node)
    const i = heap.length - 1
    this._index.set(key, i)
    this._bubbleUp(i)
  }

  pop() {
    const heap = this._heap
    if (heap.length === 0) return null
    const top = heap[0]
    const last = heap.pop()
    this._index.delete(top.key)
    if (heap.length > 0) {
      heap[0] = last
      this._index.set(last.key, 0)
      this._sinkDown(0)
    }
    return top.key
  }

  _bubbleUp(i) {
    const heap = this._heap
    const node = heap[i]
    while (i > 0) {
      const parentIdx = (i - 1) >> 1
      const parent = heap[parentIdx]
      if (node.f >= parent.f) break
      heap[i] = parent
      this._index.set(parent.key, i)
      i = parentIdx
    }
    heap[i] = node
    this._index.set(node.key, i)
  }

  _sinkDown(i) {
    const heap = this._heap
    const n = heap.length
    const node = heap[i]
    while (true) {
      const l = 2 * i + 1
      const r = 2 * i + 2
      let smallest = i
      if (l < n && heap[l].f < heap[smallest].f) smallest = l
      if (r < n && heap[r].f < heap[smallest].f) smallest = r
      if (smallest === i) break
      heap[i] = heap[smallest]
      this._index.set(heap[i].key, i)
      heap[smallest] = node
      this._index.set(node.key, smallest)
      i = smallest
    }
  }
}

export class Pathfinder {
  constructor(cellSize = 1.0) {
    this.cellSize = Math.max(0.1, cellSize)
    // Set de chaves "cx,cz" bloqueadas
    this.blocked = new Set()
  }

  _key(cx, cz) {
    return cx + ',' + cz
  }

  /**
   * Marca como bloqueadas todas as células cujo centro caia dentro da AABB
   * [minX, maxX] × [minZ, maxZ] do obstáculo (projeção top-down).
   * Equivalente a iterar as células da AABB e marcá-las.
   */
  addObstacle(minX, minZ, maxX, maxZ) {
    const cs = this.cellSize
    const cxMin = Math.floor(minX / cs)
    const cxMax = Math.floor(maxX / cs)
    const czMin = Math.floor(minZ / cs)
    const czMax = Math.floor(maxZ / cs)
    for (let cx = cxMin; cx <= cxMax; cx++) {
      for (let cz = czMin; cz <= czMax; cz++) {
        this.blocked.add(this._key(cx, cz))
      }
    }
  }

  clear() {
    this.blocked.clear()
  }

  isBlocked(cx, cz) {
    return this.blocked.has(this._key(cx, cz))
  }

  /**
   * Heurística octile — generalização de Manhattan para 8 direcções.
   * Admissível (nunca sobre-estima) e consistente.
   */
  _heuristic(cx, cz, gcx, gcz) {
    const dx = Math.abs(cx - gcx)
    const dz = Math.abs(cz - gcz)
    return Math.max(dx, dz) + (Math.SQRT2 - 1) * Math.min(dx, dz)
  }

  /**
   * Procura a célula livre mais próxima dentro de um raio (em células).
   * Usado quando start ou goal caem dentro de obstáculo.
   */
  _findNearestFree(cx, cz, maxRadius = 6) {
    for (let r = 1; r <= maxRadius; r++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          // Apenas anel exterior (interior já foi verificado em r menor)
          if (Math.abs(dx) !== r && Math.abs(dz) !== r) continue
          const nx = cx + dx
          const nz = cz + dz
          if (!this.isBlocked(nx, nz)) return [nx, nz]
        }
      }
    }
    return null
  }

  /**
   * A* principal.
   * Retorna array de waypoints [{x, z}, ...] (já simplificados) ou null se sem rota.
   */
  findPath(startX, startZ, goalX, goalZ, maxIterations = 1000) {
    const cs = this.cellSize
    let [scx, scz] = worldToCell(startX, startZ, cs)
    let [gcx, gcz] = worldToCell(goalX, goalZ, cs)

    // Se start ou goal estão bloqueados, tentar célula livre mais próxima
    if (this.isBlocked(scx, scz)) {
      const alt = this._findNearestFree(scx, scz, 6)
      if (!alt) return null
      ;[scx, scz] = alt
    }
    if (this.isBlocked(gcx, gcz)) {
      const alt = this._findNearestFree(gcx, gcz, 6)
      if (!alt) return null
      ;[gcx, gcz] = alt
    }

    // Caso trivial: start === goal
    if (scx === gcx && scz === gcz) {
      return [{ x: goalX, z: goalZ }]
    }

    const startKey = this._key(scx, scz)
    const goalKey = this._key(gcx, gcz)

    const open = new OpenSet()
    const gScore = new Map() // key → g (custo acumulado)
    const cameFrom = new Map() // key → key anterior
    const closed = new Set()

    gScore.set(startKey, 0)
    open.push(startKey, this._heuristic(scx, scz, gcx, gcz))

    let iterations = 0
    while (open.size > 0 && iterations < maxIterations) {
      iterations++
      const currentKey = open.pop()
      if (currentKey === goalKey) {
        // Reconstruir caminho
        const path = []
        let k = currentKey
        while (k !== null && k !== undefined) {
          const [ccx, ccz] = k.split(',').map(Number)
          const w = cellToWorld(ccx, ccz, cs)
          path.unshift({ x: w.x, z: w.z })
          k = cameFrom.get(k)
        }
        // Substituir primeiro e último waypoints pelas posições exactas
        if (path.length > 0) {
          path[0] = { x: startX, z: startZ }
          path[path.length - 1] = { x: goalX, z: goalZ }
        } else {
          path.push({ x: startX, z: startZ }, { x: goalX, z: goalZ })
        }
        return this.simplifyPath(path)
      }
      if (closed.has(currentKey)) continue
      closed.add(currentKey)

      const [ccx, ccz] = currentKey.split(',').map(Number)
      const currentG = gScore.get(currentKey) || 0

      for (let i = 0; i < NEIGHBORS.length; i++) {
        const [dx, dz, stepCost] = NEIGHBORS[i]
        const nx = ccx + dx
        const nz = ccz + dz
        const nKey = this._key(nx, nz)
        if (closed.has(nKey)) continue
        if (this.isBlocked(nx, nz)) continue
        // Em diagonais: não cortar quinas (ambas as células laterais têm de estar livres)
        if (dx !== 0 && dz !== 0) {
          if (this.isBlocked(ccx + dx, ccz) || this.isBlocked(ccx, ccz + dz)) {
            continue
          }
        }
        const tentativeG = currentG + stepCost
        const existingG = gScore.get(nKey)
        if (existingG === undefined || tentativeG < existingG) {
          gScore.set(nKey, tentativeG)
          cameFrom.set(nKey, currentKey)
          const f = tentativeG + this._heuristic(nx, nz, gcx, gcz)
          open.push(nKey, f)
        }
      }
    }
    return null
  }

  /**
   * Remove waypoints colineares (que não mudam a direcção do segmento).
   * Reduz o número de segmentos sem alterar a rota visível.
   */
  simplifyPath(path) {
    if (!path || path.length <= 2) return path
    const result = [path[0]]
    for (let i = 1; i < path.length - 1; i++) {
      const prev = result[result.length - 1]
      const cur = path[i]
      const next = path[i + 1]
      const dx1 = cur.x - prev.x
      const dz1 = cur.z - prev.z
      const dx2 = next.x - cur.x
      const dz2 = next.z - cur.z
      // Cross product zero → colinear (ignorar comprimento zero)
      const cross = dx1 * dz2 - dz1 * dx2
      if (Math.abs(cross) > 1e-6) {
        result.push(cur)
      }
    }
    result.push(path[path.length - 1])
    return result
  }
}

export default Pathfinder

/**
 * spatialPartitionSystem.js — Spatial Partitioning (Octree) para Flir Engine.
 *
 * Performance Core Fase 3.6 — Spatial Partitioning / Octree.
 *
 * Princípios:
 *  - Octree simples para queries espaciais (sphere/box/distance)
 *  - Reduz O(N×M) → O(N × log(M)) em trigger checks e queries espaciais
 *  - Reutiliza estruturas temporárias (zero allocations em queries frequentes)
 *  - update() marca posição como dirty — só re-indexa se moveu >threshold
 *  - NÃO substitui Cannon-es (só para queries espaciais custom)
 *  - NÃO substitui Three.js frustum culling
 *  - Estado TEMPORÁRIO — restore() limpa registos (Bug #4 safe)
 *  - FlirScript-friendly: getters públicos para FlirScriptAPI.Spatial
 *
 * NÃO usa eval() nem new Function().
 *
 * Configuração:
 *   - cellSize: tamanho da célula do octree (default 20 unidades)
 *   - Células indexadas por chave string "x,y,z" (Math.floor)
 *   - Objetos móveis re-indexados quando se movem >0.5 unidades
 *
 * API pública (FlirScriptAPI.Spatial):
 *  - querySphere(center, radius): string[] — IDs dentro da esfera
 *  - queryBox(min, max): string[] — IDs dentro da caixa
 *  - getStats(): { objectCount, cellCount, queries, lastQueryResults }
 *  - getCellSize(): number
 *  - getObjectCount(): number
 */

// Tamanho default da célula do octree (unidades do mundo)
const DEFAULT_CELL_SIZE = 20

// Threshold para re-indexar objeto móvel (se moveu mais que isto)
const REINDEX_THRESHOLD_SQ = 0.25 // 0.5² = 0.25 unidades

/**
 * SpatialPartitionSystem — singleton com Octree simples.
 *
 * Estrutura:
 *  - Map<string, Set<objectId>> — células indexadas por "x,y,z"
 *  - Map<objectId, { cellKey, position, type }> — cache de posição por objeto
 *  - Reutiliza arrays temporários em queries (zero allocations)
 */
class SpatialPartitionSystemImpl {
  constructor() {
    this.reset()
  }

  reset() {
    // Map<cellKey, Set<objectId>> — células do octree
    this._cells = new Map()
    // Map<objectId, { cellKey, x, y, z, type }> — cache de posição
    this._objects = new Map()
    // Configuração
    this._cellSize = DEFAULT_CELL_SIZE
    // Stats
    this._stats = {
      objectCount: 0,
      cellCount: 0,
      queries: 0,
      lastQueryResults: 0,
    }
    // Array reutilizável para resultados (evita allocation por query)
    this._tmpResults = []
  }

  /**
   * Converte posição em chave de célula.
   */
  _cellKey(x, y, z) {
    const cx = Math.floor(x / this._cellSize)
    const cy = Math.floor(y / this._cellSize)
    const cz = Math.floor(z / this._cellSize)
    return cx + ',' + cy + ',' + cz
  }

  /**
   * Regista um objeto no Octree.
   * @param {string} id — identificador único
   * @param {number} x, y, z — posição
   * @param {string} type — tipo do objeto (opcional, para filtros)
   */
  insert(id, x, y, z, type = null) {
    if (!id) return

    // Se já está registado, remover da célula antiga
    if (this._objects.has(id)) {
      this._removeFromCell(id)
    }

    const cellKey = this._cellKey(x, y, z)
    if (!this._cells.has(cellKey)) {
      this._cells.set(cellKey, new Set())
      this._stats.cellCount = this._cells.size
    }
    this._cells.get(cellKey).add(id)
    this._objects.set(id, { cellKey, x, y, z, type })
    this._stats.objectCount = this._objects.size
  }

  /**
   * Remove objeto da célula antiga (interno).
   */
  _removeFromCell(id) {
    const entry = this._objects.get(id)
    if (!entry) return
    const cell = this._cells.get(entry.cellKey)
    if (cell) {
      cell.delete(id)
      if (cell.size === 0) {
        this._cells.delete(entry.cellKey)
        this._stats.cellCount = this._cells.size
      }
    }
  }

  /**
   * Atualiza posição de um objeto. Re-indexa só se moveu >threshold.
   * @param {string} id
   * @param {number} x, y, z — nova posição
   */
  update(id, x, y, z) {
    const entry = this._objects.get(id)
    if (!entry) {
      // Não existe — inserir
      this.insert(id, x, y, z)
      return
    }

    // Verificar se moveu significativamente
    const dx = x - entry.x
    const dy = y - entry.y
    const dz = z - entry.z
    const movedSq = dx * dx + dy * dy + dz * dz

    if (movedSq < REINDEX_THRESHOLD_SQ) {
      // Pequeno movimento — só atualizar cache, não re-indexar
      entry.x = x
      entry.y = y
      entry.z = z
      return
    }

    // Movimento significativo — re-indexar
    const newCellKey = this._cellKey(x, y, z)
    if (newCellKey === entry.cellKey) {
      // Mesma célula — só atualizar cache
      entry.x = x
      entry.y = y
      entry.z = z
      return
    }

    // Mudou de célula — remover da antiga, adicionar à nova
    this._removeFromCell(id)
    if (!this._cells.has(newCellKey)) {
      this._cells.set(newCellKey, new Set())
      this._stats.cellCount = this._cells.size
    }
    this._cells.get(newCellKey).add(id)
    entry.cellKey = newCellKey
    entry.x = x
    entry.y = y
    entry.z = z
  }

  /**
   * Remove objeto do Octree.
   */
  remove(id) {
    if (!this._objects.has(id)) return
    this._removeFromCell(id)
    this._objects.delete(id)
    this._stats.objectCount = this._objects.size
  }

  /**
   * Query: retorna IDs dentro de uma esfera.
   * @param {number} cx, cy, cz — centro
   * @param {number} radius — raio
   * @param {object} options — { filterType?: string }
   * @returns {string[]} — IDs dentro da esfera
   */
  querySphere(cx, cy, cz, radius, options = {}) {
    this._stats.queries++
    this._tmpResults.length = 0

    const radiusSq = radius * radius
    // Determinar range de células a verificar
    const minCx = Math.floor((cx - radius) / this._cellSize)
    const maxCx = Math.floor((cx + radius) / this._cellSize)
    const minCy = Math.floor((cy - radius) / this._cellSize)
    const maxCy = Math.floor((cy + radius) / this._cellSize)
    const minCz = Math.floor((cz - radius) / this._cellSize)
    const maxCz = Math.floor((cz + radius) / this._cellSize)

    for (let ix = minCx; ix <= maxCx; ix++) {
      for (let iy = minCy; iy <= maxCy; iy++) {
        for (let iz = minCz; iz <= maxCz; iz++) {
          const cellKey = ix + ',' + iy + ',' + iz
          const cell = this._cells.get(cellKey)
          if (!cell) continue
          for (const id of cell) {
            const entry = this._objects.get(id)
            if (!entry) continue
            // Filtro por tipo
            if (options.filterType && entry.type !== options.filterType) continue
            // Verificar distância ao quadrado
            const dx = entry.x - cx
            const dy = entry.y - cy
            const dz = entry.z - cz
            const distSq = dx * dx + dy * dy + dz * dz
            if (distSq <= radiusSq) {
              this._tmpResults.push(id)
            }
          }
        }
      }
    }

    this._stats.lastQueryResults = this._tmpResults.length
    return this._tmpResults
  }

  /**
   * Query: retorna IDs dentro de uma caixa AABB.
   * @param {number} minX, minY, minZ — canto mínimo
   * @param {number} maxX, maxY, maxZ — canto máximo
   * @param {object} options — { filterType?: string }
   * @returns {string[]}
   */
  queryBox(minX, minY, minZ, maxX, maxY, maxZ, options = {}) {
    this._stats.queries++
    this._tmpResults.length = 0

    const minCx = Math.floor(minX / this._cellSize)
    const maxCx = Math.floor(maxX / this._cellSize)
    const minCy = Math.floor(minY / this._cellSize)
    const maxCy = Math.floor(maxY / this._cellSize)
    const minCz = Math.floor(minZ / this._cellSize)
    const maxCz = Math.floor(maxZ / this._cellSize)

    for (let ix = minCx; ix <= maxCx; ix++) {
      for (let iy = minCy; iy <= maxCy; iy++) {
        for (let iz = minCz; iz <= maxCz; iz++) {
          const cellKey = ix + ',' + iy + ',' + iz
          const cell = this._cells.get(cellKey)
          if (!cell) continue
          for (const id of cell) {
            const entry = this._objects.get(id)
            if (!entry) continue
            if (options.filterType && entry.type !== options.filterType) continue
            if (entry.x >= minX && entry.x <= maxX &&
                entry.y >= minY && entry.y <= maxY &&
                entry.z >= minZ && entry.z <= maxZ) {
              this._tmpResults.push(id)
            }
          }
        }
      }
    }

    this._stats.lastQueryResults = this._tmpResults.length
    return this._tmpResults
  }

  // ===== Getters públicos (FlirScriptAPI.Spatial) =====

  getStats() {
    return { ...this._stats }
  }

  getCellSize() {
    return this._cellSize
  }

  getObjectCount() {
    return this._objects.size
  }

  getCellCount() {
    return this._cells.size
  }

  /**
   * Verifica se um objeto está registado.
   */
  has(id) {
    return this._objects.has(id)
  }

  /**
   * Retorna posição de um objeto (serializável).
   */
  getPosition(id) {
    const entry = this._objects.get(id)
    if (!entry) return null
    return [entry.x, entry.y, entry.z]
  }

  // ===== Restore (Bug #4 safe) =====

  restore() {
    this._cells.clear()
    this._objects.clear()
    this._tmpResults.length = 0
    this._stats = {
      objectCount: 0,
      cellCount: 0,
      queries: 0,
      lastQueryResults: 0,
    }
  }

  // Alias
  clear() {
    this.restore()
  }
}

// Singleton — uma instância por Canvas.
export const SpatialPartitionSystem = new SpatialPartitionSystemImpl()
export { DEFAULT_CELL_SIZE, REINDEX_THRESHOLD_SQ }
export default SpatialPartitionSystem

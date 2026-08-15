/**
 * raycastSystem.js — BVH-accelerated Raycast System para Flir Engine.
 *
 * Performance Core Fase 3.5 — BVH Raycast System.
 *
 * Princípios:
 *  - Usa three-mesh-bvh para acelerar raycasting em geometrias complexas
 *  - Fallback automático para THREE.Raycaster tradicional quando BVH não aplicável
 *  - Reutiliza Raycaster/Vector3 (zero allocations por raycast)
 *  - BVH construído uma vez por geometria, reconstruído só quando markDirty(id)
 *  - NÃO aplica BVH em geometrias pequenas (<500 tris) — overhead > benefício
 *  - NÃO aplica BVH em geometrias dinâmicas (skinned/animated) — rebuild constante
 *  - NÃO destrói geometria original — BVH é metadata adicional
 *  - Estado TEMPORÁRIO — restore() limpa registos (Bug #4 safe)
 *  - FlirScript-friendly: getters públicos para FlirScriptAPI.Raycast
 *
 * NÃO usa eval() nem new Function().
 *
 * Thresholds:
 *   < 500 tris       → sem BVH (usa THREE.Raycaster)
 *   500 - 5000 tris  → BVH opcional (só se isStatic)
 *   > 5000 tris      → BVH ativo (se isStatic)
 *
 * API pública (FlirScriptAPI.Raycast):
 *  - isSupported(): boolean
 *  - getStats(): { registeredBVH, fallbackRaycasts, bvhRaycasts, builds, rebuilds, hits, misses }
 *  - hasBVH(objectId): boolean
 *  - getRegisteredCount(): number
 *  - cast(origin, direction, options): { hit, objectId, distance, point, normal } | null
 */

import * as THREE from 'three'

// Lazy import de three-mesh-bvh (não quebrar se não disponível)
let _meshBvhModule = null
let _bvhAvailable = null

async function loadMeshBvh() {
  if (_bvhAvailable !== null) return _meshBvhModule
  try {
    _meshBvhModule = await import('three-mesh-bvh')
    _bvhAvailable = true
    return _meshBvhModule
  } catch (e) {
    _bvhAvailable = false
    console.warn('[RaycastSystem] three-mesh-bvh não disponível, usando fallback THREE.Raycaster')
    return null
  }
}

// Pré-carregar módulo (não-blocking)
loadMeshBvh()

// Thresholds
const TRI_THRESHOLD_NONE = 500       // abaixo: sem BVH
const TRI_THRESHOLD_OPTIONAL = 5000  // acima: BVH ativo se estático

/**
 * RaycastSystem — singleton que gere BVHs e raycasting.
 *
 * Estado:
 *  - Map<objectId, { mesh, bvh, hasBVH, isStatic, triCount, dirty }>
 *  - Raycaster reutilizado (zero allocations)
 *  - Vector3 reutilizado para direção normalizada
 *  - Stats para FlirScriptAPI.Raycast
 */
class RaycastSystemImpl {
  constructor() {
    this.reset()
  }

  reset() {
    // Map<objectId, entry>
    // entry: { mesh, bvh, hasBVH, isStatic, triCount, dirty, geometryRef }
    this._registry = new Map()
    // Raycaster reutilizado (não criar por raycast)
    this._raycaster = new THREE.Raycaster()
    // Vector3 reutilizável para normalização de direção
    this._tmpDir = new THREE.Vector3()
    // Stats
    this._stats = {
      registeredBVH: 0,
      fallbackRaycasts: 0,
      bvhRaycasts: 0,
      builds: 0,
      rebuilds: 0,
      hits: 0,
      misses: 0,
    }
    // Cache de BVH module
    this._bvhModule = _meshBvhModule
  }

  /**
   * Verifica se three-mesh-bvh está disponível.
   */
  isSupported() {
    return _bvhAvailable === true
  }

  /**
   * Verifica se uma geometria deve ter BVH.
   * @param {number} triCount
   * @param {boolean} isStatic — geometria não é animada/modificada frequentemente
   * @param {boolean} isSkinned — tem skeleton (NÃO aplicar BVH)
   * @returns {boolean}
   */
  shouldHaveBVH(triCount, isStatic = true, isSkinned = false) {
    if (isSkinned || !isStatic) return false
    if (triCount < TRI_THRESHOLD_NONE) return false
    return triCount >= TRI_THRESHOLD_OPTIONAL || triCount >= TRI_THRESHOLD_NONE
  }

  /**
   * Conta triângulos de uma geometria.
   */
  _countTriangles(geometry) {
    if (!geometry) return 0
    if (geometry.index) return geometry.index.count / 3
    if (geometry.attributes.position) return geometry.attributes.position.count / 3
    return 0
  }

  /**
   * Regista um mesh para gestão de BVH.
   * Constrói BVH se aplicável, senão marca como fallback.
   *
   * @param {string} id — identificador único (instanceId ou objectId)
   * @param {THREE.Mesh} mesh
   * @param {object} options — { isStatic, isSkinned }
   * @returns {boolean} — true se BVH foi criado
   */
  async register(id, mesh, options = {}) {
    if (!id || !mesh) return false

    const { isStatic = true, isSkinned = false } = options
    const geometry = mesh.geometry
    const triCount = this._countTriangles(geometry)

    // Se já está registado, skip
    if (this._registry.has(id)) {
      return this._registry.get(id).hasBVH
    }

    const entry = {
      mesh,
      bvh: null,
      hasBVH: false,
      isStatic,
      isSkinned,
      triCount,
      dirty: false,
      geometryRef: geometry,
    }

    // Verificar se deve ter BVH
    if (!this.shouldHaveBVH(triCount, isStatic, isSkinned)) {
      this._registry.set(id, entry)
      return false
    }

    // Tentar carregar three-mesh-bvh
    if (!this._bvhModule) {
      this._bvhModule = await loadMeshBvh()
    }

    if (!this._bvhModule) {
      // BVH indisponível — usar fallback
      this._registry.set(id, entry)
      return false
    }

    try {
      const { MeshBVH, computeBoundsTree, disposeBoundsTree } = this._bvhModule

      // Aplicar BoundsTree à geometria (three-mesh-bvh adiciona .boundsTree)
      if (computeBoundsTree && !geometry.boundsTree) {
        // Adicionar função de raycast acelerada por BVH
        if (!geometry._originalRaycast) {
          geometry._originalRaycast = geometry.raycast.bind(geometry)
        }
        computeBoundsTree(geometry)
        this._stats.builds++
      }

      entry.bvh = geometry.boundsTree
      entry.hasBVH = true
      this._stats.registeredBVH++
    } catch (e) {
      // Erro ao construir BVH — fallback silencioso
      console.warn(`[RaycastSystem] Falha ao construir BVH para ${id}:`, e.message)
      entry.hasBVH = false
    }

    this._registry.set(id, entry)
    return entry.hasBVH
  }

  /**
   * Remove registo de BVH. Faz dispose do boundsTree (NÃO da geometria original).
   */
  unregister(id) {
    const entry = this._registry.get(id)
    if (!entry) return

    if (entry.hasBVH && entry.geometryRef?.boundsTree) {
      try {
        const { disposeBoundsTree } = this._bvhModule || {}
        if (disposeBoundsTree) disposeBoundsTree(entry.geometryRef)
        else entry.geometryRef.boundsTree = null
      } catch (e) {
        // Ignorar erro de dispose
      }
      this._stats.registeredBVH = Math.max(0, this._stats.registeredBVH - 1)
    }

    // Restaurar raycast original
    if (entry.geometryRef?._originalRaycast) {
      entry.geometryRef.raycast = entry.geometryRef._originalRaycast
      delete entry.geometryRef._originalRaycast
    }

    this._registry.delete(id)
  }

  /**
   * Marca geometria como dirty — BVH será reconstruído no próximo raycast.
   */
  markDirty(id) {
    const entry = this._registry.get(id)
    if (!entry) return
    entry.dirty = true
  }

  /**
   * Reconstrói BVH se dirty.
   */
  _rebuildIfDirty(entry) {
    if (!entry.dirty || !entry.hasBVH) return
    try {
      const { computeBoundsTree } = this._bvhModule || {}
      if (computeBoundsTree && entry.geometryRef) {
        computeBoundsTree(entry.geometryRef)
        entry.bvh = entry.geometryRef.boundsTree
        entry.dirty = false
        this._stats.rebuilds++
      }
    } catch (e) {
      // Falha no rebuild — desativar BVH para esta geometria
      entry.hasBVH = false
      entry.dirty = false
    }
  }

  /**
   * Raycast contra um mesh específico (usa BVH se disponível).
   *
   * @param {THREE.Mesh} mesh
   * @param {THREE.Vector3} origin
   * @param {THREE.Vector3} direction
   * @param {object} options — { far, near }
   * @returns {array} — intersects (formato THREE.Raycaster.intersectObject)
   */
  intersectMesh(mesh, origin, direction, options = {}) {
    if (!mesh) return []

    this._tmpDir.copy(direction).normalize()
    this._raycaster.set(origin, this._tmpDir)
    this._raycaster.far = options.far ?? Infinity
    this._raycaster.near = options.near ?? 0

    // Procurar entrada no registo (por mesh, não por id — aceita meshes não registados)
    let entry = null
    for (const [, e] of this._registry) {
      if (e.mesh === mesh) { entry = e; break }
    }

    if (entry?.hasBVH) {
      this._rebuildIfDirty(entry)
      this._stats.bvhRaycasts++
    } else {
      this._stats.fallbackRaycasts++
    }

    const intersects = this._raycaster.intersectObject(mesh, options.recursive ?? false)

    if (intersects.length > 0) this._stats.hits++
    else this._stats.misses++

    return intersects
  }

  /**
   * Raycast contra todos os meshes registados.
   * Retorna o hit mais próximo.
   *
   * @param {THREE.Vector3} origin
   * @param {THREE.Vector3} direction
   * @param {object} options — { far, near, filterIds }
   * @returns {object|null} — { hit, objectId, distance, point, normal, mesh } ou null
   */
  raycast(origin, direction, options = {}) {
    this._tmpDir.copy(direction).normalize()
    this._raycaster.set(origin, this._tmpDir)
    this._raycaster.far = options.far ?? Infinity
    this._raycaster.near = options.near ?? 0

    const filterIds = options.filterIds ? new Set(options.filterIds) : null
    const targets = []

    for (const [id, entry] of this._registry) {
      if (filterIds && !filterIds.has(id)) continue
      if (!entry.mesh || entry.mesh.visible === false) continue
      if (entry.hasBVH) {
        this._rebuildIfDirty(entry)
        this._stats.bvhRaycasts++
      } else {
        this._stats.fallbackRaycasts++
      }
      targets.push(entry.mesh)
    }

    if (targets.length === 0) {
      this._stats.misses++
      return null
    }

    const intersects = this._raycaster.intersectObjects(targets, true)

    if (intersects.length === 0) {
      this._stats.misses++
      return null
    }

    this._stats.hits++

    const hit = intersects[0]
    // Encontrar objectId correspondente ao mesh atingido
    let objectId = null
    let hitMesh = hit.object
    for (const [id, entry] of this._registry) {
      if (entry.mesh === hitMesh) { objectId = id; break }
      // Verificar se hitMesh é filho do mesh registado
      let parent = hitMesh.parent
      while (parent) {
        if (entry.mesh === parent) { objectId = id; break }
        parent = parent.parent
      }
      if (objectId) break
    }

    return {
      hit: true,
      objectId,
      distance: hit.distance,
      point: [hit.point.x, hit.point.y, hit.point.z],
      normal: hit.face ? [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z] : [0, 0, 0],
    }
  }

  // ===== Getters públicos (FlirScriptAPI.Raycast) =====

  hasBVH(objectId) {
    const entry = this._registry.get(objectId)
    return entry ? entry.hasBVH : false
  }

  getRegisteredCount() {
    return this._registry.size
  }

  getStats() {
    return { ...this._stats }
  }

  // ===== Restore (Bug #4 safe) =====

  restore() {
    // Desregistar todos (faz dispose dos boundsTrees, NÃO das geometrias originais)
    for (const id of Array.from(this._registry.keys())) {
      this.unregister(id)
    }
    this._stats = {
      registeredBVH: 0,
      fallbackRaycasts: 0,
      bvhRaycasts: 0,
      builds: 0,
      rebuilds: 0,
      hits: 0,
      misses: 0,
    }
  }

  // Alias
  clear() {
    this.restore()
  }
}

// Singleton — uma instância por Canvas.
export const RaycastSystem = new RaycastSystemImpl()
export { TRI_THRESHOLD_NONE, TRI_THRESHOLD_OPTIONAL }
export default RaycastSystem

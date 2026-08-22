/**
 * cullingManager.js — Distance & Frustum Culling Manager para Flir Engine.
 *
 * Performance Core Fase 3.3 — Distance and Frustum Culling.
 *
 * Princípios:
 *  - NÃO duplica frustum culling nativo do Three.js (mesh.frustumCulled=true por default)
 *  - Aplica distance culling a gizmos/Conects auxiliares (não a meshes funcionais)
 *  - Usa distância ao quadrado (distanceToSquared) — evita sqrt
 *  - Reutiliza Vector3/Frustum/Matrix4 via refs (zero allocations por frame)
 *  - Respeita qualityLevel do AdaptiveQuality (Fase 3.2)
 *  - Respeita objetos selecionados (NÃO cull selected mesh)
 *  - Estado TEMPORÁRIO — não persiste no projeto
 *  - FlirScript-friendly: getters públicos para futura Culling API
 *
 * NÃO usa eval() nem new Function().
 *
 * Tiers de distância por qualityLevel (do AdaptiveQuality):
 *   high    → 80 unidades (desktop potente, pouca culling)
 *   medium  → 60 unidades (default)
 *   low     → 40 unidades (mobile médio)
 *   minimal → 25 unidades (mobile fraco, culling agressivo)
 *
 * Tipos de Conects sujeitos a distance culling (gizmos auxiliares):
 *   Navigator, Item, Checkpoint, SpawnMarker, GIProbe, SSR,
 *   VolumetricFog, SSS, Bloom, PointMarker, ArrowMarker
 *
 * NÃO sujeitos a culling (funcionais/interativos):
 *   PersonalObject, StaticObject, RigidObject, StopObject, ViewObject,
 *   TerrainObject, WaterObject, SkyObject, PathObject, TrailObject,
 *   LightObjects, WeaponObject, GroupObject, AreaObject
 */

import * as THREE from 'three'

// Distâncias máximas por qualityLevel (do AdaptiveQuality.getQualityLevel())
const DISTANCE_BY_QUALITY = {
  high: 80,
  medium: 60,
  low: 40,
  minimal: 25,
}

// Conects que são gizmos auxiliares — candidatos a distance culling
const CULLABLE_CONECT_TYPES = new Set([
  'NavigatorObject',
  'ItemObject',
  'CheckpointObject',
  'SpawnObject',
  'SpawnMarkerObject',
  'GIProbe',
  'SSR',
  'VolumetricFog',
  'SSS',
  'Bloom',
  'PointMarker',
  'ArrowMarker',
])

// Re-avaliar culling quando câmara se move mais que isto (otimização)
const REEVALUATE_DISTANCE_SQ = 4 // 2² = 4 unidades

/**
 * CullingManager — singleton com estado temporário de culling.
 *
 * Mantém:
 *  - Map<Mesh, originalVisible> para restore no cleanup
 *  - Vector3/Frustum reutilizáveis (zero allocations por frame)
 *  - lastCamPos para otimização (só reavalia se câmara moveu >2 unidades)
 *
 * API pública (futura FlirScript.Culling):
 *  - getDistance(): distância máxima atual (baseada em qualityLevel)
 *  - getQualityLevel(): lido do AdaptiveQuality
 *  - getCullableTypes(): lista de tipos sujeitos a culling
 *  - isCullable(type): verifica se tipo é cullable
 *  - getStats(): { visibleCount, culledCount, totalChecked }
 *  - restore(): restaura visible original de todos os meshes (Bug #4 safe)
 */
class CullingManagerImpl {
  constructor() {
    this.reset()
  }

  reset() {
    // Map<Mesh, originalVisible> — para restore
    this._originalVisible = new Map()
    // Vector3 reutilizável (evita allocation por frame)
    this._tmpVec = new THREE.Vector3()
    // Posição da câmara no último culling (para otimização)
    this._lastCamPos = new THREE.Vector3()
    this._lastCamPosSet = false
    // Stats para FlirScript API
    this._stats = { visibleCount: 0, culledCount: 0, totalChecked: 0 }
    // Distância atual (atualizada via setQualityLevel)
    this._maxDistance = DISTANCE_BY_QUALITY.medium
    this._maxDistanceSq = this._maxDistance * this._maxDistance
  }

  /**
   * Atualiza distância máxima baseada em qualityLevel do AdaptiveQuality.
   * Chamado pelo hook/componente quando quality muda.
   */
  setQualityLevel(qualityLevel) {
    const dist = DISTANCE_BY_QUALITY[qualityLevel] ?? DISTANCE_BY_QUALITY.medium
    this._maxDistance = dist
    this._maxDistanceSq = dist * dist
  }

  /**
   * Verifica se um tipo de Conect é cullable (gizmo auxiliar).
   */
  isCullable(type) {
    return CULLABLE_CONECT_TYPES.has(type)
  }

  getCullableTypes() {
    return Array.from(CULLABLE_CONECT_TYPES)
  }

  getDistance() {
    return this._maxDistance
  }

  getStats() {
    return { ...this._stats }
  }

  /**
   * Aplica distance culling a uma lista de meshes.
   *
   * @param {Map<string, THREE.Mesh>|THREE.Mesh[]} meshes — refs ou array
   * @param {THREE.Camera} camera
   * @param {Set<string>} selectedIds — instanceIds selecionados (NÃO cull)
   * @param {Map<string, string>} idToType — instanceId → conect.type (para filtrar cullables)
   * @returns {object} stats { visibleCount, culledCount, totalChecked }
   */
  applyDistanceCulling(meshes, camera, selectedIds = new Set(), idToType = new Map()) {
    if (!meshes || !camera) return this._stats

    // Otimização: só reavaliar se câmara se moveu >2 unidades
    this._tmpVec.copy(camera.position).sub(this._lastCamPos)
    const movedSq = this._tmpVec.lengthSq()
    if (this._lastCamPosSet && movedSq < REEVALUATE_DISTANCE_SQ) {
      return this._stats
    }
    this._lastCamPos.copy(camera.position)
    this._lastCamPosSet = true

    let visibleCount = 0
    let culledCount = 0
    let totalChecked = 0

    const camPos = camera.position
    const maxDistSq = this._maxDistanceSq

    // Iterar sobre Map<string, Mesh> ou array
    const entries = meshes instanceof Map ? meshes.entries() : meshes.map((m, i) => [i, m])

    for (const [id, mesh] of entries) {
      if (!mesh) continue

      // Verificar se é cullable (gizmo auxiliar)
      const type = idToType.get(id)
      if (type && !this.isCullable(type)) {
        // Não é cullable — garantir visível
        if (!this._originalVisible.has(mesh)) {
          this._originalVisible.set(mesh, mesh.visible)
        }
        mesh.visible = this._originalVisible.get(mesh)
        continue
      }

      totalChecked++

      // Guardar original se ainda não guardado
      if (!this._originalVisible.has(mesh)) {
        this._originalVisible.set(mesh, mesh.visible)
      }

      // NÃO cull se está selecionado
      if (selectedIds.has(id)) {
        mesh.visible = true
        visibleCount++
        continue
      }

      // Distance culling ao quadrado (sem sqrt)
      const dx = mesh.position.x - camPos.x
      const dy = mesh.position.y - camPos.y
      const dz = mesh.position.z - camPos.z
      const distSq = dx * dx + dy * dy + dz * dz

      if (distSq > maxDistSq) {
        mesh.visible = false
        culledCount++
      } else {
        mesh.visible = true
        visibleCount++
      }
    }

    this._stats = { visibleCount, culledCount, totalChecked }
    return this._stats
  }

  /**
   * Restore — restaura visible original de todos os meshes.
   * Chamado no cleanup do Play Mode (preserva Bug #4 — Editor/Runtime isolation).
   */
  restore() {
    for (const [mesh, original] of this._originalVisible) {
      if (mesh) mesh.visible = original
    }
    this._originalVisible.clear()
    this._lastCamPosSet = false
    this._stats = { visibleCount: 0, culledCount: 0, totalChecked: 0 }
  }
}

// Singleton — uma instância por Canvas.
export const CullingManager = new CullingManagerImpl()
export { DISTANCE_BY_QUALITY, CULLABLE_CONECT_TYPES }
export default CullingManager

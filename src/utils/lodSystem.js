/**
 * lodSystem.js — LOD (Level of Detail) System para Flir Engine.
 *
 * Performance Core Fase 3.4 — LOD and FlirScript API Foundation.
 *
 * Princípios:
 *  - Reutiliza THREE.LOD (não reescreve sistema de LOD)
 *  - Reutiliza LODManager class de performanceOptimizer.js (estende, não duplica)
 *  - Thresholds: <1000 tris sem LOD; 1000-10000 LOD opcional; >10000 LOD forte candidato
 *  - NÃO aplica LOD em SkinnedMesh/animados (segurança — skinning não suporta LOD automático)
 *  - NÃO aplica LOD em geometrias editadas (customGeometry — perda de dados)
 *  - Distâncias por qualityLevel (AdaptiveQuality): high=mais tarde, minimal=mais cedo
 *  - Dirty flags: só reavalia quando câmara se move >2 unidades
 *  - Estado TEMPORÁRIO — não persiste no projeto
 *  - FlirScript-friendly: getters públicos para FlirScript.LOD API
 *
 * NÃO usa eval() nem new Function().
 *
 * Tiers de distância LOD por qualityLevel:
 *   high    → [0, 25, 60]   (LOD0 até 25, LOD1 até 60, LOD2 além)
 *   medium  → [0, 20, 45]
 *   low     → [0, 15, 35]
 *   minimal → [0, 10, 25]
 *
 * Thresholds de triângulos:
 *   < 1000         → sem LOD (primitivas simples, baixo custo)
 *   1000 - 10000   → LOD opcional (só se qualityLevel ≠ high)
 *   > 10000        → LOD ativo (modelos importados complexos)
 */

import * as THREE from 'three'
import { AdaptiveQuality } from './adaptiveQuality'

// Distâncias LOD por qualityLevel [LOD0_max, LOD1_max, LOD2_max]
const LOD_DISTANCES_BY_QUALITY = {
  high:    [25, 60, 120],
  medium:  [20, 45, 90],
  low:     [15, 35, 70],
  minimal: [10, 25, 50],
}

// Thresholds de triângulos
const TRI_THRESHOLD_NONE = 1000      // abaixo: sem LOD
const TRI_THRESHOLD_OPTIONAL = 10000 // acima: LOD ativo

// Re-avaliar LOD quando câmara se move mais que isto
const REEVALUATE_DISTANCE_SQ = 4 // 2² = 4 unidades

/**
 * LODSystem — singleton que gere THREE.LOD objects registados.
 *
 * Estado:
 *  - Map<instanceId, { lod, originalMesh, triCount, hasLOD }>
 *  - Vector3 reutilizável (zero allocations por frame)
 *  - lastCamPos para otimização (só reavalia se câmara moveu >2 unidades)
 *
 * API pública (FlirScript.LOD):
 *  - register(instanceId, mesh, triCount, options) — regista mesh para LOD
 *  - unregister(instanceId) — remove registo
 *  - update(camera) — atualiza LODs (chamado a cada frame)
 *  - getLevel(instanceId) — retorna nível atual (0, 1, 2 ou -1 se sem LOD)
 *  - setEnabled(instanceId, enabled) — toggle LOD por objeto
 *  - isEnabled(instanceId) — verifica se LOD está ativo
 *  - getDistance(instanceId) — distância atual da câmara
 *  - getQualityLevel() — lido do AdaptiveQuality
 *  - getStats() — { registeredCount, activeLODCount, disabledCount }
 *  - restore() — limpa registos (Bug #4 safe)
 *  - clear() — alias para restore
 */
class LODSystemImpl {
  constructor() {
    this.reset()
  }

  reset() {
    // Map<instanceId, { lod, originalMesh, triCount, hasLOD, enabled, currentLevel }>
    this._registry = new Map()
    // Vector3 reutilizável
    this._tmpVec = new THREE.Vector3()
    // Posição da câmara no último update
    this._lastCamPos = new THREE.Vector3()
    this._lastCamPosSet = false
    // Stats
    this._stats = { registeredCount: 0, activeLODCount: 0, disabledCount: 0 }
    // Distâncias atuais (atualizadas via setQualityLevel)
    this._distances = LOD_DISTANCES_BY_QUALITY.medium
    // Event listeners para FlirScript.Events
    this._lodChangedListeners = new Set()
  }

  /**
   * Atualiza distâncias LOD baseada em qualityLevel do AdaptiveQuality.
   */
  setQualityLevel(qualityLevel) {
    this._distances = LOD_DISTANCES_BY_QUALITY[qualityLevel] ?? LOD_DISTANCES_BY_QUALITY.medium
  }

  /**
   * Verifica se um objeto deve ter LOD baseado no nº de triângulos.
   * @param {number} triCount
   * @param {boolean} isAnimated — se tem skeleton/animações (NÃO aplicar LOD)
   * @param {boolean} isCustomGeometry — se é geometria editada (NÃO aplicar LOD)
   * @returns {boolean}
   */
  shouldHaveLOD(triCount, isAnimated = false, isCustomGeometry = false) {
    if (isAnimated || isCustomGeometry) return false
    if (triCount < TRI_THRESHOLD_NONE) return false
    // Acima de 1000 tris: LOD se qualityLevel não é high, OU se >10000 tris
    const quality = AdaptiveQuality.getQualityLevel()
    if (quality === 'high' && triCount < TRI_THRESHOLD_OPTIONAL) return false
    return true
  }

  /**
   * Regista um mesh para gestão de LOD.
   * Cria THREE.LOD com 3 níveis (full/50%/25%) se triCount justificar.
   *
   * @param {string} instanceId
   * @param {THREE.Mesh} mesh — mesh original
   * @param {number} triCount — nº de triângulos
   * @param {object} options — { isAnimated, isCustomGeometry, material }
   * @returns {THREE.LOD|null} — o objeto LOD criado, ou null se não aplicável
   */
  register(instanceId, mesh, triCount, options = {}) {
    if (!mesh || !instanceId) return null

    const { isAnimated = false, isCustomGeometry = false } = options

    // Verificar se deve ter LOD
    if (!this.shouldHaveLOD(triCount, isAnimated, isCustomGeometry)) {
      this._registry.set(instanceId, {
        lod: null,
        originalMesh: mesh,
        triCount,
        hasLOD: false,
        enabled: false,
        currentLevel: -1,
      })
      return null
    }

    // Criar THREE.LOD com 3 níveis
    const lod = new THREE.LOD()
    const geometry = mesh.geometry
    const material = mesh.material

    // LOD0: geometria original (100%)
    lod.addLevel(mesh, this._distances[0])

    // LOD1: simplificação 50% (clone + decimate simples)
    const geo1 = this._createSimplifiedGeometry(geometry, 0.5)
    const mesh1 = new THREE.Mesh(geo1, material)
    mesh1.castShadow = mesh.castShadow
    mesh1.receiveShadow = mesh.receiveShadow
    lod.addLevel(mesh1, this._distances[1])

    // LOD2: simplificação 25%
    const geo2 = this._createSimplifiedGeometry(geometry, 0.25)
    const mesh2 = new THREE.Mesh(geo2, material)
    mesh2.castShadow = mesh.castShadow
    mesh2.receiveShadow = mesh.receiveShadow
    lod.addLevel(mesh2, this._distances[2])

    // Copiar transform do mesh original para o LOD
    lod.position.copy(mesh.position)
    lod.rotation.copy(mesh.rotation)
    lod.scale.copy(mesh.scale)

    this._registry.set(instanceId, {
      lod,
      originalMesh: mesh,
      triCount,
      hasLOD: true,
      enabled: true,
      currentLevel: 0,
    })

    return lod
  }

  /**
   * Cria geometria simplificada via amostragem (não é ideal mas preserva topologia básica).
   * Reutiliza lógica de performanceOptimizer.simplifyGeometry.
   */
  _createSimplifiedGeometry(geometry, ratio) {
    const simplified = geometry.clone()
    const positions = simplified.attributes.position
    const originalCount = positions.count
    const keepEvery = Math.max(1, Math.round(1 / ratio))
    const newCount = Math.ceil(originalCount / keepEvery)
    const newPositions = new Float32Array(newCount * 3)

    for (let i = 0, j = 0; i < originalCount; i += keepEvery, j++) {
      newPositions[j * 3] = positions.getX(i)
      newPositions[j * 3 + 1] = positions.getY(i)
      newPositions[j * 3 + 2] = positions.getZ(i)
    }

    simplified.removeAttribute('index')
    simplified.setAttribute('position', new THREE.BufferAttribute(newPositions, 3))
    simplified.removeAttribute('normal')
    simplified.removeAttribute('uv')
    simplified.computeVertexNormals()
    return simplified
  }

  /**
   * Remove registo de LOD. Faz dispose das geometrias simplificadas (NÃO do original).
   */
  unregister(instanceId) {
    const entry = this._registry.get(instanceId)
    if (!entry) return

    if (entry.lod) {
      // Dispose apenas das geometrias LOD1 e LOD2 (LOD0 é o mesh original — não dispose)
      for (let i = 1; i < entry.lod.levels.length; i++) {
        const level = entry.lod.levels[i]
        if (level.object?.geometry && level.object.geometry !== entry.originalMesh.geometry) {
          level.object.geometry.dispose()
        }
      }
    }
    this._registry.delete(instanceId)
  }

  /**
   * Update chamado a cada frame. Atualiza LODs baseado na posição da câmara.
   * @param {THREE.Camera} camera
   */
  update(camera) {
    if (!camera) return

    // Otimização: só reavaliar se câmara se moveu >2 unidades
    this._tmpVec.copy(camera.position).sub(this._lastCamPos)
    const movedSq = this._tmpVec.lengthSq()
    if (this._lastCamPosSet && movedSq < REEVALUATE_DISTANCE_SQ) return
    this._lastCamPos.copy(camera.position)
    this._lastCamPosSet = true

    let activeCount = 0
    let disabledCount = 0

    for (const [instanceId, entry] of this._registry) {
      if (!entry.hasLOD || !entry.enabled || !entry.lod) {
        if (entry.hasLOD && !entry.enabled) disabledCount++
        continue
      }

      // THREE.LOD.update faz a troca de nível automaticamente
      const previousLevel = entry.currentLevel
      entry.lod.update(camera)
      entry.currentLevel = entry.lod.getCurrentLevel()
      activeCount++

      // Emitir evento lodChanged se nível mudou
      if (previousLevel !== entry.currentLevel) {
        this._emitLODChanged(instanceId, previousLevel, entry.currentLevel)
      }
    }

    this._stats.registeredCount = this._registry.size
    this._stats.activeLODCount = activeCount
    this._stats.disabledCount = disabledCount
  }

  /**
   * Emite evento lodChanged para listeners (FlirScript.Events).
   * Payload seguro: só IDs e números, NÃO objetos Three.js.
   */
  _emitLODChanged(instanceId, previousLevel, currentLevel) {
    const payload = { instanceId, previousLevel, currentLevel }
    for (const cb of this._lodChangedListeners) {
      try {
        cb(payload)
      } catch (e) {
        // Listener erro — não quebrar o loop
      }
    }
  }

  // ===== Getters públicos (FlirScript.LOD API) =====

  getLevel(instanceId) {
    const entry = this._registry.get(instanceId)
    return entry ? entry.currentLevel : -1
  }

  setEnabled(instanceId, enabled) {
    const entry = this._registry.get(instanceId)
    if (!entry || !entry.hasLOD) return
    entry.enabled = enabled
    if (entry.lod) {
      // Se desativado, forçar LOD0 (qualidade original)
      if (!enabled) {
        entry.lod.setLevel(0)
        entry.currentLevel = 0
      }
    }
  }

  isEnabled(instanceId) {
    const entry = this._registry.get(instanceId)
    return entry ? entry.enabled : false
  }

  getDistance(instanceId) {
    const entry = this._registry.get(instanceId)
    if (!entry || !entry.hasLOD || !entry.lod) return 0
    // Distância não é armazenada por LOD — retornar baseado no nível atual
    return this._distances[Math.max(0, entry.currentLevel)] || 0
  }

  getQualityLevel() {
    return AdaptiveQuality.getQualityLevel()
  }

  getStats() {
    return { ...this._stats }
  }

  hasLOD(instanceId) {
    const entry = this._registry.get(instanceId)
    return entry ? entry.hasLOD : false
  }

  // ===== Event system (FlirScript.Events) =====

  onLODChanged(callback) {
    this._lodChangedListeners.add(callback)
    return () => this._lodChangedListeners.delete(callback)
  }

  // ===== Restore (Bug #4 safe) =====

  restore() {
    // Dispose geometrias simplificadas (NÃO originais)
    for (const [instanceId, entry] of this._registry) {
      if (entry.lod) {
        for (let i = 1; i < entry.lod.levels.length; i++) {
          const level = entry.lod.levels[i]
          if (level.object?.geometry && level.object.geometry !== entry.originalMesh.geometry) {
            level.object.geometry.dispose()
          }
        }
      }
    }
    this._registry.clear()
    this._lodChangedListeners.clear()
    this._lastCamPosSet = false
    this._stats = { registeredCount: 0, activeLODCount: 0, disabledCount: 0 }
  }

  // Alias
  clear() {
    this.restore()
  }
}

// Singleton — uma instância por Canvas.
export const LODSystem = new LODSystemImpl()
export { LOD_DISTANCES_BY_QUALITY, TRI_THRESHOLD_NONE, TRI_THRESHOLD_OPTIONAL }
export default LODSystem

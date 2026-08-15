/**
 * flirScriptAPI.js — FlirScript API oficial da Flir Engine.
 *
 * Performance Core Fase 3.4 — LOD and FlirScript API Foundation.
 *
 * Arquitetura:
 *   FlirScript (scripts do utilizador)
 *       ↓
 *   FlirScriptAPI (esta camada — fronteira controlada)
 *       ↓
 *   Engine Systems (LODSystem, CullingManager, AdaptiveQuality, store)
 *       ↓
 *   Three.js / R3F / ECS / Physics
 *
 * Princípios de segurança:
 *  - Scripts recebem apenas IDs, valores primitivos e dados serializáveis
 *  - NÃO expor: window, document, process, filesystem, network,
 *    WebGLRenderer, React internals, Zustand store inteiro, objetos Three.js
 *  - NÃO usa eval() nem new Function()
 *  - API é read-only por defeito; setters são explícitos e controlados
 *
 * Namespaces implementados (Fase 3.4):
 *  - FlirScriptAPI.LOD — gestão de Level of Detail
 *  - FlirScriptAPI.Performance — métricas de performance
 *  - FlirScriptAPI.Culling — distance/frustum culling
 *  - FlirScriptAPI.Object — operações básicas de objetos (read-only nesta fase)
 *  - FlirScriptAPI.Events — sistema de eventos
 *
 * Namespaces futuros (Fases 3.5-3.8+):
 *  - FlirScriptAPI.Scene, .Physics, .Input, .Audio, .Animation,
 *    .UI, .Runtime, .AI, .Assets, .Networking
 *
 * Uso:
 *  import { FlirScriptAPI } from '../utils/flirscript/flirScriptAPI'
 *  FlirScriptAPI.LOD.getLevel(instanceId)
 *  FlirScriptAPI.Events.on('lodChanged', (payload) => { ... })
 *
 *  Ou via gameContext (no FlirCode):
 *  gameContext.api.LOD.getLevel('inst_123')
 */

import { LODSystem } from '../lodSystem'
import { CullingManager } from '../cullingManager'
import { AdaptiveQuality } from '../adaptiveQuality'
import { PerformanceBudget } from '../performanceBudget'
import { PerformanceStats } from '../performanceStats'

/**
 * LOD API — gestão de Level of Detail.
 *
 * Métodos:
 *  - getLevel(instanceId): number — nível atual (0=full, 1=medium, 2=low, -1=sem LOD)
 *  - setEnabled(instanceId, enabled): void — toggle LOD por objeto
 *  - isEnabled(instanceId): boolean — verifica se LOD está ativo
 *  - hasLOD(instanceId): boolean — verifica se objeto tem LOD
 *  - getDistance(instanceId): number — distância do nível atual
 *  - getQualityLevel(): string — 'high'|'medium'|'low'|'minimal'
 *  - getStats(): object — { registeredCount, activeLODCount, disabledCount }
 */
const LODAPI = {
  /**
   * Retorna o nível LOD atual de um objeto.
   * @param {string} instanceId — ID da instância
   * @returns {number} — 0 (full), 1 (medium), 2 (low), ou -1 (sem LOD)
   */
  getLevel(instanceId) {
    return LODSystem.getLevel(instanceId)
  },

  /**
   * Ativa ou desativa LOD para um objeto específico.
   * @param {string} instanceId
   * @param {boolean} enabled
   */
  setEnabled(instanceId, enabled) {
    LODSystem.setEnabled(instanceId, enabled)
  },

  /**
   * Verifica se LOD está ativo para um objeto.
   * @param {string} instanceId
   * @returns {boolean}
   */
  isEnabled(instanceId) {
    return LODSystem.isEnabled(instanceId)
  },

  /**
   * Verifica se um objeto tem LOD (foi registado e justifica LOD).
   * @param {string} instanceId
   * @returns {boolean}
   */
  hasLOD(instanceId) {
    return LODSystem.hasLOD(instanceId)
  },

  /**
   * Retorna a distância do nível LOD atual.
   * @param {string} instanceId
   * @returns {number} — distância em unidades
   */
  getDistance(instanceId) {
    return LODSystem.getDistance(instanceId)
  },

  /**
   * Retorna o qualityLevel atual da engine.
   * @returns {string} — 'high' | 'medium' | 'low' | 'minimal'
   */
  getQualityLevel() {
    return LODSystem.getQualityLevel()
  },

  /**
   * Retorna estatísticas do sistema de LOD.
   * @returns {{ registeredCount: number, activeLODCount: number, disabledCount: number }}
   */
  getStats() {
    return LODSystem.getStats()
  },
}

/**
 * Performance API — métricas de performance da engine.
 *
 * Métodos:
 *  - getFPS(): number
 *  - getFrameTime(): number — em ms
 *  - getQualityLevel(): string
 *  - getDPR(): number — pixel ratio atual
 *  - isCritical(): boolean — true se em estado CRITICAL
 *  - isMobile(): boolean
 *  - getDrawCalls(): number
 *  - getTriangles(): number
 */
const PerformanceAPI = {
  getFPS() {
    const snapshot = PerformanceStats.getSnapshot()
    return snapshot?.fps ?? 0
  },

  getFrameTime() {
    const snapshot = PerformanceStats.getSnapshot()
    return snapshot?.frameTimeMs ?? 0
  },

  getQualityLevel() {
    return AdaptiveQuality.getQualityLevel()
  },

  getDPR() {
    return AdaptiveQuality.getDpr()
  },

  isCritical() {
    return AdaptiveQuality.isCritical()
  },

  isMobile() {
    return AdaptiveQuality.isMobile()
  },

  getDrawCalls() {
    const snapshot = PerformanceStats.getSnapshot()
    return snapshot?.drawCalls ?? 0
  },

  getTriangles() {
    const snapshot = PerformanceStats.getSnapshot()
    return snapshot?.triangles ?? 0
  },

  getBudget() {
    return {
      state: PerformanceBudget.getState(),
      avgFrameTime: PerformanceBudget.getAverageFrameTime(),
      targetFPS: PerformanceBudget.getBudget().targetFPS,
      minFPS: PerformanceBudget.getBudget().minFPS,
    }
  },
}

/**
 * Culling API — distance e frustum culling.
 *
 * Métodos:
 *  - getDistance(): number — distância máxima de culling atual
 *  - getStats(): object — { visibleCount, culledCount, totalChecked }
 *  - isCullable(type): boolean — verifica se tipo é cullable
 *  - getCullableTypes(): string[]
 */
const CullingAPI = {
  getDistance() {
    return CullingManager.getDistance()
  },

  getStats() {
    return CullingManager.getStats()
  },

  isCullable(type) {
    return CullingManager.isCullable(type)
  },

  getCullableTypes() {
    return CullingManager.getCullableTypes()
  },
}

/**
 * Object API — operações básicas de objetos (read-only nesta fase).
 *
 * Nesta fase (3.4), apenas operações de leitura seguras.
 * Operações de escrita (setPosition, setName) serão adicionadas em fases futuras
 * após validação de segurança.
 *
 * Métodos:
 *  - exists(id): boolean
 *  - getPosition(id): [x, y, z] | null
 *  - getName(id): string | null  (futuro — requer bridge com store)
 */
const ObjectAPI = {
  /**
   * Verifica se um objeto existe (está registado nos meshRefs).
   * @param {string} instanceId
   * @returns {boolean}
   */
  exists(instanceId) {
    const meshRefs = (typeof window !== 'undefined') ? window._flirMeshRefs : null
    const conectMeshRefs = (typeof window !== 'undefined') ? window._flirConectMeshRefs : null
    if (!instanceId) return false
    if (meshRefs?.current?.has(instanceId)) return true
    if (conectMeshRefs?.current?.has(instanceId)) return true
    return false
  },

  /**
   * Retorna a posição de um objeto como array serializável [x, y, z].
   * NÃO expõe o objeto Three.js — retorna apenas primitivas.
   * @param {string} instanceId
   * @returns {[number, number, number] | null}
   */
  getPosition(instanceId) {
    if (!instanceId) return null
    const meshRefs = (typeof window !== 'undefined') ? window._flirMeshRefs : null
    const conectMeshRefs = (typeof window !== 'undefined') ? window._flirConectMeshRefs : null
    const mesh = meshRefs?.current?.get(instanceId) || conectMeshRefs?.current?.get(instanceId)
    if (!mesh) return null
    return [mesh.position.x, mesh.position.y, mesh.position.z]
  },
}

/**
 * Events API — sistema de eventos do FlirScript.
 *
 * Eventos suportados (Fase 3.4):
 *  - 'lodChanged' — emitido quando nível LOD de um objeto muda
 *    Payload: { instanceId: string, previousLevel: number, currentLevel: number }
 *
 * Eventos futuros:
 *  - 'qualityChanged', 'cullingChanged', 'sceneLoaded', etc.
 *
 * Métodos:
 *  - on(eventName, callback): unsubscribe function
 *  - off(eventName, callback): void
 */
const EventsAPI = {
  _listeners: new Map(), // eventName → Set<callback>

  /**
   * Regista um listener para um evento.
   * @param {string} eventName
   * @param {function} callback
   * @returns {function} — função para desregistar (unsubscribe)
   */
  on(eventName, callback) {
    if (!eventName || typeof callback !== 'function') return () => {}
    if (!this._listeners.has(eventName)) {
      this._listeners.set(eventName, new Set())
    }
    this._listeners.get(eventName).add(callback)

    // Bridge para sistemas de engine
    if (eventName === 'lodChanged') {
      const unsub = LODSystem.onLODChanged(callback)
      // Guardar para poder desregistar
      callback._unsubBridge = unsub
    }

    return () => this.off(eventName, callback)
  },

  /**
   * Remove um listener de um evento.
   * @param {string} eventName
   * @param {function} callback
   */
  off(eventName, callback) {
    const set = this._listeners.get(eventName)
    if (set) {
      set.delete(callback)
      if (set.size === 0) this._listeners.delete(eventName)
    }
    // Desregistar do bridge
    if (callback?._unsubBridge) {
      callback._unsubBridge()
      delete callback._unsubBridge
    }
  },
}

/**
 * FlirScriptAPI — objeto raiz da API oficial do FlirScript.
 *
 * Exportado como singleton. Acessível via import ou via gameContext.api.
 */
export const FlirScriptAPI = {
  LOD: LODAPI,
  Performance: PerformanceAPI,
  Culling: CullingAPI,
  Object: ObjectAPI,
  Events: EventsAPI,

  /**
   * Retorna a versão da API (para compatibilidade futura).
   */
  getVersion() {
    return '1.0.0-phase3.4'
  },
}

export default FlirScriptAPI

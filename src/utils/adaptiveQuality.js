/**
 * adaptiveQuality.js — Adaptive Quality Controller para Flir Engine.
 *
 * Performance Core Fase 3.2 — Adaptive Quality.
 *
 * Princípios:
 *  - Estado TEMPORÁRIO de Runtime — NÃO persiste em renderSettings nem no projeto.
 *  - Reutiliza PerformanceBudget (HEALTHY/WARNING/CRITICAL) — não cria medição paralela.
 *  - Histerese: 3s CRITICAL para baixar qualidade, 5s HEALTHY para subir.
 *  - Reversível: restore() devolve tudo ao estado original.
 *  - Mobile-first: prioriza estabilidade > FPS > frame time > GPU.
 *  - FlirScript-friendly: getters públicos para futura Performance API
 *    (Performance.fps, Performance.qualityLevel, Performance.dpr, Performance.isCritical).
 *
 * NÃO usa eval() nem new Function(). Não introduz execução dinâmica.
 *
 * Estados de qualidade (DPR):
 *   TIER_HIGH   → dpr 2.0    (HEALTHY sustentado, device potente)
 *   TIER_MED    → dpr 1.5    (default, WARNING recovery)
 *   TIER_LOW    → dpr 1.25   (CRITICAL recovery)
 *   TIER_MIN    → dpr 1.0    (CRITICAL sustentado, mobile fraco)
 *
 * Auto-Shadows:
 *   - Em CRITICAL sustentado (≥3s) E isMobile → pode desligar shadows temporariamente.
 *   - Em HEALTHY sustentado (≥5s) → re-liga se foram desligadas.
 *   - Não modifica renderSettings.shadowOptimizations (config do utilizador).
 */

import { PerformanceBudget } from './performanceBudget'

// Níveis de DPR (pixel ratio). Ordem descendente de qualidade.
const DPR_TIERS = [2.0, 1.5, 1.25, 1.0]

// Histerese (ms) — evita oscilação FPS↓→DPR↓→FPS↑→DPR↑
const CRITICAL_DURATION_MS = 3000   // 3s CRITICAL para baixar 1 tier
const HEALTHY_DURATION_MS = 5000    // 5s HEALTHY para subir 1 tier

// Thresholds para detectar mobile (heuristic, não invasivo)
function detectIsMobile() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  const isMobileUA = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  // Heuristic adicional: hardwareConcurrency baixo OU memória limitada
  const cores = navigator.hardwareConcurrency || 4
  const mem = navigator.deviceMemory || 4
  return isMobileUA || (cores <= 4 && mem <= 4)
}

/**
 * AdaptiveQualityController
 *
 * Singleton — uma instância por Canvas. Mantém estado próprio, não acoplado ao
 * store Zustand. Lê PerformanceBudget.getState() diretamente (baixo acoplamento).
 *
 * API pública (extensível para FlirScript Performance API futura):
 *  - update(deltaMs): chamado a cada frame pelo hook useAdaptiveQuality
 *  - getDpr(): retorna DPR atual aplicado
 *  - getQualityLevel(): retorna 'high' | 'medium' | 'low' | 'minimal'
 *  - isCritical(): boolean
 *  - isShadowsEnabled(): boolean (estado temporário, pode diferir da config)
 *  - restore(): restaura estado original (chamado no cleanup do Play Mode)
 *
 * Não emite eventos React — o hook lê os getters e aplica via gl.setPixelRatio.
 */
class AdaptiveQualityController {
  constructor() {
    this.reset()
  }

  reset() {
    // Config inicial — capturada no start()
    this._started = false
    this._originalDpr = null
    this._originalShadowsEnabled = null
    this._isMobile = detectIsMobile()

    // Estado atual
    this._dprTierIndex = 1   // default TIER_MED (1.5)
    this._appliedDpr = DPR_TIERS[this._dprTierIndex]
    this._shadowsTempDisabled = false

    // Timers de histerese
    this._criticalTimerMs = 0
    this._healthyTimerMs = 0
    this._lastState = 'HEALTHY'

    // Callbacks (aplicados pelo hook — não tocam em gl/store diretamente)
    this._onDprChange = null
    this._onShadowsChange = null

    // Snapshot para restore (Bug #4 preservado)
    this._snapshot = null
  }

  /**
   * Inicia o controller. Captura estado original para restore posterior.
   * @param {object} opts
   *  - originalDpr: DPR configurado no Canvas (renderSettings.pixelRatio)
   *  - originalShadowsEnabled: se shadows estavam ativos (renderSettings.shadowOptimizations)
   *  - onDprChange: callback(dpr) quando DPR muda
   *  - onShadowsChange: callback(enabled) quando shadows temp mudam
   */
  start(opts = {}) {
    this._originalDpr = opts.originalDpr ?? 1.5
    this._originalShadowsEnabled = opts.originalShadowsEnabled ?? true
    this._onDprChange = opts.onDprChange ?? null
    this._onShadowsChange = opts.onShadowsChange ?? null

    // Snapshot para restore seguro (Bug #4)
    this._snapshot = {
      originalDpr: this._originalDpr,
      originalShadowsEnabled: this._originalShadowsEnabled,
    }

    // Iniciar no tier mais próximo do DPR original (não subir acima do configurado)
    this._dprTierIndex = this._findTierIndex(this._originalDpr)
    // Se original é 1.0, começar no TIER_MIN; se 2.0, no TIER_HIGH; etc.
    this._appliedDpr = DPR_TIERS[this._dprTierIndex]
    this._shadowsTempDisabled = false
    this._criticalTimerMs = 0
    this._healthyTimerMs = 0
    this._lastState = 'HEALTHY'
    this._started = true

    // Aplicar estado inicial
    if (this._onDprChange) this._onDprChange(this._appliedDpr)
  }

  /**
   * Update chamado a cada frame. Lê PerformanceBudget (singleton externo).
   * @param {number} deltaMs — delta do frame em ms
   */
  update(deltaMs) {
    if (!this._started) return

    // Import dinâmico seria assíncrono — import direto para evitar latência
    // PerformanceBudget é singleton,getState é síncrono e barato
    const state = this._readBudgetState()

    if (state === 'CRITICAL') {
      this._criticalTimerMs += deltaMs
      this._healthyTimerMs = 0
      // Sustentado CRITICAL → baixar 1 tier
      if (this._criticalTimerMs >= CRITICAL_DURATION_MS && this._dprTierIndex < DPR_TIERS.length - 1) {
        this._dprTierIndex++
        this._appliedDpr = DPR_TIERS[this._dprTierIndex]
        this._criticalTimerMs = 0
        if (this._onDprChange) this._onDprChange(this._appliedDpr)
      }
      // Auto-shadows: em mobile CRITICAL sustentado, desligar shadows
      if (this._isMobile && !this._shadowsTempDisabled && this._criticalTimerMs >= CRITICAL_DURATION_MS) {
        this._shadowsTempDisabled = true
        if (this._onShadowsChange) this._onShadowsChange(false)
      }
    } else if (state === 'HEALTHY') {
      this._healthyTimerMs += deltaMs
      this._criticalTimerMs = 0
      // Sustentado HEALTHY → subir 1 tier (até ao original)
      if (this._healthyTimerMs >= HEALTHY_DURATION_MS && this._dprTierIndex > 0) {
        // Não subir acima do tier original
        const originalTierIndex = this._findTierIndex(this._originalDpr)
        if (this._dprTierIndex > originalTierIndex) {
          this._dprTierIndex--
          this._appliedDpr = DPR_TIERS[this._dprTierIndex]
          this._healthyTimerMs = 0
          if (this._onDprChange) this._onDprChange(this._appliedDpr)
        }
      }
      // Auto-shadows recovery: re-ligar se estavam desligadas
      if (this._shadowsTempDisabled && this._healthyTimerMs >= HEALTHY_DURATION_MS) {
        this._shadowsTempDisabled = false
        if (this._onShadowsChange) this._onShadowsChange(true)
      }
    } else {
      // WARNING — não mudar nada, resetar timers parciais
      this._criticalTimerMs = 0
      this._healthyTimerMs = 0
    }
    this._lastState = state
  }

  /**
   * Lê estado do PerformanceBudget (importado no topo, sem require).
   */
  _readBudgetState() {
    try {
      return PerformanceBudget.getState() || 'HEALTHY'
    } catch {
      return 'HEALTHY'
    }
  }

  _findTierIndex(dpr) {
    // Encontrar tier mais próximo (não acima) do dpr pedido
    for (let i = 0; i < DPR_TIERS.length; i++) {
      if (DPR_TIERS[i] <= dpr) return i
    }
    return DPR_TIERS.length - 1
  }

  /**
   * Restore — chamado no cleanup do Play Mode.
   * Restaura DPR e shadows ao estado original. Preserva Bug #4 (Editor/Runtime isolation).
   */
  restore() {
    if (!this._snapshot) return
    if (this._onDprChange) this._onDprChange(this._snapshot.originalDpr)
    if (this._shadowsTempDisabled && this._onShadowsChange) {
      this._onShadowsChange(this._snapshot.originalShadowsEnabled)
    }
    this._started = false
    this._shadowsTempDisabled = false
    this._criticalTimerMs = 0
    this._healthyTimerMs = 0
    this._snapshot = null
  }

  // ===== Getters públicos (futura FlirScript Performance API) =====
  getDpr() { return this._appliedDpr }
  getQualityLevel() {
    switch (this._dprTierIndex) {
      case 0: return 'high'
      case 1: return 'medium'
      case 2: return 'low'
      case 3: return 'minimal'
      default: return 'medium'
    }
  }
  isCritical() { return this._lastState === 'CRITICAL' }
  isShadowsEnabled() { return !this._shadowsTempDisabled }
  isMobile() { return this._isMobile }
  isStarted() { return this._started }
}

// Singleton — uma instância por Canvas. Reset no start/restore.
export const AdaptiveQuality = new AdaptiveQualityController()
export { DPR_TIERS }
export default AdaptiveQuality

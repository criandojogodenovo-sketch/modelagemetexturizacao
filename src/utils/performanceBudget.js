/**
 * performanceBudget.js — Orçamento de processamento da engine.
 *
 * Determina se a engine está a correr dentro do orçamento de tempo
 * por frame, e classifica o estado em HEALTHY / WARNING / CRITICAL.
 *
 * NÃO faz redução automática de qualidade — apenas detecta, mede e informa.
 *
 * API:
 *  budget.update(frameTimeMs)
 *  budget.getState()        → 'HEALTHY' | 'WARNING' | 'CRITICAL'
 *  budget.getBudget()       → { targetFPS, minFPS, targetFrameTime, maxFrameTime }
 *  budget.isOverBudget()    → boolean
 *  budget.getAverageFrameTime() → number (ms)
 */

// ============================================================
//  CONSTANTES
// ============================================================

const TARGET_FPS = 60
const MIN_FPS = 30

const TARGET_FRAME_TIME_MS = 1000 / TARGET_FPS   // 16.67ms
const MAX_FRAME_TIME_MS = 1000 / MIN_FPS          // 33.33ms

// Janela para média móvel (em frames)
const WINDOW_SIZE = 30

// Limiares de estado (percentagem do budget)
const WARNING_THRESHOLD = 1.0   // frameTime >= target × 1.0 → WARNING
const CRITICAL_THRESHOLD = 1.5  // frameTime >= target × 1.5 → CRITICAL (≈ 25fps)

// ============================================================
//  PerformanceBudget — singleton
// ============================================================

class PerformanceBudgetImpl {
  constructor() {
    this.reset()
  }

  reset() {
    this._targetFPS = TARGET_FPS
    this._minFPS = MIN_FPS
    this._targetFrameTimeMs = TARGET_FRAME_TIME_MS
    this._maxFrameTimeMs = MAX_FRAME_TIME_MS

    // Janela deslizante de frame times
    this._frameTimes = new Float32Array(WINDOW_SIZE)
    this._index = 0
    this._count = 0

    // Estado actual
    this._state = 'HEALTHY'
    this._avgFrameTimeMs = 0

    // Contadores de frames por estado (para debug)
    this._healthyFrames = 0
    this._warningFrames = 0
    this._criticalFrames = 0

    // Snapshot cache
    this._budgetSnapshot = {
      targetFPS: TARGET_FPS,
      minFPS: MIN_FPS,
      targetFrameTime: TARGET_FRAME_TIME_MS,
      maxFrameTime: MAX_FRAME_TIME_MS,
    }
  }

  /**
   * Actualiza o orçamento com o frame time actual.
   *
   * @param {number} frameTimeMs — tempo do frame em milissegundos
   */
  update(frameTimeMs) {
    // Adicionar à janela deslizante
    this._frameTimes[this._index] = frameTimeMs
    this._index = (this._index + 1) % WINDOW_SIZE
    if (this._count < WINDOW_SIZE) this._count++

    // Calcular média
    let sum = 0
    for (let i = 0; i < this._count; i++) {
      sum += this._frameTimes[i]
    }
    this._avgFrameTimeMs = sum / this._count

    // Determinar estado
    const threshold = this._avgFrameTimeMs / this._targetFrameTimeMs
    if (threshold >= CRITICAL_THRESHOLD) {
      this._state = 'CRITICAL'
      this._criticalFrames++
    } else if (threshold >= WARNING_THRESHOLD) {
      this._state = 'WARNING'
      this._warningFrames++
    } else {
      this._state = 'HEALTHY'
      this._healthyFrames++
    }
  }

  /**
   * Retorna o estado actual do orçamento.
   * @returns {'HEALTHY' | 'WARNING' | 'CRITICAL'}
   */
  getState() {
    return this._state
  }

  /**
   * Retorna a configuração do orçamento.
   * @returns {Object} { targetFPS, minFPS, targetFrameTime, maxFrameTime }
   */
  getBudget() {
    return this._budgetSnapshot
  }

  /**
   * Retorna true se a engine está acima do orçamento (WARNING ou CRITICAL).
   * @returns {boolean}
   */
  isOverBudget() {
    return this._state !== 'HEALTHY'
  }

  /**
   * Retorna o frame time médio (ms) da janela actual.
   * @returns {number}
   */
  getAverageFrameTime() {
    return this._avgFrameTimeMs
  }

  /**
   * Retorna estatísticas de frames por estado.
   * @returns {Object} { healthy, warning, critical }
   */
  getFrameStats() {
    return {
      healthy: this._healthyFrames,
      warning: this._warningFrames,
      critical: this._criticalFrames,
    }
  }
}

// Exportar singleton
export const PerformanceBudget = new PerformanceBudgetImpl()

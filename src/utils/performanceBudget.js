/**
 * performanceBudget.js — Orçamento de processamento da engine.
 * NÃO faz redução automática de qualidade — apenas detecta, mede e informa.
 */
const TARGET_FPS = 60
const MIN_FPS = 30
const TARGET_FRAME_TIME_MS = 1000 / TARGET_FPS
const MAX_FRAME_TIME_MS = 1000 / MIN_FPS
const WINDOW_SIZE = 30
const WARNING_THRESHOLD = 1.0
const CRITICAL_THRESHOLD = 1.5

class PerformanceBudgetImpl {
  constructor() { this.reset() }
  reset() {
    this._targetFPS = TARGET_FPS
    this._minFPS = MIN_FPS
    this._targetFrameTimeMs = TARGET_FRAME_TIME_MS
    this._maxFrameTimeMs = MAX_FRAME_TIME_MS
    this._frameTimes = new Float32Array(WINDOW_SIZE)
    this._index = 0
    this._count = 0
    this._state = 'HEALTHY'
    this._avgFrameTimeMs = 0
    this._healthyFrames = 0
    this._warningFrames = 0
    this._criticalFrames = 0
    this._budgetSnapshot = {
      targetFPS: TARGET_FPS, minFPS: MIN_FPS,
      targetFrameTime: TARGET_FRAME_TIME_MS, maxFrameTime: MAX_FRAME_TIME_MS,
    }
  }
  update(frameTimeMs) {
    this._frameTimes[this._index] = frameTimeMs
    this._index = (this._index + 1) % WINDOW_SIZE
    if (this._count < WINDOW_SIZE) this._count++
    let sum = 0
    for (let i = 0; i < this._count; i++) sum += this._frameTimes[i]
    this._avgFrameTimeMs = sum / this._count
    const threshold = this._avgFrameTimeMs / this._targetFrameTimeMs
    if (threshold >= CRITICAL_THRESHOLD) { this._state = 'CRITICAL'; this._criticalFrames++ }
    else if (threshold >= WARNING_THRESHOLD) { this._state = 'WARNING'; this._warningFrames++ }
    else { this._state = 'HEALTHY'; this._healthyFrames++ }
  }
  getState() { return this._state }
  getBudget() { return this._budgetSnapshot }
  isOverBudget() { return this._state !== 'HEALTHY' }
  getAverageFrameTime() { return this._avgFrameTimeMs }
}
export const PerformanceBudget = new PerformanceBudgetImpl()

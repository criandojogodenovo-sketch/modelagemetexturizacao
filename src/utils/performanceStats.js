/**
 * performanceStats.js — Coleta leve de métricas de performance em runtime.
 *
 * Princípios:
 *  - Zero allocations por frame (reutiliza objectos)
 *  - Métricas pesadas (renderer.info) só a cada N frames (throttled)
 *  - FPS calculado por janela deslizante de frames
 *  - API simples: update(delta), getSnapshot(), reset()
 *
 * NÃO faz redução automática de qualidade — apenas mede e informa.
 */
import * as THREE from 'three'

// ============================================================
//  CONSTANTES
// ============================================================

const FPS_SAMPLE_WINDOW = 60        // número de frames para média de FPS
const RENDERER_INFO_INTERVAL = 30   // ler gl.info a cada 30 frames (~0.5s a 60fps)
const MS_PER_FRAME_60FPS = 1000 / 60

// ============================================================
//  PerformanceStats — singleton leve
// ============================================================

class PerformanceStatsImpl {
  constructor() {
    this.reset()
  }

  reset() {
    // FPS — janela deslizante
    this._frameTimes = new Float32Array(FPS_SAMPLE_WINDOW)
    this._frameTimeIndex = 0
    this._frameTimeCount = 0
    this._fps = 0
    this._frameTimeMs = 0

    // Renderer info (throttled)
    this._rendererFrameCounter = 0
    this._drawCalls = 0
    this._triangles = 0
    this._geometries = 0
    this._textures = 0
    this._programs = 0

    // Objectos
    this._totalObjects = 0
    this._visibleObjects = 0

    // Overhead tracking
    this._updateTimeMs = 0

    // Snapshot cache (evita criar objecto novo)
    this._snapshot = {
      fps: 0,
      frameTimeMs: 0,
      drawCalls: 0,
      triangles: 0,
      geometries: 0,
      textures: 0,
      programs: 0,
      totalObjects: 0,
      visibleObjects: 0,
      updateTimeMs: 0,
      timestamp: 0,
    }
  }

  /**
   * Atualiza as métricas. Deve ser chamado uma vez por frame.
   *
   * @param {number} delta — delta time em segundos (do useFrame do R3F)
   * @param {Object} [gl] — renderer THREE.WebGLRenderer (opcional, para gl.info)
   * @param {Object} [scene] — THREE.Scene (opcional, para contar objectos)
   */
  update(delta, gl, scene) {
    const t0 = (typeof performance !== 'undefined') ? performance.now() : 0

    // === FPS / frame time ===
    const frameTimeMs = delta * 1000
    this._frameTimes[this._frameTimeIndex] = frameTimeMs
    this._frameTimeIndex = (this._frameTimeIndex + 1) % FPS_SAMPLE_WINDOW
    if (this._frameTimeCount < FPS_SAMPLE_WINDOW) this._frameTimeCount++

    // Calcular FPS médio da janela
    if (this._frameTimeCount > 0) {
      let sum = 0
      for (let i = 0; i < this._frameTimeCount; i++) {
        sum += this._frameTimes[i]
      }
      const avgFrameTime = sum / this._frameTimeCount
      this._frameTimeMs = avgFrameTime
      this._fps = avgFrameTime > 0 ? Math.round(1000 / avgFrameTime) : 0
    }

    // === Renderer info (throttled — a cada RENDERER_INFO_INTERVAL frames) ===
    this._rendererFrameCounter++
    if (gl && this._rendererFrameCounter >= RENDERER_INFO_INTERVAL) {
      this._rendererFrameCounter = 0
      const info = gl.info
      if (info) {
        this._drawCalls = info.render?.calls ?? 0
        this._triangles = info.render?.triangles ?? 0
        this._geometries = info.memory?.geometries ?? 0
        this._textures = info.memory?.textures ?? 0
        this._programs = info.programs?.length ?? 0
      }
    }

    // === Objectos (só quando scene muda — passivo) ===
    if (scene) {
      let total = 0
      let visible = 0
      scene.traverse((obj) => {
        if (obj.isMesh || obj.isLine || obj.isPoints || obj.isInstancedMesh) {
          total++
          if (obj.visible) visible++
        }
      })
      this._totalObjects = total
      this._visibleObjects = visible
    }

    // === Overhead tracking ===
    const t1 = (typeof performance !== 'undefined') ? performance.now() : 0
    this._updateTimeMs = t1 - t0
  }

  /**
   * Retorna um snapshot das métricas actuais.
   * O objecto retornado é reutilizado — não modificar.
   *
   * @returns {Object} { fps, frameTimeMs, drawCalls, triangles, geometries, textures, programs, totalObjects, visibleObjects, updateTimeMs, timestamp }
   */
  getSnapshot() {
    this._snapshot.fps = this._fps
    this._snapshot.frameTimeMs = this._frameTimeMs
    this._snapshot.drawCalls = this._drawCalls
    this._snapshot.triangles = this._triangles
    this._snapshot.geometries = this._geometries
    this._snapshot.textures = this._textures
    this._snapshot.programs = this._programs
    this._snapshot.totalObjects = this._totalObjects
    this._snapshot.visibleObjects = this._visibleObjects
    this._snapshot.updateTimeMs = this._updateTimeMs
    this._snapshot.timestamp = Date.now()
    return this._snapshot
  }
}

// Exportar singleton
export const PerformanceStats = new PerformanceStatsImpl()

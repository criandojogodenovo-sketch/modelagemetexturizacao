/**
 * performanceStats.js — Coleta leve de métricas de performance em runtime.
 * Zero allocations por frame (Float32Array reutilizado).
 */
import * as THREE from 'three'

const FPS_SAMPLE_WINDOW = 60
const RENDERER_INFO_INTERVAL = 30

class PerformanceStatsImpl {
  constructor() { this.reset() }
  reset() {
    this._frameTimes = new Float32Array(FPS_SAMPLE_WINDOW)
    this._frameTimeIndex = 0
    this._frameTimeCount = 0
    this._fps = 0
    this._frameTimeMs = 0
    this._rendererFrameCounter = 0
    this._drawCalls = 0
    this._triangles = 0
    this._geometries = 0
    this._textures = 0
    this._programs = 0
    this._totalObjects = 0
    this._visibleObjects = 0
    this._updateTimeMs = 0
    this._snapshot = {
      fps: 0, frameTimeMs: 0, drawCalls: 0, triangles: 0,
      geometries: 0, textures: 0, programs: 0,
      totalObjects: 0, visibleObjects: 0, updateTimeMs: 0, timestamp: 0,
    }
  }
  update(delta, gl, scene) {
    const t0 = (typeof performance !== 'undefined') ? performance.now() : 0
    const frameTimeMs = delta * 1000
    this._frameTimes[this._frameTimeIndex] = frameTimeMs
    this._frameTimeIndex = (this._frameTimeIndex + 1) % FPS_SAMPLE_WINDOW
    if (this._frameTimeCount < FPS_SAMPLE_WINDOW) this._frameTimeCount++
    if (this._frameTimeCount > 0) {
      let sum = 0
      for (let i = 0; i < this._frameTimeCount; i++) sum += this._frameTimes[i]
      const avgFrameTime = sum / this._frameTimeCount
      this._frameTimeMs = avgFrameTime
      this._fps = avgFrameTime > 0 ? Math.round(1000 / avgFrameTime) : 0
    }
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
    // Throttle scene.traverse to every 30 frames
    if (scene && this._rendererFrameCounter === 0) {
      let total = 0, visible = 0
      scene.traverse((obj) => {
        if (obj.isMesh || obj.isLine || obj.isPoints || obj.isInstancedMesh) {
          total++
          if (obj.visible) visible++
        }
      })
      this._totalObjects = total
      this._visibleObjects = visible
    }
    const t1 = (typeof performance !== 'undefined') ? performance.now() : 0
    this._updateTimeMs = t1 - t0
  }
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
export const PerformanceStats = new PerformanceStatsImpl()

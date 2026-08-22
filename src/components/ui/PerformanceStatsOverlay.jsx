/**
 * PerformanceStatsOverlay — overlay discreto com métricas REAIS de performance.
 *
 * Lê dados do store Zustand (perfStats) que são actualizados pelo
 * usePerformanceTracker dentro do Canvas. Sem RAF próprio, sem estimativas.
 */
import { useEffect, useState } from 'react'
import { useStore } from '../../store/useStore'

export default function PerformanceStatsOverlay() {
  // Selector estreito: só lê perfStats do store
  const perfStats = useStore((s) => s.perfStats)
  const objects = useStore((s) => s.objects)
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const [sceneWarnings, setSceneWarnings] = useState([])

  // Analisar cena para avisos (não muda por frame — só quando cena/objetos mudam)
  useEffect(() => {
    const activeScene = scenes.find((s) => s.id === activeSceneId)
    if (!activeScene) return
    import('../../utils/performanceOptimizer').then(({ analyzeScene }) => {
      setSceneWarnings(analyzeScene(activeScene, objects))
    })
  }, [scenes, activeSceneId, objects])

  // Dados do Performance Core (actualizados a cada 500ms pelo usePerformanceTracker)
  const fps = perfStats?.fps ?? 0
  const frameTimeMs = perfStats?.frameTimeMs ?? 0
  const drawCalls = perfStats?.drawCalls ?? 0
  const triangles = perfStats?.triangles ?? 0
  const totalObjects = perfStats?.totalObjects ?? 0
  const visibleObjects = perfStats?.visibleObjects ?? 0
  const state = perfStats?.state ?? '—'
  const geometries = perfStats?.geometries ?? 0
  const textures = perfStats?.textures ?? 0

  const fpsColor = fps >= 50 ? '#3fb950' : fps >= 30 ? '#d29922' : '#f85149'
  const stateColor = state === 'HEALTHY' ? '#3fb950' : state === 'WARNING' ? '#d29922' : '#f85149'

  return (
    <div className="perf-stats-overlay">
      <div className="perf-stats-line" style={{ color: fpsColor }}>
        FPS: {fps || '—'} {fps > 0 && `(${frameTimeMs.toFixed(1)}ms)`}
      </div>
      <div className="perf-stats-line">
        Objs: {visibleObjects}/{totalObjects}
      </div>
      <div className="perf-stats-line">
        Draws: {drawCalls || '—'}
      </div>
      <div className="perf-stats-line">
        Tris: {triangles ? triangles.toLocaleString() : '—'}
      </div>
      <div className="perf-stats-line" style={{ color: stateColor }}>
        State: {state}
      </div>
      <div className="perf-stats-line">
        Geos: {geometries} Tex: {textures}
      </div>
      {sceneWarnings.length > 0 && (
        <div className="perf-stats-warnings">
          {sceneWarnings.slice(0, 2).map((w, i) => (
            <div key={i} className="perf-stats-warning" style={{ color: w.level === 'error' ? '#f85149' : '#d29922' }}>{w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

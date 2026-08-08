/**
 * PerformanceStatsOverlay — overlay discreto com FPS, draw calls e objetos visíveis.
 *
 * Mostra um pequeno painel no canto superior esquerdo durante o jogo ou
 * pré-visualização. Atualiza a cada 500ms.
 */
import { useEffect, useState, useRef } from 'react'
import { useStore } from '../../store/useStore'

export default function PerformanceStatsOverlay() {
  const [stats, setStats] = useState({ fps: 0, visibleObjects: 0, totalObjects: 0, drawCalls: 0, triangles: 0 })
  const [sceneWarnings, setSceneWarnings] = useState([])
  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(performance.now())
  const objects = useStore((s) => s.objects)
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)

  useEffect(() => {
    let raf
    let overlay

    const tick = (now) => {
      frameCountRef.current++
      const delta = now - lastTimeRef.current
      if (delta >= 500) {
        const fps = Math.round((frameCountRef.current * 1000) / delta)
        frameCountRef.current = 0
        lastTimeRef.current = now

        // Contar objetos visíveis na cena ativa
        const activeScene = scenes.find((s) => s.id === activeSceneId)
        const totalObjects = (activeScene?.objects || []).length + (activeScene?.conects || []).length

        // Tentar obter draw calls do renderer three.js
        let drawCalls = 0
        let triangles = 0
        const canvas = document.querySelector('canvas')
        if (canvas) {
          // Procurar o renderer three.js no canvas
          const gl = canvas.getContext('webgl2') || canvas.getContext('webgl')
          if (gl) {
            // Não há API direta para draw calls sem o renderer three.js
            // Estimativa baseada em objetos
            drawCalls = totalObjects
            triangles = totalObjects * 200 // estimativa
          }
        }

        setStats({ fps, visibleObjects: totalObjects, totalObjects, drawCalls, triangles })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(raf)
  }, [scenes, activeSceneId])

  // Analisar cena para avisos
  useEffect(() => {
    const activeScene = scenes.find((s) => s.id === activeSceneId)
    if (!activeScene) return
    import('../../utils/performanceOptimizer').then(({ analyzeScene }) => {
      setSceneWarnings(analyzeScene(activeScene, objects))
    })
  }, [scenes, activeSceneId, objects])

  const fpsColor = stats.fps >= 50 ? '#3fb950' : stats.fps >= 30 ? '#d29922' : '#f85149'

  return (
    <div className="perf-stats-overlay">
      <div className="perf-stats-line" style={{ color: fpsColor }}>
        FPS: {stats.fps}
      </div>
      <div className="perf-stats-line">
        Objs: {stats.visibleObjects}
      </div>
      <div className="perf-stats-line">
        Draws: ~{stats.drawCalls}
      </div>
      <div className="perf-stats-line">
        Tris: ~{stats.triangles.toLocaleString()}
      </div>
      {sceneWarnings.length > 0 && (
        <div className="perf-stats-warnings">
          {sceneWarnings.slice(0, 2).map((w, i) => (
            <div key={i} className="perf-stats-warning" style={{ color: w.level === 'error' ? '#f85149' : '#d29922' }}>
              ⚠️ {w.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

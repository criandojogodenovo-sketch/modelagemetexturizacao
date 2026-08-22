/**
 * DebugOverlay — overlay de debug no Play Mode (estilo Godot).
 *
 * Mostra FPS, posição do jogador, bodies, view ativo.
 * Toggle via F3 ou botão no TopBar.
 *
 * Independente do PerformanceStatsOverlay (que é para editor).
 */
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../../store/useStore'

export default function DebugOverlay() {
  const visible = useStore((s) => s.debugOverlayVisible)
  const toggleDebugOverlay = useStore((s) => s.toggleDebugOverlay)
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const objects = useStore((s) => s.objects)
  const [fps, setFps] = useState(0)
  const [frameTime, setFrameTime] = useState(0)
  const rafRef = useRef()
  const lastTimeRef = useRef(performance.now())
  const framesRef = useRef(0)
  const fpsAccumRef = useRef(0)

  // Listener F3
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'F3') {
        e.preventDefault()
        toggleDebugOverlay()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [toggleDebugOverlay])

  // FPS counter
  useEffect(() => {
    if (!visible) return
    const tick = (now) => {
      const delta = now - lastTimeRef.current
      lastTimeRef.current = now
      framesRef.current++
      fpsAccumRef.current += delta
      if (fpsAccumRef.current >= 500) {
        const f = (framesRef.current * 1000) / fpsAccumRef.current
        setFps(f)
        setFrameTime(fpsAccumRef.current / framesRef.current)
        framesRef.current = 0
        fpsAccumRef.current = 0
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [visible])

  if (!visible) return null

  const activeScene = scenes.find((s) => s.id === activeSceneId)
  const conects = activeScene?.conects || []
  const player = conects.find((c) => c.type === 'PersonalObject')
  const view = conects.find((c) => c.type === 'ViewObject')
  const physicsBodies = conects.filter((c) => c.type === 'PhysicsBody' || c.type === 'RigidObject').length

  return (
    <div className="debug-overlay" style={{
      position: 'fixed',
      top: 50,
      right: 10,
      zIndex: 1000,
      background: 'rgba(13, 17, 23, 0.85)',
      color: '#c9d1d9',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: 11,
      padding: 8,
      borderRadius: 4,
      border: '1px solid #30363d',
      pointerEvents: 'none',
      minWidth: 220,
      backdropFilter: 'blur(8px)',
    }}>
      <div style={{ borderBottom: '1px solid #30363d', paddingBottom: 4, marginBottom: 4, fontWeight: 'bold' }}>
        DEBUG OVERLAY (F3)
      </div>
      <div>FPS: <strong style={{ color: fps > 50 ? '#3fb950' : fps > 30 ? '#d29922' : '#f85149' }}>{fps.toFixed(1)}</strong></div>
      <div>Frame: {frameTime.toFixed(2)}ms</div>
      <div style={{ borderTop: '1px solid #30363d', marginTop: 4, paddingTop: 4 }}>
        <div>Scene: <strong>{activeScene?.name || '—'}</strong></div>
        <div>Objects: {objects.length}</div>
        <div>Conects: {conects.length}</div>
        <div>Physics bodies: {physicsBodies}</div>
      </div>
      {player && (
        <div style={{ borderTop: '1px solid #30363d', marginTop: 4, paddingTop: 4 }}>
          <div>Player: <strong>{player.name || 'Player'}</strong></div>
          <div>Pos: ({player.position?.[0]?.toFixed(2) || 0}, {player.position?.[1]?.toFixed(2) || 0}, {player.position?.[2]?.toFixed(2) || 0})</div>
        </div>
      )}
      {view && (
        <div style={{ borderTop: '1px solid #30363d', marginTop: 4, paddingTop: 4 }}>
          <div>View: <strong>{view.followMode || 'none'}</strong></div>
          {view.fov && <div>FOV: {view.fov}°</div>}
        </div>
      )}
    </div>
  )
}

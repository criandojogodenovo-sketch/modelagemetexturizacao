/**
 * ScenePreview — overlay do modo de jogo (sem Canvas próprio).
 *
 * **Fase 6 (reescrito)**: O Canvas WebGL é do SceneLevel3D (modo jogo).
 * Este componente é apenas o overlay:
 *  - Splash screen "Feito com Flir Engine"
 *  - Botão Parar
 *  - GameUIOverlay
 *  - Consola de Debug
 *
 * Isto elimina o WebGL context loss.
 */
import { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { IconClose } from '../ui/Icons'
import GameSplash from '../ui/GameSplash'
import GameUIOverlay from './GameUIOverlay'
import DebugConsole from './debug/DebugConsole'

export default function ScenePreview() {
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const closeScenePreview = useStore((s) => s.closeScenePreview)
  const [showSplash, setShowSplash] = useState(true)
  const [showDebug, setShowDebug] = useState(true)

  const activeScene = scenes.find((s) => s.id === activeSceneId)

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') closeScenePreview() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeScenePreview])

  if (!activeScene) return null

  const viewConects = (activeScene.conects || []).filter((c) => c.type === 'ViewObject')
  const hasViewObject = viewConects.length > 0

  return (
    <div className="scene-preview-overlay">
      {showSplash && <GameSplash onDone={() => setShowSplash(false)} />}

      {/* Botão Parar */}
      <button
        className="preview-exit-btn"
        onClick={closeScenePreview}
        title="Parar execução e voltar ao editor (Esc)"
      >
        <IconClose width={18} height={18} />
        <span>⏹ Parar</span>
      </button>

      {/* Info bar */}
      <div className="preview-info">
        <strong>{activeScene.name}</strong>
        <span className="muted small">
          {' · '}{activeScene.objects.length} objetos
          {' · '}{activeScene.conects?.length || 0} conects
          {hasViewObject && ' · câmara ativa'}
        </span>
      </div>

      {/* UI Overlay */}
      <GameUIOverlay />

      {/* Consola de Debug */}
      {showDebug && (
        <div style={{ position: 'fixed', bottom: 0, right: 0, width: 320, maxHeight: 200, zIndex: 90, opacity: 0.9 }}>
          <DebugConsole onClose={() => setShowDebug(false)} />
        </div>
      )}
    </div>
  )
}

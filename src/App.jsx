/**
 * App — componente raiz da aplicação.
 *
 * Layout:
 *  ┌─────────────────────────────────────────────┐
 *  │              TopBar (48px)                  │
 *  ├──────────┬─────────────────────┬─────────────┤
 *  │  Left    │                     │   Right     │
 *  │  Panel   │      Viewport       │   Panel     │
 *  │  (260px) │   (Scene3D canvas)  │   (300px)   │
 *  └──────────┴─────────────────────┴─────────────┘
 *  │              Timeline (se rig ativo)        │
 *  │              BottomBar (mobile)             │
 *
 * Em desktop (>= 1024px):
 *  - Painéis laterais sempre visíveis
 *  - BottomBar escondida
 *  - Mais ferramentas via tabs no painel esquerdo
 *
 * Em mobile (< 1024px):
 *  - Painéis laterais viram drawers
 *  - BottomBar fixa em baixo com 6 ícones principais
 *  - "Mais ferramentas" abre grelha em ecrã cheia
 *  - Nenhum scroll horizontal necessário
 */
import { useEffect } from 'react'
import TopBar from './components/panels/TopBar'
import LeftPanel from './components/panels/LeftPanel'
import RightPanel from './components/panels/RightPanel'
import Viewport from './components/panels/Viewport'
import Timeline from './components/panels/Timeline'
import Toasts from './components/ui/Toasts'
import LoadingOverlay from './components/ui/LoadingOverlay'
import BottomBar from './components/ui/BottomBar'
import MoreToolsGrid from './components/ui/MoreToolsGrid'
import { useStore } from './store/useStore'

export default function App() {
  const ui = useStore((s) => s.ui)
  const closeDrawers = useStore((s) => s.closeDrawers)
  const toggleMoreTools = useStore((s) => s.toggleMoreTools)

  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const setTransformMode = useStore((s) => s.setTransformMode)
  const deleteObject = useStore((s) => s.deleteObject)
  const duplicateObject = useStore((s) => s.duplicateObject)
  const selectedId = useStore((s) => s.selectedId)
  const deselect = useStore((s) => s.deselect)

  // Estado para o loop de animação
  const animation = useStore((s) => s.animation)
  const setAnimation = useStore((s) => s.setAnimation)

  // ===== Loop de animação (requestAnimationFrame) =====
  useEffect(() => {
    if (!animation.playing) return
    let raf
    let last = performance.now()
    const tick = (now) => {
      const delta = (now - last) / 1000
      last = now
      const fps = animation.fps || 30
      const newTime = animation.currentTime + delta * fps
      if (newTime >= animation.duration) {
        if (animation.loop) {
          setAnimation({ currentTime: newTime % animation.duration })
        } else {
          setAnimation({ currentTime: animation.duration, playing: false })
        }
      } else {
        setAnimation({ currentTime: newTime })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [animation.playing, animation.currentTime, animation.duration, animation.fps, animation.loop, setAnimation])

  // ===== Atalhos de teclado globais =====
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const key = e.key.toLowerCase()
      if (e.ctrlKey || e.metaKey) {
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault()
          undo()
        }
        if ((key === 'z' && e.shiftKey) || key === 'y') {
          e.preventDefault()
          redo()
        }
        if (key === 'd' && selectedId) {
          e.preventDefault()
          duplicateObject(selectedId)
        }
        return
      }

      if (key === 'g') setTransformMode('translate')
      if (key === 'r') setTransformMode('rotate')
      if (key === 's') setTransformMode('scale')
      if (key === 'delete' || key === 'backspace') {
        if (selectedId) {
          e.preventDefault()
          deleteObject(selectedId)
        }
      }
      if (key === 'escape') {
        deselect()
        closeDrawers()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, setTransformMode, deleteObject, duplicateObject, selectedId, deselect, closeDrawers])

  return (
    <div className="app-shell">
      <TopBar />

      <div className="app-body">
        <LeftPanel open={ui.leftDrawerOpen} onClose={closeDrawers} />
        <Viewport />
        <RightPanel open={ui.rightDrawerOpen} onClose={closeDrawers} />
      </div>

      <Timeline />
      <BottomBar />

      {ui.moreToolsOpen && (
        <MoreToolsGrid onClose={toggleMoreTools} />
      )}

      <Toasts />
      <LoadingOverlay />
    </div>
  )
}

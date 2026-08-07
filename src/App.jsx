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
 *
 * Em ecrãs < 1024px, os painéis laterais viram drawers (gavetas)
 * acionados pelos botões de menu na topbar.
 */
import { useEffect } from 'react'
import TopBar from './components/panels/TopBar'
import LeftPanel from './components/panels/LeftPanel'
import RightPanel from './components/panels/RightPanel'
import Viewport from './components/panels/Viewport'
import Toasts from './components/ui/Toasts'
import LoadingOverlay from './components/ui/LoadingOverlay'
import { useStore } from './store/useStore'

export default function App() {
  const ui = useStore((s) => s.ui)
  const closeDrawers = useStore((s) => s.closeDrawers)

  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const setTransformMode = useStore((s) => s.setTransformMode)
  const deleteObject = useStore((s) => s.deleteObject)
  const duplicateObject = useStore((s) => s.duplicateObject)
  const selectedId = useStore((s) => s.selectedId)
  const deselect = useStore((s) => s.deselect)

  // Atalhos de teclado globais
  useEffect(() => {
    const handler = (e) => {
      // Ignora se estiver a escrever num input
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      const key = e.key.toLowerCase()
      if (e.ctrlKey || e.metaKey) {
        // Ctrl/Cmd+Z = undo
        if (key === 'z' && !e.shiftKey) {
          e.preventDefault()
          undo()
        }
        // Ctrl/Cmd+Shift+Z = redo (ou Ctrl+Y)
        if ((key === 'z' && e.shiftKey) || key === 'y') {
          e.preventDefault()
          redo()
        }
        // Ctrl/Cmd+D = duplicate
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

      <Toasts />
      <LoadingOverlay />
    </div>
  )
}

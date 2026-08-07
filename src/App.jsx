/**
 * App — componente raiz da aplicação.
 *
 * Layout:
 *  ┌─────────────────────────────────────────────┐
 *  │   TopBar (com seletor Modelagem/Cena)       │
 *  ├──────────┬─────────────────────┬─────────────┤
 *  │  Left    │                     │   Right     │
 *  │  Panel   │      Viewport       │   Panel     │
 *  │          │  (modelagem OU cena)│             │
 *  └──────────┴─────────────────────┴─────────────┘
 *  │              Timeline (se rig ativo)        │
 *  │              BottomBar (mobile)             │
 *
 * Em modo Modelagem: usa Scene3D + LeftPanel (tabs de ferramentas)
 * Em modo Cena: usa SceneLevel3D + SceneEditorPanel (lista de cenas + catálogo)
 *
 * ScenePreview aparece como overlay fullscreen quando scenePreviewOpen=true.
 */
import { useEffect } from 'react'
import TopBar from './components/panels/TopBar'
import LeftPanel from './components/panels/LeftPanel'
import RightPanel from './components/panels/RightPanel'
import Viewport from './components/panels/Viewport'
import Timeline from './components/panels/Timeline'
import SceneEditorPanel from './components/panels/SceneEditorPanel'
import ScenePreview from './components/panels/ScenePreview'
import SceneLevel3D from './components/3d/SceneLevel3D'
import FlirScriptEditor from './components/panels/flirscript/FlirScriptEditor'
import ConectsWindow from './components/panels/conects/ConectsWindow'
import GameExportModal from './components/panels/GameExportModal'
import Toasts from './components/ui/Toasts'
import LoadingOverlay from './components/ui/LoadingOverlay'
import BottomBar from './components/ui/BottomBar'
import MoreToolsGrid from './components/ui/MoreToolsGrid'
import OfflineIndicator from './components/ui/OfflineIndicator'
import { useStore } from './store/useStore'
import { useIndexedDBSync } from './hooks/useIndexedDBSync'

export default function App() {
  const ui = useStore((s) => s.ui)
  const closeDrawers = useStore((s) => s.closeDrawers)
  const toggleMoreTools = useStore((s) => s.toggleMoreTools)
  const appMode = useStore((s) => s.appMode)
  const scenePreviewOpen = useStore((s) => s.scenePreviewOpen)
  const conectsWindowOpen = useStore((s) => s.ui.conectsWindowOpen)
  const toggleConectsWindow = useStore((s) => s.toggleConectsWindow)
  const gameExportOpen = useStore((s) => s.gameExportOpen)
  const closeGameExport = useStore((s) => s.closeGameExport)

  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const setTransformMode = useStore((s) => s.setTransformMode)
  const deleteObject = useStore((s) => s.deleteObject)
  const duplicateObject = useStore((s) => s.duplicateObject)
  const selectedId = useStore((s) => s.selectedId)
  const deselect = useStore((s) => s.deselect)

  const animation = useStore((s) => s.animation)
  const setAnimation = useStore((s) => s.setAnimation)

  // Sincronização com IndexedDB (auto-save + restore)
  useIndexedDBSync()

  // Loop de animação
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

  // Atalhos de teclado
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      const key = e.key.toLowerCase()
      if (e.ctrlKey || e.metaKey) {
        if (key === 'z' && !e.shiftKey) { e.preventDefault(); undo() }
        if ((key === 'z' && e.shiftKey) || key === 'y') { e.preventDefault(); redo() }
        if (key === 'd' && selectedId) { e.preventDefault(); duplicateObject(selectedId) }
        return
      }
      if (key === 'g') setTransformMode('translate')
      if (key === 'r') setTransformMode('rotate')
      if (key === 's') setTransformMode('scale')
      if (key === 'delete' || key === 'backspace') {
        if (selectedId) { e.preventDefault(); deleteObject(selectedId) }
      }
      if (key === 'escape') { deselect(); closeDrawers() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, setTransformMode, deleteObject, duplicateObject, selectedId, deselect, closeDrawers])

  return (
    <div className="app-shell">
      <TopBar />
      <OfflineIndicator />

      {appMode === 'flirscript' ? (
        // Modo FlirScript: editor de nós ocupa todo o ecrã (abaixo da topbar)
        <FlirScriptEditor />
      ) : (
        <div className="app-body">
          {appMode === 'scene' ? (
            <SceneEditorPanel onClose={ui.leftDrawerOpen ? closeDrawers : null} />
          ) : (
            <LeftPanel open={ui.leftDrawerOpen} onClose={closeDrawers} />
          )}

          {appMode === 'scene' ? (
            <SceneLevel3D />
          ) : (
            <Viewport />
          )}

          <RightPanel open={ui.rightDrawerOpen} onClose={closeDrawers} />
        </div>
      )}

      <Timeline />
      <BottomBar />

      {ui.moreToolsOpen && <MoreToolsGrid onClose={toggleMoreTools} />}
      {scenePreviewOpen && <ScenePreview />}
      {conectsWindowOpen && (
        <ConectsWindow onClose={toggleConectsWindow} />
      )}
      {gameExportOpen && <GameExportModal onClose={closeGameExport} />}

      <Toasts />
      <LoadingOverlay />
    </div>
  )
}

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
import FlirCodeEditor from './components/panels/flirscript/FlirCodeEditor'
import UIEditor from './components/panels/ui-editor/UIEditor'
import ConectsWindow from './components/panels/conects/ConectsWindow'
import GameExportModal from './components/panels/GameExportModal'
import ShaderEditor from './components/panels/shader-editor/ShaderEditor'
import ProjectBrowser from './components/panels/project-browser/ProjectBrowser'
import DebugConsole from './components/panels/debug/DebugConsole'
import TerrainEditor from './components/panels/terrain/TerrainEditor'
import AnimationStudio from './components/panels/AnimationStudio'
import AnimationControllerEditor from './components/panels/AnimationControllerEditor'
import MultiplayerPanel from './components/panels/MultiplayerPanel'
import PostProcessingPanel from './components/panels/PostProcessingPanel'
import BuildersPanel from './components/panels/BuildersPanel'
import UVEditor from './components/panels/UVEditor'
import PerformanceStatsOverlay from './components/ui/PerformanceStatsOverlay'
import MainMenu from './components/ui/MainMenu'
import HomePage from './components/home/HomePage'
import Toasts from './components/ui/Toasts'
import LoadingOverlay from './components/ui/LoadingOverlay'
import BottomBar from './components/ui/BottomBar'
import MoreToolsGrid from './components/ui/MoreToolsGrid'
import OfflineIndicator from './components/ui/OfflineIndicator'
import SnappingControls from './components/ui/SnappingControls'
import AutosaveIndicator from './components/ui/AutosaveIndicator'
import DebugOverlay from './components/ui/DebugOverlay'
import HotkeyToolbar from './components/ui/HotkeyToolbar'
import { useStore } from './store/useStore'
import { useIndexedDBSync } from './hooks/useIndexedDBSync'
import { useAutosave } from './hooks/useAutosave'

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
  const uiEditorOpen = useStore((s) => s.uiEditorOpen)
  const closeUIEditor = useStore((s) => s.closeUIEditor)
  const shaderEditorOpen = useStore((s) => s.shaderEditorOpen)
  const closeShaderEditor = useStore((s) => s.closeShaderEditor)
  const projectBrowserOpen = useStore((s) => s.projectBrowserOpen)
  const closeProjectBrowser = useStore((s) => s.closeProjectBrowser)
  const debugConsoleOpen = useStore((s) => s.debugConsoleOpen)
  const closeDebugConsole = useStore((s) => s.closeDebugConsole)
  const animControllerTarget = useStore((s) => s.animControllerTarget)
  const closeAnimController = useStore((s) => s.closeAnimController)
  const mainMenuOpen = useStore((s) => s.mainMenuOpen)
  const closeMainMenu = useStore((s) => s.closeMainMenu)
  const terrainEditorOpen = useStore((s) => s.terrainEditorOpen)
  const closeTerrainEditor = useStore((s) => s.closeTerrainEditor)
  const animStudioOpen = useStore((s) => s.animStudioOpen)
  const closeAnimStudio = useStore((s) => s.closeAnimStudio)
  const multiplayerPanelOpen = useStore((s) => s.multiplayerPanelOpen)
  const closeMultiplayerPanel = useStore((s) => s.closeMultiplayerPanel)
  const perfStatsVisible = useStore((s) => s.perfStatsVisible)
  const postProcessingOpen = useStore((s) => s.postProcessingOpen)
  const closePostProcessing = useStore((s) => s.closePostProcessing)
  const buildersPanelOpen = useStore((s) => s.buildersPanelOpen)
  const closeBuildersPanel = useStore((s) => s.closeBuildersPanel)
  const uvEditorOpen = useStore((s) => s.uvEditorOpen)
  const closeUVEditor = useStore((s) => s.closeUVEditor)
  const homeVisible = useStore((s) => s.homeVisible)
  const hideHome = useStore((s) => s.hideHome)

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
  // Autosave inteligente (ItsMagic-style) — dirty flag + save a cada 5s
  useAutosave()

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
    <div className={`app-shell ${scenePreviewOpen ? 'game-mode' : ''}`}>
      {homeVisible && <HomePage onOpenProject={hideHome} />}
      {!scenePreviewOpen && <TopBar />}
      <OfflineIndicator />

      {appMode === 'flirscript' ? (
        <FlirCodeEditor />
      ) : appMode === 'ui' ? (
        <UIEditor />
      ) : (
        // app-body: SEMPRE montado (o SceneLevel3D funciona em modo editor ou jogo)
        <div className="app-body">
          {appMode === 'scene' ? (
            <SceneEditorPanel onClose={ui.leftDrawerOpen ? closeDrawers : null} />
          ) : (
            <LeftPanel open={ui.leftDrawerOpen} onClose={closeDrawers} />
          )}

          {appMode === 'scene' ? <SceneLevel3D /> : <Viewport />}

          <RightPanel open={ui.rightDrawerOpen} onClose={closeDrawers} />
        </div>
      )}

      <Timeline />
      {!scenePreviewOpen && <BottomBar />}

      {ui.moreToolsOpen && <MoreToolsGrid onClose={toggleMoreTools} />}
      {scenePreviewOpen && <ScenePreview />}
      {conectsWindowOpen && (
        <ConectsWindow onClose={toggleConectsWindow} />
      )}
      {gameExportOpen && <GameExportModal onClose={closeGameExport} />}
      {uiEditorOpen && <UIEditor onClose={closeUIEditor} />}
      {shaderEditorOpen && <ShaderEditor onClose={closeShaderEditor} />}
      {projectBrowserOpen && <ProjectBrowser onClose={closeProjectBrowser} />}
      {debugConsoleOpen && <DebugConsole onClose={closeDebugConsole} />}
      {terrainEditorOpen && <TerrainEditor onClose={closeTerrainEditor} />}
      {animStudioOpen && <AnimationStudio onClose={closeAnimStudio} />}
      {multiplayerPanelOpen && <MultiplayerPanel onClose={closeMultiplayerPanel} />}
      {postProcessingOpen && <PostProcessingPanel onClose={closePostProcessing} />}
      {buildersPanelOpen && <BuildersPanel open={buildersPanelOpen} onClose={closeBuildersPanel} />}
      {uvEditorOpen && <UVEditor objectId={selectedId} onClose={closeUVEditor} />}
      {perfStatsVisible && <PerformanceStatsOverlay />}
      {animControllerTarget && (
        <div className="modal-backdrop" onClick={closeAnimController}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <AnimationControllerEditor
              onClose={closeAnimController}
              targetConectId={animControllerTarget}
            />
          </div>
        </div>
      )}
      {mainMenuOpen && <MainMenu onClose={closeMainMenu} />}

      <Toasts />
      <LoadingOverlay />
      <HotkeyToolbar />
      <DebugOverlay />
    </div>
  )
}

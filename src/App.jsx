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
import MarketplacePanel from './components/panels/MarketplacePanel'
import InstancingPanel from './components/panels/InstancingPanel'
import SettingsPanel from './components/panels/SettingsPanel'
import BuildersPanel from './components/panels/BuildersPanel'
import MechanicsPanel from './components/panels/MechanicsPanel'
import DialoguePanel from './components/panels/DialoguePanel'
import UVEditor from './components/panels/UVEditor'
import TexturingPanel from './components/panels/TexturingPanel'
import LayersPanel from './components/panels/LayersPanel'
import PerformanceStatsOverlay from './components/ui/PerformanceStatsOverlay'
import MainMenu from './components/ui/MainMenu'
import VerticalRail from './components/ui/VerticalRail'
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
import ErrorBoundary from './components/ui/ErrorBoundary'
import { useStore } from './store/useStore'
import { useIndexedDBSync } from './hooks/useIndexedDBSync'
import { useAutosave } from './hooks/useAutosave'

export default function App() {
  const ui = useStore((s) => s.ui)
  const closeDrawers = useStore((s) => s.closeDrawers)
  const toggleMoreTools = useStore((s) => s.toggleMoreTools)
  const appMode = useStore((s) => s.appMode)
  const scenePreviewOpen = useStore((s) => s.scenePreviewOpen)
  const closeScenePreview = useStore((s) => s.closeScenePreview)
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
  const marketplaceOpen = useStore((s) => s.marketplaceOpen)
  const closeMarketplace = useStore((s) => s.closeMarketplace)
  const instancingPanelOpen = useStore((s) => s.instancingPanelOpen)
  const closeInstancingPanel = useStore((s) => s.closeInstancingPanel)
  const settingsPanelOpen = useStore((s) => s.settingsPanelOpen)
  const closeSettingsPanel = useStore((s) => s.closeSettingsPanel)
  const buildersPanelOpen = useStore((s) => s.buildersPanelOpen)
  const closeBuildersPanel = useStore((s) => s.closeBuildersPanel)
  const mechanicsPanelOpen = useStore((s) => s.mechanicsPanelOpen)
  const closeMechanicsPanel = useStore((s) => s.closeMechanicsPanel)
  const dialoguePanelOpen = useStore((s) => s.dialoguePanelOpen)
  const closeDialoguePanel = useStore((s) => s.closeDialoguePanel)
  const uvEditorOpen = useStore((s) => s.uvEditorOpen)
  const closeUVEditor = useStore((s) => s.closeUVEditor)
  const texturingPanelOpen = useStore((s) => s.texturingPanelOpen)
  const closeTexturingPanel = useStore((s) => s.closeTexturingPanel)
  const layersPanelOpen = useStore((s) => s.layersPanelOpen)
  const closeLayersPanel = useStore((s) => s.closeLayersPanel)
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
      // Em modo jogo, WASD/Space/etc. são para o jogador — não ativar atalhos do editor
      if (scenePreviewOpen) {
        if (key === 'escape') { closeScenePreview() }
        return
      }
      if (key === 'g') setTransformMode('translate')
      if (key === 'r') setTransformMode('rotate')
      if (key === 's') setTransformMode('scale')
      // S17 (P2-24): atalhos 1-5 alternam a visibilidade das layers (estilo Godot)
      // Só no modo Cena — 1=Mundo, 2=Gameplay, 3=UI, 4=Efeitos, 5=Áudio
      if (['1', '2', '3', '4', '5'].includes(key) && appMode === 'scene') {
        const layerKeys = ['world', 'gameplay', 'ui', 'effects', 'audio']
        const layerName = layerKeys[Number(key) - 1]
        const st = useStore.getState()
        st.toggleLayerVisibility(layerName)
        const layerLabels = { world: 'Mundo', gameplay: 'Gameplay', ui: 'UI', effects: 'Efeitos', audio: 'Áudio' }
        const nowHidden = !st.hiddenLayers.includes(layerName)
        st.toast(`Layer ${layerLabels[layerName]} ${nowHidden ? 'oculta' : 'visível'}`, 'info', 1200)
      }
      if (key === 'delete' || key === 'backspace') {
        if (selectedId) { e.preventDefault(); deleteObject(selectedId) }
      }
      if (key === 'escape') { deselect(); closeDrawers() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [undo, redo, setTransformMode, deleteObject, duplicateObject, selectedId, deselect, closeDrawers, scenePreviewOpen, closeScenePreview, appMode])

  return (
    <div className={`app-shell ${scenePreviewOpen ? 'game-mode' : ''}`}>
      {homeVisible && <HomePage onOpenProject={hideHome} />}
      {!scenePreviewOpen && <TopBar />}
      {!scenePreviewOpen && appMode !== 'flirscript' && appMode !== 'ui' && <VerticalRail />}
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
      {marketplaceOpen && <MarketplacePanel onClose={closeMarketplace} />}
      {instancingPanelOpen && <InstancingPanel onClose={closeInstancingPanel} />}
      {settingsPanelOpen && <SettingsPanel onClose={closeSettingsPanel} />}
      {buildersPanelOpen && <BuildersPanel onClose={closeBuildersPanel} />}
      {mechanicsPanelOpen && <MechanicsPanel onClose={closeMechanicsPanel} />}
      {dialoguePanelOpen && <DialoguePanel onClose={closeDialoguePanel} />}
      {uvEditorOpen && <UVEditor objectId={selectedId} onClose={closeUVEditor} />}
      {texturingPanelOpen && <TexturingPanel onClose={closeTexturingPanel} />}
      {layersPanelOpen && <LayersPanel onClose={closeLayersPanel} />}
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

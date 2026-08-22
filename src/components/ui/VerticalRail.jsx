/**
 * VerticalRail — rail de ícones vertical fino (~44px) do lado esquerdo.
 *
 * Substitui a barra horizontal de tabs do LeftPanel por um rail sempre visível.
 * Ao tocar num ícone, abre o painel largo ao lado com o conteúdo da secção.
 *
 * Inspirado em editores profissionais (Unreal, Unity, Blender):
 *  - Rail fino só com ícones (sem texto)
 *  - Painel largo ao lado com conteúdo da secção ativa
 *  - Ícone ativo destacado em azul
 *  - Sempre visível (não é drawer)
 *
 * Secções:
 *  - Modelagem (cubo)
 *  - Cena (layers)
 *  - UI (smartphone)
 *  - Construtores (package)
 *  - Conects (puzzle)
 *  - Shader (palette)
 *  - Animação (film)
 *  - Terreno (mountain)
 *  - Menu (menu) — abre menu principal
 */
import { useStore } from '../../store/useStore'
import { Icon } from '../ui/iconMap'

const RAIL_SECTIONS = [
  { id: 'modeling', icon: 'cube', label: 'Modelagem', mode: 'modeling' },
  { id: 'scene', icon: 'layers', label: 'Cena', mode: 'scene' },
  { id: 'ui', icon: 'smartphone', label: 'UI', mode: 'ui' },
  { id: 'flirscript', icon: 'puzzle', label: 'FlirScript', mode: 'flirscript' },
]

const RAIL_TOOLS = [
  { id: 'conects', icon: 'puzzle', label: 'Conects', action: 'toggleConectsWindow' },
  { id: 'builders', icon: 'package', label: 'Construtores', action: 'openBuilders' },
  { id: 'mechanics', icon: 'target', label: 'Mecânicas', action: 'openMechanics' },
  { id: 'dialogue', icon: 'message-circle', label: 'Diálogos', action: 'openDialogue' },
  { id: 'shader', icon: 'palette', label: 'Shader', action: 'openShaderEditor' },
  { id: 'animation', icon: 'film', label: 'Animação', action: 'openAnimStudio' },
  { id: 'terrain', icon: 'mountain', label: 'Terreno', action: 'openTerrainEditor' },
  { id: 'instancing', icon: 'boxes', label: 'Instancing (GPU)', action: 'openInstancingPanel' },
  { id: 'marketplace', icon: 'package', label: 'Marketplace', action: 'openMarketplace' },
]

const RAIL_BOTTOM = [
  { id: 'menu', icon: 'menu', label: 'Menu', action: 'toggleMainMenu' },
  { id: 'settings', icon: 'settings', label: 'Config', action: 'openSettingsPanel' },
]

export default function VerticalRail() {
  const appMode = useStore((s) => s.appMode)
  const setAppMode = useStore((s) => s.setAppMode)
  const toggleConectsWindow = useStore((s) => s.toggleConectsWindow)
  const openShaderEditor = useStore((s) => s.openShaderEditor)
  const openTerrainEditor = useStore((s) => s.openTerrainEditor)
  const openAnimStudio = useStore((s) => s.openAnimStudio)
  const openMarketplace = useStore((s) => s.openMarketplace)
  const openInstancingPanel = useStore((s) => s.openInstancingPanel)
  const toggleMainMenu = useStore((s) => s.toggleMainMenu)
  const toggleLeftDrawer = useStore((s) => s.toggleLeftDrawer)

  const handleSection = (section) => {
    if (section.mode) {
      setAppMode(section.mode)
      // Abrir painel esquerdo ao mudar de modo
      if (section.mode === 'modeling' || section.mode === 'scene') {
        const state = useStore.getState()
        if (!state.ui.leftDrawerOpen) toggleLeftDrawer()
      }
    }
  }

  const handleTool = (tool) => {
    switch (tool.action) {
      case 'toggleConectsWindow': toggleConectsWindow(); break
      case 'openShaderEditor': openShaderEditor(); break
      case 'openTerrainEditor': openTerrainEditor(); break
      case 'openAnimStudio': openAnimStudio(); break
      case 'openMarketplace': openMarketplace(); break
      case 'openInstancingPanel': openInstancingPanel(); break
      case 'toggleMainMenu': toggleMainMenu(); break
      case 'openSettingsPanel': toggleMainMenu(); break
      case 'openBuilders':
        // Fase 2 — Abrir painel de Construtores Profissionais
        useStore.getState().openBuildersPanel()
        break
      case 'openMechanics':
        // Fase 6 — Abrir painel de Mecânicas
        useStore.getState().openMechanicsPanel()
        break
      case 'openDialogue':
        // Fase 8 — Abrir painel de Diálogos
        useStore.getState().openDialoguePanel()
        break
    }
  }

  return (
    <nav className="vertical-rail" aria-label="Navegação principal">
      {/* Secções principais (modos) */}
      <div className="rail-section">
        {RAIL_SECTIONS.map((section) => (
          <button
            key={section.id}
            className={`rail-btn ${appMode === section.mode ? 'active' : ''}`}
            onClick={() => handleSection(section)}
            title={section.label}
            aria-label={section.label}
            aria-pressed={appMode === section.mode}
          >
            <Icon name={section.icon} size={18} />
          </button>
        ))}
      </div>

      {/* Ferramentas (abrem painéis/popups) */}
      <div className="rail-section">
        {RAIL_TOOLS.map((tool) => (
          <button
            key={tool.id}
            className="rail-btn"
            onClick={() => handleTool(tool)}
            title={tool.label}
            aria-label={tool.label}
          >
            <Icon name={tool.icon} size={18} />
          </button>
        ))}
      </div>

      {/* Bottom (menu + settings) */}
      <div className="rail-section rail-bottom">
        {RAIL_BOTTOM.map((item) => (
          <button
            key={item.id}
            className="rail-btn"
            onClick={() => handleTool(item)}
            title={item.label}
            aria-label={item.label}
          >
            <Icon name={item.icon} size={18} />
          </button>
        ))}
      </div>
    </nav>
  )
}

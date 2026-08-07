/**
 * AppModeSwitch — seletor no topo para alternar entre Modo Modelagem e Modo Cena.
 *
 * Modo Modelagem: editar objetos individuais (primitivas, edit, sculpt, etc.)
 * Modo Cena: montar o nível com os objetos criados (level editor)
 */
import { useStore } from '../../store/useStore'

export default function AppModeSwitch() {
  const appMode = useStore((s) => s.appMode)
  const setAppMode = useStore((s) => s.setAppMode)

  return (
    <div className="app-mode-switch" role="tablist" aria-label="Modo de edição">
      <button
        role="tab"
        aria-selected={appMode === 'modeling'}
        className={appMode === 'modeling' ? 'active' : ''}
        onClick={() => setAppMode('modeling')}
        title="Editar objetos individuais"
      >
        Modelagem
      </button>
      <button
        role="tab"
        aria-selected={appMode === 'scene'}
        className={appMode === 'scene' ? 'active' : ''}
        onClick={() => setAppMode('scene')}
        title="Montar o nível com os objetos"
      >
        Cena
      </button>
    </div>
  )
}

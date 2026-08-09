/**
 * AppModeSwitch — seletor no topo: Modelagem | Cena | UI
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
      <button
        role="tab"
        aria-selected={appMode === 'ui'}
        className={appMode === 'ui' ? 'active' : ''}
        onClick={() => setAppMode('ui')}
        title="Editor de Interface (UI)"
      >
        UI
      </button>
      <button
        role="tab"
        aria-selected={appMode === 'builders'}
        className={appMode === 'builders' ? 'active' : ''}
        onClick={() => setAppMode('builders')}
        title="Construtores procedurais (edifícios, veículos)"
      >
        Construtores
      </button>
    </div>
  )
}

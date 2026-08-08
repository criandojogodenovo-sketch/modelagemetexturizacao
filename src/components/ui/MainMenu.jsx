/**
 * MainMenu — menu principal com acesso a todas as janelas da engine.
 *
 * Botões para abrir:
 *  - Editor de UI
 *  - Editor de Shaders
 *  - Explorador de Projeto
 *  - Consola de Debug
 *  - Exportar Jogo
 *  - Conects
 *
 * Em mobile, abre como drawer; em desktop, dropdown.
 */
import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { IconClose } from '../ui/Icons'

export default function MainMenu({ onClose }) {
  const openUIEditor = useStore((s) => s.openUIEditor)
  const openShaderEditor = useStore((s) => s.openShaderEditor)
  const openProjectBrowser = useStore((s) => s.openProjectBrowser)
  const openDebugConsole = useStore((s) => s.openDebugConsole)
  const openGameExport = useStore((s) => s.openGameExport)
  const toggleConectsWindow = useStore((s) => s.toggleConectsWindow)
  const openMultiplayerPanel = useStore((s) => s.openMultiplayerPanel)
  const togglePerfStats = useStore((s) => s.togglePerfStats)
  const openPostProcessing = useStore((s) => s.openPostProcessing)
  const openClassesPanel = useStore((s) => s.openClassesPanel)

  const handle = (fn) => () => {
    fn()
    if (onClose) onClose()
  }

  return (
    <>
      {onClose && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`main-menu ${onClose ? 'open' : ''}`}>
        <div className="panel-header">
          <span>📋 Menu Principal</span>
          {onClose && (
            <button className="icon" onClick={onClose} title="Fechar">
              <IconClose width={14} height={14} />
            </button>
          )}
        </div>
        <div className="main-menu-body">
          <button className="mm-item" onClick={handle(toggleConectsWindow)}>
            <span className="mm-icon">🧩</span>
            <div>
              <div className="mm-label">Conects</div>
              <div className="mm-desc small muted">Adicionar objetos com física, visual, UI...</div>
            </div>
          </button>
          <button className="mm-item" onClick={handle(openUIEditor)}>
            <span className="mm-icon">📱</span>
            <div>
              <div className="mm-label">Editor de UI</div>
              <div className="mm-desc small muted">Botões, texto, imagens, ancoragem, camadas</div>
            </div>
          </button>
          <button className="mm-item" onClick={handle(openShaderEditor)}>
            <span className="mm-icon">🌈</span>
            <div>
              <div className="mm-label">Editor de Shaders</div>
              <div className="mm-desc small muted">Shaders visuais ou GLSL, biblioteca pronta</div>
            </div>
          </button>
          <button className="mm-item" onClick={handle(openProjectBrowser)}>
            <span className="mm-icon">📁</span>
            <div>
              <div className="mm-label">Explorador de Projeto</div>
              <div className="mm-desc small muted">Modelos, texturas, materiais, cenas...</div>
            </div>
          </button>
          <button className="mm-item" onClick={handle(openDebugConsole)}>
            <span className="mm-icon">🐛</span>
            <div>
              <div className="mm-label">Consola de Debug</div>
              <div className="mm-desc small muted">Erros, avisos e logs durante o jogo</div>
            </div>
          </button>
          <div className="mm-divider" />
          {/* Fase 5: Multiplayer + Performance */}
          <button className="mm-item" onClick={handle(openMultiplayerPanel)}>
            <span className="mm-icon">🌐</span>
            <div>
              <div className="mm-label">Multiplayer</div>
              <div className="mm-desc small muted">Criar/entrar em salas, jogar com outros</div>
            </div>
          </button>
          <button className="mm-item" onClick={handle(togglePerfStats)}>
            <span className="mm-icon">📊</span>
            <div>
              <div className="mm-label">Estatísticas (FPS)</div>
              <div className="mm-desc small muted">FPS, draw calls, objetos, avisos</div>
            </div>
          </button>
          <button className="mm-item" onClick={handle(openPostProcessing)}>
            <span className="mm-icon">🎨</span>
            <div>
              <div className="mm-label">Pós-Processamento</div>
              <div className="mm-desc small muted">Bloom, SSAO, Depth of Field, Color Grading</div>
            </div>
          </button>
          <button className="mm-item" onClick={handle(openClassesPanel)}>
            <span className="mm-icon">📚</span>
            <div>
              <div className="mm-label">Classes FlirCode</div>
              <div className="mm-desc small muted">Classes reutilizáveis com herança</div>
            </div>
          </button>
          <div className="mm-divider" />
          <button className="mm-item primary" onClick={handle(openGameExport)}>
            <span className="mm-icon">🎮</span>
            <div>
              <div className="mm-label">Exportar Jogo</div>
              <div className="mm-desc small muted">HTML standalone + APK Android</div>
            </div>
          </button>
        </div>
      </aside>
    </>
  )
}

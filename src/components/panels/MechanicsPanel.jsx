/**
 * MechanicsPanel — painel dedicado a configurar mecânicas de jogo.
 *
 * Fase 6 — Aba Mecânicas.
 *
 * Reune o que já existe (armas, inventário, GameState, saveProgress) numa
 * interface própria, com assistentes passo-a-passo para mecânicas comuns:
 *  - "Criar sistema de vida"
 *  - "Criar sistema de pontuação"
 *  - "Criar checkpoint"
 *
 * Acesso: VerticalRail → "Mecânicas" (abre este painel)
 */
import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { IconClose } from '../ui/Icons'

const MECHANIC_WIZARDS = [
  {
    id: 'health',
    icon: '❤️',
    label: 'Sistema de Vida',
    description: 'Cria health bar + dano + regeneração opcional',
    steps: [
      'Adiciona GameStateObject "Health" à cena',
      'Define variável _player_health = 100',
      'Adiciona FlirCode para takeDamage e regeneração',
    ],
  },
  {
    id: 'score',
    icon: '🏆',
    label: 'Sistema de Pontuação',
    description: 'Cria score display + pontos por evento',
    steps: [
      'Adiciona TextObject "Score: 0" à cena',
      'Define variável _score = 0 no GameState',
      'Adiciona FlirCode para addScore e display',
    ],
  },
  {
    id: 'checkpoint',
    icon: '🏁',
    label: 'Sistema de Checkpoint',
    description: 'Cria checkpoints que salvam progressão',
    steps: [
      'Adiciona CheckpointObject à cena',
      'Configura FlirCode para teleportar player ao último checkpoint',
      'Salva progressão em localStorage',
    ],
  },
  {
    id: 'inventory',
    icon: '🎒',
    label: 'Sistema de Inventário',
    description: 'Cria inventário com items coleccionáveis',
    steps: [
      'Adiciona ItemObjects à cena (coleccionáveis)',
      'Configura autoPickup no ItemObject',
      'gameContext.addToInventory é chamado automaticamente',
    ],
  },
  {
    id: 'weapon',
    icon: '🔫',
    label: 'Sistema de Armas',
    description: 'Cria arma com munições e disparo',
    steps: [
      'Adiciona WeaponObject à cena (configura dano, munições, fireRate)',
      'Adiciona ViewObject com followMode=first para FPS',
      'FlirCode: shoot() dispara raycast, reload() recarrega',
    ],
  },
  {
    id: 'gameState',
    icon: '📊',
    label: 'Game State Manager',
    description: 'Cria gestor de estado (menu/playing/paused/gameOver)',
    steps: [
      'Adiciona GameStateObject à cena',
      'Define _gameState = "menu" no start',
      'FlirCode: setGameState("playing") inicia o jogo',
    ],
  },
]

export default function MechanicsPanel({ onClose }) {
  const [selectedWizard, setSelectedWizard] = useState(null)
  const [step, setStep] = useState(0)

  const handleExecute = () => {
    const state = useStore.getState()
    if (!state.activeSceneId) {
      state.toast('Crie uma cena primeiro', 'error')
      return
    }

    switch (selectedWizard) {
      case 'health':
        // Adicionar GameStateObject para saúde
        state.addConectToScene('GameStateObject', [0, 5, 0])
        state.toast('Sistema de Vida criado! Configure _player_health no FlirCode.', 'success', 2000)
        break
      case 'score':
        // Adicionar TextObject para score
        state.addConectToScene('TextObject', [0, 8, 0])
        state.toast('Sistema de Pontuação criado! Configure _score no FlirCode.', 'success', 2000)
        break
      case 'checkpoint':
        // Adicionar CheckpointObject
        state.addConectToScene('CheckpointObject', [0, 1, 0])
        state.toast('Sistema de Checkpoint criado! Adicione mais checkpoints conforme necessário.', 'success', 2000)
        break
      case 'inventory':
        // Adicionar ItemObject de exemplo
        state.addConectToScene('ItemObject', [2, 1, 0])
        state.toast('Sistema de Inventário criado! ItemObject tem autoPickup por defeito.', 'success', 2000)
        break
      case 'weapon':
        // Adicionar WeaponObject + ViewObject FPS
        state.addConectToScene('WeaponObject', [0, 1.5, 0])
        const view = state.addConectToScene('ViewObject', [5, 4, 6])
        if (view) {
          state.updateConect(view.instanceId, {
            followMode: 'first',
            cameraRole: 'player',
            fov: 75,
          })
        }
        state.toast('Sistema de Armas criado! WeaponObject + ViewObject FPS configurados.', 'success', 2000)
        break
      case 'gameState':
        // Adicionar GameStateObject
        state.addConectToScene('GameStateObject', [0, 3, 0])
        state.toast('Game State Manager criado! Use setGameState("menu"/"playing"/"paused"/"gameOver") no FlirCode.', 'success', 2000)
        break
    }

    onClose()
  }

  const wizard = MECHANIC_WIZARDS.find(w => w.id === selectedWizard)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 500, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>🎯 Mecânicas de Jogo</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
            <IconClose />
          </button>
        </div>

        {!selectedWizard ? (
          // Lista de assistentes
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {MECHANIC_WIZARDS.map(w => (
              <button
                key={w.id}
                onClick={() => { setSelectedWizard(w.id); setStep(0) }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '14px 8px',
                  background: 'var(--bg-tertiary, #161b22)',
                  border: '1px solid var(--border, #30363d)',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  color: 'var(--text, #e6edf3)',
                  fontSize: '13px',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2f81f7' }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border, #30363d)' }}
              >
                <span style={{ fontSize: '28px' }}>{w.icon}</span>
                <div style={{ fontWeight: 600 }}>{w.label}</div>
                <div style={{ fontSize: '10px', opacity: 0.6, textAlign: 'center', lineHeight: '1.3' }}>
                  {w.description}
                </div>
              </button>
            ))}
          </div>
        ) : (
          // Assistente passo-a-passo
          <div>
            <button
              onClick={() => setSelectedWizard(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#2f81f7', marginBottom: '12px', fontSize: '13px' }}
            >
              ← Voltar à lista
            </button>

            <h3 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
              {wizard.icon} {wizard.label}
            </h3>

            <div style={{ marginBottom: '16px' }}>
              {wizard.steps.map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '8px 12px',
                    marginBottom: '6px',
                    background: i <= step ? 'rgba(63, 185, 80, 0.1)' : 'var(--bg-tertiary, #161b22)',
                    border: '1px solid',
                    borderColor: i <= step ? '#3fb950' : 'var(--border, #30363d)',
                    borderRadius: '6px',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ fontWeight: 700, color: i <= step ? '#3fb950' : 'var(--text, #e6edf3)' }}>
                    {i + 1}.
                  </span>
                  <span>{s}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              {step < wizard.steps.length - 1 && (
                <button
                  onClick={() => setStep(step + 1)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    background: 'var(--bg-tertiary, #161b22)',
                    border: '1px solid var(--border, #30363d)',
                    borderRadius: '6px',
                    color: 'var(--text, #e6edf3)',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  Próximo passo →
                </button>
              )}
              <button
                onClick={handleExecute}
                style={{
                  flex: 1,
                  padding: '8px',
                  background: '#2f81f7',
                  border: 'none',
                  borderRadius: '6px',
                  color: '#fff',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                Criar Mecânica
              </button>
            </div>

            <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '12px', lineHeight: '1.4' }}>
              Nota: Os Conects são adicionados à cena ativa. Configure o FlirCode no ConectPropertiesPanel
              para implementar a lógica completa (dano, score, teleport, etc.).
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

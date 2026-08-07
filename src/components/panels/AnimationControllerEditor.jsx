/**
 * AnimationControllerEditor — editor visual de máquina de estados de animação.
 *
 * Mostra estados como nós e transições como setas com condições.
 * Permite adicionar/remover estados e configurar transições.
 *
 * Consistente com o estilo do FlirScript (dark mode, gaveta, sem scroll horizontal).
 */
import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { defaultAnimationController } from '../../utils/conects/animationController'
import { IconClose, IconPlus, IconTrash } from '../ui/Icons'

export default function AnimationControllerEditor({ onClose, targetConectId }) {
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const updateConect = useStore((s) => s.updateConect)
  const toast = useStore((s) => s.toast)

  const scene = scenes.find((s) => s.id === activeSceneId)
  const conect = scene?.conects?.find((c) => c.instanceId === targetConectId)

  const controller = conect?.animationController || defaultAnimationController()
  const states = controller.states || []
  const transitions = controller.transitions || []

  const [selectedState, setSelectedState] = useState(null)

  const saveController = (newController) => {
    updateConect(targetConectId, { animationController: newController })
  }

  const addState = () => {
    const newState = {
      id: `state_${Date.now()}`,
      name: `Estado ${states.length + 1}`,
      clip: 'idle',
      isDefault: states.length === 0,
    }
    saveController({
      ...controller,
      states: [...states, newState],
    })
  }

  const removeState = (stateId) => {
    saveController({
      ...controller,
      states: states.filter((s) => s.id !== stateId),
      transitions: transitions.filter((t) => t.from !== stateId && t.to !== stateId),
    })
  }

  const addTransition = (fromId, toId, condition) => {
    saveController({
      ...controller,
      transitions: [...transitions, { from: fromId, to: toId, condition: condition || 'speed>0', duration: 0.2 }],
    })
  }

  const updateTransition = (idx, patch) => {
    const newTransitions = [...transitions]
    newTransitions[idx] = { ...newTransitions[idx], ...patch }
    saveController({ ...controller, transitions: newTransitions })
  }

  const removeTransition = (idx) => {
    saveController({
      ...controller,
      transitions: transitions.filter((_, i) => i !== idx),
    })
  }

  if (!conect) {
    return (
      <div className="empty-state">
        <div>Nenhum Conect selecionado.</div>
        <div className="small mt-2">Seleciona um PersonalObject ou NpcObject.</div>
      </div>
    )
  }

  return (
    <>
      {onClose && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`anim-controller-editor ${onClose ? 'open' : ''}`}>
        <div className="panel-header">
          <span>🏃 Controlador de Animação</span>
          {onClose && (
            <button className="icon" onClick={onClose} title="Fechar">
              <IconClose width={14} height={14} />
            </button>
          )}
        </div>

        <div className="anim-editor-body">
          <div className="small muted mb-2">
            Conect: <strong>{conect.name}</strong> ({conect.type})
          </div>

          {/* Estados */}
          <div className="panel-section">
            <div className="row between">
              <h4 style={{ margin: 0 }}>Estados ({states.length})</h4>
              <button onClick={addState} title="Adicionar estado">
                <IconPlus width={12} height={12} /> Estado
              </button>
            </div>
            <div className="anim-states-list">
              {states.map((state) => (
                <div
                  key={state.id}
                  className={`anim-state ${selectedState === state.id ? 'selected' : ''}`}
                  onClick={() => setSelectedState(state.id)}
                >
                  <span className="anim-state-name">{state.name}</span>
                  {state.isDefault && <span className="tag accent">padrão</span>}
                  <span className="small muted">clip: {state.clip}</span>
                  <button
                    className="danger icon"
                    style={{ padding: '2px 4px' }}
                    onClick={(e) => { e.stopPropagation(); removeState(state.id) }}
                  >
                    <IconTrash width={11} height={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Transições */}
          <div className="panel-section">
            <h4>Transições ({transitions.length})</h4>
            {transitions.length === 0 ? (
              <div className="empty-state small">Sem transições. Adiciona abaixo.</div>
            ) : (
              <div className="anim-transitions-list">
                {transitions.map((t, idx) => {
                  const fromState = states.find((s) => s.id === t.from)
                  const toState = states.find((s) => s.id === t.to)
                  return (
                    <div key={idx} className="anim-transition">
                      <select
                        value={t.from}
                        onChange={(e) => updateTransition(idx, { from: e.target.value })}
                        style={{ flex: 1 }}
                      >
                        {states.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <span title="Condição">→</span>
                      <select
                        value={t.to}
                        onChange={(e) => updateTransition(idx, { to: e.target.value })}
                        style={{ flex: 1 }}
                      >
                        {states.map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={t.condition}
                        onChange={(e) => updateTransition(idx, { condition: e.target.value })}
                        placeholder="speed>0"
                        style={{ flex: 1, fontSize: 10 }}
                      />
                      <button
                        className="danger icon"
                        style={{ padding: '2px 4px' }}
                        onClick={() => removeTransition(idx)}
                      >
                        <IconTrash width={11} height={11} />
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
            <button
              onClick={() => states.length >= 2 && addTransition(states[0].id, states[1].id, 'speed>0')}
              disabled={states.length < 2}
              style={{ width: '100%', marginTop: 8 }}
            >
              <IconPlus width={12} height={12} /> Adicionar Transição
            </button>
          </div>

          {/* Condições suportadas */}
          <div className="panel-section">
            <h4>Condições Suportadas</h4>
            <div className="small muted">
              <div><code>speed&gt;X</code> / <code>speed&lt;X</code> — velocidade do objeto</div>
              <div><code>grounded==true/false</code> — se está no chão</div>
              <div><code>attacking==true/false</code> — se está a atacar</div>
              <div><code>custom:varName==value</code> — variável custom</div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

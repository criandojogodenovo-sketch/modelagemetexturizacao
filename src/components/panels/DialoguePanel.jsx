/**
 * DialoguePanel — editor visual de árvores de diálogo.
 *
 * Fase 8 — Gerador de Diálogos.
 *
 * Permite criar árvores de diálogo com nós de texto e escolhas
 * que levam a outros nós. Visualiza a árvore como lista de nós.
 *
 * Acesso: VerticalRail → "Diálogos" (abre este painel)
 */
import { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { IconClose } from '../ui/Icons'
import {
  createDialogueTree,
  addDialogueNode,
  addDialogueChoice,
  getAllDialogueTrees,
  getDialogueTree,
  startDialogue,
  chooseOption,
  getCurrentNode,
  endDialogue,
  isDialogueActive,
  onDialogueEvent,
} from '../../utils/dialogueSystem'

export default function DialoguePanel({ onClose }) {
  const [trees, setTrees] = useState([])
  const [selectedTreeId, setSelectedTreeId] = useState(null)
  const [selectedNodeId, setSelectedNodeId] = useState(null)
  const [dialogueState, setDialogueState] = useState(null)

  // Refresh trees
  useEffect(() => {
    const refresh = () => setTrees(getAllDialogueTrees())
    refresh()
    // Listener para atualizar quando diálogo começa/termina
    const unsub1 = onDialogueEvent('onDialogueStart', refresh)
    const unsub2 = onDialogueEvent('onDialogueEnd', refresh)
    return () => { unsub1(); unsub2() }
  }, [])

  const tree = selectedTreeId ? getDialogueTree(selectedTreeId) : null
  const selectedNode = tree?.nodes.find(n => n.id === selectedNodeId) || null

  const handleCreateTree = () => {
    const tree = createDialogueTree(`NPC ${trees.length + 1}`)
    setTrees(getAllDialogueTrees())
    setSelectedTreeId(tree.id)
    setSelectedNodeId(tree.startNodeId)
  }

  const handleAddNode = () => {
    if (!tree) return
    const node = {
      id: `node_${tree.nodes.length}`,
      text: 'Novo nó de diálogo',
      choices: [
        { id: 'c_end', text: 'Adeus', nextNodeId: null, action: 'endDialogue' },
      ],
    }
    addDialogueNode(tree.id, node)
    setTrees(getAllDialogueTrees())
    setSelectedNodeId(node.id)
  }

  const handleAddChoice = () => {
    if (!tree || !selectedNode) return
    const choice = {
      id: `c_${selectedNode.choices.length}`,
      text: 'Nova escolha',
      nextNodeId: null,
      action: null,
    }
    addDialogueChoice(tree.id, selectedNode.id, choice)
    setTrees(getAllDialogueTrees())
  }

  const handleTestDialogue = () => {
    if (!tree) return
    const state = useStore.getState()
    const gameContext = window._flirGameContext || {}
    const node = startDialogue(tree.id, gameContext)
    setDialogueState(node)
  }

  const handleChoose = (choiceId) => {
    const node = chooseOption(choiceId)
    setDialogueState(node)
  }

  const handleEndTest = () => {
    endDialogue()
    setDialogueState(null)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>💬 Gerador de Diálogos</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text)' }}>
            <IconClose />
          </button>
        </div>

        {/* Modo teste de diálogo */}
        {dialogueState ? (
          <div style={{ background: 'var(--bg-tertiary, #161b22)', borderRadius: 8, padding: 16 }}>
            <div style={{ fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* C: Retrato do NPC (avatar circular) */}
              <div style={{
                width: 32, height: 32, borderRadius: '50%',
                background: `linear-gradient(135deg, ${tree?.npcColor || '#2f81f7'}, #8b5cf6)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, color: 'white', fontWeight: 'bold', flexShrink: 0,
              }}>
                {(tree?.npcName || 'N').charAt(0).toUpperCase()}
              </div>
              <span>{tree?.npcName}:</span>
            </div>
            {/* C: Typing effect (máquina de escrever) */}
            <TypingText text={dialogueState.text} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dialogueState.choices.map(choice => (
                <button
                  key={choice.id}
                  onClick={() => handleChoose(choice.id)}
                  style={{
                    textAlign: 'left',
                    padding: '8px 12px',
                    background: 'var(--bg-primary, #0d1117)',
                    border: '1px solid var(--border, #30363d)',
                    borderRadius: 6,
                    cursor: 'pointer',
                    color: 'var(--text, #e6edf3)',
                    fontSize: 12,
                  }}
                >
                  ▸ {choice.text}
                </button>
              ))}
            </div>
            <button
              onClick={handleEndTest}
              style={{ marginTop: 12, padding: '4px 12px', background: 'transparent', border: '1px solid #f85149', borderRadius: 4, color: '#f85149', cursor: 'pointer', fontSize: 11 }}
            >
              Terminar Diálogo
            </button>
          </div>
        ) : (
          <>
            {/* Lista de árvores */}
            {trees.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, opacity: 0.6 }}>
                <p>Nenhuma árvore de diálogo criada.</p>
                <button onClick={handleCreateTree} style={{ padding: '8px 16px', background: '#2f81f7', border: 'none', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 13, marginTop: 8 }}>
                  Criar Árvore de Diálogo
                </button>
              </div>
            ) : (
              <>
                {/* Toolbar */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <select
                    value={selectedTreeId || ''}
                    onChange={(e) => { setSelectedTreeId(e.target.value); setSelectedNodeId(null) }}
                    style={{ flex: 1, fontSize: 12 }}
                  >
                    <option value="">Selecionar árvore...</option>
                    {trees.map(t => (
                      <option key={t.id} value={t.id}>{t.npcName} ({t.nodes.length} nós)</option>
                    ))}
                  </select>
                  <button onClick={handleCreateTree} title="Nova árvore" style={{ padding: '4px 8px', fontSize: 12 }}>+</button>
                  {tree && (
                    <button onClick={handleTestDialogue} title="Testar diálogo" style={{ padding: '4px 8px', fontSize: 12, background: '#3fb950', color: '#fff', border: 'none', borderRadius: 4 }}>
                      ▶ Testar
                    </button>
                  )}
                </div>

                {/* Editor de nós */}
                {tree && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <h4 style={{ margin: 0, fontSize: 14 }}>Nós ({tree.nodes.length})</h4>
                      <button onClick={handleAddNode} style={{ padding: '4px 8px', fontSize: 11 }}>+ Nó</button>
                    </div>

                    {tree.nodes.map(node => (
                      <div
                        key={node.id}
                        onClick={() => setSelectedNodeId(node.id)}
                        style={{
                          padding: '8px 12px',
                          marginBottom: 4,
                          background: selectedNodeId === node.id ? 'rgba(47, 129, 247, 0.15)' : 'var(--bg-tertiary, #161b22)',
                          border: '1px solid',
                          borderColor: selectedNodeId === node.id ? '#2f81f7' : 'var(--border, #30363d)',
                          borderRadius: 6,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 4 }}>
                          {node.id === tree.startNodeId ? '🟢 ' : '📍 '}{node.id}
                        </div>
                        <div style={{ fontSize: 12, marginBottom: 4 }}>
                          {node.text?.slice(0, 60)}{node.text?.length > 60 ? '...' : ''}
                        </div>
                        <div style={{ fontSize: 10, opacity: 0.6 }}>
                          {node.choices.length} escolha(s)
                        </div>
                      </div>
                    ))}

                    {/* Editor do nó selecionado */}
                    {selectedNode && (
                      <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-tertiary, #161b22)', borderRadius: 8, border: '1px solid var(--border, #30363d)' }}>
                        <h5 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Editar Nó: {selectedNode.id}</h5>

                        <div className="prop-row">
                          <label>Texto</label>
                          <textarea
                            value={selectedNode.text}
                            onChange={(e) => { selectedNode.text = e.target.value; setTrees(getAllDialogueTrees()) }}
                            style={{ width: '100%', minHeight: 60, fontSize: 12, resize: 'vertical' }}
                          />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                          <h6 style={{ margin: 0, fontSize: 12 }}>Escolhas ({selectedNode.choices.length})</h6>
                          <button onClick={handleAddChoice} style={{ padding: '2px 6px', fontSize: 11 }}>+ Escolha</button>
                        </div>

                        {selectedNode.choices.map((choice, idx) => (
                          <div key={choice.id} style={{ display: 'flex', gap: 4, marginTop: 4, alignItems: 'center' }}>
                            <input
                              value={choice.text}
                              onChange={(e) => { choice.text = e.target.value; setTrees(getAllDialogueTrees()) }}
                              style={{ flex: 1, fontSize: 11, padding: '4px 6px' }}
                              placeholder="Texto da escolha"
                            />
                            <select
                              value={choice.nextNodeId || ''}
                              onChange={(e) => { choice.nextNodeId = e.target.value || null; setTrees(getAllDialogueTrees()) }}
                              style={{ width: 80, fontSize: 10, padding: '4px 2px' }}
                            >
                              <option value="">Fim</option>
                              {tree.nodes.map(n => (
                                <option key={n.id} value={n.id}>{n.id}</option>
                              ))}
                            </select>
                            <input
                              value={choice.action || ''}
                              onChange={(e) => { choice.action = e.target.value || null; setTrees(getAllDialogueTrees()) }}
                              style={{ width: 60, fontSize: 10, padding: '4px 2px' }}
                              placeholder="action"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Dica FlirCode */}
        {tree && (
          <div style={{ fontSize: '10px', opacity: 0.5, marginTop: 12, lineHeight: 1.4 }}>
            FlirCode: startDialogue('{tree.id}', gameContext) • onDialogueChoice(choiceId, action) • endDialogue()
          </div>
        )}
      </div>
    </div>
  )
}

// C: Componente TypingText — efeito máquina de escrever para diálogo
function TypingText({ text }) {
  const [displayText, setDisplayText] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  useEffect(() => {
    setDisplayText('')
    setIsComplete(false)
    if (!text) return

    let i = 0
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayText(text.slice(0, i + 1))
        i++
      } else {
        clearInterval(interval)
        setIsComplete(true)
      }
    }, 30) // 30ms por caractere ~ 33 chars/sec

    return () => clearInterval(interval)
  }, [text])

  return (
    <div style={{ fontSize: 14, marginBottom: 12, lineHeight: 1.5, minHeight: 42 }}>
      {displayText}
      {!isComplete && <span style={{ animation: 'blink 0.5s infinite' }}>▊</span>}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}

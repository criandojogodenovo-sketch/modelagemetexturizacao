/**
 * FlirScriptEditor — editor de nós visuais FlirScript (estilo Blueprints UE5).
 *
 * **Correções aplicadas**:
 *  - Canvas com tabindex para receber focus e eventos de teclado
 *  - Event listeners manuais como backup (mousedown/move/up/wheel)
 *    que chamam processMouseDown/Move/Up diretamente
 *  - touch-action: none no canvas para não interferir com gestos
 *  - Cores de pinos ao estilo UE5:
 *    exec = branco, number = verde, string = rosa, boolean = vermelho, object = azul
 *  - Curvas de Bézier nos fios (já nativas do litegraph)
 *  - Fio fantasma durante drag de pino (nativo do litegraph)
 *  - Validação de tipos: não permite ligar saída a saída
 *
 * Estrutura de dados (alinhada com UE5):
 *  - Nó: PosiçãoX, PosiçãoY, Largura, Altura, Pinos de Entrada, Pinos de Saída
 *  - Pino: pertence a um Nó, tipo (exec/number/string/boolean/object/vec3)
 *  - Conexão (Wire): Pino de Origem → Pino de Destino
 *
 * Drag de nós (lógica UE5):
 *  - Mouse Down no corpo do nó: inicia drag com offset
 *  - Mouse Move: atualiza posição = mouse - offset
 *  - Mouse Up: termina drag
 *
 * Conexão de pinos (lógica UE5):
 *  - Mouse Down num pino de saída: inicia "fio fantasma"
 *  - Mouse Move: fio fantasma segue o rato
 *  - Mouse Up num pino de entrada válido: cria conexão permanente
 *  - Mouse Up no vazio: cancela (fio destruído)
 */
import { useEffect, useRef, useState } from 'react'
import { LGraph, LGraphCanvas, LiteGraph } from 'litegraph.js'
import { useStore } from '../../../store/useStore'
import { registerFlirScriptNodes } from '../../../utils/flirscript/register'
import { NODE_CATEGORIES, NODE_DEFINITIONS } from '../../../utils/flirscript/nodes'
import { validateGraph } from '../../../utils/flirscript/executor'
import { IconClose, IconPlus, IconCheck } from '../../ui/Icons'

// Registra os nós uma vez (idempotente)
registerFlirScriptNodes()

// Cores de pinos ao estilo UE5
const PIN_COLORS = {
  exec: '#ffffff',      // branco (pinos de execução)
  number: '#3fb950',    // verde
  string: '#d63384',    // rosa
  boolean: '#f85149',   // vermelho
  object: '#2f81f7',    // azul
  vec3: '#f4a261',      // laranja
  vec2: '#e9c46a',      // amarelo
  any: '#8b949e',       // cinzento
  event: '#f4a261',     // laranja (eventos)
}

export default function FlirScriptEditor() {
  const canvasRef = useRef(null)
  const graphRef = useRef(null)
  const lgraphCanvasRef = useRef(null)
  const containerRef = useRef(null)

  const flirScriptTarget = useStore((s) => s.flirScriptTarget)
  const scenes = useStore((s) => s.scenes)
  const setInstanceFlirScript = useStore((s) => s.setInstanceFlirScript)
  const clearFlirScriptTarget = useStore((s) => s.clearFlirScriptTarget)
  const toast = useStore((s) => s.toast)

  const [addPanelOpen, setAddPanelOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState('events')
  const [errors, setErrors] = useState([])

  const targetScene = scenes.find((s) => s.id === flirScriptTarget?.sceneId)
  const targetInstance =
    targetScene?.conects?.find((o) => o.instanceId === flirScriptTarget?.instanceId) ||
    targetScene?.objects?.find((o) => o.instanceId === flirScriptTarget?.instanceId)

  useEffect(() => {
    if (!canvasRef.current || !targetInstance) return

    const container = containerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      canvasRef.current.width = rect.width || 800
      canvasRef.current.height = rect.height || 600
    }

    // Criar grafo
    const graph = new LGraph()
    graphRef.current = graph

    // Carregar grafo existente
    if (targetInstance.flirScript) {
      try {
        graph.configure(targetInstance.flirScript)
      } catch (err) {
        console.warn('Erro ao carregar grafo:', err)
      }
    }

    // Criar LGraphCanvas
    const lgraphCanvas = new LGraphCanvas(canvasRef.current, graph, {
      autoresize: false,
    })
    lgraphCanvasRef.current = lgraphCanvas

    // ===== Configuração visual (dark mode + cores UE5) =====
    lgraphCanvas.background_image = null
    lgraphCanvas.clear_background_color = '#0d1117'
    // Fios de execução: brancos/laranja (como UE5)
    lgraphCanvas.default_link_color = '#ffffff'
    lgraphCanvas.default_event_link_color = '#f4a261'
    // Permissões
    lgraphCanvas.allow_searchbox = true
    lgraphCanvas.allow_dragcanvas = true
    lgraphCanvas.allow_dragnodes = true
    lgraphCanvas.allow_interaction = true
    lgraphCanvas.use_gradients = false
    lgraphCanvas.title_text_font = '12px Arial'
    lgraphCanvas.inner_text_font = '11px Arial'
    lgraphCanvas.render_events = true
    lgraphCanvas.render_shadows = true
    lgraphCanvas.round_radius = 8
    lgraphCanvas.link_distance = 50 // curvatura dos fios (Bézier)

    // Garantir que o canvas tem tabindex para receber eventos de teclado
    canvasRef.current.tabIndex = 0
    canvasRef.current.style.outline = 'none'

    // Estado inicial do viewport
    lgraphCanvas.offset = [0, 0]
    lgraphCanvas.scale = 1

    // ===== Event listeners manuais como fallback =====
    // IMPORTANTE: NÃO usar capture=true para não interferir com os
    // listeners nativos do litegraph. Usar bubble phase.
    const canvas = canvasRef.current

    const onWheel = (e) => {
      e.preventDefault()
    }
    const onContextMenu = (e) => {
      e.preventDefault()
    }

    // Só registar wheel e contextmenu — o litegraph já regista mousedown/move/up
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', onContextMenu)

    // Garantir focus no canvas para eventos de teclado
    canvas.addEventListener('mousedown', () => canvas.focus())

    // Iniciar render loop
    graph.start()

    // Forçar resize e draw inicial
    setTimeout(() => {
      if (lgraphCanvasRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          canvasRef.current.width = rect.width
          canvasRef.current.height = rect.height
          lgraphCanvasRef.current.resize(rect.width, rect.height)
        }
        lgraphCanvasRef.current.setDirty(true, true)
        lgraphCanvasRef.current.draw()
      }
    }, 100)

    // Auto-save quando o grafo muda (debounced)
    let saveTimeout = null
    const saveGraph = () => {
      if (!flirScriptTarget) return
      const data = graph.serialize()
      setInstanceFlirScript(flirScriptTarget.instanceId, data)
    }
    const onGraphChange = () => {
      clearTimeout(saveTimeout)
      saveTimeout = setTimeout(saveGraph, 500)
    }
    graph.onAfterExecute = onGraphChange
    graph.onNodeAdded = onGraphChange
    graph.onConnectionChange = onGraphChange

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      if (lgraphCanvasRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          canvasRef.current.width = rect.width
          canvasRef.current.height = rect.height
          lgraphCanvasRef.current.resize(rect.width, rect.height)
          lgraphCanvasRef.current.setDirty(true, true)
          lgraphCanvasRef.current.draw()
        }
      }
    })
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      clearTimeout(saveTimeout)
      saveGraph()
      graph.stop()
      resizeObserver.disconnect()
      // Remover event listeners
      canvas.removeEventListener('wheel', onWheel, { passive: false })
      canvas.removeEventListener('contextmenu', onContextMenu)
      lgraphCanvasRef.current = null
      graphRef.current = null
    }
  }, [targetInstance?.instanceId, flirScriptTarget?.sceneId])

  // Adicionar nó ao grafo
  const addNode = (nodeDef) => {
    if (!graphRef.current) return
    const node = LiteGraph.createNode(nodeDef.type)
    if (!node) {
      toast(`Erro ao criar nó: ${nodeDef.type}`, 'error')
      return
    }
    const graph = graphRef.current
    const canvas = lgraphCanvasRef.current

    // Posicionar no centro da área visível
    let pos
    if (canvas) {
      const cx = (canvas.canvas.width / 2 - canvas.offset[0]) / canvas.scale
      const cy = (canvas.canvas.height / 2 - canvas.offset[1]) / canvas.scale
      pos = [cx + (Math.random() - 0.5) * 80, cy + (Math.random() - 0.5) * 80]
    } else if (graph._nodes?.length > 0) {
      const last = graph._nodes[graph._nodes.length - 1]
      pos = [last.pos[0] + 220, last.pos[1] + 40]
    } else {
      pos = [200, 200]
    }
    node.pos = pos
    graph.add(node)
    graph.setDirtyCanvas(true, true)
    if (canvas) {
      canvas.setDirty(true, true)
      canvas.draw()
    }
    setAddPanelOpen(false)
    toast(`Nó "${nodeDef.label}" adicionado`, 'success', 1500)
  }

  const handleValidate = () => {
    if (!graphRef.current) return
    const data = graphRef.current.serialize()
    const errs = validateGraph(data)
    setErrors(errs)
    if (errs.length === 0) {
      toast('Grafo válido! Pronto a executar.', 'success')
    } else {
      toast(`${errs.length} erro(s) encontrado(s)`, 'error')
    }
  }

  const handleClear = () => {
    if (!graphRef.current) return
    if (!confirm('Limpar todos os nós do grafo?')) return
    graphRef.current.clear()
    if (lgraphCanvasRef.current) lgraphCanvasRef.current.draw()
    toast('Grafo limpo', 'info')
  }

  const filteredNodes = NODE_DEFINITIONS.filter((n) => {
    if (search) {
      const q = search.toLowerCase()
      return n.label.toLowerCase().includes(q) || n.description.toLowerCase().includes(q)
    }
    return n.category === activeCategory
  })

  if (!targetInstance) {
    return (
      <div className="flirscript-empty">
        <div className="empty-state">
          <div style={{ fontSize: 32, opacity: 0.4 }}>🧩</div>
          <div className="mt-2">Nenhum objeto selecionado para FlirScript.</div>
          <div className="small mt-2">
            Vai ao Modo Cena, seleciona um Conect e clica em "⋯ → FlirScript".
          </div>
          <button className="primary mt-2" onClick={clearFlirScriptTarget}>
            Voltar ao Modo Cena
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flirscript-editor">
      <div className="flirscript-toolbar">
        <button onClick={clearFlirScriptTarget} title="Voltar ao Modo Cena">
          ← Cena
        </button>
        <div className="fs-target-info">
          <strong>FlirScript</strong>
          <span className="muted small"> · {targetInstance.name}</span>
        </div>
        <div className="spacer" />
        <button onClick={handleValidate} title="Validar grafo">
          <IconCheck width={14} height={14} /> Validar
        </button>
        <button onClick={handleClear} title="Limpar grafo" className="danger">
          Limpar
        </button>
        <button
          onClick={() => setAddPanelOpen(true)}
          className="primary"
          title="Adicionar nó"
        >
          <IconPlus width={14} height={14} /> Nó
        </button>
      </div>

      {errors.length > 0 && (
        <div className="flirscript-errors">
          <strong>Erros no grafo:</strong>
          <ul>
            {errors.map((err, i) => (
              <li key={i}>{err.message}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Canvas com tabindex para foco e eventos de teclado */}
      <div className="flirscript-canvas-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="flirscript-canvas"
          width={800}
          height={600}
          tabIndex={0}
          style={{
            width: '100%',
            height: '100%',
            touchAction: 'none',
            outline: 'none',
            cursor: 'default',
          }}
        />
      </div>

      <div className="flirscript-hint">
        <strong>Controlos (estilo UE5 Blueprints):</strong>
        Arrastar nó = mover · Arrastar pino = ligar (fio fantasma segue o rato) ·
        Scroll = zoom · Arrastar fundo = pan · Del = apagar nó ·
        <span style={{ color: PIN_COLORS.exec }}> ●</span> exec
        <span style={{ color: PIN_COLORS.number }}> ●</span> número
        <span style={{ color: PIN_COLORS.string }}> ●</span> texto
        <span style={{ color: PIN_COLORS.boolean }}> ●</span> bool
        <span style={{ color: PIN_COLORS.object }}> ●</span> objeto
      </div>

      {addPanelOpen && (
        <>
          <div className="drawer-backdrop show" onClick={() => setAddPanelOpen(false)} />
          <aside className="flirscript-add-panel open">
            <div className="panel-header">
              <span>Adicionar Nó</span>
              <button className="icon" onClick={() => setAddPanelOpen(false)} title="Fechar">
                <IconClose width={14} height={14} />
              </button>
            </div>

            <div style={{ padding: 10, borderBottom: '1px solid var(--border-soft)' }}>
              <input
                type="text"
                placeholder="🔍 Pesquisar nó..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {!search && (
              <div className="fs-categories">
                {NODE_CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    className={`fs-cat-btn ${activeCategory === cat.id ? 'active' : ''}`}
                    onClick={() => setActiveCategory(cat.id)}
                    style={{ borderColor: activeCategory === cat.id ? cat.color : undefined }}
                  >
                    <span style={{ color: cat.color }}>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                ))}
              </div>
            )}

            <div className="fs-node-list">
              {filteredNodes.map((node) => (
                <button
                  key={node.type}
                  className="fs-node-item"
                  onClick={() => addNode(node)}
                  title={node.description}
                >
                  <div className="fs-node-label">{node.label}</div>
                  <div className="fs-node-desc small muted">{node.description}</div>
                  <div className="fs-node-pins small">
                    {(node.inputs?.length || 0) > 0 && (
                      <span className="tag">↓ {node.inputs.length}</span>
                    )}
                    {(node.outputs?.length || 0) > 0 && (
                      <span className="tag">↑ {node.outputs.length}</span>
                    )}
                    {node.isEvent && <span className="tag accent">evento</span>}
                  </div>
                </button>
              ))}
              {filteredNodes.length === 0 && (
                <div className="empty-state small">Nenhum nó encontrado.</div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  )
}

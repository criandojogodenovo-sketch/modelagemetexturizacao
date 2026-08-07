/**
 * FlirScriptEditor — editor de nós visuais FlirScript.
 *
 * **Fase 5 (corrigido)**: nós arrastáveis, pinos ligáveis com feedback visual.
 *
 * Usa litegraph.js como motor. O litegraph suporta nativamente:
 *  - Drag de nós (clique no corpo do nó e arrasta)
 *  - Ligação de pinos (clique num pino e arrasta até outro)
 *  - Zoom (scroll do rato) e pan (drag no fundo)
 *  - Apagar ligações (clicar no fio e pressionar Delete, ou arrastar a ponta para fora)
 *
 * Correções aplicadas:
 *  - Canvas com width/height explícitos (atributos HTML, não só CSS)
 *  - ResizeObserver garante que o canvas tem o tamanho do container
 *  - allow_searchbox, allow_dragcanvas, allow_dragnodes explicitamente true
 *  - onConnectionChange dispara auto-save
 *  - dark_mode configurado
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

  // Objeto alvo: procurar em conects E objects
  const targetScene = scenes.find((s) => s.id === flirScriptTarget?.sceneId)
  const targetInstance =
    targetScene?.conects?.find((o) => o.instanceId === flirScriptTarget?.instanceId) ||
    targetScene?.objects?.find((o) => o.instanceId === flirScriptTarget?.instanceId)

  // Inicializar grafo e canvas do litegraph
  useEffect(() => {
    if (!canvasRef.current || !targetInstance) return

    // Garantir que o canvas tem dimensões explícitas antes de criar o LGraphCanvas
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

    // Criar canvas do LiteGraph
    const lgraphCanvas = new LGraphCanvas(canvasRef.current, graph, {
      autoresize: false,
    })
    lgraphCanvasRef.current = lgraphCanvas

    // Configurar dark mode e permissões
    lgraphCanvas.background_image = null
    lgraphCanvas.clear_background_color = '#0d1117'
    lgraphCanvas.default_link_color = '#2f81f7'
    lgraphCanvas.default_event_link_color = '#f4a261'
    lgraphCanvas.allow_searchbox = true
    lgraphCanvas.allow_dragcanvas = true
    lgraphCanvas.allow_dragnodes = true
    lgraphCanvas.allow_interaction = true
    lgraphCanvas.use_gradients = false
    lgraphCanvas.title_text_font = '12px Arial'
    lgraphCanvas.inner_text_font = '11px Arial'
    lgraphCanvas.render_events = true
    lgraphCanvas.render_shadows = true
    lgraphCanvas.round_radius = 6

    // Estado inicial do viewport (centro)
    lgraphCanvas.offset = [0, 0]
    lgraphCanvas.scale = 1

    // Iniciar render loop
    graph.start()

    // Forçar resize inicial
    setTimeout(() => {
      if (lgraphCanvasRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        canvasRef.current.width = rect.width
        canvasRef.current.height = rect.height
        lgraphCanvasRef.current.resize(rect.width, rect.height)
        lgraphCanvasRef.current.setDirty(true, true)
      }
    }, 50)

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
    if (canvas && canvas.visible_area) {
      pos = [
        canvas.visible_area[0] + canvas.visible_area[2] / 2 + (Math.random() - 0.5) * 80,
        canvas.visible_area[1] + canvas.visible_area[3] / 2 + (Math.random() - 0.5) * 80,
      ]
    } else if (canvas) {
      // Fallback: usar o offset do canvas + centro do viewport
      const cx = (canvas.canvas.width / 2 - canvas.offset[0]) / canvas.scale
      const cy = (canvas.canvas.height / 2 - canvas.offset[1]) / canvas.scale
      pos = [cx + (Math.random() - 0.5) * 80, cy + (Math.random() - 0.5) * 80]
    } else if (graph.nodes.length > 0) {
      const last = graph.nodes[graph.nodes.length - 1]
      pos = [last.pos[0] + 220, last.pos[1] + 40]
    } else {
      pos = [200, 200]
    }
    node.pos = pos
    graph.add(node)
    graph.setDirtyCanvas(true, true)
    if (canvas) canvas.setDirty(true, true)
    setAddPanelOpen(false)
    toast(`Nó "${nodeDef.label}" adicionado`, 'success', 1500)
  }

  // Validar grafo
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

  // Limpar grafo
  const handleClear = () => {
    if (!graphRef.current) return
    if (!confirm('Limpar todos os nós do grafo?')) return
    graphRef.current.clear()
    toast('Grafo limpo', 'info')
  }

  // Filtrar nós por pesquisa e categoria
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
      {/* Barra de ferramentas */}
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

      {/* Erros de validação */}
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

      {/* Canvas do LiteGraph — width/height como atributos HTML */}
      <div className="flirscript-canvas-container" ref={containerRef}>
        <canvas
          ref={canvasRef}
          className="flirscript-canvas"
          width={800}
          height={600}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {/* Dica de controlos */}
      <div className="flirscript-hint">
        <strong>Controlos:</strong> Arrastar nó = mover · Arrastar pino = ligar ·
        Scroll = zoom · Arrastar fundo = pan · Del = apagar nó/seleção
      </div>

      {/* Painel "Adicionar Nó" (drawer à direita) */}
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

            {/* Pesquisa */}
            <div style={{ padding: 10, borderBottom: '1px solid var(--border-soft)' }}>
              <input
                type="text"
                placeholder="🔍 Pesquisar nó..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Categorias (só quando não há pesquisa) */}
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

            {/* Lista de nós */}
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

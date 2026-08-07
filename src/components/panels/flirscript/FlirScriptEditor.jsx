/**
 * FlirScriptEditor — editor de nós visuais FlirScript.
 *
 * Contém:
 *  - Canvas com litegraph.js (zoom/pan, arrastar nós, ligar pinos)
 *  - Painel "Adicionar Nó" em gaveta (drawer) à direita, com pesquisa
 *  - Barra de ferramentas flutuante (validar, limpar, fechar)
 *  - Indicação visual de erros de validação
 *
 * O grafo é guardado automaticamente no store (em scene.objects[].flirScript)
 * sempre que o utilizador adiciona/remove/move nós ou ligações.
 *
 * Funciona por toque (mobile) e rato (desktop).
 */
import { useEffect, useRef, useState } from 'react'
import { LGraph, LGraphCanvas, LiteGraph } from 'litegraph.js'
import { useStore } from '../../../store/useStore'
import { registerFlirScriptNodes } from '../../../utils/flirscript/register'
import { NODE_CATEGORIES, NODE_DEFINITIONS, findNodeDefinition } from '../../../utils/flirscript/nodes'
import { validateGraph } from '../../../utils/flirscript/executor'
import { IconClose, IconPlus, IconCheck } from '../../ui/Icons'

// Regista os nós uma vez (idempotente)
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

  // Objeto alvo e seu grafo atual
  const targetScene = scenes.find((s) => s.id === flirScriptTarget?.sceneId)
  const targetInstance = targetScene?.objects.find((o) => o.instanceId === flirScriptTarget?.instanceId)

  // Inicializar grafo
  useEffect(() => {
    if (!canvasRef.current || !targetInstance) return

    // Criar grafo
    const graph = new LGraph()
    graphRef.current = graph

    // Carregar grafo existente se houver
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

    // Configurar para dark mode
    lgraphCanvas.background_image = null
    lgraphCanvas.clear_background_color = '#0d1117'
    lgraphCanvas.default_link_color = '#2f81f7'
    lgraphCanvas.default_event_link_color = '#f4a261'

    // Iniciar render loop
    graph.start()

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

    // Resize observer para manter o canvas a ocupar o container
    const resizeObserver = new ResizeObserver(() => {
      if (lgraphCanvasRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        canvasRef.current.width = rect.width
        canvasRef.current.height = rect.height
        lgraphCanvasRef.current.resize(rect.width, rect.height)
      }
    })
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    return () => {
      clearTimeout(saveTimeout)
      saveGraph() // save final
      graph.stop()
      resizeObserver.disconnect()
      lgraphCanvasRef.current = null
      graphRef.current = null
    }
  }, [targetInstance?.instanceId])

  // Adicionar nó ao grafo
  const addNode = (nodeDef) => {
    if (!graphRef.current) return
    const node = LiteGraph.createNode(nodeDef.type)
    if (!node) {
      toast(`Erro ao criar nó: ${nodeDef.type}`, 'error')
      return
    }
    // Posicionar num local visível — usar o centro do viewport atual do canvas
    // e offset aleatório para evitar sobreposição
    const graph = graphRef.current
    const canvas = lgraphCanvasRef.current
    let pos = [100 + Math.random() * 80, 100 + Math.random() * 80]
    if (canvas && canvas.visible_area) {
      // Centro da área visível + offset
      pos = [
        canvas.visible_area[0] + canvas.visible_area[2] / 2 + (Math.random() - 0.5) * 100,
        canvas.visible_area[1] + canvas.visible_area[3] / 2 + (Math.random() - 0.5) * 100,
      ]
    } else if (graph.nodes.length > 0) {
      // Offset do último nó
      const last = graph.nodes[graph.nodes.length - 1]
      pos = [last.pos[0] + 220, last.pos[1] + 40]
    }
    node.pos = pos
    graph.add(node)
    graph.setDirtyCanvas(true, true)
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
            Vai ao Modo Cena, seleciona um objeto e clica em "FlirScript".
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
      {/* Barra de ferramentas topo */}
      <div className="flirscript-toolbar">
        <button onClick={clearFlirScriptTarget} title="Voltar ao Modo Cena">
          ← Cena
        </button>
        <div className="fs-target-info">
          <strong>FlirScript</strong>
          <span className="muted small"> · {targetInstance.objectId ? `Objeto ${targetInstance.objectId.slice(-6)}` : ''}</span>
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

      {/* Canvas do LiteGraph */}
      <div className="flirscript-canvas-container" ref={containerRef}>
        <canvas ref={canvasRef} className="flirscript-canvas" />
      </div>

      {/* Dica de controlos */}
      <div className="flirscript-hint">
        <strong>Controlos:</strong> Arrastar = pan · Scroll = zoom · Click nó = selecionar ·
        Arrastar de um pino para outro = ligar
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

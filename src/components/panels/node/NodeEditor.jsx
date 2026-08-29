/**
 * NodeEditor.jsx — editor visual de nodes de material (estilo Blender/Unreal Visject).
 *
 * Sessão 20 / Parte C.
 *
 * FEATURES:
 *  - Grelha de fundo com snap (20px) + pan (arrastar fundo) + zoom (roda)
 *  - Nós arrastáveis com headers coloridos por categoria e auto-layout
 *  - Sombra + outline no nó selecionado
 *  - Edges bezier (SVG) com delete ao clicar
 *  - Ligação output→input por drag (com type check float/vec2/vec3/surface)
 *  - Shift+F — focar/enquadrar a seleção (ou todos os nós)
 *  - Atalho Delete — apagar nó selecionado
 *  - Toolbar: adicionar nó (palette), Aplicar (GLSL live), Bake (texturas),
 *    Limpar grafo
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { useStore } from '../../../store/useStore'
import {
  NODE_DEFS, createDefaultGraph, compileNodeGraph,
  applyNodeGraphToMaterial, bakeNodeGraph,
} from '../../../utils/materials/nodeGraphCompiler'

const SNAP = 20
const TYPE_COLORS = {
  float: '#79c0ff', vec2: '#56d364', vec3: '#ff7b72', surface: '#d2a8ff',
}

let _idCounter = 0
const nid = () => `n${Date.now().toString(36)}${(_idCounter++).toString(36)}`

export default function NodeEditor({ obj }) {
  const commitMaterial = useStore((s) => s.commitMaterial)
  const updateMaterial = useStore((s) => s.updateMaterial)
  const toast = useStore((s) => s.toast)
  const _pushHistory = useStore((s) => s._pushHistory)

  const graph = obj.material?.nodeGraph || null
  const [selected, setSelected] = useState(null)
  const [connecting, setConnecting] = useState(null) // { fromNode, fromSocket, type, mouse: {x,y} }
  const [view, setView] = useState({ x: 0, y: 0, zoom: 0.75 })
  const containerRef = useRef(null)
  const dragRef = useRef(null) // { kind: 'node'|'pan', nodeId, startX, startY, origX, origY }

  // ---------- persistence ----------
  const saveGraph = useCallback((next, silent = false) => {
    next._rev = (next._rev || 0) + 1
    updateMaterial(obj.id, { nodeGraph: next })
    if (!silent) commitMaterial(obj.id, { nodeGraph: next })
  }, [obj.id, updateMaterial, commitMaterial])

  // ---------- keyboard: Delete + Shift+F ----------
  useEffect(() => {
    const onKey = (e) => {
      if (!graph) return
      if (e.key === 'Delete' && selected) {
        const next = {
          _rev: graph._rev,
          nodes: graph.nodes.filter((n) => n.id !== selected),
          edges: graph.edges.filter((e2) => e2.from.node !== selected && e2.to.node !== selected),
        }
        saveGraph(next)
        setSelected(null)
      } else if (e.key.toLowerCase() === 'f' && e.shiftKey) {
        // Shift+F — focar seleção (ou todos)
        const target = graph.nodes.find((n) => n.id === selected) || null
        const nodes = target ? [target] : graph.nodes
        if (nodes.length && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect()
          const minX = Math.min(...nodes.map((n) => n.x))
          const minY = Math.min(...nodes.map((n) => n.y))
          setView((v) => ({
            ...v,
            x: rect.width / 2 - (minX + 130) * v.zoom,
            y: rect.height / 2 - (minY + 80) * v.zoom,
          }))
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [graph, selected, saveGraph])

  // ---------- node drag ----------
  const onNodeMouseDown = (e, node) => {
    e.stopPropagation()
    setSelected(node.id)
    dragRef.current = {
      kind: 'node', nodeId: node.id,
      startX: e.clientX, startY: e.clientY, origX: node.x, origY: node.y,
    }
    const onMove = (ev) => {
      const d = dragRef.current
      if (!d || d.kind !== 'node') return
      const z = view.zoom
      let nx = d.origX + (ev.clientX - d.startX) / z
      let ny = d.origY + (ev.clientY - d.startY) / z
      nx = Math.round(nx / SNAP) * SNAP
      ny = Math.round(ny / SNAP) * SNAP
      setNodesLocal(node.id, nx, ny)
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      const d = dragRef.current
      dragRef.current = null
      if (d && graph) {
        // Persistir posição final
        const cur = localNodesRef.current.find((n) => n.id === d.nodeId)
        if (cur) {
          const next = { ...graph, nodes: graph.nodes.map((n) => (n.id === d.nodeId ? { ...n, x: cur.x, y: cur.y } : n)) }
          saveGraph(next, true)
        }
      }
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Posições locais otimistas (para drag fluido sem passar pela store)
  const [localNodes, setLocalNodes] = useState(null)
  const localNodesRef = useRef(null)
  useEffect(() => { setLocalNodes(null); localNodesRef.current = null }, [graph?._rev])
  function setNodesLocal(nodeId, x, y) {
    const src = localNodesRef.current || (graph ? graph.nodes : [])
    const next = src.map((n) => (n.id === nodeId ? { ...n, x, y } : n))
    localNodesRef.current = next
    setLocalNodes(next)
  }
  const nodes = localNodes || (graph ? graph.nodes : [])

  // ---------- auto-fit (S21): enquadrar o grafo ao abrir ----------
  // O grafo default (Texture→Ramp→BSDF→Output ≈ 810px) não cabia no canvas
  // do painel direito (~280px) — os nós ficavam recortados fora do ecrã.
  // Ao abrir (ou recriar) um grafo, ajusta zoom+pan para enquadrar tudo.
  const autoFitRef = useRef(false)
  useEffect(() => {
    if (!graph) { autoFitRef.current = false; return }
    if (autoFitRef.current || !containerRef.current) return
    autoFitRef.current = true
    // trazer o canvas para a área visível do painel scrollável (instantâneo
    // para geometria determinística — smooth deixaria o rect a meio do scroll)
    containerRef.current.scrollIntoView({ block: 'center', behavior: 'auto' })
    const rect = containerRef.current.getBoundingClientRect()
    if (rect.width < 40 || !graph.nodes.length) return
    const minX = Math.min(...graph.nodes.map((n) => n.x))
    const minY = Math.min(...graph.nodes.map((n) => n.y))
    const maxX = Math.max(...graph.nodes.map((n) => n.x + 280))
    const maxY = Math.max(...graph.nodes.map((n) => n.y + 180))
    const zoom = Math.max(0.2, Math.min(1, (rect.width - 24) / (maxX - minX), (rect.height - 24) / (maxY - minY)))
    setView({
      zoom,
      x: rect.width / 2 - (minX + (maxX - minX) / 2) * zoom,
      y: rect.height / 2 - (minY + (maxY - minY) / 2) * zoom,
    })
  }, [graph])

  // ---------- pan / zoom ----------
  const onBackgroundMouseDown = (e) => {
    setSelected(null)
    dragRef.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, origX: view.x, origY: view.y }
    const onMove = (ev) => {
      const d = dragRef.current
      if (!d || d.kind !== 'pan') return
      setView((v) => ({ ...v, x: d.origX + (ev.clientX - d.startX), y: d.origY + (ev.clientY - d.startY) }))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      dragRef.current = null
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }
  const onWheel = (e) => {
    e.preventDefault()
    const factor = e.deltaY < 0 ? 1.1 : 0.9
    setView((v) => ({ ...v, zoom: Math.min(2, Math.max(0.25, v.zoom * factor)) }))
  }

  // ---------- edges ----------
  const onMouseMoveContainer = (e) => {
    if (connecting) {
      const rect = containerRef.current.getBoundingClientRect()
      setConnecting((c) => c && ({ ...c, mouse: { x: (e.clientX - rect.left - view.x) / view.zoom, y: (e.clientY - rect.top - view.y) / view.zoom } }))
    }
  }
  const startConnect = (e, node, socketName, socketType, isOutput) => {
    e.stopPropagation()
    const rect = containerRef.current.getBoundingClientRect()
    // S21 fix: capturar os dados da ligação em const local — o handler onUp
    // via `connecting` do estado React estava STALE (closure do render
    // anterior) e a 1ª ligação rebentava com TypeError (connecting.fromNode
    // de null) — edges nunca eram criados via drag.
    const conn = {
      fromNode: node.id, fromSocket: socketName, type: socketType, isOutput,
      mouse: { x: (e.clientX - rect.left - view.x) / view.zoom, y: (e.clientY - rect.top - view.y) / view.zoom },
    }
    setConnecting(conn)
    const onUp = (ev) => {
      window.removeEventListener('mouseup', onUp)
      setConnecting(null)
      // Verificar se largou sobre um socket de input (query por elemento)
      const el = document.elementFromPoint(ev.clientX, ev.clientY)
      const socketEl = el?.closest?.('[data-socket]')
      if (socketEl && graph) {
        const [toNode, toSocket] = socketEl.dataset.socket.split('::')
        const toDef = NODE_DEFS[nodes.find((n) => n.id === toNode)?.type]
        const input = toDef?.inputs?.find((i) => i.name === toSocket)
        // S21 fix: type check EXATO — o check antigo permitia vecN→float e
        // gerava GLSL inválido (ex.: float v = flirUV()). Só liga tipos iguais.
        if (input && input.type === conn.type) {
          // Substituir edge existente no mesmo input
          const edges = graph.edges.filter((e2) => !(e2.to.node === toNode && e2.to.socket === toSocket))
          let from = { node: conn.fromNode, socket: conn.fromSocket }
          let to = { node: toNode, socket: toSocket }
          if (!conn.isOutput) { const t = from; from = to; to = t }
          _pushHistory()
          saveGraph({ ...graph, edges: [...edges, { from, to }] })
          toast('Nós ligados', 'success')
        }
      }
    }
    window.addEventListener('mouseup', onUp)
  }

  const deleteEdge = (edge) => {
    if (!graph) return
    _pushHistory()
    saveGraph({ ...graph, edges: graph.edges.filter((e2) => e2 !== edge) })
  }

  // ---------- socket positions (para edges) ----------
  function socketPos(nodeId, socketName, isOutput) {
    const node = nodes.find((n) => n.id === nodeId)
    if (!node) return { x: 0, y: 0 }
    const def = NODE_DEFS[node.type]
    const list = isOutput ? def.outputs : def.inputs
    const idx = list.findIndex((s) => s.name === socketName)
    return {
      x: node.x + (isOutput ? 260 : 0),
      y: node.y + 34 + idx * 22,
    }
  }

  // ---------- params edit ----------
  const setParam = (nodeId, key, value) => {
    if (!graph) return
    saveGraph({
      ...graph,
      nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, params: { ...n.params, [key]: value } } : n)),
    })
  }

  // ---------- actions ----------
  const addNode = (type) => {
    if (!graph) return
    const def = NODE_DEFS[type]
    _pushHistory()
    // S21: spawn DENTRO do view atual (fundo-centro do canvas visível) —
    // antes caía em (60+len*40) que ficava frequentemente fora do ecrã
    let x = 60, y = 60 + graph.nodes.length * 40
    const r = containerRef.current?.getBoundingClientRect()
    if (r && r.width > 40) {
      x = Math.round(((r.width * 0.5) - view.x) / view.zoom / SNAP) * SNAP
      y = Math.round(((r.height - 80) - view.y) / view.zoom / SNAP) * SNAP
      // evitar sobreposição exata com nós existentes
      let guard = 0
      while (graph.nodes.some((n) => Math.abs(n.x - x) < 60 && Math.abs(n.y - y) < 60) && guard++ < 20) {
        y += SNAP * 3
      }
    }
    saveGraph({
      ...graph,
      nodes: [...graph.nodes, { id: nid(), type, x, y, params: { ...def.defaults } }],
    })
  }
  const applyLive = () => {
    if (!graph) { toast('Sem grafo para aplicar', 'error'); return }
    const compiled = compileNodeGraph(graph)
    if (!compiled.ok) { toast(compiled.error, 'error'); return }
    // Procurar o material three real do objeto (SceneObject expõe via ref?)
    // Nota: aplicamos ao material do objeto selecionado quando disponível no DOM
    const evt = new CustomEvent('flir:applyNodeGraph', { detail: { objectId: obj.id, graph } })
    window.dispatchEvent(evt)
    toast('Node graph compilado — GLSL aplicado ao material', 'success')
  }
  const bake = () => {
    if (!graph) { toast('Sem grafo para fazer bake', 'error'); return }
    try {
      const maps = bakeNodeGraph(graph, 256)
      _pushHistory()
      commitMaterial(obj.id, {
        map: maps.colorMap,
        roughnessMap: maps.roughnessMap,
        metalnessMap: maps.metalnessMap,
      })
      toast('Bake concluído: color + roughness + metalness maps aplicados', 'success')
    } catch (err) {
      toast('Bake falhou: ' + err.message, 'error')
    }
  }
  const initGraph = () => {
    _pushHistory()
    commitMaterial(obj.id, { nodeGraph: createDefaultGraph() })
    toast('Grafo criado (Texture → Color Ramp → Principled BSDF → Output)', 'success')
  }
  const clearGraph = () => {
    if (!graph) return
    _pushHistory()
    commitMaterial(obj.id, { nodeGraph: null })
    toast('Grafo removido', 'info')
  }

  // Escutar o evento de aplicação (o SceneObject regista o handler)
  useEffect(() => {
    const handler = (e) => {
      if (e.detail.objectId !== obj.id) return
      // Aplicar via patch do material atual (onBeforeCompile)
      const compiled = compileNodeGraph(e.detail.graph)
      if (!compiled.ok) return
      // O material real vive no SceneObject; usamos o patching tardio:
      // commitMaterial força recriação do material → o SceneObject aplica
      // o nodeGraph via applyNodeGraphToMaterial (ver SceneObject).
      updateMaterial(obj.id, { nodeGraph: { ...e.detail.graph } })
      commitMaterial(obj.id, { nodeGraph: { ...e.detail.graph } })
    }
    window.addEventListener('flir:applyNodeGraph', handler)
    return () => window.removeEventListener('flir:applyNodeGraph', handler)
  }, [obj.id, updateMaterial, commitMaterial])

  if (!graph) {
    return (
      <div style={{ padding: 12, textAlign: 'center' }}>
        <div className="small muted mb-2">Este material ainda não tem node graph.</div>
        <button className="primary" style={{ width: '100%' }} onClick={initGraph}>Criar grafo por defeito</button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: 8 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
        <select className="input" style={{ flex: 1, minWidth: 90 }} value=""
          onChange={(e) => { if (e.target.value) { addNode(e.target.value); e.target.value = '' } }}>
          <option value="">+ Adicionar nó…</option>
          {Object.entries(NODE_DEFS).map(([type, def]) => (
            <option key={type} value={type}>{def.label} ({def.category})</option>
          ))}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
        <button className="primary" style={{ flex: 2 }} onClick={applyLive}>Aplicar GLSL</button>
        <button style={{ flex: 1 }} onClick={bake}>Bake</button>
        <button className="danger" style={{ flex: 1 }} onClick={clearGraph}>Limpar</button>
      </div>

      {/* Canvas do grafo */}
      <div
        ref={containerRef}
        className="node-editor-canvas"
        style={{
          position: 'relative', height: 340, overflow: 'hidden', borderRadius: 8,
          border: '1px solid var(--border)', background: '#0d1117', cursor: 'grab',
          userSelect: 'none',
        }}
        onMouseDown={onBackgroundMouseDown}
        onMouseMove={onMouseMoveContainer}
        onWheel={onWheel}
      >
        {/* Grid + transform layer */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)',
          backgroundSize: `${SNAP * view.zoom}px ${SNAP * view.zoom}px`,
          backgroundPosition: `${view.x}px ${view.y}px`,
        }} />
        <div style={{
          position: 'absolute', left: 0, top: 0,
          transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})`,
          transformOrigin: '0 0', width: 4000, height: 3000,
        }}>
          {/* Edges SVG */}
          <svg style={{ position: 'absolute', left: 0, top: 0, width: 4000, height: 3000, pointerEvents: 'none', overflow: 'visible' }}>
            {graph.edges.map((edge, i) => {
              const a = socketPos(edge.from.node, edge.from.socket, true)
              const b = socketPos(edge.to.node, edge.to.socket, false)
              const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5)
              const path = `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`
              const fromNode = nodes.find((n) => n.id === edge.from.node)
              const type = NODE_DEFS[fromNode?.type]?.outputs?.find((s) => s.name === edge.from.socket)?.type || 'vec3'
              return (
                <g key={i} style={{ pointerEvents: 'auto', cursor: 'pointer' }} onClick={() => deleteEdge(edge)}>
                  <path d={path} fill="none" stroke="transparent" strokeWidth={12} />
                  <path d={path} fill="none" stroke={TYPE_COLORS[type] || '#8b949e'} strokeWidth={2.5} />
                </g>
              )
            })}
            {/* Edge em progresso */}
            {connecting && (() => {
              const a = socketPos(connecting.fromNode, connecting.fromSocket, connecting.isOutput)
              const b = connecting.mouse
              const [p1, p2] = connecting.isOutput ? [a, b] : [b, a]
              const dx = Math.max(40, Math.abs(p2.x - p1.x) * 0.5)
              return (
                <path
                  d={`M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`}
                  fill="none" stroke={TYPE_COLORS[connecting.type] || '#8b949e'} strokeWidth={2.5} strokeDasharray="6 4"
                />
              )
            })()}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const def = NODE_DEFS[node.type]
            if (!def) return null
            const isSel = selected === node.id
            return (
              <div
                key={node.id}
                onMouseDown={(e) => onNodeMouseDown(e, node)}
                style={{
                  position: 'absolute', left: node.x, top: node.y, width: 260,
                  background: '#161b22', borderRadius: 8,
                  border: isSel ? '2px solid #2f81f7' : '1px solid #30363d',
                  boxShadow: isSel ? '0 4px 20px rgba(47,129,247,0.35)' : '0 2px 8px rgba(0,0,0,0.5)',
                  cursor: 'move', fontSize: 11,
                }}
              >
                {/* Header */}
                <div style={{
                  padding: '5px 10px', borderRadius: '6px 6px 0 0', fontWeight: 600, color: '#fff',
                  background: def.headerColor || '#30363d', display: 'flex', justifyContent: 'space-between',
                }}>
                  <span>{def.label}</span>
                  <span style={{ opacity: 0.6, fontSize: 9 }}>{def.category}</span>
                </div>
                {/* Sockets + params */}
                <div style={{ padding: '6px 0' }}>
                  {def.inputs.map((input) => {
                    const connected = graph.edges.some((e2) => e2.to.node === node.id && e2.to.socket === input.name)
                    return (
                      // S21: data-socket na LINHA inteira — o alvo de drop passa
                      // de 10×10px para a linha de 22px (muito mais utilizável)
                      <div key={input.name} data-socket={`${node.id}::${input.name}`} style={{ display: 'flex', alignItems: 'center', height: 22, paddingLeft: 0 }}>
                        <div
                          data-socket={`${node.id}::${input.name}`}
                          title={`${input.name} (${input.type})`}
                          onMouseDown={(e) => startConnect(e, node, input.name, input.type, false)}
                          style={{
                            width: 10, height: 10, borderRadius: 3, marginLeft: -5, cursor: 'crosshair',
                            background: TYPE_COLORS[input.type] || '#8b949e',
                            border: connected ? '2px solid #fff' : '1px solid #0d1117',
                          }}
                        />
                        <span style={{ marginLeft: 6, color: connected ? '#e6edf3' : '#8b949e' }}>
                          {input.name}{input.optional ? ' ?' : ''}
                        </span>
                      </div>
                    )
                  })}
                  {/* Params inline */}
                  {def.params?.map((prm) => (
                    <div key={prm.key} style={{ display: 'flex', alignItems: 'center', height: 24, paddingLeft: 14, gap: 6 }}>
                      <span style={{ color: '#8b949e', width: 80, overflow: 'hidden', textOverflow: 'ellipsis' }}>{prm.label}</span>
                      {prm.type === 'color' ? (
                        <input type="color" value={node.params?.[prm.key] || '#ffffff'}
                          onChange={(e) => setParam(node.id, prm.key, e.target.value)}
                          style={{ width: 40, height: 18, padding: 0 }} />
                      ) : prm.type === 'checkbox' ? (
                        <input type="checkbox" checked={!!node.params?.[prm.key]}
                          onChange={(e) => setParam(node.id, prm.key, e.target.checked)} />
                      ) : prm.type === 'select' ? (
                        <select value={node.params?.[prm.key] ?? prm.options?.[0]?.value ?? ''}
                          onChange={(e) => setParam(node.id, prm.key, e.target.value)}
                          style={{ flex: 1, minWidth: 0, height: 18, fontSize: 10 }}>
                          {(prm.options || []).map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : (
                        <input type={prm.type === 'range' ? 'range' : 'number'}
                          min={prm.min} max={prm.max} step={prm.step}
                          value={node.params?.[prm.key] ?? prm.defaultValue ?? 0}
                          onChange={(e) => setParam(node.id, prm.key, prm.type === 'range' ? Number(e.target.value) : e.target.value)}
                          style={{ flex: 1, minWidth: 0, height: 16, fontSize: 10 }} />
                      )}
                    </div>
                  ))}
                  {/* Color ramp stops especiais */}
                  {node.type === 'colorRamp' && (
                    <div style={{ padding: '4px 14px 6px' }}>
                      {(node.params?.stops || []).map((stop, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, height: 20 }}>
                          <input type="range" min="0" max="1" step="0.01" value={stop.pos} style={{ flex: 1, height: 12 }}
                            onChange={(e) => {
                              const stops = [...node.params.stops]
                              stops[i] = { ...stop, pos: Number(e.target.value) }
                              setParam(node.id, 'stops', stops)
                            }} />
                          <input type="color" value={stop.color} style={{ width: 24, height: 16, padding: 0 }}
                            onChange={(e) => {
                              const stops = [...node.params.stops]
                              stops[i] = { ...stop, color: e.target.value }
                              setParam(node.id, 'stops', stops)
                            }} />
                        </div>
                      ))}
                      <button style={{ fontSize: 9, padding: '1px 6px', marginTop: 2 }}
                        onClick={() => setParam(node.id, 'stops', [...(node.params?.stops || []), { pos: 1, color: '#ffffff' }])}>
                        + stop
                      </button>
                    </div>
                  )}
                  {def.outputs.map((output) => (
                    <div key={output.name} style={{ display: 'flex', alignItems: 'center', height: 22, justifyContent: 'flex-end', paddingRight: 0 }}>
                      <span style={{ marginRight: 6, color: '#e6edf3' }}>{output.name}</span>
                      <div
                        title={`${output.name} (${output.type})`}
                        onMouseDown={(e) => startConnect(e, node, output.name, output.type, true)}
                        style={{
                          width: 10, height: 10, borderRadius: 3, marginRight: -5, cursor: 'crosshair',
                          background: TYPE_COLORS[output.type] || '#8b949e', border: '1px solid #0d1117',
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        {/* Hint */}
        <div style={{ position: 'absolute', bottom: 4, left: 8, fontSize: 9, color: '#8b949e', pointerEvents: 'none' }}>
          arrastar nó = mover · arrastar fundo = pan · roda = zoom · Shift+F = focar · Del = apagar · clicar edge = remover
        </div>
      </div>
    </div>
  )
}

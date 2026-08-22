/**
 * UVEditor — editor de UVs estilo Blender (canvas 2D).
 *
 * Funcionalidades:
 *  - Viewport 2D (canvas) que mostra as coordenadas UV (0..1)
 *  - Desenha triângulos UV como wireframe (linhas cyan #00ffff)
 *  - Seleção de vértices UV (click)
 *  - Transformar UVs selecionados: mover, rodar, escalar (drag com rato)
 *  - Toolbar: Select / Move / Rotate / Scale / Pan
 *  - Unwrap: Planar / Box / Spherical / Cylindrical
 *  - Lista de ilhas UV (display-only)
 *
 * Cores:
 *  - Background: #1a1a1a
 *  - Grelha 0.1: #2a2a2a
 *  - Linhas UV: #00ffff (cyan)
 *  - Vértices selecionados: #ffff00 (yellow)
 *  - Vértices não selecionados: #00ffff
 */
import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import * as THREE from 'three'
import { useStore } from '../../store/useStore'
import { unwrapUV } from '../../utils/meshOperations'
import { PRIMITIVES } from '../../utils/primitives'
import {
  IconClose,
  IconTranslate,
  IconRotate,
  IconScale,
  IconUV,
  IconUnwrap,
} from '../ui/Icons'

const CANVAS_SIZE = 512
const BG = '#1a1a1a'
const GRID_MINOR = '#2a2a2a'
const GRID_MAJOR = '#3a3a3a'
const UV_LINE = '#00ffff'
const UV_POINT = '#00ffff'
const UV_SELECTED = '#ffff00'

const TOOLS = [
  { id: 'select', label: 'Select', icon: IconUV, hint: 'Selecionar vértices UV' },
  { id: 'move', label: 'Move', icon: IconTranslate, hint: 'Mover UVs (G)' },
  { id: 'rotate', label: 'Rotate', icon: IconRotate, hint: 'Rodar UVs (R)' },
  { id: 'scale', label: 'Scale', icon: IconScale, hint: 'Escalar UVs (S)' },
  { id: 'pan', label: 'Pan', hint: 'Arrastar para navegar' },
]

const UNWRAP_METHODS = [
  { id: 'planar', label: 'Planar' },
  { id: 'box', label: 'Box' },
  { id: 'spherical', label: 'Spherical' },
  { id: 'cylindrical', label: 'Cylindrical' },
]

// ---------- Utilitários de geometria ----------

// Constrói um THREE.BufferGeometry a partir do objeto (customGeometry ou primitiva).
function buildGeometry(obj) {
  if (!obj) return null
  if (obj.customGeometry) {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(obj.customGeometry.positions, 3))
    if (obj.customGeometry.normals) {
      g.setAttribute('normal', new THREE.Float32BufferAttribute(obj.customGeometry.normals, 3))
    }
    if (obj.customGeometry.uvs) {
      g.setAttribute('uv', new THREE.Float32BufferAttribute(obj.customGeometry.uvs, 2))
    }
    return g
  }
  if (obj.imported && obj.bufferGeometry) {
    return obj.bufferGeometry.clone()
  }
  const def = PRIMITIVES[obj.type]
  if (!def) return null
  return def.build(THREE, obj.args || def.defaultArgs)
}

// Agrupa vértices UV em "ilhas" (componentes conexos via triângulos).
function computeIslands(geometry) {
  if (!geometry) return []
  const pos = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  if (!pos || !uv) return []
  const index = geometry.index ? geometry.index.array : null
  const triCount = index ? index.length / 3 : pos.count / 3
  // Cada triângulo gera 3 vértices UV únicos por posição UV (pela localização)
  // Para ilhas: agrupar triângulos que partilhem um vértice UV (mesmo u,v com threshold)
  const threshold = 1e-5
  const uvToVerts = new Map() // chave "u,v" -> [triIdx,...]
  const keyOf = (u, v) => `${Math.round(u / threshold)},${Math.round(v / threshold)}`
  const triUVs = []
  for (let t = 0; t < triCount; t++) {
    const a = index ? index[t * 3] : t * 3
    const b = index ? index[t * 3 + 1] : t * 3 + 1
    const c = index ? index[t * 3 + 2] : t * 3 + 2
    const ua = uv.getX(a), va = uv.getY(a)
    const ub = uv.getX(b), vb = uv.getY(b)
    const uc = uv.getX(c), vc = uv.getY(c)
    triUVs.push([[ua, va], [ub, vb], [uc, vc]])
    for (const [u, v] of [[ua, va], [ub, vb], [uc, vc]]) {
      const k = keyOf(u, v)
      if (!uvToVerts.has(k)) uvToVerts.set(k, new Set())
      uvToVerts.get(k).add(t)
    }
  }
  // Union-Find sobre triângulos
  const parent = Array.from({ length: triCount }, (_, i) => i)
  const find = (x) => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]]
      x = parent[x]
    }
    return x
  }
  const union = (a, b) => {
    const ra = find(a), rb = find(b)
    if (ra !== rb) parent[ra] = rb
  }
  for (const set of uvToVerts.values()) {
    const arr = [...set]
    for (let i = 1; i < arr.length; i++) union(arr[0], arr[i])
  }
  const groups = new Map()
  for (let t = 0; t < triCount; t++) {
    const r = find(t)
    if (!groups.has(r)) groups.set(r, [])
    groups.get(r).push(t)
  }
  return [...groups.values()].map((tris, idx) => ({
    id: idx,
    triangleCount: tris.length,
  }))
}

// ---------- Componente ----------

export default function UVEditor({ objectId, onClose }) {
  const canvasRef = useRef(null)
  const [tool, setTool] = useState('select')
  const [selectedVertices, setSelectedVertices] = useState(new Set()) // índices UV
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const dragRef = useRef(null) // { startX, startY, lastX, lastY, mode }
  const [uvsVersion, setUvsVersion] = useState(0) // forçar redraw

  const objects = useStore((s) => s.objects)
  const setObjectUVs = useStore((s) => s.setObjectUVs)
  const applyMeshOp = useStore((s) => s.applyMeshOp)
  const toast = useStore((s) => s.toast)

  const obj = objects.find((o) => o.id === objectId)

  // Constrói geometria local (com UVs) — useMemo para evitar recompute a cada render
  const geometry = useMemo(() => {
    if (!obj) return null
    let g = buildGeometry(obj)
    if (!g) return null
    if (!g.getAttribute('uv')) {
      // Auto-unwrap planar se não houver UVs
      g = unwrapUV(g, 'planar')
    }
    return g
  }, [obj, uvsVersion])

  // Lista de triângulos UV [{ uva, uvb, uvc, indices:[a,b,c] }]
  const triangles = useMemo(() => {
    if (!geometry) return []
    const uv = geometry.getAttribute('uv')
    if (!uv) return []
    const pos = geometry.getAttribute('position')
    const index = geometry.index ? geometry.index.array : null
    const triCount = index ? index.length / 3 : pos.count / 3
    const out = []
    for (let t = 0; t < triCount; t++) {
      const a = index ? index[t * 3] : t * 3
      const b = index ? index[t * 3 + 1] : t * 3 + 1
      const c = index ? index[t * 3 + 2] : t * 3 + 2
      out.push({
        a, b, c,
        ua: uv.getX(a), va: uv.getY(a),
        ub: uv.getX(b), vb: uv.getY(b),
        uc: uv.getX(c), vc: uv.getY(c),
      })
    }
    return out
  }, [geometry])

  // Ilhas UV (display-only)
  const islands = useMemo(() => computeIslands(geometry), [geometry])

  // ---------- Coordenadas UV <-> Canvas ----------
  const uvToCanvas = useCallback((u, v) => {
    // UV (0..1) -> canvas (com zoom/pan). Nota: canvas Y cresce para baixo.
    const px = (u * CANVAS_SIZE * zoom) + pan.x
    const py = ((1 - v) * CANVAS_SIZE * zoom) + pan.y
    return [px, py]
  }, [zoom, pan])

  const canvasToUV = useCallback((px, py) => {
    const u = (px - pan.x) / (CANVAS_SIZE * zoom)
    const v = 1 - (py - pan.y) / (CANVAS_SIZE * zoom)
    return [u, v]
  }, [zoom, pan])

  // ---------- Draw ----------
  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.fillStyle = BG
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

    // Grelha 0.1
    ctx.strokeStyle = GRID_MINOR
    ctx.lineWidth = 1
    for (let i = 0; i <= 10; i++) {
      const [px, _py] = uvToCanvas(i / 10, 0)
      const [, py1] = uvToCanvas(0, 0)
      const [, py2] = uvToCanvas(0, 1)
      ctx.beginPath()
      ctx.moveTo(px, py1)
      ctx.lineTo(px, py2)
      ctx.stroke()
      const [px0, ] = uvToCanvas(0, 0)
      const [px1, ] = uvToCanvas(1, 0)
      const [, py] = uvToCanvas(0, i / 10)
      ctx.beginPath()
      ctx.moveTo(px0, py)
      ctx.lineTo(px1, py)
      ctx.stroke()
    }
    // Bordas 0 e 1
    ctx.strokeStyle = GRID_MAJOR
    ctx.lineWidth = 1.5
    const [x0, y0] = uvToCanvas(0, 0)
    const [x1, y1] = uvToCanvas(1, 1)
    ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0))

    // Linhas UV (triângulos como wireframe)
    ctx.strokeStyle = UV_LINE
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const tri of triangles) {
      const [ax, ay] = uvToCanvas(tri.ua, tri.va)
      const [bx, by] = uvToCanvas(tri.ub, tri.vb)
      const [cx, cy] = uvToCanvas(tri.uc, tri.vc)
      ctx.moveTo(ax, ay)
      ctx.lineTo(bx, by)
      ctx.lineTo(cx, cy)
      ctx.closePath()
    }
    ctx.stroke()

    // Vértices UV
    const drawn = new Set()
    for (const tri of triangles) {
      for (const vi of [tri.a, tri.b, tri.c]) {
        if (drawn.has(vi)) continue
        drawn.add(vi)
        const u = geometry.getAttribute('uv').getX(vi)
        const v = geometry.getAttribute('uv').getY(vi)
        const [px, py] = uvToCanvas(u, v)
        ctx.fillStyle = selectedVertices.has(vi) ? UV_SELECTED : UV_POINT
        ctx.beginPath()
        ctx.arc(px, py, selectedVertices.has(vi) ? 4 : 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [triangles, selectedVertices, uvToCanvas, geometry])

  useEffect(() => {
    draw()
  }, [draw])

  // ---------- Mouse handlers ----------
  const findVertexAt = (px, py) => {
    if (!geometry) return null
    const uv = geometry.getAttribute('uv')
    const threshold = 8 // pixels
    let best = null
    let bestDist = threshold * threshold
    for (let i = 0; i < uv.count; i++) {
      const u = uv.getX(i)
      const v = uv.getY(i)
      const [vx, vy] = uvToCanvas(u, v)
      const d = (vx - px) ** 2 + (vy - py) ** 2
      if (d < bestDist) {
        bestDist = d
        best = i
      }
    }
    return best
  }

  const onMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    dragRef.current = { startX: px, startY: py, lastX: px, lastY: py, mode: tool }

    if (tool === 'select') {
      const vi = findVertexAt(px, py)
      if (vi == null) {
        if (!e.shiftKey) setSelectedVertices(new Set())
        return
      }
      setSelectedVertices((prev) => {
        const next = new Set(e.shiftKey ? prev : [])
        if (next.has(vi)) next.delete(vi)
        else next.add(vi)
        return next
      })
    } else if (tool === 'pan') {
      // nada — handled no move
    } else {
      // move/rotate/scale — selecionar vértice se click num, e iniciar drag
      if (selectedVertices.size === 0) {
        const vi = findVertexAt(px, py)
        if (vi != null) setSelectedVertices(new Set([vi]))
      }
    }
  }

  const onMouseMove = (e) => {
    const drag = dragRef.current
    if (!drag || !geometry) return
    const rect = canvasRef.current.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const dx = px - drag.lastX
    const dy = py - drag.lastY
    drag.lastX = px
    drag.lastY = py

    if (drag.mode === 'pan') {
      setPan((p) => ({ x: p.x + dx, y: p.y + dy }))
      return
    }

    if (selectedVertices.size === 0) return
    if (drag.mode === 'move') {
      // dx,dy em pixels -> UV units
      const duv = canvasToUV(px, py)
      const duvStart = canvasToUV(drag.startX, drag.startY)
      // Aplicar delta a partir do start (mais estável)
      const du = duv[0] - duvStart[0]
      const dv = duv[1] - duvStart[1]
      applyTransformToSelected((u, v, _vi) => {
        // Manter traço do start: precisamos da UV original — guardamos no drag
        if (!drag.origUVs) drag.origUVs = new Map()
        if (!drag.origUVs.has(_vi)) {
          const uv = geometry.getAttribute('uv')
          drag.origUVs.set(_vi, [uv.getX(_vi), uv.getY(_vi)])
        }
        const [ou, ov] = drag.origUVs.get(_vi)
        return [ou + du, ov + dv]
      })
    } else if (drag.mode === 'rotate' || drag.mode === 'scale') {
      // Centro: média dos selecionados
      const uv = geometry.getAttribute('uv')
      let cu = 0, cv = 0
      selectedVertices.forEach((vi) => {
        cu += uv.getX(vi)
        cv += uv.getY(vi)
      })
      cu /= selectedVertices.size
      cv /= selectedVertices.size
      const [cx, cy] = uvToCanvas(cu, cv)
      const angle = Math.atan2(py - cy, px - cx) - Math.atan2(drag.startY - cy, drag.startX - cx)
      const distStart = Math.hypot(drag.startX - cx, drag.startY - cy) + 1e-6
      const distNow = Math.hypot(px - cx, py - cy)
      const scale = distNow / distStart
      if (!drag.origUVs) drag.origUVs = new Map()
      applyTransformToSelected((u, v, vi) => {
        if (!drag.origUVs.has(vi)) drag.origUVs.set(vi, [u, v])
        const [ou, ov] = drag.origUVs.get(vi)
        let du = ou - cu
        let dv = ov - cv
        if (drag.mode === 'rotate') {
          const cos = Math.cos(angle), sin = Math.sin(angle)
          return [cu + du * cos - dv * sin, cv + du * sin + dv * cos]
        }
        // scale
        return [cu + du * scale, cv + dv * scale]
      })
    }
  }

  const applyTransformToSelected = (transformFn) => {
    if (!geometry) return
    const uv = geometry.getAttribute('uv')
    const arr = uv.array
    selectedVertices.forEach((vi) => {
      const [nu, nv] = transformFn(uv.getX(vi), uv.getY(vi), vi)
      arr[vi * 2] = nu
      arr[vi * 2 + 1] = nv
    })
    uv.needsUpdate = true
    setUvsVersion((v) => v + 1)
  }

  const onMouseUp = () => {
    if (dragRef.current && dragRef.current.mode !== 'select' && selectedVertices.size > 0) {
      // Persistir UVs modificados no store
      const uvs = Array.from(geometry.getAttribute('uv').array)
      setObjectUVs(objectId, uvs)
      toast('UVs guardados', 'success', 1200)
    }
    dragRef.current = null
  }

  const onWheel = (e) => {
    e.preventDefault()
    const delta = -e.deltaY * 0.001
    setZoom((z) => Math.max(0.2, Math.min(5, z + delta * z)))
  }

  // ---------- Unwrap buttons ----------
  const handleUnwrap = (method) => {
    if (!obj) return
    applyMeshOp(objectId, 'unwrap', { method })
    setSelectedVertices(new Set())
    setUvsVersion((v) => v + 1)
    toast(`Unwrap "${method}" aplicado`, 'success', 1200)
  }

  // ---------- Render ----------
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 720, width: '95%', maxHeight: '90vh', overflowY: 'auto' }}
      >
        <div className="row between" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>
            UV Editor {obj ? `— ${obj.name}` : ''}
          </h3>
          <button className="icon" onClick={onClose} title="Fechar">
            <IconClose width={16} height={16} />
          </button>
        </div>

        {!obj && (
          <p className="small muted">Nenhum objeto selecionado.</p>
        )}

        {obj && (
          <>
            {/* Toolbar */}
            <div
              className="panel-section"
              style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}
            >
              {TOOLS.map((t) => {
                const Icon = t.icon
                const active = tool === t.id
                return (
                  <button
                    key={t.id}
                    className={active ? 'active' : ''}
                    onClick={() => setTool(t.id)}
                    title={t.hint}
                    style={{ padding: '6px 10px', fontSize: 12 }}
                  >
                    {Icon && <Icon width={14} height={14} />}
                    <span>{t.label}</span>
                  </button>
                )
              })}
              <span className="small muted" style={{ marginLeft: 'auto' }}>
                Zoom: {zoom.toFixed(2)}x • Vértices: {selectedVertices.size} sel.
              </span>
            </div>

            {/* Unwrap buttons */}
            <div
              className="panel-section"
              style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}
            >
              <span className="small muted" style={{ marginRight: 4 }}>
                <IconUnwrap width={12} height={12} /> Unwrap:
              </span>
              {UNWRAP_METHODS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleUnwrap(m.id)}
                  title={`Unwrap ${m.label}`}
                  style={{ padding: '6px 10px', fontSize: 12 }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {/* Canvas */}
              <div
                style={{
                  position: 'relative',
                  width: CANVAS_SIZE,
                  height: CANVAS_SIZE,
                  maxWidth: '100%',
                  flex: '0 0 auto',
                }}
              >
                <canvas
                  ref={canvasRef}
                  width={CANVAS_SIZE}
                  height={CANVAS_SIZE}
                  onMouseDown={onMouseDown}
                  onMouseMove={onMouseMove}
                  onMouseUp={onMouseUp}
                  onMouseLeave={onMouseUp}
                  onWheel={onWheel}
                  style={{
                    width: '100%',
                    height: 'auto',
                    aspectRatio: '1 / 1',
                    cursor:
                      tool === 'pan' ? 'grab' :
                      tool === 'select' ? 'pointer' : 'crosshair',
                    border: '1px solid var(--border)',
                    borderRadius: 4,
                    background: BG,
                    touchAction: 'none',
                  }}
                />
              </div>

              {/* Side panel: islands + info */}
              <div style={{ flex: '1 1 200px', minWidth: 200 }}>
                <div className="panel-section" style={{ padding: 0 }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Ilhas UV</h4>
                  {islands.length === 0 ? (
                    <p className="small muted">Sem ilhas.</p>
                  ) : (
                    <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                      {islands.map((isl) => (
                        <div
                          key={isl.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            padding: '4px 6px',
                            borderBottom: '1px solid var(--border)',
                            fontSize: 12,
                          }}
                        >
                          <span>Ilha {isl.id + 1}</span>
                          <span className="muted">{isl.triangleCount} tris</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel-section" style={{ marginTop: 8, padding: 0 }}>
                  <h4 style={{ margin: '0 0 8px 0', fontSize: 13 }}>Atalhos</h4>
                  <ul style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0, paddingLeft: 16 }}>
                    <li>Click: selecionar vértice</li>
                    <li>Shift+Click: adicionar à seleção</li>
                    <li>Move/Rotate/Scale: arrastar para transformar</li>
                    <li>Pan: arrastar para navegar</li>
                    <li>Scroll: zoom</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

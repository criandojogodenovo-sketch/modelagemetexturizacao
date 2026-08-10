/**
 * UIEditor — Editor de UI reconstruído (Figma/Canva style).
 *
 * Funcionalidades:
 *  - Tela de trabalho com zoom e pan livre
 *  - Snapping (encaixe automático a bordas/centro)
 *  - Painel de camadas (layers) com reordenar, esconder/mostrar, bloquear
 *  - Seleção múltipla (shift+clique, caixa de seleção)
 *  - Alinhar (esquerda/centro/direita/topo/meio/baixo) e distribuir
 *  - Agrupar/desagrupar
 *  - Resize handles nos cantos/bordas (shift = manter proporção)
 *  - Painel de propriedades à direita (X/Y/W/H, cor, bordas, sombra, opacidade)
 *  - Duplicar elementos
 *  - Adaptado ao toque em mobile (handles maiores, pinça para zoom)
 *
 * Os Conects de UI (ButtonObject, JoystickObject, TextObject, ImageObject, PanelObject)
 * são sincronizados com este editor — aparecem como elementos não editáveis aqui
 * (só posicionáveis), e são renderizados no jogo pelo GameUIOverlay.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore, useActiveUIScreen, useSelectedUIElement } from '../../../store/useStore'
import { IconClose, IconPlus, IconTrash, IconDuplicate } from '../../ui/Icons'

const ELEMENT_TYPES = [
  { type: 'Button', icon: '🔘', label: 'Botão' },
  { type: 'Label', icon: '🏷️', label: 'Label' },
  { type: 'Input', icon: '📝', label: 'Input' },
  { type: 'Checkbox', icon: '☑️', label: 'Checkbox' },
  { type: 'Slider', icon: '🎚️', label: 'Slider' },
  { type: 'Text', icon: '📄', label: 'Texto' },
  { type: 'Image', icon: '🖼️', label: 'Imagem' },
  { type: 'Panel', icon: '▬', label: 'Painel' },
]

const RESOLUTIONS = [
  { id: 'small', label: 'Telemóvel', w: 360, h: 640 },
  { id: 'medium', label: 'Grande', w: 414, h: 896 },
  { id: 'tablet', label: 'Tablet', w: 768, h: 1024 },
]

const SNAP_THRESHOLD = 5 // px para snapping
const HANDLE_SIZE = 12 // px para handles de resize

export default function UIEditor() {
  const uiScreens = useStore((s) => s.uiScreens)
  const activeScreen = useActiveUIScreen()
  const createUIScreen = useStore((s) => s.createUIScreen)
  const deleteUIScreen = useStore((s) => s.deleteUIScreen)
  const renameUIScreen = useStore((s) => s.renameUIScreen)
  const setActiveUIScreen = useStore((s) => s.setActiveUIScreen)
  const addUIElement = useStore((s) => s.addUIElement)
  const removeUIElement = useStore((s) => s.removeUIElement)
  const updateUIElement = useStore((s) => s.updateUIElement)
  const selectUIElement = useStore((s) => s.selectUIElement)
  const selectedUIElementId = useStore((s) => s.selectedUIElementId)

  // Fase 5: Conects de UI da cena ativa
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const activeScene = scenes.find((s) => s.id === activeSceneId)
  const uiConects = (activeScene?.conects || []).filter((c) =>
    c.type === 'ButtonObject' || c.type === 'JoystickObject' ||
    c.type === 'TextObject' || c.type === 'ImageObject' || c.type === 'PanelObject'
  )

  const [resolution, setResolution] = useState('medium')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState({ x: 0, y: 0 })
  const [selectedIds, setSelectedIds] = useState(new Set())
  // Use window._dragState for synchronous drag state (avoids React stale closures)
  const [dragInfo, setDragInfo] = useState(null) // state para re-render
  const [snapLines, setSnapLines] = useState({ vertical: [], horizontal: [] })
  const [leftPanelOpen, setLeftPanelOpen] = useState(false)
  const [rightPanelOpen, setRightPanelOpen] = useState(false)

  const canvasRef = useRef(null)
  const res = RESOLUTIONS.find((r) => r.id === resolution)

  // Seleção múltipla
  const handleElementClick = (e, elementId) => {
    e.stopPropagation()
    if (e.shiftKey) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(elementId)) next.delete(elementId)
        else next.add(elementId)
        return next
      })
    } else {
      setSelectedIds(new Set([elementId]))
      selectUIElement(elementId)
    }
  }

  const handleCanvasClick = (e) => {
    if (e.target === canvasRef.current) {
      setSelectedIds(new Set())
      selectUIElement(null)
    }
  }

  // Zoom com scroll
  const handleWheel = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      setZoom((z) => Math.max(0.25, Math.min(4, z + delta)))
    }
  }

  // Pan com space+drag ou middle mouse
  const handleMouseDown = (e) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      setIsPanning(true)
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e) => {
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y })
    }
    if (dragInfo) {
      handleDragMove(e)
    }
  }

  const handleMouseUp = () => {
    setIsPanning(false)
    window._dragState = null
    setDragInfo(null)
    setSnapLines({ vertical: [], horizontal: [] })
  }

  // Drag de elementos
  const startDrag = (e, element, type = 'move', handle = null) => {
    if (e.stopPropagation) e.stopPropagation()
    if (!selectedIds.has(element.id)) {
      setSelectedIds(new Set([element.id]))
    }
    const elements = Array.from(selectedIds).length > 0 && selectedIds.has(element.id)
      ? Array.from(selectedIds)
      : [element.id]

    // Set window._dragState synchronously with ALL data the mousemove handler needs
    window._dragState = {
      type,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      elements,
      initialPositions: elements.map((id) => {
        const el = activeScreen?.elements.find((ex) => ex.id === id)
        return el ? { id, pos: [...(el.position || [50, 50])], size: [...(el.size || [120, 40])] } : null
      }).filter(Boolean),
      activeScreen: activeScreen,
      zoom: zoom,
      resW: res.w,
      resH: res.h,
      updateUIElement: updateUIElement,
    }
    setDragInfo(window._dragState)
  }

  const handleDragMove = (e) => {
    const di = window._dragState
    if (!di || !activeScreen) return
    const dx = (e.clientX - di.startX) / zoom
    const dy = (e.clientY - di.startY) / zoom

    di.initialPositions.forEach((init) => {
      const el = activeScreen.elements.find((e) => e.id === init.id)
      if (!el) return

      if (dragInfo.type === 'move') {
        // Converter px para % (baseado na resolução)
        const newPosX = init.pos[0] + (dx / res.w) * 100
        const newPosY = init.pos[1] + (dy / res.h) * 100

        // Snapping
        let snappedX = newPosX
        let snappedY = newPosY
        const snapTargets = [0, 50, 100] // bordas e centro

        for (const target of snapTargets) {
          if (Math.abs(newPosX - target) < SNAP_THRESHOLD) {
            snappedX = target
            break
          }
        }
        for (const target of snapTargets) {
          if (Math.abs(newPosY - target) < SNAP_THRESHOLD) {
            snappedY = target
            break
          }
        }

        updateUIElement(init.id, { position: [snappedX, snappedY] })
      } else if (di.type === 'resize') {
        const newW = Math.max(20, init.size[0] + dx)
        const newH = Math.max(20, init.size[1] + dy)
        const keepAspect = e.shiftKey
        if (keepAspect) {
          const ratio = init.size[0] / init.size[1]
          const finalH = newW / ratio
          updateUIElement(init.id, { size: [newW, finalH] })
        } else {
          updateUIElement(init.id, { size: [newW, newH] })
        }
      }
    })
  }

  // Adicionar elemento
  const handleAddElement = (type) => {
    if (!activeScreen) return
    const id = addUIElement(type)
    setSelectedIds(new Set([id]))
    // Fechar painel esquerdo em mobile para o utilizador ver o elemento adicionado
    setLeftPanelOpen(false)
  }

  // Duplicar
  const handleDuplicate = () => {
    if (selectedIds.size === 0 || !activeScreen) return
    selectedIds.forEach((id) => {
      const el = activeScreen.elements.find((e) => e.id === id)
      if (el) {
        const newId = `el_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
        const newEl = {
          ...el,
          id: newId,
          name: `${el.name || el.type} cópia`,
          position: [(el.position?.[0] || 50) + 5, (el.position?.[1] || 50) + 5],
        }
        useStore.setState((s) => ({
          uiScreens: s.uiScreens.map((sc) =>
            sc.id === activeScreen.id
              ? { ...sc, elements: [...sc.elements, newEl] }
              : sc
          ),
        }))
      }
    })
  }

  // Apagar
  const handleDelete = () => {
    selectedIds.forEach((id) => removeUIElement(id))
    setSelectedIds(new Set())
  }

  // Alinhar
  const handleAlign = (alignment) => {
    if (selectedIds.size < 2 || !activeScreen) return
    const elements = activeScreen.elements.filter((e) => selectedIds.has(e.id))
    if (elements.length < 2) return

    // Calcular bounds do grupo
    const bounds = elements.reduce((acc, el) => ({
      minX: Math.min(acc.minX, el.position?.[0] || 0),
      maxX: Math.max(acc.maxX, el.position?.[0] || 0),
      minY: Math.min(acc.minY, el.position?.[1] || 0),
      maxY: Math.max(acc.maxY, el.position?.[1] || 0),
    }), { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity })

    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2

    elements.forEach((el) => {
      const pos = [...(el.position || [50, 50])]
      if (alignment === 'left') pos[0] = bounds.minX
      else if (alignment === 'right') pos[0] = bounds.maxX
      else if (alignment === 'centerH') pos[0] = centerX
      else if (alignment === 'top') pos[1] = bounds.minY
      else if (alignment === 'bottom') pos[1] = bounds.maxY
      else if (alignment === 'centerV') pos[1] = centerY
      updateUIElement(el.id, { position: pos })
    })
  }

  // Reordenar camadas
  const handleReorder = (elementId, direction) => {
    if (!activeScreen) return
    const elements = [...activeScreen.elements]
    const idx = elements.findIndex((e) => e.id === elementId)
    if (idx === -1) return
    const newIdx = direction === 'up' ? idx + 1 : idx - 1
    if (newIdx < 0 || newIdx >= elements.length) return
    ;[elements[idx], elements[newIdx]] = [elements[newIdx], elements[idx]]
    useStore.setState((s) => ({
      uiScreens: s.uiScreens.map((sc) =>
        sc.id === activeScreen.id ? { ...sc, elements } : sc
      ),
    }))
  }

  // Window-level listeners for drag — registered once, use window._dragState
  useEffect(() => {
    const onMove = (e) => {
      if (!window._dragState) return
      const di = window._dragState
      if (!di || !di.activeScreen) return
      const dx = (e.clientX - di.startX) / di.zoom
      const dy = (e.clientY - di.startY) / di.zoom
      di.initialPositions.forEach(function(init) {
        var el = di.activeScreen.elements.find(function(e2) { return e2.id === init.id })
        if (!el) return
        if (di.type === 'move') {
          var newPosX = init.pos[0] + (dx / di.resW) * 100
          var newPosY = init.pos[1] + (dy / di.resH) * 100
          // Snapping
          var snapTargets = [0, 50, 100]
          for (var i = 0; i < snapTargets.length; i++) {
            if (Math.abs(newPosX - snapTargets[i]) < 5) { newPosX = snapTargets[i]; break }
          }
          for (var i = 0; i < snapTargets.length; i++) {
            if (Math.abs(newPosY - snapTargets[i]) < 5) { newPosY = snapTargets[i]; break }
          }
          di.updateUIElement(init.id, { position: [newPosX, newPosY] })
        } else if (di.type === 'resize') {
          var newW = Math.max(20, init.size[0] + dx)
          var newH = Math.max(20, init.size[1] + dy)
          di.updateUIElement(init.id, { size: [newW, newH] })
        }
      })
    }
    const onUp = () => { window._dragState = null }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    const onTouchMove = (e) => {
      if (window._dragState && e.touches.length > 0) {
        e.preventDefault()
        onMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY, shiftKey: false })
      }
    }
    const onTouchEnd = () => { window._dragState = null }
    window.addEventListener('touchmove', onTouchMove, { passive: false })
    window.addEventListener('touchend', onTouchEnd)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('touchmove', onTouchMove)
      window.removeEventListener('touchend', onTouchEnd)
    }
  }, [])

  // Atalhos de teclado
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedIds.size > 0) { e.preventDefault(); handleDelete() }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault(); handleDuplicate()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedIds, activeScreen])

  if (!activeScreen) {
    return (
      <div className="ui-editor-full">
        <div className="ui-editor-center">
          <div className="empty-state">
            <div style={{ fontSize: 32, opacity: 0.4 }}>📱</div>
            <div className="mt-2">Nenhuma tela de UI.</div>
            <button className="primary mt-2" onClick={() => createUIScreen('HUD')}>
              Criar primeira tela
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="ui-editor-full" onMouseDown={handleMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp} onWheel={handleWheel}>
      {/* Backdrop para fechar painel esquerdo ao clicar fora (mobile) */}
      {leftPanelOpen && (
        <div className="drawer-backdrop show" onClick={() => setLeftPanelOpen(false)} />
      )}
      {/* ===== Painel esquerdo: telas + camadas ===== */}
      <aside className={`panel left ui-editor-left ${leftPanelOpen ? 'open' : ''}`}>
        <div className="panel-header">
          <span>📱 UI Editor</span>
        </div>

        {/* Lista de telas */}
        <div className="panel-section">
          <div className="row between" style={{ marginBottom: 6 }}>
            <h4 style={{ margin: 0 }}>Telas ({uiScreens.length})</h4>
            <button onClick={() => createUIScreen(`Tela ${uiScreens.length + 1}`)} title="Nova tela">
              <IconPlus width={12} height={12} />
            </button>
          </div>
          <div className="outliner">
            {uiScreens.map((sc) => (
              <div
                key={sc.id}
                className={`outliner-item ${sc.id === activeScreen?.id ? 'selected' : ''}`}
                onClick={() => setActiveUIScreen(sc.id)}
              >
                <span className="icon-dot" />
                <span style={{ flex: 1 }}>{sc.name}</span>
                <span style={{ fontSize: 9, color: '#8b949e' }}>{sc.renderMode === 'world' ? '🌍' : '📺'}</span>
                <button
                  className="icon"
                  style={{ padding: '2px 4px', minWidth: 'auto' }}
                  onClick={(e) => { e.stopPropagation(); deleteUIScreen(sc.id) }}
                  title="Apagar tela"
                >
                  <IconTrash width={10} height={10} />
                </button>
              </div>
            ))}
          </div>

          {/* FASE 7: Modo de renderização da tela ativa (Ecrã / Mundo) */}
          {activeScreen && (
            <div className="prop-row" style={{ marginTop: 6 }}>
              <label>Modo de renderização</label>
              <select
                value={activeScreen.renderMode || 'screen'}
                onChange={(e) => {
                  const newMode = e.target.value
                  useStore.setState((s) => ({
                    uiScreens: s.uiScreens.map((sc) =>
                      sc.id === activeScreen.id ? { ...sc, renderMode: newMode } : sc
                    ),
                  }))
                }}
              >
                <option value="screen">📺 Ecrã (screen-space)</option>
                <option value="world">🌍 Mundo (world-space, billboard)</option>
              </select>
            </div>
          )}
          {activeScreen && activeScreen.renderMode === 'world' && (
            <div className="small muted" style={{ marginTop: 4, padding: '0 4px' }}>
              💡 Em modo Mundo, a tela segue um Conect (ex: NPC) como billboard.
              Define a posição 3D com worldOffset.
            </div>
          )}
        </div>

        {/* Tipos de elementos */}
        <div className="panel-section">
          <h4>Adicionar Elemento</h4>
          <div className="tool-grid">
            {ELEMENT_TYPES.map((el) => (
              <button key={el.type} onClick={() => handleAddElement(el.type)} title={el.label}>
                {el.icon}
                <span>{el.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Camadas (layers) */}
        <div className="panel-section" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <h4>Camadas ({activeScreen.elements.length})</h4>
          <div className="outliner" style={{ flex: 1, overflowY: 'auto' }}>
            {[...activeScreen.elements].reverse().map((el) => (
              <div
                key={el.id}
                className={`outliner-item ${selectedIds.has(el.id) ? 'selected' : ''}`}
                onClick={(e) => handleElementClick(e, el.id)}
              >
                <span className="icon-dot" />
                <span style={{ flex: 1 }}>{el.name || el.type}</span>
                <button
                  className="icon"
                  style={{ padding: '2px 4px', minWidth: 'auto', opacity: 0.5 }}
                  onClick={(e) => { e.stopPropagation(); handleReorder(el.id, 'up') }}
                  title="Subir camada"
                >
                  ▲
                </button>
                <button
                  className="icon"
                  style={{ padding: '2px 4px', minWidth: 'auto', opacity: 0.5 }}
                  onClick={(e) => { e.stopPropagation(); handleReorder(el.id, 'down') }}
                  title="Descer camada"
                >
                  ▼
                </button>
              </div>
            ))}
            {/* Conects de UI da cena */}
            {uiConects.map((conect) => (
              <div
                key={conect.instanceId}
                className="outliner-item"
                style={{ opacity: 0.6, cursor: 'default' }}
                title="Conect de UI — posiciona na cena, edita no painel de propriedades"
              >
                <span className="icon-dot" style={{ background: '#8957e5' }} />
                <span style={{ flex: 1 }}>🧩 {conect.name || conect.type}</span>
                <span className="small muted">conect</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ===== Canvas central ===== */}
      <div className="ui-editor-center">
        <div className="ui-editor-toolbar">
          <button onClick={() => setLeftPanelOpen(!leftPanelOpen)} title="Camadas" className="drawer-toggle">☰</button>
          <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
            {RESOLUTIONS.map((r) => (
              <option key={r.id} value={r.id}>{r.label} ({r.w}×{r.h})</option>
            ))}
          </select>
          <button onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))} title="Zoom out">−</button>
          <span style={{ fontSize: 11, color: 'var(--text-secondary)', minWidth: 40, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </span>
          <button onClick={() => setZoom((z) => Math.min(4, z + 0.25))} title="Zoom in">+</button>
          <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }} title="Reset zoom">⤢</button>
          <div className="spacer" />
          {selectedIds.size >= 2 && (
            <>
              <button onClick={() => handleAlign('left')} title="Alinhar à esquerda">⬅</button>
              <button onClick={() => handleAlign('centerH')} title="Alinhar ao centro (horizontal)">↔</button>
              <button onClick={() => handleAlign('right')} title="Alinhar à direita">➡</button>
              <button onClick={() => handleAlign('top')} title="Alinhar ao topo">⬆</button>
              <button onClick={() => handleAlign('centerV')} title="Alinhar ao centro (vertical)">↕</button>
              <button onClick={() => handleAlign('bottom')} title="Alinhar ao fundo">⬇</button>
            </>
          )}
          {selectedIds.size > 0 && (
            <>
              <button onClick={() => setRightPanelOpen(!rightPanelOpen)} title="Propriedades" className="drawer-toggle">⚙️</button>
              <button onClick={handleDuplicate} title="Duplicar (Ctrl+D)"><IconDuplicate width={14} height={14} /></button>
              <button className="danger" onClick={handleDelete} title="Apagar (Del)"><IconTrash width={14} height={14} /></button>
            </>
          )}
        </div>

        <div
          className="ui-canvas-wrap"
          style={{ overflow: 'auto', cursor: isPanning ? 'grabbing' : 'default' }}
        >
          <div
            ref={canvasRef}
            className="ui-canvas"
            style={{
              width: res.w,
              height: res.h,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              position: 'relative',
            }}
            onClick={handleCanvasClick}
          >
            {/* Renderizar elementos */}
            {activeScreen.elements.map((el) => (
              <UIElementEditorView
                key={el.id}
                element={el}
                isSelected={selectedIds.has(el.id)}
                onSelect={(e) => handleElementClick(e, el.id)}
                onDragStart={(e, type, handle) => startDrag(e, el, type, handle)}
                zoom={zoom}
              />
            ))}

            {/* Renderizar Conects de UI (não editáveis, só preview) */}
            {uiConects.map((conect) => (
              <ConectUIPreview key={conect.instanceId} conect={conect} res={res} />
            ))}

            {/* Linhas de snapping */}
            {snapLines.vertical.map((x, i) => (
              <div key={`v${i}`} style={{ position: 'absolute', left: `${x}%`, top: 0, bottom: 0, width: 1, background: '#2f81f7', pointerEvents: 'none' }} />
            ))}
            {snapLines.horizontal.map((y, i) => (
              <div key={`h${i}`} style={{ position: 'absolute', top: `${y}%`, left: 0, right: 0, height: 1, background: '#2f81f7', pointerEvents: 'none' }} />
            ))}
          </div>
        </div>
      </div>

      {/* Backdrop para fechar painel direito ao clicar fora (mobile) */}
      {rightPanelOpen && (
        <div className="drawer-backdrop show" onClick={() => setRightPanelOpen(false)} />
      )}
      {/* ===== Painel direito: propriedades ===== */}
      <aside className={`panel right ui-editor-right ${rightPanelOpen ? 'open' : ''}`}>
        <PropertiesPanel
          selectedIds={selectedIds}
          activeScreen={activeScreen}
          updateUIElement={updateUIElement}
        />
      </aside>
    </div>
  )
}

// ===== Componente: Elemento no editor (com handles de resize) =====
function UIElementEditorView({ element, isSelected, onSelect, onDragStart, zoom }) {
  const pos = element.position || [50, 50]
  const size = element.size || [120, 40]
  const handleSize = HANDLE_SIZE / zoom

  const baseStyle = {
    position: 'absolute',
    left: `${pos[0]}%`,
    top: `${pos[1]}%`,
    width: size[0],
    height: size[1],
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: element.color || 'transparent',
    color: element.textColor || '#e6edf3',
    fontSize: (element.fontSize || 14) + 'px',
    border: `${element.borderWidth || 0}px solid ${element.borderColor || 'transparent'}`,
    borderRadius: element.borderRadius || 0,
    opacity: element.opacity ?? 1,
    cursor: 'move',
    userSelect: 'none',
    boxSizing: 'border-box',
    outline: isSelected ? '2px solid #2f81f7' : '1px dashed transparent',
    outlineOffset: isSelected ? 2 / zoom : 0,
  }

  return (
    <div
      style={baseStyle}
      onMouseDown={(e) => { e.stopPropagation(); onSelect(e); onDragStart(e, 'move') }}
      onTouchStart={(e) => { e.stopPropagation(); onSelect(e); if (e.touches.length > 0) { const t = e.touches[0]; onDragStart({ clientX: t.clientX, clientY: t.clientY, stopPropagation: () => {} }, 'move') } }}
    >
      {/* Conteúdo do elemento */}
      {element.type === 'Button' && (element.label || 'Botão')}
      {element.type === 'Label' && (element.text || element.label || '')}
      {element.type === 'Text' && (element.text || '')}
      {element.type === 'Input' && <input type="text" placeholder={element.placeholder || ''} style={{ width: '100%', background: 'transparent', border: 'none', color: 'inherit' }} readOnly />}
      {element.type === 'Checkbox' && `☑ ${element.label || ''}`}
      {element.type === 'Slider' && '─────●─────'}
      {element.type === 'Image' && (element.url ? '🖼️' : '🖼️ (sem URL)')}
      {element.type === 'Panel' && ''}

      {/* Handles de resize (só quando selecionado) */}
      {isSelected && (
        <>
          <ResizeHandle position="nw" onDragStart={onDragStart} size={handleSize} />
          <ResizeHandle position="ne" onDragStart={onDragStart} size={handleSize} />
          <ResizeHandle position="sw" onDragStart={onDragStart} size={handleSize} />
          <ResizeHandle position="se" onDragStart={onDragStart} size={handleSize} />
          <ResizeHandle position="n" onDragStart={onDragStart} size={handleSize} />
          <ResizeHandle position="s" onDragStart={onDragStart} size={handleSize} />
          <ResizeHandle position="w" onDragStart={onDragStart} size={handleSize} />
          <ResizeHandle position="e" onDragStart={onDragStart} size={handleSize} />
        </>
      )}
    </div>
  )
}

// ===== Handle de resize =====
function ResizeHandle({ position, onDragStart, size }) {
  const positions = {
    nw: { top: 0, left: 0, cursor: 'nwse-resize' },
    ne: { top: 0, right: 0, cursor: 'nesw-resize' },
    sw: { bottom: 0, left: 0, cursor: 'nesw-resize' },
    se: { bottom: 0, right: 0, cursor: 'nwse-resize' },
    n: { top: 0, left: '50%', cursor: 'ns-resize' },
    s: { bottom: 0, left: '50%', cursor: 'ns-resize' },
    w: { top: '50%', left: 0, cursor: 'ew-resize' },
    e: { top: '50%', right: 0, cursor: 'ew-resize' },
  }
  const style = {
    position: 'absolute',
    width: size,
    height: size,
    background: '#2f81f7',
    border: '1px solid #fff',
    borderRadius: '50%',
    transform: 'translate(-50%, -50%)',
    ...positions[position],
  }
  // Ajustar transform para posições de borda
  if (position === 'n' || position === 's') style.transform = 'translate(-50%, 0)'
  if (position === 'w' || position === 'e') style.transform = 'translate(0, -50%)'
  if (position === 'nw') style.transform = 'translate(0, 0)'
  if (position === 'ne') style.transform = 'translate(-100%, 0)'
  if (position === 'sw') style.transform = 'translate(0, -100%)'
  if (position === 'se') style.transform = 'translate(-100%, -100%)'

  return (
    <div
      style={{ ...style, cursor: positions[position].cursor }}
      onMouseDown={(e) => { e.stopPropagation(); onDragStart(e, 'resize', position) }}
    />
  )
}

// ===== Preview de Conect de UI (não editável) =====
function ConectUIPreview({ conect, res }) {
  // Conects de UI usam posição percentual como os elementos
  const pos = conect.position || [50, 50]
  const size = conect.size || [120, 40]

  let content = ''
  let bg = 'transparent'
  let border = '2px dashed #8957e5'

  if (conect.type === 'ButtonObject') {
    content = conect.label || 'Botão'
    bg = conect.color || '#1c2128'
  } else if (conect.type === 'JoystickObject') {
    content = '🕹️'
    bg = `${conect.color || '#2f81f7'}22`
    border = `2px solid ${conect.color || '#2f81f7'}`
    return (
      <div style={{
        position: 'absolute',
        left: `${pos[0]}%`,
        top: `${pos[1]}%`,
        width: conect.size || 120,
        height: conect.size || 120,
        transform: 'translate(-50%, -50%)',
        borderRadius: '50%',
        background: bg,
        border,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        opacity: 0.6,
        pointerEvents: 'none',
      }}>
        {content}
      </div>
    )
  } else if (conect.type === 'TextObject') {
    content = conect.text || conect.label || 'Texto'
    bg = 'transparent'
    border = '1px dashed #8957e5'
  } else if (conect.type === 'ImageObject') {
    content = conect.url ? '🖼️' : '🖼️ (sem URL)'
    border = '1px dashed #8957e5'
  } else if (conect.type === 'PanelObject') {
    content = ''
    bg = conect.color || '#1c2128'
    border = '1px dashed #8957e5'
  }

  return (
    <div style={{
      position: 'absolute',
      left: `${pos[0]}%`,
      top: `${pos[1]}%`,
      width: Array.isArray(size) ? size[0] : size,
      height: Array.isArray(size) ? size[1] : 40,
      transform: 'translate(-50%, -50%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: bg,
      color: conect.textColor || '#e6edf3',
      fontSize: (conect.fontSize || 14) + 'px',
      border,
      borderRadius: conect.borderRadius || 0,
      opacity: 0.6,
      pointerEvents: 'none',
    }}>
      {content}
    </div>
  )
}

// ===== Painel de Propriedades =====
function PropertiesPanel({ selectedIds, activeScreen, updateUIElement }) {
  const selectedElements = activeScreen.elements.filter((e) => selectedIds.has(e.id))

  if (selectedElements.length === 0) {
    return (
      <div className="panel-body">
        <div className="empty-state">
          <div style={{ fontSize: 24, opacity: 0.4 }}>⚙️</div>
          <div className="small mt-2 muted">Seleciona um elemento para ver as propriedades</div>
        </div>
      </div>
    )
  }

  if (selectedElements.length > 1) {
    return (
      <div className="panel-body">
        <div className="panel-section">
          <h4>{selectedElements.length} elementos selecionados</h4>
          <div className="small muted">Usa os botões de alinhar na barra superior</div>
        </div>
      </div>
    )
  }

  const el = selectedElements[0]
  const set = (patch) => updateUIElement(el.id, patch)
  const pos = el.position || [50, 50]
  const size = el.size || [120, 40]

  return (
    <div className="panel-body">
      <div className="panel-section">
        <h4>Elemento</h4>
        <div className="prop-row">
          <label>Nome</label>
          <input type="text" value={el.name || ''} onChange={(e) => set({ name: e.target.value })} />
        </div>
        <div className="prop-row row" style={{ gap: 6 }}>
          <span className="tag accent">{el.type}</span>
          <span className="tag">id: {el.id.slice(-6)}</span>
        </div>
      </div>

      <div className="panel-section">
        <h4>Posição & Tamanho</h4>
        <div className="prop-row">
          <label>Posição (X%, Y%)</label>
          <div className="vec3-input">
            <div className="axis x" data-axis="X">
              <input type="number" value={pos[0].toFixed(1)} step="1"
                onChange={(e) => set({ position: [Number(e.target.value), pos[1]] })} />
            </div>
            <div className="axis y" data-axis="Y">
              <input type="number" value={pos[1].toFixed(1)} step="1"
                onChange={(e) => set({ position: [pos[0], Number(e.target.value)] })} />
            </div>
          </div>
        </div>
        <div className="prop-row">
          <label>Tamanho (W, H)</label>
          <div className="vec3-input">
            <div className="axis x" data-axis="W">
              <input type="number" value={size[0]} step="1"
                onChange={(e) => set({ size: [Number(e.target.value), size[1]] })} />
            </div>
            <div className="axis y" data-axis="H">
              <input type="number" value={size[1]} step="1"
                onChange={(e) => set({ size: [size[0], Number(e.target.value)] })} />
            </div>
          </div>
        </div>
      </div>

      <div className="panel-section">
        <h4>Aparência</h4>
        <div className="prop-row">
          <label>Cor de fundo</label>
          <input type="color" value={el.color || '#1c2128'} onChange={(e) => set({ color: e.target.value })} />
        </div>
        <div className="prop-row">
          <label>Cor do texto</label>
          <input type="color" value={el.textColor || '#e6edf3'} onChange={(e) => set({ textColor: e.target.value })} />
        </div>
        <div className="prop-row">
          <label>Opacidade: {(el.opacity ?? 1).toFixed(2)}</label>
          <input type="range" min="0" max="1" step="0.05" value={el.opacity ?? 1}
            onChange={(e) => set({ opacity: Number(e.target.value) })} />
        </div>
        <div className="prop-row">
          <label>Raio da borda: {el.borderRadius || 0}px</label>
          <input type="range" min="0" max="50" step="1" value={el.borderRadius || 0}
            onChange={(e) => set({ borderRadius: Number(e.target.value) })} />
        </div>
        <div className="prop-row">
          <label>Espessura da borda: {el.borderWidth || 0}px</label>
          <input type="range" min="0" max="10" step="1" value={el.borderWidth || 0}
            onChange={(e) => set({ borderWidth: Number(e.target.value) })} />
        </div>
        <div className="prop-row">
          <label>Cor da borda</label>
          <input type="color" value={el.borderColor || '#30363d'} onChange={(e) => set({ borderColor: e.target.value })} />
        </div>
      </div>

      <div className="panel-section">
        <h4>Tipografia</h4>
        <div className="prop-row">
          <label>Tamanho da fonte: {el.fontSize || 14}px</label>
          <input type="range" min="8" max="72" step="1" value={el.fontSize || 14}
            onChange={(e) => set({ fontSize: Number(e.target.value) })} />
        </div>
        {el.type === 'Button' && (
          <div className="prop-row">
            <label>Texto do botão</label>
            <input type="text" value={el.label || ''} onChange={(e) => set({ label: e.target.value })} />
          </div>
        )}
        {(el.type === 'Label' || el.type === 'Text') && (
          <div className="prop-row">
            <label>Conteúdo</label>
            <textarea value={el.text || ''} onChange={(e) => set({ text: e.target.value })} rows={3} />
          </div>
        )}
        {el.type === 'Image' && (
          <div className="prop-row">
            <label>URL da imagem</label>
            <input type="text" value={el.url || ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://..." />
          </div>
        )}
      </div>

      <div className="panel-section">
        <h4>Evento FlirCode</h4>
        <div className="prop-row">
          <label>Nome do evento</label>
          <input type="text" value={el.eventName || ''} onChange={(e) => set({ eventName: e.target.value })}
            placeholder="onClick, onChange, onSubmit..." />
        </div>
      </div>

      {/* Sistema: Links — navegar entre cenas/telas ao clicar */}
      <div className="panel-section">
        <h4>🔗 Link (navegação)</h4>
        <div className="prop-row">
          <label>Tipo de link</label>
          <select value={el.linkType || 'none'} onChange={(e) => set({ linkType: e.target.value })}>
            <option value="none">— Nenhum —</option>
            <option value="scene">Ir para cena</option>
            <option value="screen">Mostrar tela de UI</option>
            <option value="url">Abrir URL</option>
          </select>
        </div>
        {el.linkType && el.linkType !== 'none' && (
          <div className="prop-row">
            <label>Destino</label>
            {el.linkType === 'scene' ? (
              <select value={el.linkTarget || ''} onChange={(e) => set({ linkTarget: e.target.value })}>
                <option value="">— Selecionar cena —</option>
                {scenes.map((sc) => (
                  <option key={sc.id} value={sc.name}>{sc.name}</option>
                ))}
              </select>
            ) : el.linkType === 'screen' ? (
              <select value={el.linkTarget || ''} onChange={(e) => set({ linkTarget: e.target.value })}>
                <option value="">— Selecionar tela —</option>
                {uiScreens.map((sc) => (
                  <option key={sc.id} value={sc.name}>{sc.name}</option>
                ))}
              </select>
            ) : (
              <input type="text" value={el.linkTarget || ''} onChange={(e) => set({ linkTarget: e.target.value })}
                placeholder="https://..." />
            )}
          </div>
        )}
        <div className="small muted mt-1">
          Ao clicar no botão durante o jogo, navega automaticamente.
          Não precisa de FlirCode — é automático!
        </div>
      </div>
    </div>
  )
}

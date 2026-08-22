/**
 * UIEditor — editor de UI completo com múltiplas telas.
 *
 * Funcionalidades:
 *  - Múltiplas telas de UI (Main Menu, HUD, Game Over, etc.)
 *  - Outliner de elementos
 *  - Painel de propriedades completo (posição, tamanho, cor, fonte, bordas, padding)
 *  - Novos elementos: Button, Label, Input, Checkbox, Slider, Form, Text, Image, Panel
 *  - Tela 2D com preview de resoluções (telemóvel, tablet)
 *  - Pré-visualização em tempo real
 *
 * Os dados das telas de UI são guardados no store (uiScreens) e persistidos.
 * O GameUIOverlay usa exatamente os mesmos dados para renderizar durante o jogo.
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import { useStore, useActiveUIScreen, useSelectedUIElement } from '../../../store/useStore'
import { IconPlus, IconTrash, IconClose } from '../../ui/Icons'

const ELEMENT_TYPES = [
  { type: 'Button', icon: 'mouse-pointer-2', label: 'Botão' },
{ type: 'Label', icon: '️', label: 'Label' },
  { type: 'Input', icon: 'type', label: 'Input' },
{ type: 'Checkbox', icon: '️', label: 'Checkbox' },
{ type: 'Slider', icon: '️', label: 'Slider' },
  { type: 'Form', icon: 'clipboard', label: 'Formulário' },
  { type: 'Text', icon: 'file', label: 'Texto' },
  { type: 'Image', icon: 'image', label: 'Imagem' },
  { type: 'Panel', icon: '▬', label: 'Painel' },
]

const RESOLUTIONS = [
  { id: 'small', label: 'Telemóvel', w: 360, h: 640 },
  { id: 'medium', label: 'Grande', w: 414, h: 896 },
  { id: 'tablet', label: 'Tablet', w: 768, h: 1024 },
]

export default function UIEditor() {
  const uiScreens = useStore((s) => s.uiScreens)
  const activeScreen = useActiveUIScreen()
  const selectedElement = useSelectedUIElement()
  const createUIScreen = useStore((s) => s.createUIScreen)
  const deleteUIScreen = useStore((s) => s.deleteUIScreen)
  const renameUIScreen = useStore((s) => s.renameUIScreen)
  const setActiveUIScreen = useStore((s) => s.setActiveUIScreen)
  const addUIElement = useStore((s) => s.addUIElement)
  const removeUIElement = useStore((s) => s.removeUIElement)
  const updateUIElement = useStore((s) => s.updateUIElement)
  const selectUIElement = useStore((s) => s.selectUIElement)
  const selectedUIElementId = useStore((s) => s.selectedUIElementId)
  // Fase 5: mostrar JoystickObjects da cena ativa como preview
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const activeScene = scenes.find((s) => s.id === activeSceneId)
  const joystickConects = (activeScene?.conects || []).filter((c) => c.type === 'JoystickObject')

  const [resolution, setResolution] = useState('medium')
  const [editingScreenName, setEditingScreenName] = useState(null)

  const res = RESOLUTIONS.find((r) => r.id === resolution)

  return (
    <div className="ui-editor-full">
      {/* ===== Painel esquerdo: telas + outliner ===== */}
      <aside className="panel left ui-editor-left">
        <div className="panel-header">
          <span>UI Editor</span>
        </div>

        {/* Lista de telas */}
        <div className="panel-section">
          <div className="row between" style={{ marginBottom: 6 }}>
            <h4 style={{ margin: 0 }}>Telas ({uiScreens.length})</h4>
            <button onClick={() => createUIScreen(`Tela ${uiScreens.length + 1}`)} title="Nova tela">
              <IconPlus width={12} height={12} />
            </button>
          </div>
          {uiScreens.length === 0 ? (
            <div className="empty-state small">Sem telas. Cria uma acima.</div>
          ) : (
            <div className="outliner">
              {uiScreens.map((sc) => (
                <div
                  key={sc.id}
                  className={`outliner-item ${sc.id === activeScreen?.id ? 'selected' : ''}`}
                  onClick={() => setActiveUIScreen(sc.id)}
                >
                  {editingScreenName === sc.id ? (
                    <input
                      value={sc.name}
                      onChange={(e) => renameUIScreen(sc.id, e.target.value)}
                      onBlur={() => setEditingScreenName(null)}
                      onKeyDown={(e) => { if (e.key === 'Enter') setEditingScreenName(null) }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      style={{ flex: 1 }}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => { e.stopPropagation(); setEditingScreenName(sc.id) }}
                      style={{ flex: 1 }}
                    >{sc.name} <span className="small muted">({sc.elements.length})</span>
                    </span>
                  )}
                  <div className="actions">
                    <button
                      className="danger"
                      onClick={(e) => { e.stopPropagation(); deleteUIScreen(sc.id) }}
                      style={{ padding: '2px 4px' }}
                    >
                      <IconTrash width={11} height={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Paleta de elementos */}
        {activeScreen && (
          <div className="panel-section">
            <h4>Adicionar Elemento</h4>
            <div className="tool-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
              {ELEMENT_TYPES.map((el) => (
                <button
                  key={el.type}
                  onClick={() => addUIElement(el.type, activeScreen.id)}
                  title={el.label}
                >
                  <span style={{ fontSize: 16 }}>{el.icon}</span>
                  <span style={{ fontSize: 9 }}>{el.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Fase 7 — Componentes pré-estilizados (presets estilo Figma) */}
        {activeScreen && (
          <div className="panel-section">
            <h4>Componentes Pré-estilizados</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={() => {
                  const el = addUIElement('Button', activeScreen.id)
                  if (el?.id) updateUIElement(el.id, {
                    label: 'Confirmar', color: '#2f81f7', textColor: '#ffffff',
                    borderRadius: 8, fontSize: 14, padding: 12,
                  })
                }}
                style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11 }}
              >
                🔵 Botão Primário (azul, arredondado)
              </button>
              <button
                onClick={() => {
                  const el = addUIElement('Panel', activeScreen.id)
                  if (el?.id) updateUIElement(el.id, {
                    color: '#0d1117', opacity: 0.85, borderRadius: 12, padding: 16,
                  })
                }}
                style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11 }}
              >
                📦 Painel Escuro (overlay)
              </button>
              <button
                onClick={() => {
                  const el = addUIElement('Label', activeScreen.id)
                  if (el?.id) updateUIElement(el.id, {
                    label: 'Título', textColor: '#ffffff', fontSize: 24, fontWeight: 'bold',
                  })
                }}
                style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11 }}
              >
                📝 Label Título (branco, 24px, bold)
              </button>
              <button
                onClick={() => {
                  const el = addUIElement('Slider', activeScreen.id)
                  if (el?.id) updateUIElement(el.id, {
                    label: 'Volume', min: 0, max: 100, value: 50,
                  })
                }}
                style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11 }}
              >
                🎚️ Slider Volume (0-100)
              </button>
              <button
                onClick={() => {
                  const el = addUIElement('Checkbox', activeScreen.id)
                  if (el?.id) updateUIElement(el.id, {
                    label: 'Ativar som', checked: true,
                  })
                }}
                style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11 }}
              >
                ☑️ Checkbox Config
              </button>
            </div>
          </div>
        )}

        {/* Outliner de elementos da tela ativa */}
        {activeScreen && activeScreen.elements.length > 0 && (
          <div className="panel-section">
            <h4>Elementos ({activeScreen.elements.length})</h4>
            <div className="outliner">
              {activeScreen.elements.map((el) => (
                <div
                  key={el.id}
                  className={`outliner-item ${el.id === selectedUIElementId ? 'selected' : ''}`}
                  onClick={() => selectUIElement(el.id)}
                >
                  <span style={{ flex: 1 }}>
                    {ELEMENT_TYPES.find((t) => t.type === el.type)?.icon || '◻'} {el.name || el.type}
                  </span>
                  <button
                    className="danger"
                    onClick={(e) => { e.stopPropagation(); removeUIElement(el.id) }}
                    style={{ padding: '2px 4px' }}
                  >
                    <IconTrash width={11} height={11} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* ===== Centro: tela 2D de trabalho ===== */}
      <div className="ui-editor-center">
        {/* Toolbar de resolução */}
        <div className="ui-editor-toolbar">
          <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
            {RESOLUTIONS.map((r) => (
              <option key={r.id} value={r.id}>{r.label} ({r.w}×{r.h})</option>
            ))}
          </select>
          {activeScreen && <span className="small muted">Tela: {activeScreen.name}</span>}
        </div>

        {/* Canvas 2D */}
        <div className="ui-canvas-wrap">
          {activeScreen ? (
            <div
              className="ui-canvas"
              style={{ width: Math.min(res.w, 420), height: Math.min(res.h, 600) }}
              onClick={(e) => {
                if (e.target.classList.contains('ui-canvas')) selectUIElement(null)
              }}
            >
              {activeScreen.elements.map((el) => (
                <DraggableUIElement
                  key={el.id}
                  element={el}
                  isSelected={el.id === selectedUIElementId}
                  onSelect={() => selectUIElement(el.id)}
                  onUpdate={(patch) => updateUIElement(el.id, patch)}
                />
              ))}
              {/* Fase 5: Preview de JoystickObjects da cena ativa */}
              {joystickConects.map((js) => (
                <JoystickPreview key={js.instanceId} conect={js} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <div style={{ fontSize: 32, opacity: 0.4 }}></div>
              <div className="mt-2">Nenhuma tela de UI.</div>
              <button className="primary mt-2" onClick={() => createUIScreen('HUD')}>
                Criar primeira tela
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ===== Painel direito: propriedades ===== */}
      <aside className="panel right ui-editor-right">
        <div className="panel-header">
          <span>Propriedades</span>
        </div>
        <div className="panel-body">
          {selectedElement ? (
            <UIElementProperties element={selectedElement} onUpdate={(patch) => updateUIElement(selectedElement.id, patch)} />
          ) : (
            <div className="empty-state small">
              Seleciona um elemento para editar as suas propriedades.
            </div>
          )}
        </div>
      </aside>
    </div>
  )
}

// ===== Fase 9 — DraggableUIElement: drag + resize + rotação no canvas =====
// Wrapper que envolve o UIElementRenderer no modo editor.
// Permite arrastar, redimensionar e rotacionar elementos no canvas.
function DraggableUIElement({ element, isSelected, onSelect, onUpdate }) {
  const dragRef = useRef(null)
  const dragState = useRef({ mode: null, startX: 0, startY: 0, startPos: [0,0], startSize: [0,0], startRot: 0 })

  const handlePointerDown = useCallback((e, mode) => {
    e.stopPropagation()
    e.preventDefault()
    onSelect()
    dragState.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      startPos: [...(element.position || [50, 50])],
      startSize: [...(element.size || [120, 40])],
      startRot: element.rotation || 0,
    }

    const handleMove = (ev) => {
      const dx = ev.clientX - dragState.current.startX
      const dy = ev.clientY - dragState.current.startY
      const canvas = dragRef.current?.parentElement
      if (!canvas) return
      const cw = canvas.offsetWidth
      const ch = canvas.offsetHeight

      if (dragState.current.mode === 'drag') {
        // Mover — converte pixels para percentagem
        const newPosX = dragState.current.startPos[0] + (dx / cw) * 100
        const newPosY = dragState.current.startPos[1] + (dy / ch) * 100
        onUpdate({ position: [Math.round(newPosX * 10) / 10, Math.round(newPosY * 10) / 10] })
      } else if (dragState.current.mode === 'resize') {
        // Redimensionar — pixels absolutos
        const newW = Math.max(30, dragState.current.startSize[0] + dx)
        const newH = Math.max(20, dragState.current.startSize[1] + dy)
        onUpdate({ size: [Math.round(newW), Math.round(newH)] })
      } else if (dragState.current.mode === 'rotate') {
        // Rotacionar — converte dx em graus
        const newRot = dragState.current.startRot + (dx * 0.5)
        onUpdate({ rotation: Math.round(newRot) })
      }
    }

    const handleUp = () => {
      dragState.current.mode = null
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }, [element, onSelect, onUpdate])

  const pos = element.position || [50, 50]
  const size = element.size || [120, 40]
  const rotation = element.rotation || 0

  return (
    <div
      ref={dragRef}
      style={{
        position: 'absolute',
        left: `${pos[0]}%`,
        top: `${pos[1]}%`,
        width: size[0],
        height: size[1],
        transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
        cursor: isSelected ? 'move' : 'pointer',
      }}
      onPointerDown={(e) => { if (isSelected) handlePointerDown(e, 'drag'); else onSelect() }}
    >
      <UIElementRenderer
        element={element}
        isSelected={isSelected}
        onSelect={onSelect}
        onUpdate={onUpdate}
        isEditor={true}
      />

      {/* Handles de edição — só quando selecionado */}
      {isSelected && (
        <>
          {/* Handle de resize (canto inferior direito) */}
          <div
            style={{
              position: 'absolute',
              bottom: -6,
              right: -6,
              width: 12,
              height: 12,
              background: '#2f81f7',
              border: '2px solid #fff',
              borderRadius: '50%',
              cursor: 'nwse-resize',
              zIndex: 100,
            }}
            onPointerDown={(e) => handlePointerDown(e, 'resize')}
          />
          {/* Handle de rotação (topo centro) */}
          <div
            style={{
              position: 'absolute',
              top: -20,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 12,
              height: 12,
              background: '#3fb950',
              border: '2px solid #fff',
              borderRadius: '50%',
              cursor: 'grab',
              zIndex: 100,
            }}
            onPointerDown={(e) => handlePointerDown(e, 'rotate')}
          />
          {/* Borda de seleção */}
          <div style={{
            position: 'absolute',
            inset: -2,
            border: '1px dashed #2f81f7',
            pointerEvents: 'none',
            borderRadius: (element.borderRadius || 0) + 2,
          }} />
        </>
      )}
    </div>
  )
}

// ===== Renderizador de elemento (usado no editor E no jogo) =====
// Este componente é partilhado entre o editor e o GameUIOverlay para garantir
// que o que se vê no editor é exatamente o que aparece no jogo.
export function UIElementRenderer({ element, isSelected, onSelect, onUpdate, isEditor }) {
  const pos = element.position || [50, 50]
  const size = element.size || [120, 40]
  const isSelectedClass = isEditor && isSelected ? 'ui-el-selected' : ''

  const baseStyle = {
    position: 'absolute',
    left: `${pos[0]}%`,
    top: `${pos[1]}%`,
    width: size[0],
    height: size[1],
    background: element.color || 'transparent',
    color: element.textColor || '#e6edf3',
    fontSize: (element.fontSize || 14) + 'px',
    border: `${element.borderWidth || 0}px solid ${element.borderColor || 'transparent'}`,
    borderRadius: element.borderRadius || 0,
    padding: element.padding || 0,
    transform: 'translate(-50%, -50%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: isEditor ? 'pointer' : 'auto',
    pointerEvents: isEditor ? 'auto' : 'auto',
    userSelect: 'none',
    fontFamily: '-apple-system, sans-serif',
    boxSizing: 'border-box',
    opacity: element.opacity ?? 1,
  }

  const handleClick = (e) => {
    if (isEditor) {
      e.stopPropagation()
      onSelect?.()
    }
  }

  switch (element.type) {
    case 'Button':
      return (
        <button
          style={{ ...baseStyle, cursor: 'pointer', border: `${element.borderWidth || 1}px solid ${element.borderColor || '#2f81f7'}` }}
          className={isSelectedClass}
          onClick={handleClick}
          data-ui-element={element.id}
          data-ui-event="onClick"
        >
          {element.label || 'Botão'}
        </button>
      )

    case 'Label':
    case 'Text':
      return (
        <div
          style={baseStyle}
          className={isSelectedClass}
          onClick={handleClick}
          data-ui-element={element.id}
        >
          {element.text || 'Texto'}
        </div>
      )

    case 'Input':
      return (
        <input
          type="text"
          style={baseStyle}
          className={isSelectedClass}
          onClick={handleClick}
          placeholder={element.placeholder || ''}
          value={isEditor ? '' : (element.value || '')}
          onChange={(e) => { if (!isEditor) onUpdate?.({ value: e.target.value }) }}
          data-ui-element={element.id}
          data-ui-event="onChange"
          readOnly={isEditor}
        />
      )

    case 'Checkbox':
      return (
        <label
          style={{ ...baseStyle, cursor: 'pointer', gap: 6 }}
          className={isSelectedClass}
          onClick={handleClick}
          data-ui-element={element.id}
          data-ui-event="onChange"
        >
          <input
            type="checkbox"
            checked={isEditor ? false : (element.checked || false)}
            onChange={(e) => { if (!isEditor) onUpdate?.({ checked: e.target.checked }) }}
            readOnly={isEditor}
          />
          {element.label || ''}
        </label>
      )

    case 'Slider':
      return (
        <div
          style={{ ...baseStyle, flexDirection: 'column' }}
          className={isSelectedClass}
          onClick={handleClick}
          data-ui-element={element.id}
          data-ui-event="onChange"
        >
          <input
            type="range"
            min={element.min || 0}
            max={element.max || 100}
            value={isEditor ? (element.value || 50) : (element.value || 50)}
            onChange={(e) => { if (!isEditor) onUpdate?.({ value: Number(e.target.value) }) }}
            style={{ width: '100%' }}
            readOnly={isEditor}
          />
          {!isEditor && <span style={{ fontSize: 10 }}>{element.value}</span>}
        </div>
      )

    case 'Form':
      return (
        <div
          style={{ ...baseStyle, flexDirection: 'column', gap: 6 }}
          className={isSelectedClass}
          onClick={handleClick}
          data-ui-element={element.id}
          data-ui-event="onSubmit"
        >
          <div style={{ fontSize: 12, fontWeight: 600 }}>{element.name || 'Form'}</div>
          <button style={{ fontSize: 11, padding: '4px 12px' }}>{element.submitLabel || 'Enviar'}</button>
        </div>
      )

    case 'Image':
      return (
        <div
          style={{ ...baseStyle, overflow: 'hidden' }}
          className={isSelectedClass}
          onClick={handleClick}
          data-ui-element={element.id}
        >
          {element.url ? (
            <img src={element.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <span style={{ fontSize: 10, opacity: 0.5 }}>Sem imagem</span>
          )}
        </div>
      )

    case 'Panel':
      return (
        <div
          style={baseStyle}
          className={isSelectedClass}
          onClick={handleClick}
          data-ui-element={element.id}
        />
      )

    default:
      return (
        <div style={baseStyle} className={isSelectedClass} onClick={handleClick}>
          {element.name || element.type}
        </div>
      )
  }
}

// ===== Painel de propriedades =====
function UIElementProperties({ element, onUpdate }) {
  const set = (patch) => onUpdate(patch)
  const setPos = (axis, val) => {
    const pos = [...(element.position || [50, 50])]
    pos[axis] = val
    set({ position: pos })
  }
  const setSize = (axis, val) => {
    const size = [...(element.size || [120, 40])]
    size[axis] = val
    set({ size })
  }

  return (
    <>
      <div className="panel-section">
        <h4>{element.type}</h4>
        <div className="prop-row">
          <label>Nome</label>
          <input type="text" value={element.name || ''} onChange={(e) => set({ name: e.target.value })} />
        </div>
      </div>

      <div className="panel-section">
        <h4>Posição (%)</h4>
        <div className="vec3-input">
          <div className="axis x" data-axis="X">
            <input type="number" value={element.position?.[0] || 0} onChange={(e) => setPos(0, Number(e.target.value))} />
          </div>
          <div className="axis y" data-axis="Y">
            <input type="number" value={element.position?.[1] || 0} onChange={(e) => setPos(1, Number(e.target.value))} />
          </div>
        </div>
      </div>

      <div className="panel-section">
        <h4>Tamanho (px)</h4>
        <div className="vec3-input" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div className="axis x" data-axis="W">
            <input type="number" value={element.size?.[0] || 100} onChange={(e) => setSize(0, Number(e.target.value))} />
          </div>
          <div className="axis y" data-axis="H">
            <input type="number" value={element.size?.[1] || 40} onChange={(e) => setSize(1, Number(e.target.value))} />
          </div>
        </div>
      </div>

      {/* Fase 9 — Rotação */}
      <div className="panel-section">
        <h4>Rotação</h4>
        <div className="prop-row">
          <label>Ângulo: {element.rotation || 0}°</label>
          <input type="range" min="0" max="360" step="1" value={element.rotation || 0}
            onChange={(e) => set({ rotation: Number(e.target.value) })} />
        </div>
      </div>

      {(element.type === 'Button' || element.type === 'Label' || element.type === 'Text') && (
        <div className="panel-section">
          <h4>Texto</h4>
          <div className="prop-row">
            <label>{element.type === 'Button' ? 'Label' : 'Conteúdo'}</label>
            <input type="text" value={element.label || element.text || ''} onChange={(e) => set(element.type === 'Button' ? { label: e.target.value } : { text: e.target.value })} />
          </div>
        </div>
      )}

      {element.type === 'Input' && (
        <div className="panel-section">
          <h4>Input</h4>
          <div className="prop-row">
            <label>Placeholder</label>
            <input type="text" value={element.placeholder || ''} onChange={(e) => set({ placeholder: e.target.value })} />
          </div>
        </div>
      )}

      {element.type === 'Slider' && (
        <div className="panel-section">
          <h4>Slider</h4>
          <div className="prop-row">
            <label>Mín: {element.min}</label>
            <input type="range" min="0" max="100" value={element.min || 0} onChange={(e) => set({ min: Number(e.target.value) })} />
          </div>
          <div className="prop-row">
            <label>Máx: {element.max}</label>
            <input type="range" min="0" max="500" value={element.max || 100} onChange={(e) => set({ max: Number(e.target.value) })} />
          </div>
          <div className="prop-row">
            <label>Valor: {element.value}</label>
            <input type="range" min={element.min || 0} max={element.max || 100} value={element.value || 0} onChange={(e) => set({ value: Number(e.target.value) })} />
          </div>
        </div>
      )}

      {element.type === 'Checkbox' && (
        <div className="panel-section">
          <h4>Checkbox</h4>
          <div className="prop-row">
            <label>Label</label>
            <input type="text" value={element.label || ''} onChange={(e) => set({ label: e.target.value })} />
          </div>
          <label className="checkbox-row">
            <input type="checkbox" checked={element.checked || false} onChange={(e) => set({ checked: e.target.checked })} />
            Marcado
          </label>
        </div>
      )}

      <div className="panel-section">
        <h4>Aparência</h4>
        <div className="prop-row">
          <label>Cor de fundo</label>
          <input type="color" value={element.color === 'transparent' ? '#000000' : (element.color || '#1c2128')} onChange={(e) => set({ color: e.target.value })} />
        </div>
        <div className="prop-row">
          <label>Cor do texto</label>
          <input type="color" value={element.textColor || '#e6edf3'} onChange={(e) => set({ textColor: e.target.value })} />
        </div>
        <div className="prop-row">
          <label>Tamanho da fonte: {element.fontSize || 14}px</label>
          <input type="range" min="8" max="48" value={element.fontSize || 14} onChange={(e) => set({ fontSize: Number(e.target.value) })} />
        </div>
      </div>

      <div className="panel-section">
        <h4>Bordas</h4>
        <div className="prop-row">
          <label>Espessura: {element.borderWidth || 0}px</label>
          <input type="range" min="0" max="10" value={element.borderWidth || 0} onChange={(e) => set({ borderWidth: Number(e.target.value) })} />
        </div>
        <div className="prop-row">
          <label>Cor da borda</label>
          <input type="color" value={element.borderColor || '#30363d'} onChange={(e) => set({ borderColor: e.target.value })} />
        </div>
        <div className="prop-row">
          <label>Arredondamento: {element.borderRadius || 0}px</label>
          <input type="range" min="0" max="30" value={element.borderRadius || 0} onChange={(e) => set({ borderRadius: Number(e.target.value) })} />
        </div>
        <div className="prop-row">
          <label>Padding: {element.padding || 0}px</label>
          <input type="range" min="0" max="30" value={element.padding || 0} onChange={(e) => set({ padding: Number(e.target.value) })} />
        </div>
      </div>

      {element.type === 'Image' && (
        <div className="panel-section">
          <h4>Imagem</h4>
          <div className="prop-row">
            <label>URL</label>
            <input type="text" value={element.url || ''} onChange={(e) => set({ url: e.target.value })} placeholder="https://..." />
          </div>
        </div>
      )}

      <div className="panel-section">
        <h4>Evento FlirCode</h4>
        <div className="prop-row">
          <label>Função a chamar</label>
          <input type="text" value={element.eventName || ''} onChange={(e) => set({ eventName: e.target.value })} placeholder="onClick, onChange, onSubmit..." />
        </div>
      </div>
    </>
  )
}

// Fase 5: Preview de JoystickObject no editor de UI
function JoystickPreview({ conect }) {
  const side = conect.side || 'left'
  const size = conect.size || 120
  const color = conect.color || '#2f81f7'
  const thumbSize = size * 0.4

  const containerStyle = {
    position: 'absolute',
    bottom: 20,
    [side]: 20,
    width: size,
    height: size,
    pointerEvents: 'none',
    zIndex: 10,
  }

  const baseStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: `radial-gradient(circle, ${color}22 0%, ${color}11 70%, transparent 100%)`,
    border: `2px solid ${color}`,
    opacity: 0.6,
    position: 'relative',
  }

  const thumbStyle = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: thumbSize,
    height: thumbSize,
    borderRadius: '50%',
    background: color,
    border: '2px solid #fff',
    transform: 'translate(-50%, -50%)',
  }

  return (
    <div style={containerStyle}>
      <div style={baseStyle}>
        <div style={thumbStyle} />
      </div>
      <div style={{ position: 'absolute', top: -20, left: 0, fontSize: 10, color: '#8b949e' }}>{conect.name || 'Joystick'}
      </div>
    </div>
  )
}

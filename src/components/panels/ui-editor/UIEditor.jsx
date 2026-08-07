/**
 * UIEditor — editor de UI 2D com tela de trabalho, ancoragem e camadas.
 *
 * Funcionalidades:
 *  - Tela 2D onde se arrastam ButtonObject, TextObject, ImageObject, PanelObject, JoystickObject
 *  - Sistema de ancoragem (cantos/bordas/centro) para adaptação a diferentes ecrãs
 *  - Camadas de UI (HUD, Menu Pausa, Game Over) mostráveis/escondíveis via FlirScript
 *  - Pré-visualização com simulação de resoluções (telemóvel pequeno, grande, tablet)
 *  - Painel de propriedades para cada elemento
 *
 * Os elementos UI são Conects do tipo UI guardados na cena ativa.
 */
import { useState } from 'react'
import { useStore } from '../../../store/useStore'
import { IconClose, IconPlus, IconTrash } from '../../ui/Icons'
import { CONECT_CATEGORIES } from '../../../utils/conects/taxonomy'

const UI_CONECT_TYPES = ['ButtonObject', 'TextObject', 'ImageObject', 'PanelObject', 'JoystickObject']

const RESOLUTIONS = [
  { id: 'small', label: 'Telemóvel pequeno', w: 360, h: 640 },
  { id: 'medium', label: 'Telemóvel grande', w: 414, h: 896 },
  { id: 'tablet', label: 'Tablet', w: 768, h: 1024 },
]

export default function UIEditor({ onClose }) {
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const addConectToScene = useStore((s) => s.addConectToScene)
  const updateConect = useStore((s) => s.updateConect)
  const removeConectFromScene = useStore((s) => s.removeConectFromScene)
  const selectedConectId = useStore((s) => s.selectedConectId)
  const selectConect = useStore((s) => s.selectConect)

  const [resolution, setResolution] = useState('medium')
  const [activeLayer, setActiveLayer] = useState('HUD')

  const activeScene = scenes.find((s) => s.id === activeSceneId)
  const uiConects = (activeScene?.conects || []).filter((c) => UI_CONECT_TYPES.includes(c.type))

  const res = RESOLUTIONS.find((r) => r.id === resolution)

  const handleAddUI = (type) => {
    addConectToScene(type, [50, 50, 0])
  }

  const handleDragStart = (e, type) => {
    e.dataTransfer.setData('text/uiConectType', type)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const type = e.dataTransfer.getData('text/uiConectType')
    if (!type) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    addConectToScene(type, [x, y, 0])
  }

  const selectedConect = uiConects.find((c) => c.instanceId === selectedConectId)

  return (
    <>
      {onClose && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`ui-editor ${onClose ? 'open' : ''}`}>
        <div className="panel-header">
          <span>📱 Editor de UI</span>
          {onClose && (
            <button className="icon" onClick={onClose} title="Fechar">
              <IconClose width={14} height={14} />
            </button>
          )}
        </div>

        <div className="ui-editor-body">
          {/* Toolbar: resoluções + camadas */}
          <div className="ui-editor-toolbar">
            <select value={resolution} onChange={(e) => setResolution(e.target.value)}>
              {RESOLUTIONS.map((r) => (
                <option key={r.id} value={r.id}>{r.label} ({r.w}×{r.h})</option>
              ))}
            </select>
            <select value={activeLayer} onChange={(e) => setActiveLayer(e.target.value)}>
              <option value="HUD">HUD</option>
              <option value="MenuPausa">Menu Pausa</option>
              <option value="GameOver">Game Over</option>
            </select>
          </div>

          {/* Paleta de elementos UI */}
          <div className="ui-palette">
            {UI_CONECT_TYPES.map((type) => {
              const def = CONECT_CATEGORIES.find((c) => c.id === 'ui')
              return (
                <button
                  key={type}
                  className="ui-palette-item"
                  draggable
                  onDragStart={(e) => handleDragStart(e, type)}
                  onClick={() => handleAddUI(type)}
                  title={`Adicionar ${type}`}
                >
                  {type.replace('Object', '')}
                </button>
              )
            })}
          </div>

          {/* Tela 2D de trabalho */}
          <div className="ui-canvas-wrap">
            <div
              className="ui-canvas"
              style={{ width: res.w, height: res.h, maxWidth: '100%', maxHeight: '60vh' }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {uiConects.map((conect) => {
                const pos = conect.position || [50, 50]
                const size = conect.size || [120, 50]
                const isSelected = conect.instanceId === selectedConectId
                return (
                  <div
                    key={conect.instanceId}
                    className={`ui-element ${isSelected ? 'selected' : ''}`}
                    style={{
                      left: `${pos[0]}%`,
                      top: `${pos[1]}%`,
                      width: size[0],
                      height: size[1],
                      background: conect.color || '#2f81f7',
                      color: conect.textColor || '#fff',
                      fontSize: (conect.fontSize || 14) + 'px',
                    }}
                    onClick={() => selectConect(conect.instanceId)}
                  >
                    {conect.label || conect.text || conect.type.replace('Object', '')}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Painel de propriedades do elemento selecionado */}
          {selectedConect && (
            <div className="ui-props">
              <h4>Propriedades — {selectedConect.type}</h4>
              <div className="prop-row">
                <label>Posição X (%)</label>
                <input
                  type="number"
                  value={selectedConect.position?.[0] || 0}
                  onChange={(e) => updateConect(selectedConect.instanceId, {
                    position: [Number(e.target.value), selectedConect.position?.[1] || 0, 0],
                  })}
                />
              </div>
              <div className="prop-row">
                <label>Posição Y (%)</label>
                <input
                  type="number"
                  value={selectedConect.position?.[1] || 0}
                  onChange={(e) => updateConect(selectedConect.instanceId, {
                    position: [selectedConect.position?.[0] || 0, Number(e.target.value), 0],
                  })}
                />
              </div>
              <div className="prop-row">
                <label>Largura</label>
                <input
                  type="number"
                  value={selectedConect.size?.[0] || 120}
                  onChange={(e) => updateConect(selectedConect.instanceId, {
                    size: [Number(e.target.value), selectedConect.size?.[1] || 50],
                  })}
                />
              </div>
              <div className="prop-row">
                <label>Altura</label>
                <input
                  type="number"
                  value={selectedConect.size?.[1] || 50}
                  onChange={(e) => updateConect(selectedConect.instanceId, {
                    size: [selectedConect.size?.[0] || 120, Number(e.target.value)],
                  })}
                />
              </div>
              <div className="prop-row">
                <label>Cor de fundo</label>
                <input
                  type="color"
                  value={selectedConect.color || '#2f81f7'}
                  onChange={(e) => updateConect(selectedConect.instanceId, { color: e.target.value })}
                />
              </div>
              {selectedConect.label !== undefined && (
                <div className="prop-row">
                  <label>Texto</label>
                  <input
                    type="text"
                    value={selectedConect.label || ''}
                    onChange={(e) => updateConect(selectedConect.instanceId, { label: e.target.value })}
                  />
                </div>
              )}
              <button
                className="danger"
                onClick={() => removeConectFromScene(selectedConect.instanceId)}
                style={{ width: '100%', marginTop: 8 }}
              >
                <IconTrash width={12} height={12} /> Apagar elemento
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

/**
 * RightPanel — painel lateral direito.
 *
 * Mostra as propriedades do objeto selecionado:
 *  - Nome (editável)
 *  - Transformação (posição, rotação, escala) com inputs XYZ
 *  - Material (cor, roughness, metalness, opacity, wireframe, flat shading)
 *  - Texturas (upload de difusa + normal, tiling UV, offset)
 *
 * Se nenhum objeto estiver selecionado, mostra um empty state.
 */
import { useState } from 'react'
import { useStore, useSelectedObject } from '../../store/useStore'
import { radToDeg, degToRad, round, fileToDataURL } from '../../utils/helpers'
import { IconClose } from '../ui/Icons'
import MaterialEditor from './MaterialEditor'
import ConectPropertiesPanel from './conects/ConectPropertiesPanel'

export default function RightPanel({ open, onClose }) {
  const selected = useSelectedObject()
  const selectedConectId = useStore((s) => s.selectedConectId)
  const appMode = useStore((s) => s.appMode)

  // Em modo Cena, se houver um conect selecionado, mostrar suas propriedades
  const showConectProps = appMode === 'scene' && selectedConectId

  return (
    <>
      {open && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`panel right ${open ? 'open' : ''}`}>
        <div className="panel-header">
          <span>Propriedades</span>
          <button className="icon drawer-toggle" onClick={onClose} title="Fechar painel">
            <IconClose width={14} height={14} />
          </button>
        </div>

        <div className="panel-body">
          {showConectProps ? (
            <ConectPropertiesPanel conectId={selectedConectId} />
          ) : !selected ? (
            <div className="empty-state">
              <div style={{ fontSize: 32, opacity: 0.4 }}>⬚</div>
              <div className="mt-2">Nenhum objeto selecionado.</div>
              <div className="small mt-2">
                Clique num objeto da cena ou num item do outliner para editar as suas propriedades.
              </div>
            </div>
          ) : (
            <ObjectProperties obj={selected} />
          )}
        </div>
      </aside>
    </>
  )
}

function ObjectProperties({ obj }) {
  const updateObject = useStore((s) => s.updateObject)
  const renameObject = useStore((s) => s.renameObject)
  const _pushHistory = useStore((s) => s._pushHistory)

  // Atualiza um campo de transformação (position/rotation/scale)
  // Usa commit direto (sem histórico por cada tecla) — o histórico é feito
  // pelo TransformControls. Para inputs manuais, empurramos histórico ao focar/perder foco.
  const setTransform = (field, axis, value) => {
    const arr = [...obj[field]]
    arr[axis] = value
    updateObject(obj.id, { [field]: arr })
  }

  const startEdit = () => _pushHistory()

  return (
    <>
      {/* Nome */}
      <div className="panel-section">
        <h4>Objeto</h4>
        <div className="prop-row">
          <label>Nome</label>
          <input
            type="text"
            value={obj.name}
            onChange={(e) => renameObject(obj.id, e.target.value)}
          />
        </div>
        <div className="prop-row row" style={{ gap: 6 }}>
          <span className="tag accent">{obj.type}</span>
          {obj.imported && <span className="tag">importado</span>}
          <span className="tag">id: {obj.id.slice(-6)}</span>
        </div>
      </div>

      {/* Transformação */}
      <div className="panel-section">
        <h4>Transformação</h4>

        <div className="prop-row">
          <label>Posição</label>
          <div className="vec3-input">
            <Vec3Axis axis={0} label="X" value={obj.position[0]}
              onFocus={startEdit}
              onChange={(v) => setTransform('position', 0, v)} />
            <Vec3Axis axis={1} label="Y" value={obj.position[1]}
              onFocus={startEdit}
              onChange={(v) => setTransform('position', 1, v)} />
            <Vec3Axis axis={2} label="Z" value={obj.position[2]}
              onFocus={startEdit}
              onChange={(v) => setTransform('position', 2, v)} />
          </div>
        </div>

        <div className="prop-row">
          <label>Rotação (graus)</label>
          <div className="vec3-input">
            <Vec3Axis axis={0} label="X" value={round(radToDeg(obj.rotation[0]), 1)}
              onFocus={startEdit}
              onChange={(v) => setTransform('rotation', 0, degToRad(v))} />
            <Vec3Axis axis={1} label="Y" value={round(radToDeg(obj.rotation[1]), 1)}
              onFocus={startEdit}
              onChange={(v) => setTransform('rotation', 1, degToRad(v))} />
            <Vec3Axis axis={2} label="Z" value={round(radToDeg(obj.rotation[2]), 1)}
              onFocus={startEdit}
              onChange={(v) => setTransform('rotation', 2, degToRad(v))} />
          </div>
        </div>

        <div className="prop-row">
          <label>Escala</label>
          <div className="vec3-input">
            <Vec3Axis axis={0} label="X" value={obj.scale[0]} step={0.1}
              onFocus={startEdit}
              onChange={(v) => setTransform('scale', 0, v)} />
            <Vec3Axis axis={1} label="Y" value={obj.scale[1]} step={0.1}
              onFocus={startEdit}
              onChange={(v) => setTransform('scale', 1, v)} />
            <Vec3Axis axis={2} label="Z" value={obj.scale[2]} step={0.1}
              onFocus={startEdit}
              onChange={(v) => setTransform('scale', 2, v)} />
          </div>
        </div>
      </div>

      {/* Material */}
      {obj?.material && <MaterialEditor obj={obj} />}

      {/* Args da primitiva (se aplicável) */}
      {!obj.imported && obj.args && <PrimitiveArgsEditor obj={obj} />}
    </>
  )
}

// Input de eixo XYZ com cor colorida
function Vec3Axis({ axis, label, value, onChange, onFocus, step = 0.1 }) {
  return (
    <div className={`axis ${['x', 'y', 'z'][axis]}`} data-axis={label}>
      <input
        type="number"
        step={step}
        value={typeof value === 'number' ? round(value, 3) : 0}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        onFocus={onFocus}
      />
    </div>
  )
}

// Editor de argumentos da primitiva (tamanho, raio, etc.)
function PrimitiveArgsEditor({ obj }) {
  const updateObject = useStore((s) => s.updateObject)
  const _pushHistory = useStore((s) => s._pushHistory)

  const updateArg = (key, value) => {
    updateObject(obj.id, { args: { ...obj.args, [key]: value } })
  }

  // Mapa de campos por tipo de primitiva
  const fieldsByType = {
    cube: [{ key: 'size', label: 'Tamanho', min: 0.1, max: 10, step: 0.1 }],
    sphere: [
      { key: 'radius', label: 'Raio', min: 0.1, max: 5, step: 0.1 },
      { key: 'segments', label: 'Segmentos', min: 4, max: 64, step: 1 },
    ],
    cylinder: [
      { key: 'radius', label: 'Raio', min: 0.1, max: 5, step: 0.1 },
      { key: 'height', label: 'Altura', min: 0.1, max: 10, step: 0.1 },
      { key: 'segments', label: 'Segmentos', min: 3, max: 64, step: 1 },
    ],
    cone: [
      { key: 'radius', label: 'Raio', min: 0.1, max: 5, step: 0.1 },
      { key: 'height', label: 'Altura', min: 0.1, max: 10, step: 0.1 },
      { key: 'segments', label: 'Segmentos', min: 3, max: 64, step: 1 },
    ],
    plane: [
      { key: 'width', label: 'Largura', min: 0.1, max: 20, step: 0.1 },
      { key: 'height', label: 'Altura', min: 0.1, max: 20, step: 0.1 },
    ],
    torus: [
      { key: 'radius', label: 'Raio', min: 0.1, max: 5, step: 0.1 },
      { key: 'tube', label: 'Tubo', min: 0.05, max: 2, step: 0.05 },
      { key: 'radialSegments', label: 'Seg. radiais', min: 3, max: 32, step: 1 },
      { key: 'tubularSegments', label: 'Seg. tubulares', min: 8, max: 128, step: 1 },
    ],
  }

  const fields = fieldsByType[obj.type] || []

  return (
    <div className="panel-section">
      <h4>Geometria</h4>
      {fields.map((f) => (
        <div key={f.key} className="prop-row">
          <label>{f.label}: {round(obj.args[f.key], 2)}</label>
          <input
            type="range"
            min={f.min}
            max={f.max}
            step={f.step}
            value={obj.args[f.key]}
            onFocus={_pushHistory}
            onChange={(e) => updateArg(f.key, Number(e.target.value))}
          />
        </div>
      ))}
    </div>
  )
}

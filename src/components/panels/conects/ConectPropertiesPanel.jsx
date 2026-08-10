/**
 * ConectPropertiesPanel — painel de propriedades dinâmico para o Conect selecionado.
 *
 * Lê a definição do tipo de Conect na taxonomy e gera inputs apropriados
 * para cada propriedade (number, color, boolean, select, vec2, vec3, text, objectRef).
 *
 * Mostra também:
 *  - Nome editável
 *  - Transformação (position/rotation/scale)
 *  - Botão para abrir FlirScript (se o conect for flirScriptable)
 *  - Botão para duplicar e apagar
 */
import { useStore } from '../../../store/useStore'
import { findConectDefinition } from '../../../utils/conects/taxonomy'
import { radToDeg, degToRad, round } from '../../../utils/helpers'
import {
  IconClose,
  IconDuplicate,
  IconTrash,
} from '../../ui/Icons'

export default function ConectPropertiesPanel({ conectId }) {
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const updateConect = useStore((s) => s.updateConect)
  const renameConect = useStore((s) => s.renameConect)
  const duplicateConect = useStore((s) => s.duplicateConect)
  const removeConectFromScene = useStore((s) => s.removeConectFromScene)
  const setFlirScriptTarget = useStore((s) => s.setFlirScriptTarget)
  const _pushHistory = useStore((s) => s._pushHistory)

  const scene = scenes.find((s) => s.id === activeSceneId)
  const conect = scene?.conects?.find((c) => c.instanceId === conectId)

  if (!conect) {
    return (
      <div className="empty-state">
        <div style={{ fontSize: 32, opacity: 0.4 }}></div>
        <div className="mt-2">Nenhum Conect selecionado.</div>
        <div className="small mt-2">
          Abre a janela de Conects e adiciona um à cena, ou clica num Conect existente.
        </div>
      </div>
    )
  }

  const def = findConectDefinition(conect.type)
  if (!def) return null

  const setProp = (key, value) => {
    updateConect(conect.instanceId, { [key]: value })
  }

  const setTransform = (field, axis, value) => {
    const arr = [...conect[field]]
    arr[axis] = value
    updateConect(conect.instanceId, { [field]: arr })
  }

  return (
    <div className="conect-properties">
      {/* Cabeçalho */}
      <div className="panel-section">
        <div className="row between" style={{ marginBottom: 6 }}>
          <span className="tag accent">{def.icon} {def.label}</span>
          <div className="row" style={{ gap: 4 }}>
            <button
              className="icon"
              onClick={() => duplicateConect(conect.instanceId)}
              title="Duplicar"
              style={{ padding: '4px 6px' }}
            >
              <IconDuplicate width={12} height={12} />
            </button>
            <button
              className="danger icon"
              onClick={() => removeConectFromScene(conect.instanceId)}
              title="Apagar"
              style={{ padding: '4px 6px' }}
            >
              <IconTrash width={12} height={12} />
            </button>
          </div>
        </div>
        <div className="prop-row">
          <label>Nome</label>
          <input
            type="text"
            value={conect.name}
            onChange={(e) => renameConect(conect.instanceId, e.target.value)}
          />
        </div>
      </div>

      {/* Transformação */}
      <div className="panel-section">
        <h4>Transformação</h4>
        <div className="prop-row">
          <label>Posição</label>
          <div className="vec3-input">
            <Vec3Axis axis={0} label="X" value={conect.position[0]}
              onFocus={_pushHistory}
              onChange={(v) => setTransform('position', 0, v)} />
            <Vec3Axis axis={1} label="Y" value={conect.position[1]}
              onFocus={_pushHistory}
              onChange={(v) => setTransform('position', 1, v)} />
            <Vec3Axis axis={2} label="Z" value={conect.position[2]}
              onFocus={_pushHistory}
              onChange={(v) => setTransform('position', 2, v)} />
          </div>
        </div>
        <div className="prop-row">
          <label>Rotação (graus)</label>
          <div className="vec3-input">
            <Vec3Axis axis={0} label="X" value={round(radToDeg(conect.rotation[0]), 1)}
              onChange={(v) => setTransform('rotation', 0, degToRad(v))} />
            <Vec3Axis axis={1} label="Y" value={round(radToDeg(conect.rotation[1]), 1)}
              onChange={(v) => setTransform('rotation', 1, degToRad(v))} />
            <Vec3Axis axis={2} label="Z" value={round(radToDeg(conect.rotation[2]), 1)}
              onChange={(v) => setTransform('rotation', 2, degToRad(v))} />
          </div>
        </div>
        <div className="prop-row">
          <label>Escala</label>
          <div className="vec3-input">
            <Vec3Axis axis={0} label="X" value={conect.scale[0]} step={0.1}
              onChange={(v) => setTransform('scale', 0, v)} />
            <Vec3Axis axis={1} label="Y" value={conect.scale[1]} step={0.1}
              onChange={(v) => setTransform('scale', 1, v)} />
            <Vec3Axis axis={2} label="Z" value={conect.scale[2]} step={0.1}
              onChange={(v) => setTransform('scale', 2, v)} />
          </div>
        </div>
      </div>

      {/* Propriedades específicas do tipo */}
      <div className="panel-section">
        <h4>Propriedades — {def.label}</h4>
        {def.properties.map((propDef) => (
          <PropertyField
            key={propDef.key}
            propDef={propDef}
            value={conect[propDef.key]}
            onChange={(v) => setProp(propDef.key, v)}
            onFocus={_pushHistory}
          />
        ))}
      </div>

      {/* FlirScript */}
      {def.flirScriptable && (
        <div className="panel-section">
          <h4>FlirScript (lógica)</h4>
          <button
            onClick={() => setFlirScriptTarget(activeSceneId, conect.instanceId)}
            className={conect.flirScript ? 'primary' : ''}
            style={{ width: '100%' }}
            title="Abrir editor FlirScript para este Conect"
          >{conect.flirScript ? 'Editar FlirScript ✓' : 'Criar FlirScript'}
          </button>
        </div>
      )}

      {/* Estado do Conect */}
      <div className="panel-section">
        <h4>Estado</h4>
        <div className="small muted">
          <div>Tipo: <strong>{conect.type}</strong></div>
          <div>ID: <code>{conect.instanceId.slice(-8)}</code></div>
          {def.hasPhysics && <div>Tem física</div>}
          {def.hasVisual && <div>Tem visual</div>}
          {def.flirScriptable && <div>Suporta FlirScript</div>}
        </div>
      </div>
    </div>
  )
}

// Campo de propriedade dinâmico
function PropertyField({ propDef, value, onChange, onFocus }) {
  const { type, label, key } = propDef

  switch (type) {
    case 'number':
      return (
        <div className="prop-row">
          <label>{label}{value !== undefined ? `: ${round(value, 3)}` : ''}</label>
          {propDef.min !== undefined && propDef.max !== undefined ? (
            <input
              type="range"
              min={propDef.min}
              max={propDef.max}
              step={propDef.step || 0.1}
              value={value ?? propDef.default}
              onFocus={onFocus}
              onChange={(e) => onChange(Number(e.target.value))}
            />
          ) : (
            <input
              type="number"
              step={propDef.step || 0.1}
              value={value ?? propDef.default}
              onFocus={onFocus}
              onChange={(e) => onChange(Number(e.target.value))}
            />
          )}
        </div>
      )

    case 'color':
      return (
        <div className="prop-row">
          <label>{label}</label>
          <input
            type="color"
            value={value || propDef.default}
            onFocus={onFocus}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onFocus}
          />
        </div>
      )

    case 'boolean':
      return (
        <div className="prop-row">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={value ?? propDef.default}
              onChange={(e) => { onFocus(); onChange(e.target.checked) }}
            />
            {label}
          </label>
        </div>
      )

    case 'select':
      return (
        <div className="prop-row">
          <label>{label}</label>
          <select
            value={value || propDef.default}
            onFocus={onFocus}
            onChange={(e) => onChange(e.target.value)}
          >
            {propDef.options.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      )

    case 'text':
      return (
        <div className="prop-row">
          <label>{label}</label>
          <input
            type="text"
            value={value ?? propDef.default ?? ''}
            onFocus={onFocus}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      )

    case 'vec2':
      const v2 = value || propDef.default || [0, 0]
      return (
        <div className="prop-row">
          <label>{label}</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            <input
              type="number"
              step={0.1}
              value={v2[0]}
              onFocus={onFocus}
              onChange={(e) => onChange([Number(e.target.value), v2[1]])}
            />
            <input
              type="number"
              step={0.1}
              value={v2[1]}
              onChange={(e) => onChange([v2[0], Number(e.target.value)])}
            />
          </div>
        </div>
      )

    case 'vec3':
      const v3 = value || propDef.default || [0, 0, 0]
      return (
        <div className="prop-row">
          <label>{label}</label>
          <div className="vec3-input">
            <div className="axis x" data-axis="X">
              <input type="number" step={0.1} value={v3[0]}
                onChange={(e) => onChange([Number(e.target.value), v3[1], v3[2]])} />
            </div>
            <div className="axis y" data-axis="Y">
              <input type="number" step={0.1} value={v3[1]}
                onChange={(e) => onChange([v3[0], Number(e.target.value), v3[2]])} />
            </div>
            <div className="axis z" data-axis="Z">
              <input type="number" step={0.1} value={v3[2]}
                onChange={(e) => onChange([v3[0], v3[1], Number(e.target.value)])} />
            </div>
          </div>
        </div>
      )

    case 'objectRef':
      // Lista de instâncias disponíveis na cena
      const scene = useStore.getState().scenes.find((s) => s.id === useStore.getState().activeSceneId)
      const options = [
        ...(scene?.objects || []).map((o) => ({ id: o.instanceId, label: `Objeto: ${o.objectId?.slice(-6)}` })),
        ...(scene?.conects || []).map((c) => ({ id: c.instanceId, label: `${c.name} (${c.type})` })),
      ]
      return (
        <div className="prop-row">
          <label>{label}</label>
          <select
            value={value || ''}
            onFocus={onFocus}
            onChange={(e) => onChange(e.target.value || null)}
          >
            <option value="">— Nenhum —</option>
            {options.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </div>
      )

    default:
      return null
  }
}

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

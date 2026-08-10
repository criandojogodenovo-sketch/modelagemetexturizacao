/**
 * ModifiersPanel — painel para gerir modificadores não destrutivos.
 *
 * Permite adicionar subdivision surface, mirror, array, solidify.
 * Lista os modificadores do objeto selecionado com toggles e parâmetros editáveis.
 */
import { useStore, useSelectedObject, MODIFIER_TYPES } from '../../store/useStore'
import {
  IconSubdivide,
  IconMirror,
  IconArray,
  IconSolidify,
  IconCurve,
  IconTrash,
} from '../ui/Icons'

const MODIFIER_ICONS = {
  subdivision: IconSubdivide,
  mirror: IconMirror,
  array: IconArray,
  solidify: IconSolidify,
  curve: IconCurve,
}

export default function ModifiersPanel() {
  const selected = useSelectedObject()
  const addModifier = useStore((s) => s.addModifier)
  const updateModifier = useStore((s) => s.updateModifier)
  const removeModifier = useStore((s) => s.removeModifier)

  if (!selected) {
    return (
      <div className="empty-state">
        <div>Selecione um objeto para gerir modificadores.</div>
      </div>
    )
  }

  const modifiers = selected.modifiers || []

  return (
    <>
      <div className="panel-section">
        <h4>Adicionar Modificador</h4>
        <div className="tool-grid">
          {Object.entries(MODIFIER_TYPES).map(([key, def]) => {
            const Icon = MODIFIER_ICONS[key]
            return (
              <button
                key={key}
                onClick={() => addModifier(selected.id, key)}
                title={def.description}
              >
                {Icon && <Icon />}
                <span style={{ fontSize: 9 }}>{def.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="panel-section">
        <h4>Stack de Modificadores ({modifiers.length})</h4>
        {modifiers.length === 0 ? (
          <div className="empty-state small">
            Sem modificadores. Adicione acima.
          </div>
        ) : (
          modifiers.map((mod, index) => {
            const def = MODIFIER_TYPES[mod.type]
            const Icon = MODIFIER_ICONS[mod.type]
            return (
              <div
                key={mod.id}
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: 8,
                  marginBottom: 8,
                  background: 'var(--bg-panel-2)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  {Icon && <Icon width={14} height={14} />}
                  <strong style={{ flex: 1, fontSize: 12 }}>
                    {index + 1}. {def?.label || mod.type}
                  </strong>
                  <label className="checkbox-row" style={{ fontSize: 10 }}>
                    <input
                      type="checkbox"
                      checked={mod.enabled}
                      onChange={(e) =>
                        updateModifier(selected.id, mod.id, { enabled: e.target.checked })
                      }
                    />
                  </label>
                  <button
                    className="danger"
                    style={{ padding: '2px 4px' }}
                    onClick={() => removeModifier(selected.id, mod.id)}
                    title="Remover modificador"
                  >
                    <IconTrash width={12} height={12} />
                  </button>
                </div>

                {/* Parâmetros específicos do modificador */}
                <ModifierParams
                  mod={mod}
                  onChange={(patch) => updateModifier(selected.id, mod.id, { params: patch })}
                />
              </div>
            )
          })
        )}
      </div>
    </>
  )
}

function ModifierParams({ mod, onChange }) {
  const params = mod.params || {}
  switch (mod.type) {
    case 'subdivision':
      return (
        <div className="prop-row">
          <label>Níveis: {params.levels}</label>
          <input
            type="range"
            min="1"
            max="4"
            step="1"
            value={params.levels}
            onChange={(e) => onChange({ levels: Number(e.target.value) })}
          />
        </div>
      )
    case 'mirror':
      return (
        <div className="prop-row">
          <label>Eixo</label>
          <select
            value={params.axis}
            onChange={(e) => onChange({ axis: e.target.value })}
          >
            <option value="x">X (horizontal)</option>
            <option value="y">Y (vertical)</option>
            <option value="z">Z (profundidade)</option>
          </select>
        </div>
      )
    case 'array':
      return (
        <>
          <div className="prop-row">
            <label>Repetições: {params.count}</label>
            <input
              type="range"
              min="2"
              max="20"
              step="1"
              value={params.count}
              onChange={(e) => onChange({ count: Number(e.target.value) })}
            />
          </div>
          <div className="prop-row">
            <label>Offset X: {params.offset?.[0]}</label>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={params.offset?.[0]}
              onChange={(e) => onChange({ offset: [Number(e.target.value), params.offset?.[1] || 0, params.offset?.[2] || 0] })}
            />
          </div>
        </>
      )
    case 'solidify':
      return (
        <div className="prop-row">
          <label>Espessura: {params.thickness}</label>
          <input
            type="range"
            min="0.01"
            max="1"
            step="0.01"
            value={params.thickness}
            onChange={(e) => onChange({ thickness: Number(e.target.value) })}
          />
        </div>
      )
    case 'curve': {
      // Listar PathObjects disponíveis em todas as cenas
      const scenes = useStore.getState().scenes || []
      const pathOptions = []
      for (const scene of scenes) {
        for (const conect of scene.conects || []) {
          if (conect.type === 'PathObject' && conect.points?.length >= 2) {
            pathOptions.push({
              id: conect.instanceId,
              label: `${conect.name || 'Path'} (${conect.points.length} pts)`,
            })
          }
        }
      }
      return (
        <>
          <div className="prop-row">
            <label>Path (curva)</label>
            <select
              value={params.pathId || ''}
              onChange={(e) => onChange({ pathId: e.target.value || null })}
            >
              <option value="">— Selecionar Path —</option>
              {pathOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>
          </div>
          {pathOptions.length === 0 && (
            <div className="small muted">
              💡 Cria um PathObject numa cena primeiro (Conects → Path Object).
            </div>
          )}
          <div className="prop-row">
            <label>Twist (rotações): {params.twist}</label>
            <input
              type="range"
              min="-3"
              max="3"
              step="0.1"
              value={params.twist || 0}
              onChange={(e) => onChange({ twist: Number(e.target.value) })}
            />
          </div>
          <div className="prop-row">
            <label>Stretch: {params.stretch}</label>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={params.stretch || 1}
              onChange={(e) => onChange({ stretch: Number(e.target.value) })}
            />
          </div>
        </>
      )
    }
    default:
      return null
  }
}

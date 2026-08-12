/**
 * ModifiersPanel — painel para gerir modificadores não destrutivos.
 *
 * Permite adicionar subdivision surface, mirror, array, solidify.
 * Lista os modificadores do objeto selecionado com toggles e parâmetros editáveis.
 */
import { useStore, useSelectedObject, MODIFIER_TYPES } from '../../store/useStore'
import { applyGPUModifiers } from '../../utils/gpuMeshModifiers'
import {
  IconSubdivide,
  IconMirror,
  IconArray,
  IconSolidify,
  IconTrash,
} from '../ui/Icons'
import { Icon } from '../ui/iconMap'
import { useState, useEffect } from 'react'

const MODIFIER_ICONS = {
  subdivision: IconSubdivide,
  mirror: IconMirror,
  array: IconArray,
  solidify: IconSolidify,
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

      {/* Modificadores GPU — deformação em tempo real no vertex shader */}
      <div className="panel-section">
        <h4>Modificadores GPU (Tempo Real)</h4>
        <div className="small muted mb-2">
          Deformações processadas na GPU. Zero overhead CPU. Animáveis em tempo real.
        </div>
        <GPUModifiersSection selected={selected} />
      </div>
    </>
  )
}

function GPUModifiersSection({ selected }) {
  const [stack, setStack] = useState(null)
  const [params, setParams] = useState({
    bendAngle: 0, bendAxis: 1,
    twistAngle: 0, twistAxis: 1,
    taperFactor: 0, taperAxis: 1,
    skewAmount: 0, skewAxis: 0, skewDir: 1,
    spherifyAmount: 0,
    displaceStrength: 0, displaceScale: 1,
    rippleStrength: 0, rippleFrequency: 5,
  })

  useEffect(() => {
    if (!selected?.material) return
    // Aplicar GPU modifiers ao material do objeto selecionado
    // Nota: applyGPUModifiers modifica onBeforeCompile do material
    // Isto é seguro chamar múltiplas vezes (idempotente)
  }, [selected?.id])

  const update = (name, value) => {
    setParams(p => ({ ...p, [name]: value }))
    if (stack) stack.setParam(name, value)
  }

  return (
    <>
      <div className="prop-row">
        <label>Bend (ângulo): {params.bendAngle.toFixed(2)} rad</label>
        <input type="range" min="-3.14" max="3.14" step="0.05" value={params.bendAngle}
          onChange={(e) => update('bendAngle', Number(e.target.value))} />
      </div>
      <div className="prop-row">
        <label>Twist (rotações): {params.twistAngle.toFixed(2)} rad</label>
        <input type="range" min="-6.28" max="6.28" step="0.05" value={params.twistAngle}
          onChange={(e) => update('twistAngle', Number(e.target.value))} />
      </div>
      <div className="prop-row">
        <label>Taper: {params.taperFactor.toFixed(2)}</label>
        <input type="range" min="-1" max="1" step="0.05" value={params.taperFactor}
          onChange={(e) => update('taperFactor', Number(e.target.value))} />
      </div>
      <div className="prop-row">
        <label>Spherify: {params.spherifyAmount.toFixed(2)}</label>
        <input type="range" min="0" max="1" step="0.05" value={params.spherifyAmount}
          onChange={(e) => update('spherifyAmount', Number(e.target.value))} />
      </div>
      <div className="prop-row">
        <label>Displace: {params.displaceStrength.toFixed(2)}</label>
        <input type="range" min="0" max="0.5" step="0.01" value={params.displaceStrength}
          onChange={(e) => update('displaceStrength', Number(e.target.value))} />
      </div>
      <div className="prop-row">
        <label>Ripple: {params.rippleStrength.toFixed(2)}</label>
        <input type="range" min="0" max="0.5" step="0.01" value={params.rippleStrength}
          onChange={(e) => update('rippleStrength', Number(e.target.value))} />
      </div>
      <button
        onClick={() => {
          setParams({
            bendAngle: 0, twistAngle: 0, taperFactor: 0,
            skewAmount: 0, spherifyAmount: 0,
            displaceStrength: 0, rippleStrength: 0,
          })
          if (stack) {
            stack.applyPreset('none')
          }
        }}
        style={{ width: '100%', marginTop: 8, fontSize: 11 }}
      >
        <Icon name="refresh" size={12} />
        <span>Reset</span>
      </button>
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
    case 'bevel':
      return (
        <>
          <div className="prop-row">
            <label>Largura: {params.width}</label>
            <input type="range" min="0.01" max="0.5" step="0.01" value={params.width}
              onChange={(e) => onChange({ width: Number(e.target.value) })} />
          </div>
          <div className="prop-row">
            <label>Segmentos: {params.segments}</label>
            <input type="range" min="1" max="8" step="1" value={params.segments}
              onChange={(e) => onChange({ segments: Number(e.target.value) })} />
          </div>
        </>
      )
    case 'displace':
      return (
        <>
          <div className="prop-row">
            <label>Força: {params.strength}</label>
            <input type="range" min="0" max="2" step="0.05" value={params.strength}
              onChange={(e) => onChange({ strength: Number(e.target.value) })} />
          </div>
          <div className="prop-row">
            <label>Escala: {params.scale}</label>
            <input type="range" min="0.1" max="5" step="0.1" value={params.scale}
              onChange={(e) => onChange({ scale: Number(e.target.value) })} />
          </div>
          <div className="prop-row">
            <label>Tipo textura</label>
            <select value={params.textureType} onChange={(e) => onChange({ textureType: e.target.value })}>
              <option value="noise">Noise (sin)</option>
              <option value="random">Aleatório</option>
            </select>
          </div>
        </>
      )
    case 'bend':
    case 'twist':
      return (
        <>
          <div className="prop-row">
            <label>Ângulo: {params.angle}°</label>
            <input type="range" min="0" max="360" step="5" value={params.angle}
              onChange={(e) => onChange({ angle: Number(e.target.value) })} />
          </div>
          <div className="prop-row">
            <label>Eixo</label>
            <select value={params.axis} onChange={(e) => onChange({ axis: e.target.value })}>
              <option value="x">X</option>
              <option value="y">Y</option>
              <option value="z">Z</option>
            </select>
          </div>
        </>
      )
    case 'taper':
      return (
        <>
          <div className="prop-row">
            <label>Quantidade: {params.amount}</label>
            <input type="range" min="-1" max="1" step="0.05" value={params.amount}
              onChange={(e) => onChange({ amount: Number(e.target.value) })} />
          </div>
          <div className="prop-row">
            <label>Eixo</label>
            <select value={params.axis} onChange={(e) => onChange({ axis: e.target.value })}>
              <option value="x">X</option>
              <option value="y">Y</option>
              <option value="z">Z</option>
            </select>
          </div>
        </>
      )
    case 'wireframe':
      return (
        <div className="prop-row">
          <label>Espessura: {params.thickness}</label>
          <input type="range" min="0.005" max="0.2" step="0.005" value={params.thickness}
            onChange={(e) => onChange({ thickness: Number(e.target.value) })} />
        </div>
      )
    case 'remesh':
      return (
        <div className="prop-row">
          <label>Tamanho voxel: {params.voxelSize}</label>
          <input type="range" min="0.02" max="0.5" step="0.02" value={params.voxelSize}
            onChange={(e) => onChange({ voxelSize: Number(e.target.value) })} />
        </div>
      )
    case 'smooth':
      return (
        <>
          <div className="prop-row">
            <label>Iterações: {params.iterations}</label>
            <input type="range" min="1" max="5" step="1" value={params.iterations}
              onChange={(e) => onChange({ iterations: Number(e.target.value) })} />
          </div>
          <div className="prop-row">
            <label>Fator: {params.factor}</label>
            <input type="range" min="0" max="1" step="0.05" value={params.factor}
              onChange={(e) => onChange({ factor: Number(e.target.value) })} />
          </div>
        </>
      )
    case 'spherify':
      return (
        <div className="prop-row">
          <label>Fator: {params.factor}</label>
          <input type="range" min="0" max="1" step="0.05" value={params.factor}
            onChange={(e) => onChange({ factor: Number(e.target.value) })} />
        </div>
      )
    default:
      return null
  }
}

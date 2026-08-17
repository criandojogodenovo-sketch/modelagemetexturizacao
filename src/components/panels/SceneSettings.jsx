/**
 * SceneSettings — configurações globais da cena.
 *
 * Permite ajustar:
 *  - Fundo (cor sólida ou gradiente)
 *  - Grelha (visibilidade, tamanho, cor)
 *  - Luzes (ambiente + direcional)
 *  - Presets de Luz (RGB + cinematográficos)
 *
 * Secções colapsáveis via CollapseSection.
 */
import { useStore } from '../../store/useStore'
import CollapseSection from '../ui/CollapseSection'
import { LIGHT_PRESETS, applyLightPreset, getPresetsByCategory } from '../../utils/lightPresets'
import { SKY_PRESETS, applySkyPreset, getSkyPresets } from '../../utils/skyPresets'

export default function SceneSettings() {
  const background = useStore((s) => s.background)
  const setBackground = useStore((s) => s.setBackground)
  const grid = useStore((s) => s.grid)
  const setGrid = useStore((s) => s.setGrid)
  const lights = useStore((s) => s.lights)
  const setLights = useStore((s) => s.setLights)

  return (
    <>
      <CollapseSection title="Fundo da Cena" icon="palette" storageKey="scene_bg">
        <div className="prop-row">
          <label>Tipo</label>
          <select
            value={background.type}
            onChange={(e) => setBackground({ type: e.target.value })}
          >
            <option value="solid">Cor sólida</option>
            <option value="gradient">Gradiente</option>
          </select>
        </div>
        {background.type === 'solid' ? (
          <div className="prop-row">
            <label>Cor</label>
            <input
              type="color"
              value={background.color}
              onChange={(e) => setBackground({ color: e.target.value })}
            />
          </div>
        ) : (
          <>
            <div className="prop-row">
              <label>Cor superior</label>
              <input
                type="color"
                value={background.gradientTop}
                onChange={(e) => setBackground({ gradientTop: e.target.value })}
              />
            </div>
            <div className="prop-row">
              <label>Cor inferior</label>
              <input
                type="color"
                value={background.gradientBottom}
                onChange={(e) => setBackground({ gradientBottom: e.target.value })}
              />
            </div>
          </>
        )}
      </CollapseSection>

      <CollapseSection title="Grelha de Referência" icon="grid-2x2" defaultOpen={false} storageKey="scene_grid">
        <div className="prop-row">
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={grid.visible}
              onChange={(e) => setGrid({ visible: e.target.checked })}
            />
            Mostrar grelha
          </label>
        </div>
        <div className="prop-row">
          <label>Tamanho: {grid.size}</label>
          <input
            type="range"
            min="5"
            max="60"
            step="1"
            value={grid.size}
            onChange={(e) => setGrid({ size: Number(e.target.value) })}
          />
        </div>
        <div className="prop-row">
          <label>Divisões: {grid.divisions}</label>
          <input
            type="range"
            min="5"
            max="60"
            step="1"
            value={grid.divisions}
            onChange={(e) => setGrid({ divisions: Number(e.target.value) })}
          />
        </div>
        <div className="prop-row">
          <label>Cor</label>
          <input
            type="color"
            value={grid.color}
            onChange={(e) => setGrid({ color: e.target.value })}
          />
        </div>
      </CollapseSection>

      <CollapseSection title="Iluminação" icon="lightbulb" defaultOpen={false} storageKey="scene_lights">
        <div className="prop-row">
          <label>Luz Ambiente — Intensidade: {lights.ambient.intensity.toFixed(2)}</label>
          <input
            type="range"
            min="0"
            max="3"
            step="0.05"
            value={lights.ambient.intensity}
            onChange={(e) =>
              setLights({ ambient: { intensity: Number(e.target.value) } })
            }
          />
        </div>
        <div className="prop-row">
          <label>Luz Ambiente — Cor</label>
          <input
            type="color"
            value={lights.ambient.color}
            onChange={(e) => setLights({ ambient: { color: e.target.value } })}
          />
        </div>

        <div className="divider" />

        <div className="prop-row">
          <label>Luz Direcional — Intensidade: {lights.directional.intensity.toFixed(2)}</label>
          <input
            type="range"
            min="0"
            max="5"
            step="0.05"
            value={lights.directional.intensity}
            onChange={(e) =>
              setLights({ directional: { intensity: Number(e.target.value) } })
            }
          />
        </div>
        <div className="prop-row">
          <label>Luz Direcional — Cor</label>
          <input
            type="color"
            value={lights.directional.color}
            onChange={(e) => setLights({ directional: { color: e.target.value } })}
          />
        </div>
        <div className="prop-row">
          <label>Posição (X, Y, Z)</label>
          <div className="vec3-input">
            <div className="axis x" data-axis="X">
              <input
                type="number"
                step="0.5"
                value={lights.directional.position[0]}
                onChange={(e) =>
                  setLights({
                    directional: {
                      position: [Number(e.target.value), lights.directional.position[1], lights.directional.position[2]],
                    },
                  })
                }
              />
            </div>
            <div className="axis y" data-axis="Y">
              <input
                type="number"
                step="0.5"
                value={lights.directional.position[1]}
                onChange={(e) =>
                  setLights({
                    directional: {
                      position: [lights.directional.position[0], Number(e.target.value), lights.directional.position[2]],
                    },
                  })
                }
              />
            </div>
            <div className="axis z" data-axis="Z">
              <input
                type="number"
                step="0.5"
                value={lights.directional.position[2]}
                onChange={(e) =>
                  setLights({
                    directional: {
                      position: [lights.directional.position[0], lights.directional.position[1], Number(e.target.value)],
                    },
                  })
                }
              />
            </div>
          </div>
        </div>
      </CollapseSection>

      <CollapseSection title="Presets de Luz" icon="sparkles" defaultOpen={false} storageKey="scene_light_presets">
        <PresetsSection />
      </CollapseSection>

      <CollapseSection title="Presets de Céu" icon="cloud" defaultOpen={false} storageKey="scene_sky_presets">
        <SkyPresetsSection />
      </CollapseSection>
    </>
  )
}

// ===== Sub-componente: Presets de Céu =====
function SkyPresetsSection() {
  const store = useStore
  const presets = getSkyPresets()

  const handleApply = (presetId) => {
    applySkyPreset(presetId, store.getState())
  }

  return (
    <>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {presets.map(preset => (
            <button
              key={preset.id}
              onClick={() => handleApply(preset.id)}
              title={preset.description}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '10px 4px',
                background: 'var(--bg-tertiary, #161b22)',
                border: '1px solid var(--border, #30363d)',
                borderRadius: '6px',
                cursor: 'pointer',
                color: 'var(--text, #e6edf3)',
                fontSize: '11px',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#2f81f7' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border, #30363d)' }}
            >
              <span style={{ fontSize: '24px' }}>{preset.icon}</span>
              <span style={{ fontWeight: 600 }}>{preset.label}</span>
              <span style={{ fontSize: '9px', opacity: 0.5, textAlign: 'center', lineHeight: '1.3' }}>
                {preset.description}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '8px', lineHeight: '1.4' }}>
        Aplicar um preset cria/atualiza um SkyObject na cena com configurações de céu procedural (rayleigh, turbidity, estrelas, etc.).
      </div>
    </>
  )
}

// ===== Sub-componente: Presets de Luz =====
function PresetsSection() {
  const store = useStore
  const { rgb, cinematic } = getPresetsByCategory()

  const handleApply = (presetId) => {
    applyLightPreset(presetId, store.getState())
  }

  return (
    <>
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.7, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Presets RGB
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {rgb.map(preset => (
            <button
              key={preset.id}
              onClick={() => handleApply(preset.id)}
              title={preset.description}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 4px',
                background: 'var(--bg-tertiary, #161b22)',
                border: '1px solid var(--border, #30363d)',
                borderRadius: '6px',
                cursor: 'pointer',
                color: 'var(--text, #e6edf3)',
                fontSize: '11px',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = preset.primary.color }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border, #30363d)' }}
            >
              <div style={{ display: 'flex', gap: '2px' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: preset.primary.color, border: '1px solid rgba(255,255,255,0.2)' }} />
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: preset.secondary.color, border: '1px solid rgba(255,255,255,0.2)' }} />
              </div>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', fontWeight: 600, opacity: 0.7, marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Presets Cinematográficos
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
          {cinematic.map(preset => (
            <button
              key={preset.id}
              onClick={() => handleApply(preset.id)}
              title={preset.description}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                padding: '8px 4px',
                background: 'var(--bg-tertiary, #161b22)',
                border: '1px solid var(--border, #30363d)',
                borderRadius: '6px',
                cursor: 'pointer',
                color: 'var(--text, #e6edf3)',
                fontSize: '11px',
                transition: 'border-color 0.15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = preset.primary.color }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border, #30363d)' }}
            >
              <div style={{ display: 'flex', gap: '2px' }}>
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: preset.primary.color, border: '1px solid rgba(255,255,255,0.2)' }} />
                <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: preset.secondary.color, border: '1px solid rgba(255,255,255,0.2)' }} />
              </div>
              <span>{preset.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ fontSize: '10px', opacity: 0.5, marginTop: '8px', lineHeight: '1.4' }}>
        Aplicar um preset substitui luzes Sun/Point/Ambient existentes na cena por 2 novas luzes complementares.
      </div>
    </>
  )
}

/**
 * SceneSettings — configurações globais da cena.
 *
 * Permite ajustar:
 *  - Fundo (cor sólida ou gradiente)
 *  - Grelha (visibilidade, tamanho, cor)
 *  - Luzes (ambiente + direcional)
 *
 * Secções colapsáveis via CollapseSection.
 */
import { useStore } from '../../store/useStore'
import CollapseSection from '../ui/CollapseSection'

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
    </>
  )
}

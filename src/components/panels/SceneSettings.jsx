/**
 * SceneSettings — configurações globais da cena.
 *
 * Permite ajustar:
 *  - Fundo (cor sólida ou gradiente)
 *  - Grelha (visibilidade, tamanho, cor)
 *  - Luzes (ambiente + direcional)
 */
import { useStore } from '../../store/useStore'

export default function SceneSettings() {
  const background = useStore((s) => s.background)
  const setBackground = useStore((s) => s.setBackground)
  const grid = useStore((s) => s.grid)
  const setGrid = useStore((s) => s.setGrid)
  const lights = useStore((s) => s.lights)
  const setLights = useStore((s) => s.setLights)
  const renderSettings = useStore((s) => s.renderSettings)
  const setRenderSettings = useStore((s) => s.setRenderSettings)

  return (
    <>
      <div className="panel-section">
        <h4>Fundo da Cena</h4>
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
      </div>

      <div className="panel-section">
        <h4>Grelha de Referência</h4>
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
      </div>

      <div className="panel-section">
        <h4>Iluminação</h4>
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
      </div>

      {/* Renderização Avançada — recursos pesados, off por defeito */}
      <div className="panel-section">
        <h4>Renderização Avançada</h4>
        <div className="small muted mb-2" style={{ color: '#f85149' }}>
          ⚠️ Recursos pesados — podem reduzir o FPS
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={renderSettings?.flirGI || false}
            onChange={(e) => setRenderSettings({ flirGI: e.target.checked })}
          />
          <div style={{ flex: 1 }}>
            <strong>Flir GI</strong>
            <div className="small muted">
              Iluminação global em tempo real (aproximação de luz indireta/bounce).
              Adiciona hemisphere light + contact shadows melhoradas.
            </div>
          </div>
        </label>

        <label className="checkbox-row mt-2">
          <input
            type="checkbox"
            checked={renderSettings?.flirAdaptiveMesh || false}
            onChange={(e) => setRenderSettings({ flirAdaptiveMesh: e.target.checked })}
          />
          <div style={{ flex: 1 }}>
            <strong>Flir Adaptive Mesh</strong>
            <div className="small muted">
              Geometria adaptativa — ajusta o nível de detalhe (LOD) automaticamente
              consoante a distância à câmara. Permite modelos mais detalhados sem
              penalizar o desempenho à distância.
            </div>
          </div>
        </label>

        <label className="checkbox-row mt-2">
          <input
            type="checkbox"
            checked={renderSettings?.vertexAO || false}
            onChange={(e) => setRenderSettings({ vertexAO: e.target.checked })}
          />
          <div style={{ flex: 1 }}>
            <strong>Vertex AO (Oclusão Ambiental)</strong>
            <div className="small muted">
              Pré-calcula oclusão ambiental por vértice (cantos/frestas mais escuros).
              Custo zero em runtime — cálculo feito uma vez no setup.
            </div>
          </div>
        </label>

        <label className="checkbox-row mt-2">
          <input
            type="checkbox"
            checked={renderSettings?.pom || false}
            onChange={(e) => setRenderSettings({ pom: e.target.checked })}
          />
          <div style={{ flex: 1 }}>
            <strong>Parallax Occlusion Mapping (POM)</strong>
            <div className="small muted">
              Faz superfícies planas parecerem ter relevo real (tijolos, fendas).
              Usa height map — sem adicionar polígonos. Custo moderado.
            </div>
          </div>
        </label>
      </div>

      {/* Otimização de Sombras — ativo por defeito, reduz custo de shadow passes */}
      <div className="panel-section">
        <h4>Otimização de Sombras</h4>
        <div className="small muted mb-2" style={{ color: '#3fb950' }}>
          ⚡ Recomendado — reduz o gargalo principal (shadow passes)
        </div>

        <label className="checkbox-row">
          <input
            type="checkbox"
            checked={renderSettings?.shadowOptimizations ?? true}
            onChange={(e) => setRenderSettings({ shadowOptimizations: e.target.checked })}
          />
          <div style={{ flex: 1 }}>
            <strong>Shadow Distance Culling</strong>
            <div className="small muted">
              Objetos além da distância configurada não projetam sombras.
              Reduz draw calls na shadow pass sem afetar a qualidade visível.
            </div>
          </div>
        </label>

        {renderSettings?.shadowOptimizations !== false && (
          <>
            <div className="prop-row mt-2">
              <label>Distância de sombra: {renderSettings?.shadowDistance || 20} unidades</label>
              <input
                type="range"
                min="5"
                max="60"
                step="5"
                value={renderSettings?.shadowDistance || 20}
                onChange={(e) => setRenderSettings({ shadowDistance: Number(e.target.value) })}
              />
            </div>

            <div className="prop-row">
              <label>Resolução do shadow map</label>
              <select
                value={renderSettings?.shadowMapSize || 1024}
                onChange={(e) => setRenderSettings({ shadowMapSize: Number(e.target.value) })}
              >
                <option value="1024">1024 (performance)</option>
                <option value="2048">2048 (qualidade)</option>
                <option value="4096">4096 (máxima — pesado)</option>
              </select>
            </div>
          </>
        )}
      </div>
    </>
  )
}

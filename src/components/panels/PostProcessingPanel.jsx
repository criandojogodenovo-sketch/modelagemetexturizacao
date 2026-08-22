/**
 * PostProcessingPanel — painel de configuração de efeitos de pós-processamento.
 *
 * Efeitos suportados:
 *  - Bloom (brilho em zonas claras/emissivas)
 *  - SSAO leve (oclusão ambiente)
 *  - Depth of Field (desfoque de profundidade)
 *  - Color Grading (correção/ajuste de cor)
 *
 * As configurações são guardadas por cena (em activeScene.postProcessing)
 * e aplicadas tanto na pré-visualização como no jogo exportado.
 *
 * Avisos de desempenho são mostrados quando demasiados efeitos pesados
 * estão ativos simultaneamente.
 */
import { useStore } from '../../store/useStore'
import { IconClose } from '../ui/Icons'

const EFFECTS = [
  {
    id: 'bloom',
    label: 'Bloom',
    icon: 'sparkles',
    desc: 'Brilho em zonas claras/emissivas',
    perfCost: 'medium',
    defaults: { enabled: false, intensity: 0.8, threshold: 0.85 },
  },
  {
    id: 'ssao',
    label: 'SSAO',
icon: '',
    desc: 'Oclusão ambiente — sombras suaves em cantos',
    perfCost: 'high',
    defaults: { enabled: false, intensity: 0.5, radius: 0.1 },
  },
  {
    id: 'dof',
    label: 'Depth of Field',
    icon: 'search',
    desc: 'Desfoque de profundidade — fundo desfocado',
    perfCost: 'high',
    defaults: { enabled: false, focusDistance: 10, focusRange: 5, bokehSize: 0.02 },
  },
  {
    id: 'colorGrading',
    label: 'Color Grading',
    icon: 'palette',
    desc: 'Correção/ajuste de cor geral da cena',
    perfCost: 'low',
    defaults: { enabled: false, brightness: 1, contrast: 1, saturation: 1, hue: 0, tint: '#ffffff' },
  },
]

export default function PostProcessingPanel({ onClose }) {
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const updateScene = useStore((s) => s.updateScene)
  const toast = useStore((s) => s.toast)

  const activeScene = scenes.find((s) => s.id === activeSceneId)
  if (!activeScene) return null

  const pp = activeScene.postProcessing || {}
  // Inicializar defaults se não existirem
  for (const effect of EFFECTS) {
    if (!pp[effect.id]) {
      pp[effect.id] = { ...effect.defaults }
    }
  }

  const updateEffect = (effectId, patch) => {
    const newPp = { ...pp, [effectId]: { ...pp[effectId], ...patch } }
    updateScene(activeScene.id, { postProcessing: newPp })
  }

  // Calcular aviso de desempenho
  const enabledEffects = EFFECTS.filter((e) => pp[e.id]?.enabled)
  const highCostCount = enabledEffects.filter((e) => e.perfCost === 'high').length
  const mediumCostCount = enabledEffects.filter((e) => e.perfCost === 'medium').length

  let perfWarning = null
  if (highCostCount >= 2) {
    perfWarning = { level: 'error', msg: 'Dois ou mais efeitos pesados (SSAO/DoF) ativos — pode ser muito lento em telemóveis fracos.' }
  } else if (highCostCount >= 1 && mediumCostCount >= 1) {
    perfWarning = { level: 'warning', msg: 'Efeitos pesados combinados — performance pode degradar em telemóveis médios.' }
  } else if (enabledEffects.length >= 3) {
    perfWarning = { level: 'warning', msg: 'Muitos efeitos ativos — considera desligar alguns para melhor performance.' }
  }

  return (
    <>
      <div className="drawer-backdrop show" onClick={onClose} />
      <aside className="post-processing-panel open">
        <div className="panel-header">
          <span>Pós-Processamento</span>
          <button className="icon" onClick={onClose} title="Fechar">
            <IconClose width={14} height={14} />
          </button>
        </div>

        <div className="panel-body">
          <div className="small muted mb-2">
            Efeitos visuais aplicados a toda a cena. Configurados por cena —
            ativos tanto na pré-visualização como no jogo exportado.
          </div>

          {perfWarning && (
            <div
              className="pp-warning"
              style={{
                borderColor: perfWarning.level === 'error' ? 'var(--danger)' : 'var(--warning)',
                color: perfWarning.level === 'error' ? 'var(--danger)' : 'var(--warning)',
              }}
            >{perfWarning.msg}
            </div>
          )}

          {EFFECTS.map((effect) => {
            const cfg = pp[effect.id]
            const isEnabled = cfg?.enabled || false
            const costColor = effect.perfCost === 'high' ? 'var(--danger)' :
                              effect.perfCost === 'medium' ? 'var(--warning)' : 'var(--success)'
            const costLabel = effect.perfCost === 'high' ? 'Pesado' :
                              effect.perfCost === 'medium' ? 'Médio' : 'Leve'

            return (
              <div key={effect.id} className={`pp-effect ${isEnabled ? 'enabled' : ''}`}>
                <div className="pp-effect-header">
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={(e) => updateEffect(effect.id, { enabled: e.target.checked })}
                    />
                    <span className="pp-effect-icon">{effect.icon}</span>
                    <span className="pp-effect-label">{effect.label}</span>
                  </label>
                  <span className="pp-perf-cost" style={{ color: costColor }}>
                    {costLabel}
                  </span>
                </div>
                <div className="small muted pp-effect-desc">{effect.desc}</div>

                {isEnabled && (
                  <div className="pp-effect-controls">
                    {effect.id === 'bloom' && (
                      <>
                        <div className="prop-row">
                          <label>Intensidade: {cfg.intensity.toFixed(2)}</label>
                          <input type="range" min="0" max="3" step="0.05" value={cfg.intensity}
                            onChange={(e) => updateEffect(effect.id, { intensity: Number(e.target.value) })} />
                        </div>
                        <div className="prop-row">
                          <label>Threshold: {cfg.threshold.toFixed(2)}</label>
                          <input type="range" min="0" max="1" step="0.05" value={cfg.threshold}
                            onChange={(e) => updateEffect(effect.id, { threshold: Number(e.target.value) })} />
                        </div>
                      </>
                    )}
                    {effect.id === 'ssao' && (
                      <>
                        <div className="prop-row">
                          <label>Intensidade: {cfg.intensity.toFixed(2)}</label>
                          <input type="range" min="0" max="2" step="0.05" value={cfg.intensity}
                            onChange={(e) => updateEffect(effect.id, { intensity: Number(e.target.value) })} />
                        </div>
                        <div className="prop-row">
                          <label>Raio: {cfg.radius.toFixed(2)}</label>
                          <input type="range" min="0.01" max="0.5" step="0.01" value={cfg.radius}
                            onChange={(e) => updateEffect(effect.id, { radius: Number(e.target.value) })} />
                        </div>
                      </>
                    )}
                    {effect.id === 'dof' && (
                      <>
                        <div className="prop-row">
                          <label>Distância foco: {cfg.focusDistance}</label>
                          <input type="range" min="1" max="50" step="1" value={cfg.focusDistance}
                            onChange={(e) => updateEffect(effect.id, { focusDistance: Number(e.target.value) })} />
                        </div>
                        <div className="prop-row">
                          <label>Range foco: {cfg.focusRange}</label>
                          <input type="range" min="1" max="20" step="1" value={cfg.focusRange}
                            onChange={(e) => updateEffect(effect.id, { focusRange: Number(e.target.value) })} />
                        </div>
                        <div className="prop-row">
                          <label>Bokeh: {cfg.bokehSize.toFixed(3)}</label>
                          <input type="range" min="0" max="0.1" step="0.005" value={cfg.bokehSize}
                            onChange={(e) => updateEffect(effect.id, { bokehSize: Number(e.target.value) })} />
                        </div>
                      </>
                    )}
                    {effect.id === 'colorGrading' && (
                      <>
                        <div className="prop-row">
                          <label>Brilho: {cfg.brightness.toFixed(2)}</label>
                          <input type="range" min="0.5" max="2" step="0.05" value={cfg.brightness}
                            onChange={(e) => updateEffect(effect.id, { brightness: Number(e.target.value) })} />
                        </div>
                        <div className="prop-row">
                          <label>Contraste: {cfg.contrast.toFixed(2)}</label>
                          <input type="range" min="0.5" max="2" step="0.05" value={cfg.contrast}
                            onChange={(e) => updateEffect(effect.id, { contrast: Number(e.target.value) })} />
                        </div>
                        <div className="prop-row">
                          <label>Saturação: {cfg.saturation.toFixed(2)}</label>
                          <input type="range" min="0" max="2" step="0.05" value={cfg.saturation}
                            onChange={(e) => updateEffect(effect.id, { saturation: Number(e.target.value) })} />
                        </div>
                        <div className="prop-row">
                          <label>Matiz (Hue): {cfg.hue.toFixed(2)}</label>
                          <input type="range" min="0" max="1" step="0.02" value={cfg.hue}
                            onChange={(e) => updateEffect(effect.id, { hue: Number(e.target.value) })} />
                        </div>
                        <div className="prop-row">
                          <label>Tinta</label>
                          <input type="color" value={cfg.tint} style={{ width: '100%', height: 32 }}
                            onChange={(e) => updateEffect(effect.id, { tint: e.target.value })} />
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          <div className="panel-section mt-2">
            <button
              onClick={() => {
                const reset = {}
                for (const e of EFFECTS) reset[e.id] = { ...e.defaults }
                updateScene(activeScene.id, { postProcessing: reset })
                toast('Pós-processamento resetado', 'info')
              }}
              style={{ width: '100%' }}
            >Resetar tudo
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

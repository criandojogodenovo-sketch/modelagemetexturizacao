/**
 * SettingsPanel — Configurações completas do Projeto e do Editor.
 *
 * A3 (Sessão 12) — expandido com 6 secções:
 *  - Projeto: nome, versão, autor, descrição, ícone
 *  - Editor: tema, idioma, atalhos, snapping (grade, ângulo)
 *  - Render: qualidade, FPS alvo, sombras, anti-aliasing, pixel ratio, resolução
 *  - Física: gravidade, timestep, iterações, damping
 *  - Áudio: volume master, música, efeitos
 *  - Ficheiro: guardar/carregar projeto, exportar JSON
 *
 * Tudo persistido no useStore via Zustand persist (localStorage + IndexedDB).
 *
 * Acessível via Menu Principal → Configurações, ou botão "Config" no VerticalRail.
 */
import { useStore, QUALITY_PRESETS } from '../../store/useStore'
import { IconClose } from '../ui/Icons'

const HOTKEYS = [
  { key: 'G', action: 'Mover (translate)' },
  { key: 'R', action: 'Rodar (rotate)' },
  { key: 'S', action: 'Escalar (scale)' },
  { key: 'Ctrl+Z', action: 'Desfazer' },
  { key: 'Ctrl+Shift+Z', action: 'Refazer' },
  { key: 'Ctrl+D', action: 'Duplicar' },
  { key: 'Del', action: 'Apagar' },
  { key: 'Esc', action: 'Desselecionar / Fechar' },
  { key: 'F3', action: 'Toggle Debug Overlay' },
]

const Section = ({ title, icon, children }) => (
  <div className="panel-section">
    <h4>{icon ? `${icon} ` : ''}{title}</h4>
    {children}
  </div>
)

const Row = ({ label, children }) => (
  <div className="prop-row">
    <label>{label}</label>
    {children}
  </div>
)

const Slider = ({ label, value, min, max, step, onChange, fmt }) => (
  <Row label={`${label}: ${fmt ? fmt(value ?? 0) : (value ?? 0)}`}>
    <input type="range" min={min} max={max} step={step} value={value ?? 0} onChange={(e) => onChange(Number(e.target.value))} />
  </Row>
)

export default function SettingsPanel({ onClose }) {
  const toast = useStore((s) => s.toast)
  const exportProjectJSON = useStore((s) => s.exportProjectJSON)
  // Render settings
  const renderSettings = useStore((s) => s.renderSettings) || {}
  const setRenderSettings = useStore((s) => s.setRenderSettings)
  const setQualityLevel = useStore((s) => s.setQualityLevel)
  // A3: settings estruturadas (com fallbacks para estado persistido antigo)
  const projectSettings = useStore((s) => s.projectSettings) || { name: '', version: '1.0.0', author: '', description: '', iconColor: '#2f81f7' }
  const setProjectSettings = useStore((s) => s.setProjectSettings)
  const editorSettings = useStore((s) => s.editorSettings) || { theme: 'dark', language: 'pt-PT', gizmoSensitivity: 1.0, units: 'meters', snapEnabled: false, snapSize: 0.5, snapRotationStep: 15 }
  const setEditorSettings = useStore((s) => s.setEditorSettings)
  const physicsSettings = useStore((s) => s.physicsSettings) || { gravity: -9.82, timestep: 1/60, iterations: 10, damping: 0.01 }
  const setPhysicsSettings = useStore((s) => s.setPhysicsSettings)
  const audioSettings = useStore((s) => s.audioSettings) || { masterVolume: 1.0, musicVolume: 0.7, sfxVolume: 0.8 }
  const setAudioSettings = useStore((s) => s.setAudioSettings)
  const setTheme = useStore((s) => s.setTheme)

  const saveAsFlirengine = () => {
    const json = exportProjectJSON()
    const filename = (projectSettings.name || 'projeto').replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase() + '.flirengine'
    const blob = new Blob([json], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast(`Projeto guardado como "${filename}"`, 'success')
  }

  // Aplicar tema (claro/escuro) — adiciona/remove class no <html>
  const applyTheme = (theme) => {
    setEditorSettings({ theme })
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
    }
    toast(`Tema: ${theme === 'dark' ? 'Escuro' : 'Claro'}`, 'success')
  }

  return (
    <>
      <div className="drawer-backdrop show" onClick={onClose} />
      <aside className="settings-panel open">
        <div className="panel-header">
          <span>Configurações</span>
          <button className="icon" onClick={onClose}><IconClose width={14} height={14} /></button>
        </div>

        <div className="panel-body">
          {/* === PROJETO === */}
          <Section title="Projeto" icon="📁">
            <Row label="Nome do projeto">
              <input type="text" value={projectSettings.name} onChange={(e) => setProjectSettings({ name: e.target.value })} />
            </Row>
            <Row label="Versão">
              <input type="text" value={projectSettings.version} onChange={(e) => setProjectSettings({ version: e.target.value })} placeholder="1.0.0" />
            </Row>
            <Row label="Autor">
              <input type="text" value={projectSettings.author} onChange={(e) => setProjectSettings({ author: e.target.value })} placeholder="O teu nome" />
            </Row>
            <Row label="Descrição">
              <textarea value={projectSettings.description} onChange={(e) => setProjectSettings({ description: e.target.value })} placeholder="Descrição do projeto" rows={3} style={{ width: '100%' }} />
            </Row>
            <Row label="Cor do ícone">
              <input type="color" value={projectSettings.iconColor} onChange={(e) => setProjectSettings({ iconColor: e.target.value })} />
            </Row>
          </Section>

          {/* === RENDER === */}
          <Section title="Render" icon="🎨">
            <div className="small muted mb-2">Nível de qualidade — cada nível ativa mais recursos pesados.</div>
            {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => { setQualityLevel(key); toast(`Qualidade: ${preset.label}`, 'success') }}
                style={{
                  display: 'block', width: '100%', padding: '8px 12px', marginBottom: 6, borderRadius: 6,
                  border: renderSettings.qualityLevel === key ? '2px solid #2f81f7' : '1px solid #30363d',
                  background: renderSettings.qualityLevel === key ? '#161b22' : '#0d1117', color: '#e6edf3',
                  textAlign: 'left', cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{preset.label}</div>
                <div className="small muted">{preset.description}</div>
              </button>
            ))}

            <Slider label="FPS alvo" value={renderSettings.targetFps} min={15} max={144} step={1} onChange={(v) => setRenderSettings({ targetFps: v })} />
            <Slider label="Pixel ratio" value={renderSettings.pixelRatio} min={0.5} max={3} step={0.25} onChange={(v) => setRenderSettings({ pixelRatio: v })} fmt={(v) => v.toFixed(2)} />
            <Slider label="Resolution scale" value={renderSettings.resolutionScale} min={0.5} max={2} step={0.1} onChange={(v) => setRenderSettings({ resolutionScale: v })} fmt={(v) => v.toFixed(1) + 'x'} />
            <Slider label="Shadow map size" value={renderSettings.shadowMapSize} min={256} max={4096} step={256} onChange={(v) => setRenderSettings({ shadowMapSize: v })} />
            <Slider label="Shadow distance" value={renderSettings.shadowDistance} min={5} max={100} step={5} onChange={(v) => setRenderSettings({ shadowDistance: v })} fmt={(v) => v + 'm'} />

            <Row label="Sombras">
              <input type="checkbox" checked={renderSettings.shadows !== false} onChange={(e) => setRenderSettings({ shadows: e.target.checked })} />
            </Row>
            <Row label="Anti-aliasing">
              <input type="checkbox" checked={renderSettings.antialias !== false} onChange={(e) => setRenderSettings({ antialias: e.target.checked })} />
            </Row>
            <Row label="FlirGI (iluminação global)">
              <input type="checkbox" checked={renderSettings.flirGI} onChange={(e) => setRenderSettings({ flirGI: e.target.checked })} />
            </Row>
            <Row label="Post-processing (bloom, etc.)">
              <input type="checkbox" checked={renderSettings.postProcessing} onChange={(e) => setRenderSettings({ postProcessing: e.target.checked })} />
            </Row>
          </Section>

          {/* === S20: REALISMO AVANÇADO (Parte B) === */}
          <Section title="Realismo (S20)" icon="✨">
            <div className="small muted mb-2">
              Pipeline de realismo da Sessão 20 — DDGI, SSR Hi-Z, fog volumétrico e FSR.
              Também ativa automaticamente ao adicionar SSRObject/VolumetricFogObject à cena.
            </div>

            {/* --- DDGI --- */}
            <Row label="DDGI (GI dinâmica por probes)">
              <input type="checkbox" checked={!!renderSettings.ddgi} onChange={(e) => setRenderSettings({ ddgi: e.target.checked })} />
            </Row>
            {renderSettings.ddgi && (
              <>
                <Slider label="Intensidade DDGI" value={renderSettings.ddgiIntensity ?? 1.0} min={0.1} max={3} step={0.1} onChange={(v) => setRenderSettings({ ddgiIntensity: v })} fmt={(v) => v.toFixed(1)} />
                <div className="small muted mb-1">A luz "salta" entre superfícies (probes PMREM atualizadas de forma escalonada).</div>
              </>
            )}

            {/* --- SSR --- */}
            <Row label="SSR (reflexos Hi-Z)">
              <input type="checkbox" checked={!!renderSettings.ssr} onChange={(e) => setRenderSettings({ ssr: e.target.checked })} />
            </Row>
            {renderSettings.ssr && (
              <>
                <Slider label="Intensidade SSR" value={renderSettings.ssrIntensity ?? 0.8} min={0.1} max={2} step={0.05} onChange={(v) => setRenderSettings({ ssrIntensity: v })} fmt={(v) => v.toFixed(2)} />
                <div className="small muted mb-1">Reflexos screen-space com pirâmide Hi-Z + filtragem temporal.</div>
              </>
            )}

            {/* --- Fog volumétrico --- */}
            <Row label="Fog volumétrico (god rays)">
              <input type="checkbox" checked={!!renderSettings.volumetricFog} onChange={(e) => setRenderSettings({ volumetricFog: e.target.checked })} />
            </Row>
            {renderSettings.volumetricFog && (
              <>
                <Slider label="Densidade" value={renderSettings.fogDensity ?? 0.02} min={0.005} max={0.3} step={0.005} onChange={(v) => setRenderSettings({ fogDensity: v })} fmt={(v) => v.toFixed(3)} />
                <Slider label="Scattering" value={renderSettings.fogScattering ?? 0.5} min={0} max={2} step={0.05} onChange={(v) => setRenderSettings({ fogScattering: v })} fmt={(v) => v.toFixed(2)} />
                <Slider label="Anisotropia (god rays)" value={renderSettings.fogAnisotropy ?? 0.6} min={-0.95} max={0.95} step={0.05} onChange={(v) => setRenderSettings({ fogAnisotropy: v })} fmt={(v) => v.toFixed(2)} />
                <Slider label="Penumbra" value={renderSettings.fogPenumbra ?? 0.35} min={0.01} max={1} step={0.01} onChange={(v) => setRenderSettings({ fogPenumbra: v })} fmt={(v) => v.toFixed(2)} />
                <Row label="God rays">
                  <input type="checkbox" checked={renderSettings.fogGodRays !== false} onChange={(e) => setRenderSettings({ fogGodRays: e.target.checked })} />
                </Row>
                <Row label="Cor do fog">
                  <input type="color" value={renderSettings.fogColor || '#a0c4ff'} onChange={(e) => setRenderSettings({ fogColor: e.target.value })} />
                </Row>
              </>
            )}

            {/* --- FSR --- */}
            <Row label="FSR (upscaling)">
              <input type="checkbox" checked={!!renderSettings.fsr} onChange={(e) => setRenderSettings({ fsr: e.target.checked })} />
            </Row>
            {renderSettings.fsr && (
              <>
                <Row label="Escala de render">
                  <select value={renderSettings.fsrScale ?? 0.77} onChange={(e) => setRenderSettings({ fsrScale: Number(e.target.value) })}>
                    <option value={0.5}>Performance (0.50x)</option>
                    <option value={0.67}>Balanced (0.67x)</option>
                    <option value={0.77}>Quality (0.77x)</option>
                    <option value={0.9}>Ultra Quality (0.90x)</option>
                  </select>
                </Row>
                <Slider label="Nitidez RCAS" value={renderSettings.fsrSharpness ?? 0.87} min={0} max={2} step={0.05} onChange={(v) => setRenderSettings({ fsrSharpness: v })} fmt={(v) => v.toFixed(2)} />
                <div className="small muted">Renderiza a baixa resolução + EASU/RCAS — tipicamente +50-100% FPS em mobile.</div>
              </>
            )}
          </Section>

          {/* === EDITOR === */}
          <Section title="Editor" icon="🖊️">
            <Row label="Tema">
              <select value={editorSettings.theme} onChange={(e) => applyTheme(e.target.value)}>
                <option value="dark">Escuro</option>
                <option value="light">Claro</option>
              </select>
            </Row>
            <Row label="Idioma">
              <select value={editorSettings.language} onChange={(e) => setEditorSettings({ language: e.target.value })}>
                <option value="pt-PT">Português (PT)</option>
                <option value="pt-BR">Português (BR)</option>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </Row>
            <Slider label="Sensibilidade gizmos" value={editorSettings.gizmoSensitivity} min={0.1} max={3} step={0.1} onChange={(v) => setEditorSettings({ gizmoSensitivity: v })} fmt={(v) => v.toFixed(2)} />
            <Row label="Unidades">
              <select value={editorSettings.units} onChange={(e) => setEditorSettings({ units: e.target.value })}>
                <option value="meters">Metros</option>
                <option value="centimeters">Centímetros</option>
                <option value="feet">Pés</option>
                <option value="units">Unidades (genérico)</option>
              </select>
            </Row>

            {/* Snapping */}
            <div className="small muted mt-2 mb-1" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Snapping</div>
            <Row label="Snap ativo (grade)">
              <input type="checkbox" checked={editorSettings.snapEnabled} onChange={(e) => setEditorSettings({ snapEnabled: e.target.checked })} />
            </Row>
            <Slider label="Tamanho da grade" value={editorSettings.snapSize} min={0.1} max={5} step={0.1} onChange={(v) => setEditorSettings({ snapSize: v })} fmt={(v) => v.toFixed(1) + 'u'} />
            <Slider label="Ângulo de rotação" value={editorSettings.snapRotationStep} min={1} max={90} step={1} onChange={(v) => setEditorSettings({ snapRotationStep: v })} fmt={(v) => v + '°'} />
          </Section>

          {/* === FÍSICA === */}
          <Section title="Física" icon="⚙️">
            <Slider label="Gravidade" value={physicsSettings.gravity} min={-30} max={0} step={0.1} onChange={(v) => setPhysicsSettings({ gravity: v })} fmt={(v) => v.toFixed(1) + ' m/s²'} />
            <Slider label="Timestep" value={physicsSettings.timestep} min={0.005} max={0.05} step={0.005} onChange={(v) => setPhysicsSettings({ timestep: v })} fmt={(v) => (v * 1000).toFixed(0) + 'ms'} />
            <Slider label="Iterações do solver" value={physicsSettings.iterations} min={1} max={30} step={1} onChange={(v) => setPhysicsSettings({ iterations: v })} />
            <Slider label="Damping" value={physicsSettings.damping} min={0} max={0.5} step={0.01} onChange={(v) => setPhysicsSettings({ damping: v })} fmt={(v) => v.toFixed(2)} />
          </Section>

          {/* === ÁUDIO === */}
          <Section title="Áudio" icon="🔊">
            <Slider label="Volume master" value={audioSettings.masterVolume} min={0} max={1} step={0.05} onChange={(v) => setAudioSettings({ masterVolume: v })} fmt={(v) => Math.round(v * 100) + '%'} />
            <Slider label="Música" value={audioSettings.musicVolume} min={0} max={1} step={0.05} onChange={(v) => setAudioSettings({ musicVolume: v })} fmt={(v) => Math.round(v * 100) + '%'} />
            <Slider label="Efeitos (SFX)" value={audioSettings.sfxVolume} min={0} max={1} step={0.05} onChange={(v) => setAudioSettings({ sfxVolume: v })} fmt={(v) => Math.round(v * 100) + '%'} />
          </Section>

          {/* === ATALHOS === */}
          <Section title="Atalhos de Teclado" icon="⌨️">
            <div className="settings-hotkeys">
              {HOTKEYS.map((hk) => (
                <div key={hk.key} className="settings-hotkey-row">
                  <kbd className="settings-kbd">{hk.key}</kbd>
                  <span className="small">{hk.action}</span>
                </div>
              ))}
            </div>
          </Section>

          {/* === FICHEIRO === */}
          <Section title="Guardar Projeto" icon="💾">
            <div className="small muted mb-2">
              Ficheiro: <strong>{(projectSettings.name || 'projeto').replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase()}.flirengine</strong>
            </div>
            <button onClick={saveAsFlirengine} className="primary" style={{ width: '100%' }}>
              💾 Guardar como .flirengine
            </button>
            <div className="small muted mt-2">
              As configurações deste painel são guardadas automaticamente no navegador
              (localStorage + IndexedDB) via Zustand persist.
            </div>
          </Section>
        </div>
      </aside>
    </>
  )
}

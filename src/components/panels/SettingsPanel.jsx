/**
 * SettingsPanel — Configurações do Projeto e do Editor.
 *
 * Inclui:
 *  - Níveis de Qualidade Gráfica (QUALITY_PRESETS)
 *  - Configurações do Projeto (nome, resolução, gravidade)
 *  - Guardar/Abrir .flirengine
 *  - Atalhos de teclado
 */
import { useState } from 'react'
import { useStore, QUALITY_PRESETS } from '../../store/useStore'
import { IconClose } from '../ui/Icons'
import { Icon } from '../ui/iconMap'

const HOTKEYS = [
  { key: 'G', action: 'Mover (translate)' },
  { key: 'R', action: 'Rodar (rotate)' },
  { key: 'S', action: 'Escalar (scale)' },
  { key: 'Ctrl+Z', action: 'Desfazer' },
  { key: 'Ctrl+Shift+Z', action: 'Refazer' },
  { key: 'Ctrl+D', action: 'Duplicar' },
  { key: 'Del', action: 'Apagar' },
  { key: 'Esc', action: 'Desselecionar / Fechar' },
]

export default function SettingsPanel({ onClose }) {
  const toast = useStore((s) => s.toast)
  const exportProjectJSON = useStore((s) => s.exportProjectJSON)
  const renderSettings = useStore((s) => s.renderSettings)
  const setRenderSettings = useStore((s) => s.setRenderSettings)
  const setQualityLevel = useStore((s) => s.setQualityLevel)
  const [projectName, setProjectName] = useState(() => {
    try {
      const data = JSON.parse(localStorage.getItem('me3d.project.v1') || '{}')
      return data.state?.projectName || 'Meu Jogo'
    } catch { return 'Meu Jogo' }
  })

  const saveAsFlirengine = () => {
    const json = exportProjectJSON()
    const filename = (projectName || 'projeto').replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase() + '.flirengine'
    const blob = new Blob([json], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
    toast(`Projeto guardado como "${filename}"`, 'success')
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
          {/* Níveis de Qualidade Gráfica */}
          <div className="panel-section">
            <h4>Qualidade Gráfica</h4>
            <div className="small muted mb-2">
              Cada nível ativa progressivamente mais recursos pesados.
            </div>
            {Object.entries(QUALITY_PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => { setQualityLevel(key); toast(`Qualidade: ${preset.label}`, 'success') }}
                style={{
                  display: 'block', width: '100%', padding: '8px 12px', marginBottom: 6,
                  borderRadius: 6,
                  border: renderSettings?.qualityLevel === key ? '2px solid var(--accent)' : '1px solid var(--border)',
                  background: renderSettings?.qualityLevel === key ? 'var(--accent-soft)' : 'var(--bg-app)',
                  color: 'var(--text-primary)', textAlign: 'left', cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 13 }}>{preset.label}</div>
                <div className="small muted">
                  Água: {preset.settings.waterQuality === 'professional' ? 'Pro (Gerstner)' : 'Básica'} |
                  Sombras: {preset.settings.shadowMapSize}px |
                  GI: {preset.settings.flirGI ? 'ON' : 'OFF'} |
                  POM: {preset.settings.pom ? 'ON' : 'OFF'} |
                  Pós-proc: {preset.settings.postProcessing ? 'ON' : 'OFF'}
                </div>
              </button>
            ))}
          </div>

          {/* Projeto */}
          <div className="panel-section">
            <h4>Projeto</h4>
            <div className="prop-row">
              <label>Nome do projeto</label>
              <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)} />
            </div>
            <button onClick={saveAsFlirengine} className="primary" style={{ width: '100%', marginTop: 8 }}>
              <Icon name="save" size={12} />
              <span>Guardar como .flirengine</span>
            </button>
          </div>

          {/* Atalhos */}
          <div className="panel-section">
            <h4>Atalhos de Teclado</h4>
            {HOTKEYS.map((hk) => (
              <div key={hk.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <kbd style={{ background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>{hk.key}</kbd>
                <span className="small muted">{hk.action}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>
    </>
  )
}

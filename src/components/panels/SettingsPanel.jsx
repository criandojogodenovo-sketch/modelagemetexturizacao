/**
 * SettingsPanel — Configurações do Projeto e do Editor.
 *
 * Configurações do Projeto: nome, resolução alvo, gravidade, LOD default
 * Configurações do Editor: sensibilidade de gizmos, unidades, atalhos
 *
 * Acessível via Menu Principal → ⚙️ Configurações
 */
import { useState } from 'react'
import { useStore } from '../../store/useStore'
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
]

export default function SettingsPanel({ onClose }) {
  const toast = useStore((s) => s.toast)
  const exportProjectJSON = useStore((s) => s.exportProjectJSON)
  const [projectName, setProjectName] = useState(() => {
    try {
      const data = JSON.parse(localStorage.getItem('me3d.project.v1') || '{}')
      return data.state?.projectName || 'Meu Jogo'
    } catch { return 'Meu Jogo' }
  })
  const [targetResolution, setTargetResolution] = useState('mobile')
  const [gravity, setGravity] = useState(-9.82)
  const [defaultLOD, setDefaultLOD] = useState('auto')
  const [gizmoSensitivity, setGizmoSensitivity] = useState(1.0)
  const [units, setUnits] = useState('meters')

  const saveSettings = () => {
    // Guardar nome do projeto no state
    const data = JSON.parse(localStorage.getItem('me3d.project.v1') || '{}')
    if (data.state) {
      data.state.projectName = projectName
      data.state.projectSettings = { targetResolution, gravity, defaultLOD }
      data.state.editorSettings = { gizmoSensitivity, units }
      localStorage.setItem('me3d.project.v1', JSON.stringify(data))
    }
    toast('Configurações guardadas', 'success')
  }

  const saveAsFlirengine = () => {
    const json = exportProjectJSON()
    // Usar o nome do projeto para o ficheiro
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
          <span>⚙️ Configurações</span>
          <button className="icon" onClick={onClose}><IconClose width={14} height={14} /></button>
        </div>

        <div className="panel-body">
          {/* Configurações do Projeto */}
          <div className="panel-section">
            <h4>📦 Projeto</h4>
            <div className="prop-row">
              <label>Nome do projeto</label>
              <input type="text" value={projectName} onChange={(e) => setProjectName(e.target.value)}
                placeholder="Meu Jogo" />
            </div>
            <div className="prop-row">
              <label>Resolução alvo</label>
              <select value={targetResolution} onChange={(e) => setTargetResolution(e.target.value)}>
                <option value="mobile">Mobile (360-414px)</option>
                <option value="tablet">Tablet (768px)</option>
                <option value="desktop">Desktop (1920px)</option>
                <option value="auto">Auto</option>
              </select>
            </div>
            <div className="prop-row">
              <label>Gravidade global: {gravity}</label>
              <input type="range" min="-20" max="0" step="0.1" value={gravity}
                onChange={(e) => setGravity(Number(e.target.value))} />
            </div>
            <div className="prop-row">
              <label>LOD por defeito</label>
              <select value={defaultLOD} onChange={(e) => setDefaultLOD(e.target.value)}>
                <option value="auto">Automático</option>
                <option value="high">Alto (mais detalhe)</option>
                <option value="medium">Médio</option>
                <option value="low">Baixo (mais performance)</option>
              </select>
            </div>
            <button onClick={saveSettings} className="primary" style={{ width: '100%', marginTop: 8 }}>
              💾 Guardar Configurações
            </button>
          </div>

          {/* Guardar como .flirengine com nome do projeto */}
          <div className="panel-section">
            <h4>💾 Guardar Projeto</h4>
            <div className="small muted mb-2">
              O ficheiro será guardado com o nome do projeto: <strong>{(projectName || 'projeto').replace(/[^a-zA-Z0-9-_]/g, '_').toLowerCase()}.flirengine</strong>
            </div>
            <button onClick={saveAsFlirengine} className="primary" style={{ width: '100%' }}>
              💾 Guardar como .flirengine
            </button>
          </div>

          {/* Configurações do Editor */}
          <div className="panel-section">
            <h4>🖊️ Editor</h4>
            <div className="prop-row">
              <label>Sensibilidade dos gizmos: {gizmoSensitivity.toFixed(2)}</label>
              <input type="range" min="0.1" max="3" step="0.1" value={gizmoSensitivity}
                onChange={(e) => setGizmoSensitivity(Number(e.target.value))} />
            </div>
            <div className="prop-row">
              <label>Unidades</label>
              <select value={units} onChange={(e) => setUnits(e.target.value)}>
                <option value="meters">Metros</option>
                <option value="centimeters">Centímetros</option>
                <option value="feet">Pés</option>
                <option value="units">Unidades (genérico)</option>
              </select>
            </div>
          </div>

          {/* Lista de Atalhos */}
          <div className="panel-section">
            <h4>⌨️ Atalhos de Teclado</h4>
            <div className="settings-hotkeys">
              {HOTKEYS.map((hk) => (
                <div key={hk.key} className="settings-hotkey-row">
                  <kbd className="settings-kbd">{hk.key}</kbd>
                  <span className="small">{hk.action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

/**
 * SculptPanel — configurações do modo de esculpir.
 *
 * Permite configurar:
 *  - Modo do pincel (elevar, rebaixar, suavizar, achatar)
 *  - Tamanho do pincel
 *  - Força do pincel
 *
 * Para esculpir, o utilizador clica/arrasta sobre o objeto no modo sculpt.
 * O Scene3D trata do raycast e chama sculptStrokeAt do store.
 */
import { useStore } from '../../store/useStore'
import { useSelectedObject } from '../../store/useStore'
import { IconSculpt, IconBrush } from '../ui/Icons'

const SCULPT_MODES = [
  { id: 'raise', label: 'Elevar', icon: '▲', color: '#3fb950' },
  { id: 'lower', label: 'Rebaixar', icon: '▼', color: '#f85149' },
  { id: 'smooth', label: 'Suavizar', icon: '◯', color: '#2f81f7' },
  { id: 'flatten', label: 'Achatar', icon: '▬', color: '#d29922' },
]

export default function SculptPanel() {
  const selected = useSelectedObject()
  const sculptSettings = useStore((s) => s.sculptSettings)
  const setSculptSettings = useStore((s) => s.setSculptSettings)
  const setMode = useStore((s) => s.setMode)
  const mode = useStore((s) => s.mode)

  if (!selected) {
    return (
      <div className="empty-state">
        <div>Selecione um objeto para esculpir.</div>
      </div>
    )
  }

  return (
    <>
      <div className="panel-section">
        <h4>Modo de Pincel</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {SCULPT_MODES.map((m) => (
            <button
              key={m.id}
              onClick={() => setSculptSettings({ mode: m.id })}
              className={sculptSettings.mode === m.id ? 'active' : ''}
              style={{ flexDirection: 'column', gap: 4, padding: 10 }}
            >
              <span style={{ fontSize: 18, color: m.color }}>{m.icon}</span>
              <span style={{ fontSize: 11 }}>{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="panel-section">
        <h4>Pincel</h4>
        <div className="prop-row">
          <label>Tamanho: {sculptSettings.brushSize.toFixed(2)}</label>
          <input
            type="range"
            min="0.05"
            max="2"
            step="0.05"
            value={sculptSettings.brushSize}
            onChange={(e) => setSculptSettings({ brushSize: Number(e.target.value) })}
          />
        </div>
        <div className="prop-row">
          <label>Força: {sculptSettings.brushStrength.toFixed(3)}</label>
          <input
            type="range"
            min="0.005"
            max="0.2"
            step="0.005"
            value={sculptSettings.brushStrength}
            onChange={(e) => setSculptSettings({ brushStrength: Number(e.target.value) })}
          />
        </div>
      </div>

      <div className="panel-section">
        <h4>Como usar</h4>
        <div className="small muted">
          <div className="mb-2">
            1. Ative o modo Esculpir (botão abaixo).
          </div>
          <div className="mb-2">
            2. Clique e arraste sobre o objeto para aplicar a pincelada.
          </div>
          <div>
            3. Use Undo/Redo se necessário. As alterações são guardadas em <strong>customGeometry</strong>.
          </div>
        </div>
        <button
          onClick={() => setMode(mode === 'sculpt' ? 'object' : 'sculpt')}
          className={mode === 'sculpt' ? 'primary' : ''}
          style={{ width: '100%', marginTop: 8 }}
        >
          <IconSculpt width={14} height={14} />
          {mode === 'sculpt' ? 'Sair do modo Esculpir' : 'Ativar modo Esculpir'}
        </button>
      </div>
    </>
  )
}

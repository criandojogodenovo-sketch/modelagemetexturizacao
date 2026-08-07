/**
 * BooleansPanel — operações booleanas entre objetos.
 *
 * Permite ao utilizador escolher o objeto-alvo (atualmente selecionado),
 * o objeto-ferramenta (segunda geometria) e a operação (união, subtração, interseção).
 */
import { useState } from 'react'
import { useStore, useSelectedObject, BOOLEAN_OPS } from '../../store/useStore'
import { IconBoolean } from '../ui/Icons'

export default function BooleansPanel() {
  const selected = useSelectedObject()
  const objects = useStore((s) => s.objects)
  const applyBooleanOp = useStore((s) => s.applyBooleanOp)
  const toast = useStore((s) => s.toast)
  const [toolId, setToolId] = useState('')

  if (!selected) {
    return (
      <div className="empty-state">
        <div>Selecione o objeto-alvo (A) primeiro.</div>
      </div>
    )
  }

  const toolObjects = objects.filter((o) => o.id !== selected.id)

  const handleApply = (op) => {
    if (!toolId) {
      toast('Escolha o objeto-ferramenta (B) primeiro', 'error')
      return
    }
    applyBooleanOp(selected.id, toolId, op)
  }

  return (
    <>
      <div className="panel-section">
        <h4>Booleanas</h4>
        <div className="small muted mb-2">
          Combina a geometria do objeto-alvo (A) com a do objeto-ferramenta (B).
          O objeto-ferramenta é removido após a operação.
        </div>

        <div className="prop-row">
          <label>Objeto-alvo (A)</label>
          <input type="text" value={`${selected.name}`} disabled />
        </div>

        <div className="prop-row">
          <label>Objeto-ferramenta (B)</label>
          <select value={toolId} onChange={(e) => setToolId(e.target.value)}>
            <option value="">— Escolher objeto —</option>
            {toolObjects.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </div>

        <div className="prop-row">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
            {BOOLEAN_OPS.map((op) => (
              <button
                key={op.id}
                onClick={() => handleApply(op.id)}
                title={op.description}
                style={{ flexDirection: 'column', gap: 4, padding: 8 }}
              >
                <IconBoolean width={16} height={16} />
                <span style={{ fontSize: 10 }}>{op.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

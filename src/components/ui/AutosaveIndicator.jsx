/**
 * AutosaveIndicator — indicador visual do estado de autosave.
 *
 * Mostra "✓ Guardado" quando está tudo guardado, "… A guardar" durante save.
 * Estilo ItsMagic: pequeno indicador no TopBar.
 */
import { useStore } from '../../store/useStore'

export default function AutosaveIndicator() {
  const autosave = useStore((s) => s.autosave)

  if (autosave.saving) {
    return (
      <span className="autosave-indicator saving" title="A guardar...">
        <span className="autosave-dot pulse" />
        <span className="small">A guardar</span>
      </span>
    )
  }

  if (autosave.dirty) {
    return (
      <span className="autosave-indicator dirty" title="Alterações não guardadas">
        <span className="autosave-dot" style={{ background: 'var(--warning, #d29922)' }} />
        <span className="small">Não guardado</span>
      </span>
    )
  }

  if (autosave.lastSavedAt) {
    const date = new Date(autosave.lastSavedAt)
    const time = date.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })
    return (
      <span className="autosave-indicator saved" title={`Guardado às ${time}`}>
        <span className="autosave-dot" style={{ background: 'var(--success, #3fb950)' }} />
        <span className="small">Guardado</span>
      </span>
    )
  }

  return null
}

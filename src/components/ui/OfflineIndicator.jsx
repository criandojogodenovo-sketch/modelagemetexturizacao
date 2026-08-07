/**
 * OfflineIndicator — mostrado quando a app está a funcionar offline.
 *
 * Pequeno banner fixo no topo (abaixo da topbar) que aparece automaticamente
 * quando o browser perde ligação à internet.
 */
import { useOnlineStatus } from '../../hooks/useOnlineStatus'

export default function OfflineIndicator() {
  const online = useOnlineStatus()
  if (online) return null

  return (
    <div className="offline-indicator" role="status" aria-live="polite">
      <span className="oi-dot" />
      <span>Modo offline — a funcionar com cache local</span>
    </div>
  )
}

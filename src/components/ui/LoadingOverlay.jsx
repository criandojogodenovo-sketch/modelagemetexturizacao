/**
 * LoadingOverlay — overlay de carregamento.
 * Mostra um spinner e mensagem opcional (definida via store.ui.loading).
 */
import { useStore } from '../../store/useStore'

export default function LoadingOverlay() {
  const loading = useStore((s) => s.ui.loading)
  const message = useStore((s) => s.ui.loadingMessage)

  if (!loading) return null

  return (
    <div className="loading-overlay">
      <div className="spinner" />
      <div className="muted">{message || 'A processar...'}</div>
    </div>
  )
}

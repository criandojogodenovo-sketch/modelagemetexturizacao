/**
 * ErrorBoundary — captura erros de render React e mostra fallback.
 *
 * Sem isto, qualquer erro de render (e.g., undefined.toFixed()) desmonta
 * a árvore React inteira → página preta.
 *
 * Com isto, o erro é capturado, mostrado um ecrã de erro com botão de reload,
 * e o erro é logado na consola para debugging.
 */
import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Erro capturado:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo?.componentStack)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    // Forçar reload da página para limpar estado corrompido
    if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }

  handleDismiss = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (this.state.hasError) {
      const errorMsg = this.state.error?.message || 'Erro desconhecido'
      return (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(13, 17, 23, 0.95)',
          color: '#e6edf3',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 13,
          padding: 24,
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
        }}>
          <div style={{ color: '#f85149', fontSize: 18, fontWeight: 'bold' }}>
            ⚠️ Erro na Aplicação
          </div>
          <div style={{
            background: '#161b22',
            border: '1px solid #30363d',
            borderRadius: 6,
            padding: 12,
            maxWidth: 600,
            overflow: 'auto',
            maxHeight: 200,
          }}>
            <div style={{ color: '#f85149', marginBottom: 8 }}>Erro:</div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {errorMsg}
            </pre>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={this.handleDismiss}
              style={{
                padding: '8px 16px',
                background: '#21262d',
                color: '#e6edf3',
                border: '1px solid #30363d',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Tentar continuar
            </button>
            <button
              onClick={this.handleReload}
              style={{
                padding: '8px 16px',
                background: '#238636',
                color: 'white',
                border: '1px solid #238636',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 'bold',
              }}
            >
              ↻ Recarregar página
            </button>
          </div>
          <div style={{ color: '#8b949e', fontSize: 11, maxWidth: 500, textAlign: 'center' }}>
            O erro foi capturado pelo ErrorBoundary. O estado da app pode estar inconsistente.
            Recomenda-se recarregar a página. Verifica a consola (F12) para detalhes.
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

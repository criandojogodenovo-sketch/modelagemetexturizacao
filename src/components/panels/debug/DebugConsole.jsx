/**
 * DebugConsole — consola de debug visível durante o "Pré-visualizar".
 *
 * Mostra mensagens (log/warning/error) em tempo real, com:
 *  - Nome do Conect/objeto onde ocorreu o problema
 *  - Histórico das últimas 200 mensagens
 *  - Botão para limpar
 *  - Toggle mostrar/esconder
 *
 * Erros comuns assinalados:
 *  - Conect mal configurado (sem sourceObjectId, etc.)
 *  - Ligação inválida no FlirScript
 *  - RigidObject sem VisualObject
 *  - Referência a objeto inexistente
 */
import { useEffect, useState } from 'react'
import { debugSubscribe, debugClear, debugGetMessages } from '../../../utils/debug/debugStore'

export default function DebugConsole({ onClose }) {
  const [messages, setMessages] = useState(debugGetMessages())
  const [filter, setFilter] = useState('all') // all | log | warning | error

  useEffect(() => {
    return debugSubscribe((msgs) => setMessages([...msgs]))
  }, [])

  const filtered = filter === 'all' ? messages : messages.filter((m) => m.type === filter)
  const errorCount = messages.filter((m) => m.type === 'error').length
  const warningCount = messages.filter((m) => m.type === 'warning').length

  return (
    <div className="debug-console">
      <div className="debug-console-header">
        <span className="dc-title">Consola de Debug
          {errorCount > 0 && <span className="dc-badge dc-badge-error">{errorCount} erros</span>}
          {warningCount > 0 && <span className="dc-badge dc-badge-warn">{warningCount} avisos</span>}
        </span>
        <div className="dc-actions">
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: 'auto' }}>
            <option value="all">Todos ({messages.length})</option>
            <option value="error">Erros ({errorCount})</option>
            <option value="warning">Avisos ({warningCount})</option>
            <option value="log">Logs ({messages.filter((m) => m.type === 'log').length})</option>
          </select>
          <button onClick={debugClear} title="Limpar">Limpar</button>
          {onClose && <button onClick={onClose} title="Fechar">✕</button>}
        </div>
      </div>
      <div className="debug-console-body">
        {filtered.length === 0 ? (
          <div className="dc-empty">Sem mensagens. Erros e avisos aparecerão aqui durante a pré-visualização.</div>
        ) : (
          filtered.map((m) => (
            <div key={m.id} className={`dc-message dc-${m.type}`}>
              <span className="dc-time">{m.time.toLocaleTimeString()}</span>
              <span className="dc-type">{m.type === 'error' ? 'x' : m.type === 'warning' ? 'alert' : 'ℹ️'}</span>
              <span className="dc-msg">{m.message}</span>
              {m.source && <span className="dc-source">[{m.source}]</span>}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

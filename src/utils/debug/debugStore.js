/**
 * debugStore.js — store simples (não-Zustand) para mensagens de debug.
 *
 * Mantém um histórico das últimas N mensagens (log, warning, error) da
 * sessão de pré-visualização. Acessível via DebugConsole durante o jogo.
 *
 * API:
 *  - debugLog(message, type, source)
 *  - debugClear()
 *  - debugGetMessages()
 *  - debugSubscribe(callback)
 */

const MAX_MESSAGES = 200
let messages = []
const subscribers = new Set()

export function debugLog(message, type = 'log', source = null) {
  const entry = {
    id: `dbg_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    time: new Date(),
    type, // 'log' | 'warning' | 'error'
    message: String(message),
    source, // nome do Conect/objeto onde ocorreu
  }
  messages.push(entry)
  if (messages.length > MAX_MESSAGES) messages.shift()
  subscribers.forEach((cb) => cb(messages))
  if (type === 'error') console.error('[Debug]', message, source || '')
  else if (type === 'warning') console.warn('[Debug]', message, source || '')
  else console.log('[Debug]', message, source || '')
}

export function debugClear() {
  messages = []
  subscribers.forEach((cb) => cb(messages))
}

export function debugGetMessages() {
  return messages
}

export function debugSubscribe(cb) {
  subscribers.add(cb)
  return () => subscribers.delete(cb)
}

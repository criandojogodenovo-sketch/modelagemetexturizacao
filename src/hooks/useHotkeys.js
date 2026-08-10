/**
 * Hook para registar atalhos de teclado globais.
 * @param {Object} handlers - mapa de combo -> função
 *   combos em lowercase, ex: "ctrl+z", "shift+ctrl+z", "delete", "escape"
 */
import { useEffect } from 'react'

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)

export function buildCombo(e) {
  const parts = []
  if (e.ctrlKey || (isMac && e.metaKey)) parts.push('ctrl')
  if (e.shiftKey) parts.push('shift')
  if (e.altKey) parts.push('alt')
  let key = e.key.toLowerCase()
  if (key === ' ') key = 'space'
  if (key === 'escape') key = 'escape'
  if (key === 'delete' || key === 'backspace') key = 'delete'
  if (key.length === 1) key = key.toLowerCase()
  parts.push(key)
  return parts.join('+')
}

export function useHotkeys(handlers) {
  useEffect(() => {
    const handler = (e) => {
      const combo = buildCombo(e)
      const fn = handlers[combo]
      if (fn) {
        e.preventDefault()
        e.stopPropagation()
        fn(e)
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [handlers])
}

// Mapa de atalhos para mostrar na UI
export const HOTKEYS = isMac
  ? {
      undo: 'Cmd+Z',
      redo: 'Cmd+Shift+Z',
      translate: 'G',
      rotate: 'R',
      scale: 'S',
      delete: 'Delete',
      duplicate: 'Cmd+D',
      deselect: 'Esc',
    }
  : {
      undo: 'Ctrl+Z',
      redo: 'Ctrl+Shift+Z',
      translate: 'G',
      rotate: 'R',
      scale: 'S',
      delete: 'Delete',
      duplicate: 'Ctrl+D',
      deselect: 'Esc',
    }

/**
 * useOnlineStatus — hook para detetar estado online/offline.
 *
 * Retorna true se a app está online, false caso contrário.
 * Atualiza automaticamente quando o estado da rede muda.
 */
import { useState, useEffect } from 'react'

export function useOnlineStatus() {
  const [online, setOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )

  useEffect(() => {
    const handleOnline = () => setOnline(true)
    const handleOffline = () => setOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return online
}

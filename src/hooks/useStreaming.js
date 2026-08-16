/**
 * useStreaming — hook que gere StreamingManager lifecycle no Canvas.
 *
 * Performance Core Fase 3.8 — Integration.
 *
 * Responsabilidades:
 *  - Quando Play Mode começa, StreamingManager fica ativo
 *  - No cleanup (Stop), StreamingManager.restore() limpa:
 *    * promises pendentes (rejeitadas)
 *    * assets registados temporários
 *    * texturas com refCount=0 (flushTextureCache)
 *  - Texturas com refCount>0 são PRESERVADAS (ainda em uso)
 *
 * Estado puramente Runtime — não persiste no projeto.
 * Preserva Bug #4: restore no cleanup só remove recursos não referenciados.
 *
 * FlirScript-friendly: StreamingManager singleton acessível via import.
 */
import { useEffect } from 'react'
import { StreamingManager } from '../utils/streamingManager'

export default function useStreaming({ enabled = false } = {}) {
  useEffect(() => {
    if (!enabled) return
    return () => {
      // Restore: limpa registos temporários do Play Mode (Bug #4 safe)
      // flushTextureCache() só dispõe texturas com refCount=0
      // Texturas ainda referenciadas (refCount>0) são preservadas
      StreamingManager.restore()
    }
  }, [enabled])

  return {
    getStats: () => StreamingManager.getStats(),
  }
}

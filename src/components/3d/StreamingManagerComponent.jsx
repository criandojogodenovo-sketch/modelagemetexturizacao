/**
 * StreamingManagerComponent — componente R3F que gere Streaming lifecycle.
 *
 * Performance Core Fase 3.8 — Integration.
 *
 * Combina:
 *  - useStreaming hook (restore no cleanup)
 *
 * NOTA: O registo de assets é feito por SceneObject/loadTexture diretamente
 * via StreamingManager.getTexture(). Este componente apenas garante o restore
 * no cleanup do Play Mode.
 *
 * Uso:
 *   <StreamingManagerComponent enabled={isGameMode} />
 *
 * Estado puramente Runtime — não persiste no projeto.
 * Preserva Bug #4: restore no cleanup.
 */
import useStreaming from '../../hooks/useStreaming'

export default function StreamingManagerComponent({ enabled = false }) {
  useStreaming({ enabled })
  return null
}

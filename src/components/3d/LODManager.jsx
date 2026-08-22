/**
 * LODManager — componente R3F que gere Level of Detail.
 *
 * Performance Core Fase 3.4 — LOD and FlirScript API Foundation.
 *
 * Combina:
 *  - useLOD hook (atualiza LODSystem a cada frame)
 *
 * NOTA: O registo de meshes no LODSystem é feito pelo SceneObject via
 * LODSystem.register() no seu useEffect de setup. Este componente apenas
 * garante que LODSystem.update() é chamado a cada frame e que o qualityLevel
 * está sincronizado.
 *
 * Uso:
 *   <LODManager enabled={isGameMode} />
 *
 * Estado puramente Runtime — não persiste no projeto.
 * Preserva Bug #4: restore no cleanup.
 */
import useLOD from '../../hooks/useLOD'

export default function LODManager({ enabled = false }) {
  useLOD({ enabled })
  return null
}

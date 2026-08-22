/**
 * DistanceCulling — componente R3F que aplica distance culling a Conects gizmos.
 *
 * Performance Core Fase 3.3 — Distance and Frustum Culling.
 *
 * Combina:
 *  - useDistanceCulling hook (integra CullingManager no useFrame)
 *  - idToType Map construído a partir dos conects da cena ativa
 *
 * Uso:
 *   <DistanceCulling
 *     conectMeshRefs={conectMeshRefs}
 *     conects={activeScene.conects}
 *     enabled={!isGameMode || isGameMode}  // ativo em ambos os modos
 *     selectedInstanceId={selectedInstanceId}
 *   />
 *
 * Estado puramente Runtime — não persiste no projeto.
 * Preserva Bug #4: restore no cleanup.
 */
import { useMemo } from 'react'
import useDistanceCulling from '../../hooks/useDistanceCulling'

export default function DistanceCulling({
  conectMeshRefs,
  conects = [],
  enabled = false,
  selectedInstanceId = null,
}) {
  // Pré-construir Map<instanceId, conect.type> para filtrar cullables
  // useMemo evita recriar a cada render
  const idToType = useMemo(() => {
    const map = new Map()
    for (const conect of conects || []) {
      if (conect?.instanceId) {
        map.set(conect.instanceId, conect.type)
      }
    }
    return map
  }, [conects])

  useDistanceCulling({
    conectMeshRefs,
    enabled,
    selectedInstanceId,
    idToType,
  })

  return null
}

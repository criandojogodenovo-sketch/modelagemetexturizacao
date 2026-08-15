/**
 * RaycastManager — componente R3F que gere RaycastSystem lifecycle.
 *
 * Performance Core Fase 3.5 — BVH Raycast System.
 *
 * Combina:
 *  - useRaycastSystem hook (restore no cleanup)
 *
 * NOTA: O registo de meshes é feito por SceneObject/TerrainSculpt3D diretamente.
 * Este componente apenas garante o restore no cleanup do Play Mode.
 *
 * Uso:
 *   <RaycastManager enabled={isGameMode} />
 *
 * Estado puramente Runtime — não persiste no projeto.
 * Preserva Bug #4: restore no cleanup.
 */
import useRaycastSystem from '../../hooks/useRaycastSystem'

export default function RaycastManager({ enabled = false }) {
  useRaycastSystem({ enabled })
  return null
}

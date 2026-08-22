/**
 * useRaycastSystem — hook que gere RaycastSystem lifecycle no Canvas.
 *
 * Performance Core Fase 3.5 — BVH Raycast System.
 *
 * Responsabilidades:
 *  - Quando Play Mode começa, RaycastSystem fica ativo
 *  - No cleanup (Stop), RaycastSystem.restore() limpa registos temporários
 *    (Bug #4 safe — não contaminam Editor)
 *
 * NOTA: O registo de meshes é feito por SceneObject/TerrainSculpt3D diretamente
 * via RaycastSystem.register(). Este hook apenas garante o restore no cleanup.
 *
 * Estado puramente Runtime — não persiste no projeto.
 * Preserva Bug #4: restore no cleanup.
 *
 * FlirScript-friendly: RaycastSystem singleton acessível via import.
 */
import { useEffect } from 'react'
import { RaycastSystem } from '../utils/raycastSystem'

export default function useRaycastSystem({ enabled = false } = {}) {
  useEffect(() => {
    if (!enabled) return
    return () => {
      // Restore: limpa registos e faz dispose dos BVHs (Bug #4 safe)
      // NÃO destrói geometrias originais — apenas boundsTrees
      RaycastSystem.restore()
    }
  }, [enabled])

  return {
    getStats: () => RaycastSystem.getStats(),
    isSupported: () => RaycastSystem.isSupported(),
  }
}

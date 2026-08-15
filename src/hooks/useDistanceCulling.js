/**
 * useDistanceCulling — hook que aplica distance culling a Conects gizmos.
 *
 * Performance Core Fase 3.3 — Distance and Frustum Culling.
 *
 * Responsabilidades:
 *  - A cada frame, ler qualityLevel do AdaptiveQuality e atualizar CullingManager
 *  - Aplicar distance culling aos conectMeshRefs (gizmos auxiliares)
 *  - Respeitar selectedInstanceId (NÃO cull selecionado)
 *  - No cleanup (Stop), restaurar visible original via CullingManager.restore()
 *
 * Estado puramente Runtime — não persiste no projeto.
 * Preserva Bug #4 (Editor/Runtime isolation): restore no cleanup.
 *
 * FlirScript-friendly: CullingManager singleton acessível via import para
 * futura API (FlirScript.Culling.enabled, .distance, .visibleObjects).
 */
import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { CullingManager } from '../utils/cullingManager'
import { AdaptiveQuality } from '../utils/adaptiveQuality'
import { useStore } from '../store/useStore'

export default function useDistanceCulling({
  conectMeshRefs,
  enabled = false,
  selectedInstanceId = null,
  idToType = new Map(),
} = {}) {
  const { camera } = useThree()
  const lastQualityRef = useRef('medium')
  const selectedSetRef = useRef(new Set())

  // Atualizar selectedSet quando muda
  useEffect(() => {
    selectedSetRef.current = new Set(selectedInstanceId ? [selectedInstanceId] : [])
  }, [selectedInstanceId])

  // Cleanup no unmount ou quando enabled muda
  useEffect(() => {
    if (!enabled) return
    return () => {
      // Restore visible original (Bug #4 safe)
      CullingManager.restore()
    }
  }, [enabled])

  useFrame(() => {
    if (!enabled || !conectMeshRefs?.current) return

    // Sincronizar qualityLevel do AdaptiveQuality → CullingManager
    const quality = AdaptiveQuality.getQualityLevel()
    if (quality !== lastQualityRef.current) {
      CullingManager.setQualityLevel(quality)
      lastQualityRef.current = quality
    }

    // Aplicar distance culling
    CullingManager.applyDistanceCulling(
      conectMeshRefs.current,
      camera,
      selectedSetRef.current,
      idToType
    )
  })

  return {
    getStats: () => CullingManager.getStats(),
    getDistance: () => CullingManager.getDistance(),
  }
}

/**
 * useLOD — hook que integra LODSystem no useFrame do R3F.
 *
 * Performance Core Fase 3.4 — LOD and FlirScript API Foundation.
 *
 * Responsabilidades:
 *  - A cada frame, sincronizar qualityLevel do AdaptiveQuality → LODSystem
 *  - Chamar LODSystem.update(camera) para atualizar níveis
 *  - No cleanup (Stop), restaurar via LODSystem.restore() (Bug #4 safe)
 *
 * Estado puramente Runtime — não persiste no projeto.
 * Preserva Bug #4: restore no cleanup.
 *
 * FlirScript-friendly: LODSystem singleton acessível via import.
 */
import { useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { LODSystem } from '../utils/lodSystem'
import { AdaptiveQuality } from '../utils/adaptiveQuality'

export default function useLOD({ enabled = false } = {}) {
  const { camera } = useThree()
  const lastQualityRef = useRef('medium')
  const startedRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    startedRef.current = true
    return () => {
      // Restore: limpa registos e dispose geometrias simplificadas (Bug #4 safe)
      LODSystem.restore()
      startedRef.current = false
    }
  }, [enabled])

  useFrame(() => {
    if (!startedRef.current || !enabled) return

    // Sincronizar qualityLevel do AdaptiveQuality → LODSystem
    const quality = AdaptiveQuality.getQualityLevel()
    if (quality !== lastQualityRef.current) {
      LODSystem.setQualityLevel(quality)
      lastQualityRef.current = quality
    }

    // Atualizar LODs
    LODSystem.update(camera)
  })

  return {
    getStats: () => LODSystem.getStats(),
    getQualityLevel: () => LODSystem.getQualityLevel(),
  }
}

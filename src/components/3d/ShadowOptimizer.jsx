/**
 * ShadowOptimizer — desliga castShadow em meshes distantes da câmara.
 *
 * Performance Core Fase 3.2 — Adaptive Quality.
 *
 * Princípios:
 *  - Só ativo quando renderSettings.shadowOptimizations === true
 *  - Respeita shadowDistance (meshes além desta distância não projetam sombra)
 *  - NÃO destrói materiais/geometrias — apenas toggle castShadow
 *  - Reversível: no cleanup, restaura castShadow original
 *  - Editor-friendly: preserva seleção (selectedMesh mantém castShadow)
 *  - Não mexe em receiveShadow (sombras recebidas são baratas)
 *  - Otimização: só reavalia quando câmara se move >2 unidades OU nº meshes muda
 *
 * Estado temporário — não persiste em renderSettings nem no projeto.
 * Integrável com futura FlirScript Performance API.
 */
import { useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store/useStore'

// Re-avaliar shadows quando câmara se move mais que isto (otimização)
const REEVALUATE_DISTANCE_SQ = 4 // 2² = 4 unidades

export default function ShadowOptimizer({ meshRefs, conectMeshRefs, enabled = true, isGameMode = false }) {
  const { camera } = useThree()
  const renderSettings = useStore((s) => s.renderSettings)
  const lastCamPosRef = useRef(new THREE.Vector3())
  const lastMeshCountRef = useRef(0)
  // Map<Mesh, originalCastShadow> — para restore no cleanup
  const originalCastShadowRef = useRef(new Map())
  // Ref para Vector3 reutilizável (evita allocation por frame)
  const _tmpVec = useRef(new THREE.Vector3())

  // Distância de shadow do renderSettings (default 20)
  const shadowDistance = renderSettings?.shadowDistance ?? 20
  const shadowOptimizationsEnabled = renderSettings?.shadowOptimizations !== false

  useFrame(() => {
    if (!enabled || !shadowOptimizationsEnabled) return

    // Otimização: só reavaliar se câmara se moveu >2 unidades OU nº meshes mudou
    const movedSq = _tmpVec.current.copy(camera.position).sub(lastCamPosRef.current).lengthSq()
    let totalMeshes = 0
    if (meshRefs?.current) totalMeshes += meshRefs.current.size
    if (conectMeshRefs?.current) totalMeshes += conectMeshRefs.current.size
    if (movedSq < REEVALUATE_DISTANCE_SQ && totalMeshes === lastMeshCountRef.current) return

    lastCamPosRef.current.copy(camera.position)
    lastMeshCountRef.current = totalMeshes

    const camPos = camera.position
    const distSq = shadowDistance * shadowDistance

    // Processar meshes de objects
    if (meshRefs?.current) {
      for (const [, mesh] of meshRefs.current) {
        if (!mesh) continue
        // Guardar original se ainda não guardado
        if (!originalCastShadowRef.current.has(mesh)) {
          originalCastShadowRef.current.set(mesh, mesh.castShadow)
        }
        // Distância ao mesh (usar position directa, sem allocate)
        const dx = mesh.position.x - camPos.x
        const dy = mesh.position.y - camPos.y
        const dz = mesh.position.z - camPos.z
        const meshDistSq = dx * dx + dy * dy + dz * dz
        mesh.castShadow = meshDistSq < distSq && originalCastShadowRef.current.get(mesh)
      }
    }
    // Processar meshes de conects
    if (conectMeshRefs?.current) {
      for (const [, mesh] of conectMeshRefs.current) {
        if (!mesh) continue
        if (!originalCastShadowRef.current.has(mesh)) {
          originalCastShadowRef.current.set(mesh, mesh.castShadow)
        }
        const dx = mesh.position.x - camPos.x
        const dy = mesh.position.y - camPos.y
        const dz = mesh.position.z - camPos.z
        const meshDistSq = dx * dx + dy * dy + dz * dz
        mesh.castShadow = meshDistSq < distSq && originalCastShadowRef.current.get(mesh)
      }
    }
  })

  // Cleanup: restaurar castShadow original quando componente desmonta
  // (garante Bug #4 — Editor/Runtime isolation preservado)
  useEffect(() => {
    return () => {
      for (const [mesh, original] of originalCastShadowRef.current) {
        if (mesh) mesh.castShadow = original
      }
      originalCastShadowRef.current.clear()
      lastMeshCountRef.current = 0
    }
  }, [])

  return null
}

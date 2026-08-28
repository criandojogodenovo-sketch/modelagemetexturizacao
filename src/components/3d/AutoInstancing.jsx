/**
 * AutoInstancing — detecta StaticObjects com mesmo sourceObjectId (≥5 instâncias)
 * e converte-os para InstancedMesh automaticamente.
 *
 * Poupa draw calls: N objetos → 1 draw call por sourceObjectId.
 *
 * Funciona tanto no editor como no modo jogo.
 *
 * Performance Core Fase 3.3:
 *  - Dirty flags: só reescreve matriz de instâncias que mudaram
 *  - Frustum culling por instância: skip instâncias fora do view frustum
 *  - Reutiliza Frustum/Matrix4/Vector3 (zero allocations por frame)
 *  - Só reavalia culling quando câmara se move >2 unidades
 *  - Respeita AdaptiveQuality.getQualityLevel() para distância de culling
 */
import { useMemo, useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { AdaptiveQuality } from '../../utils/adaptiveQuality'

const INSTANCING_THRESHOLD = 5  // só instancia se houver 5+ objetos do mesmo tipo
const REEVALUATE_DISTANCE_SQ = 4 // 2² = 4 unidades

export default function AutoInstancing({ activeScene, objects }) {
  const { scene, camera } = useThree()
  const instancedMeshesRef = useRef([])
  const dummy = useMemo(() => new THREE.Object3D(), [])

  // Reutilizáveis para frustum culling (zero allocations por frame)
  const _frustum = useMemo(() => new THREE.Frustum(), [])
  const _projScreenMatrix = useMemo(() => new THREE.Matrix4(), [])
  const _tempVec = useMemo(() => new THREE.Vector3(), [])
  const _lastCamPos = useMemo(() => new THREE.Vector3(), [])
  const _camMovedRef = useRef(true) // forçar reavaliação no 1º frame
  const _lastQualityRef = useRef('medium')

  // Agrupar StaticObjects por sourceObjectId
  const groups = useMemo(() => {
    if (!activeScene?.conects) return []
    const map = new Map()
    for (const c of activeScene.conects) {
      if (c.type !== 'StaticObject' || !c.sourceObjectId) continue
      if (!map.has(c.sourceObjectId)) map.set(c.sourceObjectId, [])
      map.get(c.sourceObjectId).push(c)
    }
    // Só manter grupos com ≥5 instâncias
    return Array.from(map.entries())
      .filter(([_, list]) => list.length >= INSTANCING_THRESHOLD)
      .map(([sourceObjectId, list]) => ({ sourceObjectId, conects: list }))
  }, [activeScene])

  // Para cada grupo, criar um InstancedMesh
  const instancedData = useMemo(() => {
    return groups.map(({ sourceObjectId, conects }) => {
      const obj = objects.find((o) => o.id === sourceObjectId)
      if (!obj) return null

      // Construir geometria (iguais às PRIMITIVES de src/utils/primitives.js)
      // S17 fix (P1-17): tipos corretos — antes verificava 'box' (inexistente;
      // 'cube' caía no fallback 1×1×1) e plane/torus não eram suportados.
      let geometry
      if (obj.type === 'cube') {
        const s = obj.args?.size || 1
        geometry = new THREE.BoxGeometry(s, s, s)
      } else if (obj.type === 'sphere') {
        const r = obj.args?.radius || 0.6, seg = obj.args?.segments || 32
        geometry = new THREE.SphereGeometry(r, seg, Math.max(8, seg / 2))
      } else if (obj.type === 'cylinder') {
        const r = obj.args?.radius ?? 0.5, h = obj.args?.height || 1.2, rs = obj.args?.segments || 32
        geometry = new THREE.CylinderGeometry(r, r, h, rs)
      } else if (obj.type === 'cone') {
        const r = obj.args?.radius || 0.6, h = obj.args?.height || 1.2
        geometry = new THREE.ConeGeometry(r, h, obj.args?.segments || 32)
      } else if (obj.type === 'plane') {
        geometry = new THREE.PlaneGeometry(obj.args?.width || 1.5, obj.args?.height || 1.5)
      } else if (obj.type === 'torus') {
        geometry = new THREE.TorusGeometry(obj.args?.radius || 0.6, obj.args?.tube || 0.2, obj.args?.radialSegments || 16, obj.args?.tubularSegments || 64)
      } else {
        geometry = new THREE.BoxGeometry(1, 1, 1)
      }

      const material = new THREE.MeshStandardMaterial({
        color: obj.material?.color || '#888888',
        roughness: obj.material?.roughness ?? 0.8,
        metalness: obj.material?.metalness ?? 0.1,
      })

      const mesh = new THREE.InstancedMesh(geometry, material, conects.length)
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.frustumCulled = false  // já gerimos nós mesmos
      mesh.userData.isAutoInstanced = true

      // Performance Core 3.3: dirty flags por instância
      // true = precisa de update de matriz; false = já está atualizada
      const dirtyFlags = new Array(conects.length).fill(true) // 1º frame: todas dirty
      // Cache de última posição/rotação/escala para detetar mudanças
      const lastTransforms = conects.map(c => ({
        px: c.position?.[0] ?? 0, py: c.position?.[1] ?? 0, pz: c.position?.[2] ?? 0,
        rx: c.rotation?.[0] ?? 0, ry: c.rotation?.[1] ?? 0, rz: c.rotation?.[2] ?? 0,
        sx: c.scale?.[0] ?? 1, sy: c.scale?.[1] ?? 1, sz: c.scale?.[2] ?? 1,
      }))

      return { mesh, conects, sourceObjectId, dirtyFlags, lastTransforms }
    }).filter(Boolean)
  }, [groups, objects])

  // Adicionar/remover da cena
  useEffect(() => {
    for (const { mesh } of instancedData) {
      scene.add(mesh)
    }
    instancedMeshesRef.current = instancedData

    return () => {
      for (const { mesh } of instancedData) {
        scene.remove(mesh)
        mesh.geometry?.dispose()
        mesh.material?.dispose()
      }
    }
  }, [instancedData, scene])

  // Actualizar matrizes por frame (com dirty flags + frustum culling)
  useFrame(() => {
    // Verificar se câmara se moveu significativamente
    _tempVec.copy(camera.position).sub(_lastCamPos)
    const camMovedSq = _tempVec.lengthSq()
    if (camMovedSq >= REEVALUATE_DISTANCE_SQ) {
      _camMovedRef.current = true
      _lastCamPos.copy(camera.position)
    }

    // Sincronizar qualityLevel → distância de culling
    const quality = AdaptiveQuality.getQualityLevel()
    if (quality !== _lastQualityRef.current) {
      _lastQualityRef.current = quality
      _camMovedRef.current = true // forçar reavaliação quando quality muda
    }

    // Atualizar frustum só se câmara se moveu
    if (_camMovedRef.current) {
      _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
      _frustum.setFromProjectionMatrix(_projScreenMatrix)
    }

    // Distância máxima de culling baseada em quality (igual ao CullingManager)
    const maxDist = quality === 'high' ? 80 : quality === 'low' ? 40 : quality === 'minimal' ? 25 : 60
    const maxDistSq = maxDist * maxDist
    const camPos = camera.position

    let anyDirty = false

    for (const { mesh, conects, dirtyFlags, lastTransforms } of instancedMeshesRef.current) {
      for (let i = 0; i < conects.length; i++) {
        const c = conects[i]
        const px = c.position?.[0] ?? 0
        const py = c.position?.[1] ?? 0
        const pz = c.position?.[2] ?? 0
        const rx = c.rotation?.[0] ?? 0
        const ry = c.rotation?.[1] ?? 0
        const rz = c.rotation?.[2] ?? 0
        const sx = c.scale?.[0] ?? 1
        const sy = c.scale?.[1] ?? 1
        const sz = c.scale?.[2] ?? 1

        const last = lastTransforms[i]
        // Dirty flag: só reescrever matriz se transform mudou
        if (
          dirtyFlags[i] ||
          last.px !== px || last.py !== py || last.pz !== pz ||
          last.rx !== rx || last.ry !== ry || last.rz !== rz ||
          last.sx !== sx || last.sy !== sy || last.sz !== sz
        ) {
          dummy.position.set(px, py, pz)
          dummy.rotation.set(rx, ry, rz)
          dummy.scale.set(sx, sy, sz)
          dummy.updateMatrix()
          mesh.setMatrixAt(i, dummy.matrix)
          dirtyFlags[i] = false
          last.px = px; last.py = py; last.pz = pz
          last.rx = rx; last.ry = ry; last.rz = rz
          last.sx = sx; last.sy = sy; last.sz = sz
          anyDirty = true
        }

        // Frustum + distance culling: se instância está fora, escala para 0 (skip GPU)
        // Mas só reavalia se câmara se moveu
        if (_camMovedRef.current) {
          _tempVec.set(px, py, pz)
          const dx = px - camPos.x, dy = py - camPos.y, dz = pz - camPos.z
          const distSq = dx * dx + dy * dy + dz * dz
          if (distSq > maxDistSq || !_frustum.containsPoint(_tempVec)) {
            // Fora do frustum ou além da distância — escalar para 0
            dummy.position.set(px, py, pz)
            dummy.rotation.set(rx, ry, rz)
            dummy.scale.set(0, 0, 0)
            dummy.updateMatrix()
            mesh.setMatrixAt(i, dummy.matrix)
            dirtyFlags[i] = true // forçar re-update quando voltar a estar visível
            anyDirty = true
          }
        }
      }

      if (anyDirty) {
        mesh.instanceMatrix.needsUpdate = true
      }
    }

    _camMovedRef.current = false
  })

  return null
}

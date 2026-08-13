/**
 * AutoInstancing — detecta StaticObjects com mesmo sourceObjectId (≥5 instâncias)
 * e converte-os para InstancedMesh automaticamente.
 *
 * Poupa draw calls: N objetos → 1 draw call por sourceObjectId.
 *
 * Funciona tanto no editor como no modo jogo.
 */
import { useMemo, useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const INSTANCING_THRESHOLD = 5  // só instancia se houver 5+ objetos do mesmo tipo

export default function AutoInstancing({ activeScene, objects }) {
  const { scene } = useThree()
  const instancedMeshesRef = useRef([])
  const dummy = useMemo(() => new THREE.Object3D(), [])

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

      // Construir geometria (igual ao SceneObject)
      let geometry
      if (obj.type === 'box') {
        const w = obj.args?.width || 1, h = obj.args?.height || 1, d = obj.args?.depth || 1
        geometry = new THREE.BoxGeometry(w, h, d)
      } else if (obj.type === 'cylinder') {
        const rt = obj.args?.radiusTop ?? 0.5, rb = obj.args?.radiusBottom ?? 0.5
        const h = obj.args?.height || 1, rs = obj.args?.radialSegments || 12
        geometry = new THREE.CylinderGeometry(rt, rb, h, rs)
      } else if (obj.type === 'sphere') {
        const r = obj.args?.radius || 0.5
        geometry = new THREE.SphereGeometry(r, 12, 8)
      } else if (obj.type === 'cone') {
        const r = obj.args?.radius || 0.5, h = obj.args?.height || 1
        geometry = new THREE.ConeGeometry(r, h, 8)
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

      return { mesh, conects, sourceObjectId }
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

  // Actualizar matrizes por frame (para acompanhar animações de FlirCode se houver)
  useFrame(() => {
    for (const { mesh, conects } of instancedMeshesRef.current) {
      for (let i = 0; i < conects.length; i++) {
        const c = conects[i]
        dummy.position.set(c.position?.[0] || 0, c.position?.[1] || 0, c.position?.[2] || 0)
        dummy.rotation.set(c.rotation?.[0] || 0, c.rotation?.[1] || 0, c.rotation?.[2] || 0)
        dummy.scale.set(c.scale?.[0] || 1, c.scale?.[1] || 1, c.scale?.[2] || 1)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
    }
  })

  return null
}

/**
 * InstancedObjects — otimização de performance para objetos repetidos.
 *
 * C4: Quando há múltiplos objetos do mesmo tipo (árvores, postes, etc.),
 * em vez de criar um mesh por objeto (draw call por objeto), usa InstancedMesh
 * que faz 1 draw call para todas as instâncias do mesmo tipo.
 *
 * Uso: <InstancedObjects objects={treesOfType} geometry={treeGeo} material={treeMat} />
 *
 * Cada `objects` item deve ter { id, position, rotation, scale }.
 */
import { useRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'

export default function InstancedObjects({ objects, geometry, material }) {
  const meshRef = useRef()
  const instanceCount = objects?.length || 0

  // Criar matrices de transformação para cada instância
  const matrices = useMemo(() => {
    if (!objects || objects.length === 0) return []
    const dummy = new THREE.Object3D()
    return objects.map((obj, i) => {
      dummy.position.set(...(obj.position || [0, 0, 0]))
      dummy.rotation.set(...(obj.rotation || [0, 0, 0]))
      dummy.scale.set(...(obj.scale || [1, 1, 1]))
      dummy.updateMatrix()
      return { index: i, matrix: dummy.matrix.clone(), visible: obj.visible !== false }
    })
  }, [objects])

  // Aplicar matrices ao InstancedMesh
  useEffect(() => {
    if (!meshRef.current || matrices.length === 0) return
    const mesh = meshRef.current
    for (const { index, matrix, visible } of matrices) {
      if (visible) {
        mesh.setMatrixAt(index, matrix)
      } else {
        // Escala zero para esconder
        const hidden = new THREE.Matrix4().makeScale(0, 0, 0)
        mesh.setMatrixAt(index, hidden)
      }
    }
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [matrices])

  if (instanceCount === 0) return null

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, instanceCount]}
      castShadow
      receiveShadow
      frustumCulled
    />
  )
}

/**
 * Helper: agrupar objetos do catálogo por tipo para InstancedMesh.
 *
 * @param {Array} instances — array de instâncias de cena { objectId, position, rotation, scale }
 * @param {Array} catalogObjects — array de objetos do catálogo { id, type, args, material }
 * @returns {Map<string, { geometry, material, objects }>} — mapa de tipo → { geometry, material, objects }
 */
export function groupInstancesByType(instances, catalogObjects) {
  const groups = new Map()
  for (const inst of instances) {
    const obj = catalogObjects.find(o => o.id === inst.objectId)
    if (!obj) continue
    const key = `${obj.type}_${JSON.stringify(obj.args)}_${JSON.stringify(obj.material)}`
    if (!groups.has(key)) {
      groups.set(key, {
        type: obj.type,
        args: obj.args,
        material: obj.material,
        objects: [],
      })
    }
    groups.get(key).objects.push(inst)
  }
  return groups
}

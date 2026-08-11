/**
 * instancedRenderer.js — Agrupa meshes repetidos em InstancedMesh.
 *
 * Em vez de renderizar 500 meshes separados (500 draw calls),
 * cria um InstancedMesh que renderiza todos numa única draw call.
 *
 * Uso:
 *   const ir = createInstancedRenderer(scene3d)
 *   ir.addType('NpcObject', geometry, material, count)
 *   ir.updateInstance('NpcObject', index, position, rotation, scale)
 *   ir.update() // chamado a cada frame
 */
import * as THREE from 'three'

export function createInstancedRenderer(scene) {
  const types = new Map() // type → { mesh, instances: [], count, maxCount }

  function addType(type, geometry, material, maxCount = 500) {
    const instancedMesh = new THREE.InstancedMesh(geometry, material, maxCount)
    instancedMesh.castShadow = false
    instancedMesh.receiveShadow = true
    instancedMesh.count = 0
    instancedMesh.frustumCulled = false // o InstancedMesh gere o seu próprio culling
    scene.add(instancedMesh)

    types.set(type, {
      mesh: instancedMesh,
      instances: new Map(), // instanceId → index
      count: 0,
      maxCount,
    })
    return instancedMesh
  }

  function addInstance(type, instanceId, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
    const t = types.get(type)
    if (!t) return -1
    if (t.count >= t.maxCount) return -1
    const index = t.count++
    t.instances.set(instanceId, index)
    updateInstance(type, instanceId, position, rotation, scale)
    return index
  }

  // Reusable objects to avoid GC pressure
  const _pos = new THREE.Vector3()
  const _quat = new THREE.Quaternion()
  const _euler = new THREE.Euler()
  const _scl = new THREE.Vector3()
  const _matrix = new THREE.Matrix4()

  function updateInstance(type, instanceId, position, rotation, scale) {
    const t = types.get(type)
    if (!t) return
    const index = t.instances.get(instanceId)
    if (index === undefined) return

    _pos.set(position[0], position[1], position[2])
    _euler.set(rotation[0], rotation[1], rotation[2])
    _quat.setFromEuler(_euler)
    _scl.set(scale[0], scale[1], scale[2])
    _matrix.compose(_pos, _quat, _scl)
    t.mesh.setMatrixAt(index, _matrix)
  }

  // Call this once per frame after all updates
  function flushUpdates() {
    for (const [, t] of types) {
      t.mesh.instanceMatrix.needsUpdate = true
    }
  }

  function removeInstance(type, instanceId) {
    const t = types.get(type)
    if (!t) return
    const index = t.instances.get(instanceId)
    if (index === undefined) return
    // Mover última instância para o lugar da removida
    const lastIndex = t.count - 1
    if (index !== lastIndex) {
      const matrix = new THREE.Matrix4()
      t.mesh.getMatrixAt(lastIndex, matrix)
      t.mesh.setMatrixAt(index, matrix)
    }
    t.count--
    t.instances.delete(instanceId)
    t.mesh.count = t.count
    t.mesh.instanceMatrix.needsUpdate = true
  }

  function setVisible(type, instanceId, visible) {
    const t = types.get(type)
    if (!t) return
    const index = t.instances.get(instanceId)
    if (index === undefined) return
    // Para esconder uma instância: escalar para 0
    if (!visible) {
      const matrix = new THREE.Matrix4().makeScale(0, 0, 0)
      t.mesh.setMatrixAt(index, matrix)
      t.mesh.instanceMatrix.needsUpdate = true
    }
  }

  function getCount(type) {
    const t = types.get(type)
    return t ? t.count : 0
  }

  function dispose() {
    for (const [, t] of types) {
      scene.remove(t.mesh)
      t.mesh.geometry?.dispose()
      t.mesh.material?.dispose()
    }
    types.clear()
  }

  return {
    addType,
    addInstance,
    updateInstance,
    flushUpdates,
    removeInstance,
    setVisible,
    getCount,
    dispose,
    types,
  }
}

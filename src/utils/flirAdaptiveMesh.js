/**
 * flirAdaptiveMesh.js — Geometria adaptativa (LOD automático por distância).
 *
 * Implementação LEVE de Nanite-like LOD:
 *  - Para cada mesh na cena, calcula a distância à câmara
 *  - Se estiver perto: usa geometria original (full detail)
 *  - Se estiver médio: simplifica para 50% dos vértices
 *  - Se estiver longe: simplifica para 25% dos vértices
 *
 * Usa THREE.LOD internamente. A simplificação é feita uma vez (cacheada).
 *
 * Custo: extra computation no setup + 1-2 draw calls por nível de LOD.
 * Impacto esperado: +20-40% FPS em cenas com muitos objetos distantes.
 */
import * as THREE from 'three'

// Cache de geometrias simplificadas por objeto
const lodCache = new WeakMap()

/**
 * Cria um THREE.LOD para um mesh.
 * Substitui o mesh original por um LOD com 3 níveis de detalhe.
 */
export function createAdaptiveLOD(mesh, camera) {
  if (!mesh || !mesh.geometry) return mesh

  // Se já é um LOD, retornar
  if (mesh.isLOD) return mesh

  // Obter ou criar geometrias simplificadas
  let levels = lodCache.get(mesh.geometry)
  if (!levels) {
    const original = mesh.geometry
    const medDetail = simplifyGeometry(original, 0.5)
    const lowDetail = simplifyGeometry(original, 0.25)
    levels = { high: original, med: medDetail, low: lowDetail }
    lodCache.set(mesh.geometry, levels)
  }

  const lod = new THREE.LOD()
  lod.position.copy(mesh.position)
  lod.rotation.copy(mesh.rotation)
  lod.scale.copy(mesh.scale)

  // Nível alto (full detail) — até 15 unidades
  const highMesh = new THREE.Mesh(levels.high, mesh.material)
  highMesh.castShadow = mesh.castShadow
  highMesh.receiveShadow = mesh.receiveShadow
  lod.addLevel(highMesh, 0)

  // Nível médio — 15 a 40 unidades
  if (levels.med !== levels.high) {
    const medMesh = new THREE.Mesh(levels.med, mesh.material)
    medMesh.castShadow = mesh.castShadow
    medMesh.receiveShadow = mesh.receiveShadow
    lod.addLevel(medMesh, 15)
  }

  // Nível baixo — 40+ unidades
  if (levels.low !== levels.high) {
    const lowMesh = new THREE.Mesh(levels.low, mesh.material)
    lowMesh.castShadow = false // Sem sombras à distância
    lowMesh.receiveShadow = mesh.receiveShadow
    lod.addLevel(lowMesh, 40)
  }

  return lod
}

/**
 * Simplifica uma geometria (aproximação — amostra vértices).
 */
function simplifyGeometry(geometry, ratio) {
  if (ratio >= 1) return geometry
  const pos = geometry.attributes.position
  if (!pos) return geometry

  const totalVerts = pos.count
  const step = Math.max(1, Math.floor(1 / ratio))
  const newCount = Math.floor(totalVerts / step)

  if (newCount === totalVerts) return geometry

  // Criar geometria simplificada (apenas vértices amostrados)
  const newGeo = new THREE.BufferGeometry()
  const positions = new Float32Array(newCount * 3)
  for (let i = 0; i < newCount; i++) {
    const srcIdx = i * step
    positions[i * 3] = pos.getX(srcIdx)
    positions[i * 3 + 1] = pos.getY(srcIdx)
    positions[i * 3 + 2] = pos.getZ(srcIdx)
  }
  newGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  newGeo.computeVertexNormals()
  return newGeo
}

/**
 * Atualiza todos os LODs numa cena (chamar a cada frame).
 */
export function updateAdaptiveLODs(scene, camera) {
  scene.traverse((obj) => {
    if (obj.isLOD) {
      obj.update(camera)
    }
  })
}

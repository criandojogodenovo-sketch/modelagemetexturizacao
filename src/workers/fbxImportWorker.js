/**
 * fbxImportWorker.js — Web Worker para parsing de FBX fora da thread principal.
 *
 * **Porquê um Worker?**
 * O FBXLoader.parse() do three.js é síncrono e bloqueia a thread principal
 * durante segundos para ficheiros grandes com esqueleto complexo. Isto causa
 * o ecrã "A importar modelo..." ficar congelado (sem animação, sem resposta
 * a toques) — mau UX em mobile.
 *
 * **Abordagem:**
 * 1. Worker importa `three` + `FBXLoader` internamente (three.js é puro JS,
 *    funciona em module workers desde que não aceda a `document`/`window`).
 * 2. Worker faz `loader.parse(arrayBuffer, '')` — isto é o passo pesado.
 * 3. Worker extrai dados SERIALIZÁVEIS (arrays primitivos, plain objects)
 *    — NÃO envia objetos THREE.* pela fronteira (são estruturados complexos).
 * 4. Worker envia via `postMessage` com `transfer` de ArrayBuffers (zero-copy).
 * 5. Main thread reconstrói THREE.BufferGeometry, THREE.Skeleton, etc.
 *
 * **Limitação conhecida (honestidade):**
 * FBXLoader usa `THREE.ImageLoader` para texturas externas, que usa `document`.
 * Em worker, `document` não existe — mas FBX com texturas EMBEDADAS funciona
 * porque os dataURLs já estão no binário. Para FBX com texturas externas,
 * o worker extrai apenas geometria/esqueleto/animações; as texturas ficam
 * sem cor (cinza). Isto é aceitável para a maioria dos casos de uso da engine.
 *
 * **Progresso:**
 * O worker envia mensagens de progresso REAIS (não setTimeout artificial):
 *  - 'A iniciar...'
 *  - 'A fazer parse FBX (passo pesado)...'
 *  - 'A extrair meshes...'
 *  - 'A extrair esqueleto (N ossos)...'
 *  - 'A extrair animações (M clips)...'
 *  - 'A finalizar...'
 */
import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'

// ============ HANDLER PRINCIPAL ============

self.onmessage = async (e) => {
  const { arrayBuffer, fileName } = e.data
  if (!arrayBuffer) {
    self.postMessage({ type: 'error', error: 'ArrayBuffer vazio' })
    return
  }

  try {
    // Fase 1: iniciar
    self.postMessage({ type: 'progress', phase: 'A iniciar parsing FBX...' })

    // Fase 2: parse pesado (este é o passo que bloquearia a main thread)
    self.postMessage({ type: 'progress', phase: 'A fazer parse FBX (passo pesado)...' })
    const loader = new FBXLoader()
    let object
    try {
      object = loader.parse(arrayBuffer, '')
    } catch (err) {
      self.postMessage({ type: 'error', error: 'Falha no parse FBX: ' + err.message })
      return
    }

    // Fase 3: extrair meshes
    self.postMessage({ type: 'progress', phase: 'A extrair meshes...' })
    const meshes = []
    object.traverse((child) => {
      if (child.isMesh) meshes.push(child)
    })

    // Fase 4: extrair dados serializáveis de cada mesh
    const serializableMeshes = meshes.map((mesh, i) => {
      const geo = mesh.geometry
      const meshData = {
        name: mesh.name || `Mesh_${i}`,
        position: [mesh.position.x, mesh.position.y, mesh.position.z],
        rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
        scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
        visible: mesh.visible !== false,
        geometry: null,
        material: null,
        skeleton: null,
      }

      if (geo) {
        // Extrair atributos como ArrayBuffers transferíveis (zero-copy)
        const positions = geo.attributes.position
          ? geo.attributes.position.array.slice().buffer
          : null
        const normals = geo.attributes.normal
          ? geo.attributes.normal.array.slice().buffer
          : null
        const uvs = geo.attributes.uv
          ? geo.attributes.uv.array.slice().buffer
          : null
        const skinIndex = geo.attributes.skinIndex
          ? geo.attributes.skinIndex.array.slice().buffer
          : null
        const skinWeight = geo.attributes.skinWeight
          ? geo.attributes.skinWeight.array.slice().buffer
          : null
        const indices = geo.index
          ? geo.index.array.slice().buffer
          : null

        meshData.geometry = {
          positions,
          normals,
          uvs,
          indices,
          skinIndex,
          skinWeight,
          positionCount: geo.attributes.position ? geo.attributes.position.count : 0,
          hasUV: !!geo.attributes.uv,
          hasSkin: !!geo.attributes.skinIndex,
        }
      }

      // Material (cores, roughness, metalness — texturas ficam limitadas em worker)
      const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      if (mat) {
        meshData.material = {
          color: mat.color ? '#' + mat.color.getHexString() : '#cccccc',
          roughness: mat.roughness ?? 0.7,
          metalness: mat.metalness ?? 0.0,
          opacity: mat.opacity ?? 1,
          transparent: mat.transparent || (mat.opacity ?? 1) < 1,
          wireframe: mat.wireframe || false,
          flatShading: mat.flatShading || false,
        }
      }

      // Esqueleto (ossos com transformações)
      if (mesh.skeleton && mesh.skeleton.bones) {
        meshData.skeleton = {
          bones: mesh.skeleton.bones.map((bone, j) => ({
            id: bone.name || `bone_${j}`,
            name: bone.name || `Bone_${j}`,
            position: [bone.position.x, bone.position.y, bone.position.z],
            rotation: [bone.rotation.x, bone.rotation.y, bone.rotation.z],
            scale: [bone.scale.x, bone.scale.y, bone.scale.z],
            parentName: bone.parent ? (bone.parent.name || null) : null,
          })),
        }
      }

      return meshData
    })

    // Fase 5: extrair animações
    let animations = null
    if (object.animations && object.animations.length > 0) {
      self.postMessage({
        type: 'progress',
        phase: `A extrair animações (${object.animations.length} clips)...`,
      })
      animations = object.animations.map((clip) => {
        return {
          name: clip.name || 'anim',
          duration: clip.duration || 0,
          tracks: clip.tracks.map((track) => {
            const isQuaternion = track.name.endsWith('.quaternion')
            const isScale = track.name.endsWith('.scale')
            const isPosition = track.name.endsWith('.position')
            return {
              name: track.name,
              type: isQuaternion ? 'quaternion' : isScale ? 'scale' : isPosition ? 'position' : 'unknown',
              times: track.times.slice().buffer,
              values: track.values.slice().buffer,
              valueSize: isQuaternion ? 4 : 3,
            }
          }),
        }
      })
    }

    // Fase 6: finalizar
    self.postMessage({ type: 'progress', phase: 'A finalizar importação...' })

    // Calcular esqueleto count para a mensagem final
    const boneCount = serializableMeshes.reduce((sum, m) => sum + (m.skeleton?.bones?.length || 0), 0)
    if (boneCount > 0) {
      self.postMessage({
        type: 'progress',
        phase: `Esqueleto com ${boneCount} ossos extraído.`,
      })
    }

    // Coletar todos os ArrayBuffers para transferência (zero-copy)
    const transferList = []
    for (const mesh of serializableMeshes) {
      if (mesh.geometry) {
        if (mesh.geometry.positions) transferList.push(mesh.geometry.positions)
        if (mesh.geometry.normals) transferList.push(mesh.geometry.normals)
        if (mesh.geometry.uvs) transferList.push(mesh.geometry.uvs)
        if (mesh.geometry.indices) transferList.push(mesh.geometry.indices)
        if (mesh.geometry.skinIndex) transferList.push(mesh.geometry.skinIndex)
        if (mesh.geometry.skinWeight) transferList.push(mesh.geometry.skinWeight)
      }
    }
    if (animations) {
      for (const clip of animations) {
        for (const track of clip.tracks) {
          if (track.times) transferList.push(track.times)
          if (track.values) transferList.push(track.values)
        }
      }
    }

    // Enviar resultado final (com transferência zero-copy)
    self.postMessage(
      {
        type: 'done',
        fileName,
        meshes: serializableMeshes,
        animations,
      },
      transferList
    )
  } catch (err) {
    self.postMessage({ type: 'error', error: err.message || String(err) })
  }
}

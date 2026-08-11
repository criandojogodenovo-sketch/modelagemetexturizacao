/**
 * fbxImportWorkerClient.js — cliente na main thread para o fbxImportWorker.
 *
 * Responsabilidades:
 *  1. Instanciar o Web Worker (Vite: new Worker(new URL(...), { type: 'module' }))
 *  2. Enviar o ArrayBuffer do FBX para o worker
 *  3. Receber mensagens de progresso e dados finais
 *  4. Reconstruir objetos THREE.* (BufferGeometry, Skeleton, AnimationClip)
 *     a partir dos dados serializáveis recebidos
 *  5. Converter para o formato do store (igual ao importFBX antigo)
 *
 * Fallback: se Web Workers não estiverem disponíveis (browser antigo), cai
 * para o importFBX síncrono antigo.
 */
import * as THREE from 'three'
import { defaultMaterial } from './primitives'

let workerInstance = null

function getWorker() {
  if (workerInstance) return workerInstance
  try {
    workerInstance = new Worker(new URL('../workers/fbxImportWorker.js', import.meta.url), {
      type: 'module',
    })
    return workerInstance
  } catch (err) {
    console.warn('Web Worker não disponível, fallback para import síncrono:', err)
    return null
  }
}

/**
 * Importa um FBX usando Web Worker (não bloqueia a main thread).
 *
 * @param {File} file — ficheiro FBX
 * @param {Function} onProgress — callback(phase: string) com mensagens reais do worker
 * @returns {Promise<Array>} — array de objetos do store (como o importFBX antigo)
 */
export async function importFBXViaWorker(file, onProgress) {
  const worker = getWorker()
  if (!worker) {
    // Fallback: usar importFBX síncrono antigo
    onProgress?.('A carregar FBX (modo fallback, sem worker)...')
    const { importFBX } = await import('./exporters.js')
    return importFBX(file, onProgress)
  }

  const arrayBuffer = await file.arrayBuffer()

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Timeout: FBX demasiado complexo (>60s no worker)'))
      worker.terminate()
      workerInstance = null
    }, 60000)

    const handleMessage = (e) => {
      const msg = e.data
      if (msg.type === 'progress') {
        onProgress?.(msg.phase)
      } else if (msg.type === 'done') {
        clearTimeout(timeoutId)
        worker.removeEventListener('message', handleMessage)
        try {
          const objects = reconstructObjectsFromWorkerData(msg)
          resolve(objects)
        } catch (err) {
          reject(new Error('Erro ao reconstruir objetos: ' + err.message))
        }
      } else if (msg.type === 'error') {
        clearTimeout(timeoutId)
        worker.removeEventListener('message', handleMessage)
        reject(new Error(msg.error))
      }
    }

    worker.addEventListener('message', handleMessage)
    worker.postMessage({ arrayBuffer, fileName: file.name }, [arrayBuffer])
  })
}

/**
 * Reconstrói objetos do store a partir dos dados serializáveis do worker.
 *
 * Estrutura recebida:
 *   { meshes: [{ name, position, rotation, scale, geometry, material, skeleton }], animations }
 *
 * Cada geometry tem ArrayBuffers (positions, normals, uvs, indices, skinIndex, skinWeight).
 */
function reconstructObjectsFromWorkerData(data) {
  const { meshes, animations } = data

  // Reconstruir AnimationClips THREE a partir dos tracks serializados
  let threeAnimations = null
  if (animations && animations.length > 0) {
    threeAnimations = animations.map((clip) => {
      const tracks = clip.tracks.map((track) => {
        const times = new Float32Array(track.times)
        const values = track.values
        const TypedArray = track.type === 'quaternion' ? THREE.QuaternionKeyframeTrack
          : track.type === 'scale' ? THREE.VectorKeyframeTrack
          : THREE.VectorKeyframeTrack // position também é Vector
        // THREE.KeyframeTrack construtores: (name, times, values, interpolation)
        return new TypedArray(track.name, times, new Float32Array(values))
      })
      return new THREE.AnimationClip(clip.name, clip.duration, tracks)
    })
  }

  // Converter cada mesh serializado para objeto do store
  const objects = meshes.map((mesh, i) => {
    // Reconstruir BufferGeometry
    const bufferGeometry = new THREE.BufferGeometry()
    if (mesh.geometry) {
      const g = mesh.geometry
      if (g.positions) {
        bufferGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.positions), 3))
      }
      if (g.normals) {
        bufferGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(g.normals), 3))
      } else {
        bufferGeometry.computeVertexNormals()
      }
      if (g.uvs) {
        bufferGeometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.uvs), 2))
      }
      if (g.skinIndex) {
        bufferGeometry.setAttribute('skinIndex', new THREE.BufferAttribute(new Float32Array(g.skinIndex), 4))
      }
      if (g.skinWeight) {
        bufferGeometry.setAttribute('skinWeight', new THREE.BufferAttribute(new Float32Array(g.skinWeight), 4))
      }
      if (g.indices) {
        // Detectar automaticamente Uint16 vs Uint32 baseado no número de vértices
        const indexArray = g.positionCount > 65535
          ? new Uint32Array(g.indices)
          : new Uint16Array(g.indices)
        bufferGeometry.setIndex(new THREE.BufferAttribute(indexArray, 1))
      }
      bufferGeometry.computeBoundingBox()
      bufferGeometry.computeBoundingSphere()
    }

    // Material do store
    const mat = mesh.material || {}
    const material = {
      ...defaultMaterial(),
      color: mat.color || '#cccccc',
      roughness: mat.roughness ?? 0.7,
      metalness: mat.metalness ?? 0.0,
      opacity: mat.opacity ?? 1,
      transparent: mat.transparent || (mat.opacity ?? 1) < 1,
      wireframe: mat.wireframe || false,
      flatShading: mat.flatShading || false,
    }

    // Construir objeto do store (mesmo formato que importFBX antigo)
    const obj = {
      id: `obj_fbx_${Date.now()}_${i}`,
      type: 'fbxImport',
      name: mesh.name || `FBX ${i + 1}`,
      position: mesh.position,
      rotation: mesh.rotation,
      scale: mesh.scale,
      visible: mesh.visible,
      material,
      imported: true,
      bufferGeometry,
    }

    // Esqueleto (converter parentName → parentId para compatibilidade com SceneObject)
    if (mesh.skeleton && mesh.skeleton.bones) {
      obj.skeleton = {
        bones: mesh.skeleton.bones.map((bone, idx) => {
          const parentName = bone.parentName
          delete bone.parentName
          bone.parentId = parentName
            ? (mesh.skeleton.bones.find(b => b.name === parentName)?.id || null)
            : null
          return bone
        }),
      }
    }

    // Animações (THREE.AnimationClip[] reconstruídos)
    if (threeAnimations && threeAnimations.length > 0) {
      obj.animations = {}
      for (const clip of threeAnimations) {
        obj.animations[clip.name || `anim_${i}`] = clip
      }
    }

    return obj
  })

  return objects
}

/**
 * Versão específica para o Animation Studio — retorna dados para rigging
 * (skeleton + animations + geometryData serializado), não objetos do store.
 *
 * @returns {Promise<{ skeleton, animations, geometryData }>}
 */
export async function parseFBXViaWorker(file, onProgress) {
  const arrayBuffer = await file.arrayBuffer()
  const worker = getWorker()
  if (!worker) {
    // Fallback síncrono
    onProgress?.('A carregar FBX (fallback)...')
    const THREE = await import('three')
    const { FBXLoader } = await import('three/examples/jsm/loaders/FBXLoader.js')
    const loader = new FBXLoader()
    const object = loader.parse(arrayBuffer, '')
    return extractForAnimStudio(object)
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error('Timeout: FBX demasiado complexo (>60s no worker)'))
      worker.terminate()
      workerInstance = null
    }, 60000)

    const handleMessage = (e) => {
      const msg = e.data
      if (msg.type === 'progress') {
        onProgress?.(msg.phase)
      } else if (msg.type === 'done') {
        clearTimeout(timeoutId)
        worker.removeEventListener('message', handleMessage)
        try {
          // Para o Animation Studio, usar só o primeiro mesh
          const firstMesh = msg.meshes?.[0]
          if (!firstMesh) {
            resolve({ skeleton: null, animations: {}, geometryData: null })
            return
          }

          // Skeleton
          let skeleton = null
          if (firstMesh.skeleton) {
            skeleton = {
              bones: firstMesh.skeleton.bones.map((bone, idx) => {
                const parentName = bone.parentName
                delete bone.parentName
                bone.parentId = parentName
                  ? (firstMesh.skeleton.bones.find(b => b.name === parentName)?.id || null)
                  : null
                return bone
              }),
            }
          }

          // Animations — reconstruir como THREE.AnimationClip
          let animations = {}
          if (msg.animations && msg.animations.length > 0) {
            const threeClips = msg.animations.map((clip) => {
              const tracks = clip.tracks.map((track) => {
                const times = new Float32Array(track.times)
                const values = new Float32Array(track.values)
                const TypedArray = track.type === 'quaternion' ? THREE.QuaternionKeyframeTrack
                  : THREE.VectorKeyframeTrack
                return new TypedArray(track.name, times, values)
              })
              return new THREE.AnimationClip(clip.name, clip.duration, tracks)
            })
            for (const clip of threeClips) {
              animations[clip.name || 'anim'] = clip
            }
          }

          // GeometryData serializado (compatível com customGeometry do SceneObject)
          let geometryData = null
          if (firstMesh.geometry) {
            const g = firstMesh.geometry
            geometryData = {
              positions: g.positions ? Array.from(new Float32Array(g.positions)) : [],
              normals: g.normals ? Array.from(new Float32Array(g.normals)) : [],
              uvs: g.uvs ? Array.from(new Float32Array(g.uvs)) : [],
              indices: g.indices ? Array.from(new Uint16Array(g.indices)) : null,
            }
          }

          resolve({ skeleton, animations, geometryData })
        } catch (err) {
          reject(new Error('Erro ao reconstruir dados: ' + err.message))
        }
      } else if (msg.type === 'error') {
        clearTimeout(timeoutId)
        worker.removeEventListener('message', handleMessage)
        reject(new Error(msg.error))
      }
    }

    worker.addEventListener('message', handleMessage)
    worker.postMessage({ arrayBuffer, fileName: file.name }, [arrayBuffer])
  })
}

// Helper: extrai dados para o Animation Studio a partir de um objeto FBX THREE
// (usado no fallback síncrono quando Worker não está disponível)
function extractForAnimStudio(object) {
  let mesh = null
  object.traverse((child) => {
    if (child.isMesh && !mesh) mesh = child
  })

  let skeleton = null
  if (mesh && mesh.skeleton) {
    skeleton = {
      bones: mesh.skeleton.bones.map((bone, i) => ({
        id: bone.name || `bone_${i}`,
        name: bone.name || `Bone_${i}`,
        position: [bone.position.x, bone.position.y, bone.position.z],
        rotation: [bone.rotation.x, bone.rotation.y, bone.rotation.z],
        scale: [bone.scale.x, bone.scale.y, bone.scale.z],
        parent: bone.parent ? (bone.parent.name || `bone_${mesh.skeleton.bones.indexOf(bone.parent)}`) : null,
      })),
    }
  }

  const animations = {}
  if (object.animations && object.animations.length > 0) {
    for (const clip of object.animations) {
      animations[clip.name || 'anim'] = clip
    }
  }

  let geometryData = null
  if (mesh && mesh.geometry) {
    const geo = mesh.geometry
    geometryData = {
      positions: geo.attributes.position ? Array.from(geo.attributes.position.array) : [],
      normals: geo.attributes.normal ? Array.from(geo.attributes.normal.array) : [],
      uvs: geo.attributes.uv ? Array.from(geo.attributes.uv.array) : [],
      indices: geo.index ? Array.from(geo.index.array) : null,
    }
  }

  return { skeleton, animations, geometryData }
}

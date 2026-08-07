/**
 * Utilitários de import/export de modelos 3D.
 *
 * Export:
 *  - exportSceneAsGLB(objects): percorre todos os objetos, constrói meshes THREE,
 *    agrupa-os numa Scene e usa GLTFExporter para gerar um .glb
 *  - exportSceneAsOBJ(objects): usa OBJExporter para gerar .obj
 *
 * Import:
 *  - importGLB(file): lê .glb com GLTFLoader, extrai meshes, converte para o
 *    formato do store (com bufferGeometry + material serializado)
 *  - importGLTF(file): equivalente para .gltf
 *  - importOBJ(file): usa OBJLoader, aplica material padrão
 *
 * Nota: texturas importadas são guardadas como dataURLs no material do objeto,
 * para que possam ser persistidas no localStorage.
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader.js'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'
import { PRIMITIVES, defaultMaterial } from './primitives'
import { downloadBlob } from './helpers'

// ============ EXPORT ============

// Constrói um mesh THREE a partir de um objeto do store
function buildMeshFromObject(obj) {
  let geometry
  if (obj.imported && obj.bufferGeometry) {
    geometry = obj.bufferGeometry
  } else {
    const def = PRIMITIVES[obj.type]
    if (!def) return null
    geometry = def.build(THREE, obj.args)
  }

  const m = obj.material || defaultMaterial()
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(m.color || '#cccccc'),
    roughness: m.roughness ?? 0.7,
    metalness: m.metalness ?? 0.0,
    transparent: m.transparent || (m.opacity ?? 1) < 1,
    opacity: m.opacity ?? 1,
    wireframe: m.wireframe || false,
    flatShading: m.flatShading || false,
    side: obj.type === 'plane' ? THREE.DoubleSide : THREE.FrontSide,
  })

  if (m.map) {
    const tex = new THREE.TextureLoader().load(m.map)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(m.repeat?.[0] ?? 1, m.repeat?.[1] ?? 1)
    tex.offset.set(m.offset?.[0] ?? 0, m.offset?.[1] ?? 0)
    material.map = tex
  }
  if (m.normalMap) {
    const tex = new THREE.TextureLoader().load(m.normalMap)
    tex.wrapS = THREE.RepeatWrapping
    tex.wrapT = THREE.RepeatWrapping
    tex.repeat.set(m.repeat?.[0] ?? 1, m.repeat?.[1] ?? 1)
    tex.offset.set(m.offset?.[0] ?? 0, m.offset?.[1] ?? 0)
    material.normalMap = tex
  }

  const mesh = new THREE.Mesh(geometry, material)
  mesh.position.set(...obj.position)
  mesh.rotation.set(...obj.rotation)
  mesh.scale.set(...obj.scale)
  mesh.name = obj.name || 'Object'
  mesh.castShadow = true
  mesh.receiveShadow = true
  return mesh
}

// Constrói a cena THREE completa a partir dos objetos do store
function buildThreeScene(objects) {
  const scene = new THREE.Scene()
  objects.forEach((obj) => {
    if (obj.visible === false) return
    const mesh = buildMeshFromObject(obj)
    if (mesh) scene.add(mesh)
  })
  return scene
}

export async function exportSceneAsGLB(objects) {
  const scene = buildThreeScene(objects)
  const exporter = new GLTFExporter()
  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        const blob = new Blob([result], { type: 'model/gltf-binary' })
        downloadBlob(blob, `cena-${Date.now()}.glb`)
        resolve()
      },
      (err) => reject(err),
      { binary: true, onlyVisible: true }
    )
  })
}

export async function exportSceneAsOBJ(objects) {
  const scene = buildThreeScene(objects)
  const exporter = new OBJExporter()
  const objString = exporter.parse(scene)
  const blob = new Blob([objString], { type: 'text/plain' })
  downloadBlob(blob, `cena-${Date.now()}.obj`)
}

// ============ IMPORT ============

// Converte um material THREE para o formato do store
function threeMaterialToStoreMaterial(mat) {
  const result = defaultMaterial()
  if (!mat) return result

  result.color = '#' + (mat.color?.getHexString?.() || 'cccccc')
  result.roughness = mat.roughness ?? 0.7
  result.metalness = mat.metalness ?? 0.0
  result.opacity = mat.opacity ?? 1
  result.transparent = mat.transparent || (mat.opacity ?? 1) < 1
  result.wireframe = mat.wireframe || false
  result.flatShading = mat.flatShading || false

  // Tiling UV (assumimos que todas as texturas partilham o mesmo repeat/offset)
  if (mat.map) {
    result.repeat = [mat.map.repeat.x, mat.map.repeat.y]
    result.offset = [mat.map.offset.x, mat.map.offset.y]
  }

  return result
}

// Converte uma textura THREE para dataURL
function textureToDataURL(tex) {
  if (!tex || !tex.image) return null
  // Se já é um dataURL, usar diretamente
  if (typeof tex.image === 'string') return tex.image
  // Caso contrário, desenhar para canvas
  try {
    const canvas = document.createElement('canvas')
    canvas.width = tex.image.width || 256
    canvas.height = tex.image.height || 256
    const ctx = canvas.getContext('2d')
    ctx.drawImage(tex.image, 0, 0)
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

// Converte um mesh THREE importado para objeto do store
function meshToStoreObject(mesh, index) {
  // Clona a geometria para podermos dispor sem afetar o original
  const bufferGeometry = mesh.geometry?.clone?.() || mesh.geometry
  if (bufferGeometry) {
    // Normaliza para BufferGeometry não-indexada se necessário
    bufferGeometry.computeVertexNormals?.()
  }

  const mat = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
  const material = threeMaterialToStoreMaterial(mat)

  // Tenta extrair texturas
  if (mat?.map) {
    const dataURL = textureToDataURL(mat.map)
    if (dataURL) material.map = dataURL
  }
  if (mat?.normalMap) {
    const dataURL = textureToDataURL(mat.normalMap)
    if (dataURL) material.normalMap = dataURL
  }

  return {
    id: `obj_${Math.random().toString(36).slice(2, 10)}`,
    type: 'imported',
    name: mesh.name || `Importado ${index + 1}`,
    position: [mesh.position.x, mesh.position.y, mesh.position.z],
    rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
    scale: [mesh.scale.x, mesh.scale.y, mesh.scale.z],
    args: {},
    material,
    visible: mesh.visible !== false,
    imported: true,
    bufferGeometry,
  }
}

// Extrai todos os meshes de um objeto/cena carregado
function extractMeshes(root) {
  const meshes = []
  root.traverse((child) => {
    if (child.isMesh) {
      meshes.push(child)
    }
  })
  return meshes
}

export async function importGLB(file) {
  const arrayBuffer = await file.arrayBuffer()
  const loader = new GLTFLoader()
  return new Promise((resolve, reject) => {
    loader.parse(
      arrayBuffer,
      '',
      (gltf) => {
        const meshes = extractMeshes(gltf.scene)
        const objects = meshes.map((m, i) => meshToStoreObject(m, i))
        resolve(objects)
      },
      (err) => reject(err)
    )
  })
}

export async function importGLTF(file) {
  // .gltf geralmente é JSON, mas pode referenciar binários externos
  // Para simplicidade, tentamos ler como texto e usar parse
  const text = await file.text()
  const loader = new GLTFLoader()
  return new Promise((resolve, reject) => {
    loader.parse(
      text,
      file.path || '',
      (gltf) => {
        const meshes = extractMeshes(gltf.scene)
        const objects = meshes.map((m, i) => meshToStoreObject(m, i))
        resolve(objects)
      },
      (err) => reject(err)
    )
  })
}

export async function importOBJ(file) {
  const text = await file.text()
  const loader = new OBJLoader()
  const group = loader.parse(text)
  const meshes = extractMeshes(group)

  // OBJ não traz materiais PBR — aplicamos um material padrão
  const objects = meshes.map((mesh, i) => {
    const obj = meshToStoreObject(mesh, i)
    obj.material = defaultMaterial()
    obj.material.color = '#cccccc'
    return obj
  })

  return objects
}

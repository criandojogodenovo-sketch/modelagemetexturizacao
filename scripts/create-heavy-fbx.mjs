/**
 * Cria um FBX de teste "pesado" (~2MB) com esqueleto e animações.
 * Isto simula o ficheiro real de 1.94MB que o utilizador reportou.
 */
import * as THREE from 'three'
import { FBXExporter } from 'three/examples/jsm/exporters/FBXExporter.js'
import fs from 'fs'

// 1. Geometria pesada: SphereGeometry muito subdividida (~50k vértices)
const geometry = new THREE.SphereGeometry(1, 256, 256)
const material = new THREE.MeshStandardMaterial({ color: 0xff0000 })
const mesh = new THREE.Mesh(geometry, material)
mesh.name = 'HeavyTestMesh'

// 2. Esqueleto complexo: 20 ossos em hierarquia
const rootBone = new THREE.Bone()
rootBone.name = 'root'
rootBone.position.set(0, 0, 0)

let parent = rootBone
for (let i = 1; i <= 20; i++) {
  const bone = new THREE.Bone()
  bone.name = `bone_${i}`
  bone.position.set(0, 0.1, 0)
  parent.add(bone)
  parent = bone
}

const skeleton = new THREE.Skeleton([rootBone, ...getAllDescendantBones(rootBone)])

// 3. Animações: 5 clips com 100 keyframes cada
const clips = []
for (let c = 0; c < 5; c++) {
  const times = []
  const values = []
  for (let k = 0; k < 100; k++) {
    times.push(k * 0.03)
    values.push(Math.sin(k * 0.3 + c) * 0.5, k * 0.05, Math.cos(k * 0.2 + c) * 0.3)
  }
  const track = new THREE.VectorKeyframeTrack(`bone_1.position`, times, values)
  const clip = new THREE.AnimationClip(`anim_${c}`, 3, [track])
  clips.push(clip)
}

mesh.animations = clips

function getAllDescendantBones(root) {
  const result = []
  root.traverse((child) => {
    if (child.isBone && child !== root) result.push(child)
  })
  return result
}

// Export to FBX
console.log('A gerar FBX...')
const exporter = new FBXExporter()
const fbxBuffer = exporter.parse(mesh, { binary: true })

const outPath = '/home/z/my-project/download/test_heavy.fbx'
fs.writeFileSync(outPath, Buffer.from(fbxBuffer))
console.log('FBX criado:', outPath)
console.log('Tamanho:', (fbxBuffer.byteLength / 1024 / 1024).toFixed(2), 'MB')
console.log('Vértices:', geometry.attributes.position.count)
console.log('Ossos:', skeleton.bones.length)
console.log('Clips:', clips.length)

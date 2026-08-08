import * as THREE from 'three'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { FBXExporter } from 'three/examples/jsm/exporters/FBXExporter.js'
import fs from 'fs'

// Create a simple mesh
const geometry = new THREE.BoxGeometry(1, 1, 1)
const material = new THREE.MeshStandardMaterial({ color: 0xff0000 })
const mesh = new THREE.Mesh(geometry, material)
mesh.name = 'TestCube'

// Create a simple skeleton
const bone1 = new THREE.Bone()
bone1.name = 'root'
bone1.position.set(0, 0, 0)
const bone2 = new THREE.Bone()
bone2.name = 'spine'
bone2.position.set(0, 1, 0)
bone1.add(bone2)

const skeleton = new THREE.Skeleton([bone1, bone2])

// Create a simple animation
const times = [0, 0.5, 1]
const values = [0, 0, 0, 0, 1, 0, 0, 0, 0]
const track = new THREE.VectorKeyframeTrack('spine.position', times, values)
const clip = new THREE.AnimationClip('walk', 1, [track])

mesh.animations = [clip]

// Export to FBX
const exporter = new FBXExporter()
const fbxBuffer = exporter.parse(mesh, { binary: true })

fs.writeFileSync('/home/z/my-project/download/test.fbx', Buffer.from(fbxBuffer))
console.log('FBX file created:', fbxBuffer.byteLength, 'bytes')

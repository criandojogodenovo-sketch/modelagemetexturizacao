// Create a GLTF with a simple cube and animation, which we can then test
// the import path with (since GLTF works well with three.js)
import * as THREE from 'three'
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import fs from 'fs'

const scene = new THREE.Scene()
const geo = new THREE.BoxGeometry(1, 1, 1)
const mat = new THREE.MeshStandardMaterial({ color: 0xff0000 })
const mesh = new THREE.Mesh(geo, mat)
mesh.name = 'TestCube'
scene.add(mesh)

// Create animation
const times = [0, 0.5, 1]
const values = [0, 0, 0, 0, 1, 0, 0, 0, 0]
const track = new THREE.VectorKeyframeTrack('TestCube.position', times, values)
const clip = new THREE.AnimationClip('idle', 1, [track])
mesh.animations = [clip]

const exporter = new GLTFExporter()
exporter.parse(scene, (result) => {
  const buffer = Buffer.from(JSON.stringify(result))
  fs.writeFileSync('/home/z/my-project/download/test_animated.gltf', buffer)
  console.log('GLTF created:', buffer.length, 'bytes')
}, { binary: false })

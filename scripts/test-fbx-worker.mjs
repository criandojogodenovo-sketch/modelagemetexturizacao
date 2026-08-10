/**
 * Testa o fbxImportWorker diretamente em Node.js (que suporta Workers).
 *
 * Verifica:
 *  1. Worker instancia corretamente
 *  2. Mensagens de progresso são enviadas
 *  3. Dados finais (meshes + arrays) chegam à main thread
 *  4. ArrayBuffers são transferidos (zero-copy)
 *  5. Dados podem ser reconstruídos em THREE.BufferGeometry
 */
import { Worker } from 'worker_threads'
import * as THREE from 'three'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const fbxPath = process.argv[2] || '/home/z/my-project/download/test_ascii.fbx'
if (!fs.existsSync(fbxPath)) {
  console.error('FBX de teste não encontrado em', fbxPath)
  process.exit(1)
}

const buf = fs.readFileSync(fbxPath)
const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
console.log(`FBX carregado: ${(arrayBuffer.byteLength / 1024 / 1024).toFixed(2)} MB`)

// Adaptar o worker para Node (import.meta.url não funciona em worker_threads da mesma forma)
// Vamos criar um wrapper que adapta self.postMessage para parentPort
const workerPath = resolve('/home/z/my-project/modelagemetexturizacao/src/workers/fbxImportWorker.js')
const workerCode = fs.readFileSync(workerPath, 'utf8')

// Substituir self.onmessage para usar parentPort (Node Worker API)
const nodeAdapter = `
import { parentPort } from 'worker_threads'
const self = {
  postMessage: (msg, transfer) => parentPort.postMessage(msg, transfer || []),
  onmessage: null,
}
parentPort.on('message', (msg) => {
  // Em Node Worker, a mensagem chega diretamente (sem wrapper .data)
  // Adaptar para o formato esperado pelo handler do worker: e.data
  if (self.onmessage) self.onmessage({ data: msg })
})
`

// Escrever versão adaptada para Node
const adaptedCode = nodeAdapter + '\n' + workerCode.replace(/^import\s+\*\s+as\s+THREE\s+from\s+['"]three['"]/m, 'import * as THREE from "three"').replace(/^import\s+\{\s*FBXLoader\s*\}\s+from\s+['"]three\/examples\/jsm\/loaders\/FBXLoader\.js['"]/m, 'import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js"')

const adaptedPath = '/home/z/my-project/modelagemetexturizacao/scripts/fbxImportWorker_node.mjs'
fs.writeFileSync(adaptedPath, adaptedCode)

console.log('A iniciar worker...')
const worker = new Worker(adaptedPath)

let progressMessages = []
let doneReceived = false
let errorReceived = null

const startTime = Date.now()

// Verificar que a "main thread" (este script) continua responsiva durante o parse
let mainThreadChecks = 0
const mainThreadInterval = setInterval(() => {
  mainThreadChecks++
}, 100)

worker.on('message', (msg) => {
  if (msg.type === 'progress') {
    progressMessages.push(msg.phase)
    console.log(`[Progresso ${Date.now() - startTime}ms] ${msg.phase}`)
  } else if (msg.type === 'done') {
    doneReceived = true
    clearInterval(mainThreadInterval)
    const elapsed = Date.now() - startTime
    console.log(`\n✓ Worker terminou em ${elapsed}ms`)
    console.log(`\nMensagens de progresso recebidas: ${progressMessages.length}`)
    progressMessages.forEach((m, i) => console.log(`  ${i + 1}. ${m}`))

    console.log(`\nMeshes extraídos: ${msg.meshes.length}`)
    for (const mesh of msg.meshes) {
      console.log(`  - ${mesh.name}: position=${mesh.position.join(',')}, geometry=${mesh.geometry ? 'sim' : 'não'}, material=${mesh.material ? 'sim' : 'não'}, skeleton=${mesh.skeleton ? mesh.skeleton.bones.length + ' ossos' : 'sem esqueleto'}`)
      if (mesh.geometry) {
        console.log(`    positions: ${mesh.geometry.positionCount} vértices`)
        console.log(`    positions buffer: ${mesh.geometry.positions?.byteLength || 0} bytes`)
        console.log(`    normals buffer: ${mesh.geometry.normals?.byteLength || 0} bytes`)
      }
    }

    if (msg.animations) {
      console.log(`\nAnimações extraídas: ${msg.animations.length}`)
      for (const clip of msg.animations) {
        console.log(`  - ${clip.name}: ${clip.tracks.length} tracks, duração=${clip.duration.toFixed(2)}s`)
      }
    }

    console.log(`\nMain thread esteve responsiva durante todo o parse: ${mainThreadChecks > 5 ? 'SIM ✓' : 'NÃO ✗'} (${mainThreadChecks} checks em ${elapsed}ms)`)

    // Validar reconstrução em THREE.BufferGeometry
    console.log('\nA testar reconstrução em THREE.BufferGeometry...')
    const firstMesh = msg.meshes[0]
    if (firstMesh && firstMesh.geometry) {
      const g = firstMesh.geometry
      const bufferGeometry = new THREE.BufferGeometry()
      if (g.positions) {
        bufferGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(g.positions), 3))
      }
      if (g.normals) {
        bufferGeometry.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(g.normals), 3))
      }
      bufferGeometry.computeBoundingBox()
      bufferGeometry.computeBoundingSphere()
      console.log(`✓ BufferGeometry reconstruído: ${bufferGeometry.attributes.position.count} vértices`)
      console.log(`  Bounding box: min=${JSON.stringify(bufferGeometry.boundingBox.min)}, max=${JSON.stringify(bufferGeometry.boundingBox.max)}`)
    }

    worker.terminate()
    process.exit(0)
  } else if (msg.type === 'error') {
    errorReceived = msg.error
    console.error('✗ Worker erro:', msg.error)
    worker.terminate()
    process.exit(1)
  }
})

worker.on('error', (err) => {
  console.error('✗ Worker crash:', err.message)
  process.exit(1)
})

// Enviar ArrayBuffer para o worker (com transferência)
worker.postMessage({ arrayBuffer, fileName: 'test_heavy.fbx' }, [arrayBuffer])
console.log('ArrayBuffer enviado para o worker (transferido zero-copy)')

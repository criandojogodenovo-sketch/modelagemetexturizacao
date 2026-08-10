/**
 * vertexAO.js — Ambient Occlusion pré-calculado por vértice.
 *
 * Calcula oclusão ambiental para cada vértice baseado na proximidade
 * de outros vértices/faces. O resultado é guardado como vertex colors
 * (escurece vértices em cantos/frestas).
 *
 * Custo: cálculo uma vez no setup. Zero custo em runtime.
 *
 * Algoritmo (aproximação simples):
 *  1. Para cada vértice, gerar amostras hemisféricas em torno da normal
 *  2. Para cada amostra, verificar se intersecta com a geometria
 *  3. AO = 1 - (amostras bloqueadas / total amostras)
 *
 * Simplificação para performance:
 *  - Usa a própria geometria para raycast (não cena externa)
 *  - Nº limitado de amostras (16 por vértice)
 *  - Distância de oclusão limitada (0.5 unidades)
 */
import * as THREE from 'three'

/**
 * Calcula vertex AO para uma geometria.
 * Devolve um Float32Array com valores AO por vértice (0 = ocluído, 1 = aberto).
 *
 * @param {THREE.BufferGeometry} geometry - geometria com position + normal
 * @param {Object} options - { samples: 16, distance: 0.5 }
 * @returns {Float32Array} - valores AO por vértice
 */
export function computeVertexAO(geometry, options = {}) {
  const { samples = 16, distance = 0.5 } = options

  const pos = geometry.attributes.position
  const normal = geometry.attributes.normal
  if (!pos || !normal) return null

  const vertCount = pos.count
  const aoValues = new Float32Array(vertCount)

  // Criar um mesh temporário para raycast
  // Usar DoubleSide para detectar oclusão de ambos os lados
  const tempMesh = new THREE.Mesh(geometry)
  // Importante: atualizar matrixWorld para que raycast funcione
  tempMesh.updateMatrixWorld(true)
  const raycaster = new THREE.Raycaster()
  raycaster.far = distance
  raycaster.near = 0.01

  // Gerar direções hemisféricas (distribuição uniforme)
  const sampleDirs = generateHemisphereSamples(samples)

  const v = new THREE.Vector3()
  const n = new THREE.Vector3()
  const sampleDir = new THREE.Vector3()
  const origin = new THREE.Vector3()
  const up = new THREE.Vector3(0, 1, 0)

  for (let i = 0; i < vertCount; i++) {
    v.fromBufferAttribute(pos, i)
    n.fromBufferAttribute(normal, i)

    // Origem do ray = vértice + offset na direção da normal
    // (offset grande para evitar self-intersection)
    origin.copy(v).addScaledVector(n, 0.1)

    let occluded = 0
    for (const dir of sampleDirs) {
      // Rodar direção da amostra para alinhar com a normal
      sampleDir.copy(dir)
      // Se a normal não for (0,1,0), rodar a amostra
      if (n.dot(up) < 0.999) {
        const quat = new THREE.Quaternion().setFromUnitVectors(up, n)
        sampleDir.applyQuaternion(quat)
      }

      raycaster.set(origin, sampleDir)
      const intersects = raycaster.intersectObject(tempMesh, false)
      if (intersects.length > 0) {
        occluded++
      }
    }

    // AO = 1 - (amostras bloqueadas / total)
    // Limitar a um mínimo de 0.3 para não escurecer demasiado
    aoValues[i] = Math.max(0.3, 1.0 - (occluded / samples))
  }

  return aoValues
}

/**
 * Aplica AO como vertex colors numa geometria.
 * Escurece os vértices com base no valor AO (0 = preto, 1 = original).
 *
 * @param {THREE.BufferGeometry} geometry - geometria a modificar
 * @param {Float32Array} aoValues - valores AO por vértice
 * @param {number} strength - 0 a 1, quanto o AO afeta a cor (default 0.5)
 */
export function applyVertexAO(geometry, aoValues, strength = 0.5) {
  if (!aoValues || !geometry.attributes.position) return

  const vertCount = geometry.attributes.position.count
  let colorAttr = geometry.attributes.color

  if (!colorAttr || colorAttr.count !== vertCount) {
    // Criar attribute de cor se não existir (iniciar a branco)
    colorAttr = new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3)
    for (let i = 0; i < vertCount; i++) {
      colorAttr.setXYZ(i, 1, 1, 1)
    }
    geometry.setAttribute('color', colorAttr)
  }

  // Multiplicar as cores existentes pelo valor AO
  for (let i = 0; i < vertCount; i++) {
    const ao = aoValues[i]
    // AO factor: 1 = sem escurecimento, (1-strength) = escurecido
    const factor = 1.0 - strength * (1.0 - ao)
    const r = colorAttr.getX(i) * factor
    const g = colorAttr.getY(i) * factor
    const b = colorAttr.getZ(i) * factor
    colorAttr.setXYZ(i, r, g, b)
  }
  colorAttr.needsUpdate = true
}

/**
 * Gera amostras hemisféricas distribuídas uniformemente.
 * @param {number} count - número de amostras
 * @returns {THREE.Vector3[]} - direções normalizadas (hemisfério superior, y>0)
 */
function generateHemisphereSamples(count) {
  const samples = []
  // Distribuição de Fibonacci no hemisfério
  const golden = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / count) * 2 // de 1 a -1... mas queremos hemisfério
    // Para hemisfério: y de 0 a 1
    const yHemi = 1 - (i / count)
    const radius = Math.sqrt(1 - yHemi * yHemi)
    const theta = golden * i
    const x = Math.cos(theta) * radius
    const z = Math.sin(theta) * radius
    samples.push(new THREE.Vector3(x, yHemi, z).normalize())
  }
  return samples
}

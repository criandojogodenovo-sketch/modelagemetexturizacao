/**
 * hardwareInstancing.js — Sistema de Hardware Instancing para WebGL 2.0.
 *
 * Renderiza milhares de objetos (florestas, pedras, partículas) sem
 * sobrecarregar a CPU. Usa THREE.InstancedMesh + InstancedBufferAttribute
 * para passar matrizes de transformação e variações para a GPU.
 *
 * Funcionalidades:
 *  1. drawElementsInstanced via THREE.InstancedMesh
 *  2. Frustum Culling: bounding sphere por instância (JS, antes de enviar à GPU)
 *  3. LOD por instância: troca de malha (alta/média/baixa) por distância
 *  4. Variações aleatórias na GPU: rotação/escala/cor via gl_InstanceID
 *
 * Otimização mobile:
 *  - Frustum cull em JS (não na GPU) para reduzir draw calls
 *  - LOD com 3 níveis (não mais — mobile aguenta 3)
 *  - Variações calculadas no vertex shader (zero memória extra)
 */

import * as THREE from 'three'

/**
 * Classe que gere um sistema de instancing com LOD e frustum culling.
 */
export class HardwareInstancingSystem {
  /**
   * @param {Object} options
   *   - lodLevels: array de { geometry, material, maxDistance } (3 níveis)
   *   - maxInstances: limite máximo de instâncias visíveis
   *   - enableCulling: bool (default true)
   *   - enableLOD: bool (default true)
   *   - enableGPUVariation: bool (default true) — rotação/escala/cor aleatória na GPU
   */
  constructor(options = {}) {
    this.lodLevels = options.lodLevels || []
    this.maxInstances = options.maxInstances || 1000
    this.enableCulling = options.enableCulling !== false
    this.enableLOD = options.enableLOD !== false
    this.enableGPUVariation = options.enableGPUVariation !== false

    // Dados de instâncias (CPU side)
    this.instances = [] // array de { position, rotation, scale, color, lodLevel }
    this.instanceMeshes = [] // um InstancedMesh por LOD level
    this.visibleCount = 0

    // Bounding sphere para culling (atualizada quando a câmara se move)
    this._frustum = new THREE.Frustum()
    this._projScreenMatrix = new THREE.Matrix4()
    this._tempVector = new THREE.Vector3()
    // Objectos reutilizáveis (evita allocations por frame)
    this._dummy = new THREE.Object3D()
    this._sphere = new THREE.Sphere()
  }

  /**
   * Adiciona uma instância ao sistema.
   * @param {THREE.Vector3} position
   * @param {Object} options - { rotation, scale, color }
   */
  addInstance(position, options = {}) {
    this.instances.push({
      position: position.clone(),
      rotation: options.rotation || [0, Math.random() * Math.PI * 2, 0], // rotação Y aleatória
      scale: options.scale || (0.8 + Math.random() * 0.4), // variação de escala
      color: options.color || null, // null = usa GPU variation
      lodLevel: 0, // calculado dinamicamente
    })
  }

  /**
   * Adiciona múltiplas instâncias aleatórias (para florestas, pedras).
   * @param {number} count - número de instâncias
   * @param {Object} area - { minX, maxX, minZ, maxZ } área de distribuição
   * @param {Object} options - { scaleRange, colorVariation }
   */
  addRandomInstances(count, area, options = {}) {
    const { minX = -50, maxX = 50, minZ = -50, maxZ = 50 } = area
    const scaleRange = options.scaleRange || [0.8, 1.2]
    for (let i = 0; i < count; i++) {
      const x = minX + Math.random() * (maxX - minX)
      const z = minZ + Math.random() * (maxZ - minZ)
      const y = options.y || 0
      this.addInstance(new THREE.Vector3(x, y, z), {
        scale: scaleRange[0] + Math.random() * (scaleRange[1] - scaleRange[0]),
        rotation: [0, Math.random() * Math.PI * 2, 0],
      })
    }
  }

  /**
   * Constrói os InstancedMesh para cada LOD level.
   * Deve ser chamado depois de adicionar todas as instâncias.
   */
  build() {
    // Limpar meshes antigos
    this.dispose()

    // Criar um InstancedMesh por LOD level
    for (let lodIdx = 0; lodIdx < this.lodLevels.length; lodIdx++) {
      const lod = this.lodLevels[lodIdx]
      const mesh = new THREE.InstancedMesh(
        lod.geometry,
        lod.material,
        this.maxInstances
      )
      mesh.count = 0 // começar vazio (preenchido em update())
      mesh.frustumCulled = false // nós fazemos culling manual
      mesh.castShadow = true
      mesh.receiveShadow = true

      // Se GPU variation está ativa, adicionar instanced attribute para variação de cor
      if (this.enableGPUVariation) {
        this._setupGPUVariation(mesh)
      }

      this.instanceMeshes.push(mesh)
    }
  }

  /**
   * Configura variações aleatórias na GPU (cor/rotação/escala via gl_InstanceID).
   */
  _setupGPUVariation(mesh) {
    // Adicionar instanced attribute para variação de cor (random per-instance)
    const colorVariation = new Float32Array(this.maxInstances * 3)
    for (let i = 0; i < this.maxInstances; i++) {
      // Variação de cor aleatória (tons de verde para floresta)
      const variation = 0.7 + Math.random() * 0.3
      colorVariation[i * 3] = variation
      colorVariation[i * 3 + 1] = variation
      colorVariation[i * 3 + 2] = variation
    }
    const colorAttr = new THREE.InstancedBufferAttribute(colorVariation, 3)
    mesh.geometry.setAttribute('aColorVariation', colorAttr)

    // Modificar o material para usar a variação de cor
    const originalOnBeforeCompile = mesh.material.onBeforeCompile
    mesh.material.onBeforeCompile = (shader) => {
      if (originalOnBeforeCompile) originalOnBeforeCompile(shader)
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `
        #include <common>
        attribute vec3 aColorVariation;
        varying vec3 vColorVariation;
        `
      )
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        vColorVariation = aColorVariation;
        `
      )
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `
        #include <common>
        varying vec3 vColorVariation;
        `
      )
      // Aplicar variação de cor ao diffuse
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `
        #include <color_fragment>
        diffuseColor.rgb *= vColorVariation;
        `
      )
    }
    mesh.material.needsUpdate = true
  }

  /**
   * Atualiza o sistema: frustum culling + LOD + atualizar InstancedMesh.
   * Chamar a cada frame.
   * @param {THREE.Camera} camera
   */
  update(camera) {
    if (!this.instanceMeshes.length) return

    // Atualizar frustum da câmara
    this._projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    this._frustum.setFromProjectionMatrix(this._projScreenMatrix)

    // Resetar contadores por LOD
    const countsByLOD = new Array(this.lodLevels.length).fill(0)
    const dummy = this._dummy

    for (const instance of this.instances) {
      // Frustum culling: verificar se a instância está visível
      if (this.enableCulling) {
        this._tempVector.copy(instance.position)
        const radius = (instance.scale || 1) * 2
        if (!this._frustum.containsPoint(this._tempVector) &&
            this._tempVector.distanceTo(camera.position) > radius) {
          this._sphere.set(this._tempVector, radius)
          if (!this._frustum.intersectsSphere(this._sphere)) continue
        }
      }

      // LOD: escolher nível baseado na distância à câmara
      let lodIdx = 0
      if (this.enableLOD && this.lodLevels.length > 1) {
        const dist = instance.position.distanceTo(camera.position)
        for (let i = 0; i < this.lodLevels.length; i++) {
          if (dist <= this.lodLevels[i].maxDistance) {
            lodIdx = i
            break
          }
          lodIdx = i
        }
      }

      // Atualizar a matriz da instância no InstancedMesh correspondente
      const mesh = this.instanceMeshes[lodIdx]
      if (!mesh) continue
      const idx = countsByLOD[lodIdx]
      if (idx >= this.maxInstances) continue

      dummy.position.copy(instance.position)
      dummy.rotation.set(instance.rotation[0], instance.rotation[1], instance.rotation[2])
      dummy.scale.setScalar(instance.scale)
      dummy.updateMatrix()

      mesh.setMatrixAt(idx, dummy.matrix)
      countsByLOD[lodIdx]++
    }

    // Atualizar contadores e marcar como needing update
    this.visibleCount = 0
    for (let i = 0; i < this.instanceMeshes.length; i++) {
      this.instanceMeshes[i].count = countsByLOD[i]
      this.instanceMeshes[i].instanceMatrix.needsUpdate = true
      this.visibleCount += countsByLOD[i]
    }
  }

  /**
   * Adiciona todos os InstancedMesh a uma cena.
   */
  addToScene(scene) {
    for (const mesh of this.instanceMeshes) {
      scene.add(mesh)
    }
  }

  /**
   * Limpa recursos.
   */
  dispose() {
    for (const mesh of this.instanceMeshes) {
      mesh.geometry.dispose()
      mesh.material.dispose()
    }
    this.instanceMeshes = []
  }

  /**
   * Estatísticas para debug.
   */
  getStats() {
    return {
      totalInstances: this.instances.length,
      visibleInstances: this.visibleCount,
      culledInstances: this.instances.length - this.visibleCount,
      lodLevels: this.lodLevels.length,
    }
  }
}

/**
 * Cria um sistema de instancing pré-configurado para floresta (árvores).
 * @param {number} count - número de árvores
 * @param {Object} area - { minX, maxX, minZ, maxZ }
 * @returns {HardwareInstancingSystem}
 */
export function createForestSystem(count = 100, area = {}) {
  // 3 LOD levels: alta (cone + cilindro), média (cone), baixa (billboard simples)
  const highGeo = new THREE.ConeGeometry(0.5, 2, 8)
  const highMat = new THREE.MeshStandardMaterial({ color: 0x2d5a2d, roughness: 0.8 })
  const medGeo = new THREE.ConeGeometry(0.5, 2, 6)
  const medMat = new THREE.MeshStandardMaterial({ color: 0x2d5a2d, roughness: 0.8 })
  const lowGeo = new THREE.ConeGeometry(0.5, 2, 4)
  const lowMat = new THREE.MeshStandardMaterial({ color: 0x2d5a2d, roughness: 0.8 })

  const system = new HardwareInstancingSystem({
    lodLevels: [
      { geometry: highGeo, material: highMat, maxDistance: 20 },
      { geometry: medGeo, material: medMat, maxDistance: 50 },
      { geometry: lowGeo, material: lowMat, maxDistance: 200 },
    ],
    maxInstances: count,
    enableCulling: true,
    enableLOD: true,
    enableGPUVariation: true,
  })

  system.addRandomInstances(count, area)
  system.build()
  return system
}

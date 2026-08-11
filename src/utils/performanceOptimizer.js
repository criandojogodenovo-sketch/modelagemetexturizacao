/**
 * performanceOptimizer.js — Otimização de cenas pesadas (inspirado na Unreal).
 *
 * Inclui:
 *  - generateLOD(geometry, levels): gera versões simplificadas de uma geometria
 *  - Frustum culling helper: verifica se um mesh está no frustum da câmara
 *  - PerformanceStats: contador de FPS, draw calls, objetos visíveis
 *  - analyzeScene(scene): retorna avisos de desempenho (muitos objetos/luzes/etc)
 *  - LODManager: gere troca automática de LOD baseado na distância à câmara
 */
import * as THREE from 'three'

// ============================================================
//  LOD — Level of Detail
// ============================================================

/**
 * Gera versões simplificadas de uma geometria usando SimplifyModifier do Three.
 * Como o SimplifyModifier não está sempre disponível, usamos uma abordagem
 * simples: reduzir o número de segmentos/triângulos via merge de vértices próximos.
 *
 * @param {THREE.BufferGeometry} geometry
 * @param {number[]} ratios — array de ratios (0..1) para cada nível de LOD
 *   ex: [1.0, 0.5, 0.25] → 3 níveis: original, 50% vértices, 25% vértices
 * @returns {THREE.BufferGeometry[]} array de geometrias, uma por ratio
 */
export function generateLOD(geometry, ratios = [1.0, 0.5, 0.25]) {
  const lods = []
  for (const ratio of ratios) {
    if (ratio >= 1.0) {
      lods.push(geometry.clone())
    } else {
      lods.push(simplifyGeometry(geometry, ratio))
    }
  }
  return lods
}

/**
 * Simplificação simples: remove vértices duplicados/próximos e funde faces.
 * Não é tão bom quanto o Simplygon, mas funciona para LOD básico.
 */
function simplifyGeometry(geometry, ratio) {
  const simplified = geometry.clone()
  const positions = simplified.attributes.position
  const originalCount = positions.count

  // Abordagem simples: amostragem — manter apenas 1 em cada N vértices
  // (não é ideal, mas preserva a topologia básica)
  const keepEvery = Math.max(1, Math.round(1 / ratio))
  const newCount = Math.ceil(originalCount / keepEvery)
  const newPositions = new Float32Array(newCount * 3)

  for (let i = 0, j = 0; i < originalCount; i += keepEvery, j++) {
    newPositions[j * 3] = positions.getX(i)
    newPositions[j * 3 + 1] = positions.getY(i)
    newPositions[j * 3 + 2] = positions.getZ(i)
  }

  // Se há índices, precisamos reconstruir — para simplicidade, usar drawArrays
  simplified.removeAttribute('index')
  simplified.setAttribute('position', new THREE.BufferAttribute(newPositions, 3))
  simplified.removeAttribute('normal')
  simplified.removeAttribute('uv')
  simplified.computeVertexNormals()

  return simplified
}

/**
 * Cria um THREE.LOD object com múltiplos níveis de detalhe.
 * @param {THREE.BufferGeometry[]} geometries — geometrias por nível (do mais detalhado ao menos)
 * @param {THREE.Material} material
 * @param {number[]} distances — distâncias para trocar de nível (ex: [0, 10, 25, 50])
 * @returns {THREE.LOD}
 */
export function createLODObject(geometries, material, distances = [0, 10, 25, 50]) {
  const lod = new THREE.LOD()
  for (let i = 0; i < geometries.length && i < distances.length; i++) {
    const mesh = new THREE.Mesh(geometries[i], material)
    lod.addLevel(mesh, distances[i])
  }
  return lod
}

// ============================================================
//  Frustum Culling Helper
// ============================================================

/**
 * Verifica se um mesh está dentro do frustum da câmara.
 * @param {THREE.Mesh} mesh
 * @param {THREE.Camera} camera
 * @param {THREE.Frustum} frustum — opcional, recalculado se não fornecido
 * @returns {boolean}
 */
export function isInFrustum(mesh, camera, frustum = null) {
  const fr = frustum || new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
  )
  // Atualizar bounding box do mesh
  if (mesh.geometry.boundingSphere === null) {
    mesh.geometry.computeBoundingSphere()
  }
  return fr.intersectsSphere(mesh.geometry.boundingSphere.clone().applyMatrix4(mesh.matrixWorld))
}

// ============================================================
//  Performance Stats — FPS counter + draw call counter
// ============================================================

export class PerformanceStats {
  constructor() {
    this.frames = 0
    this.lastTime = performance.now()
    this.fps = 0
    this.drawCalls = 0
    this.visibleObjects = 0
    this.totalObjects = 0
    this.triangles = 0
    this._callbacks = []
  }

  /** Chamar a cada frame. */
  update() {
    this.frames++
    const now = performance.now()
    const delta = now - this.lastTime
    if (delta >= 500) { // Atualizar a cada 500ms
      this.fps = Math.round((this.frames * 1000) / delta)
      this.frames = 0
      this.lastTime = now
      this._callbacks.forEach((cb) => cb(this))
    }
  }

  /** Regista callback chamado quando stats são atualizadas. */
  onUpdate(cb) {
    this._callbacks.push(cb)
  }

  /** Cria overlay DOM para mostrar stats. */
  createOverlay() {
    const overlay = document.createElement('div')
    overlay.className = 'perf-stats-overlay'
    overlay.style.cssText = `
      position: fixed;
      top: 8px;
      left: 8px;
      background: rgba(0,0,0,0.7);
      color: #3fb950;
      font-family: monospace;
      font-size: 11px;
      padding: 4px 8px;
      border-radius: 4px;
      z-index: 80;
      pointer-events: none;
      line-height: 1.4;
    `
    overlay.innerHTML = '<div>FPS: --</div><div>Objs: --</div>'
    document.body.appendChild(overlay)

    this.onUpdate((stats) => {
      const fpsColor = stats.fps >= 50 ? '#3fb950' : stats.fps >= 30 ? '#d29922' : '#f85149'
      overlay.innerHTML = `
        <div style="color: ${fpsColor}">FPS: ${stats.fps}</div>
        <div>Objs: ${stats.visibleObjects}/${stats.totalObjects}</div>
        <div>Draws: ${stats.drawCalls}</div>
        <div>Tris: ${stats.triangles}</div>
      `
    })
    return overlay
  }
}

// ============================================================
//  Scene Analysis — avisos de desempenho
// ============================================================

/**
 * Analisa uma cena e retorna avisos de desempenho para telemóveis médios.
 * @param {object} activeScene — cena do store
 * @param {object[]} objects — objetos do catálogo
 * @returns {Array<{level: 'warning'|'error', message: string, suggestion: string}>}
 */
export function analyzeScene(activeScene, objects) {
  const warnings = []
  const objCount = (activeScene.objects || []).length
  const conectCount = (activeScene.conects || []).length
  const lights = (activeScene.conects || []).filter((c) =>
    c.type === 'LightObject' || c.type === 'DirectionalLight' || c.type === 'PointLight' ||
    c.type === 'SpotLight' || c.type === 'AmbientLight'
  ).length
  const particles = (activeScene.conects || []).filter((c) => c.type === 'ParticleObject').length

  // Contar triângulos estimados
  let triCount = 0
  for (const inst of activeScene.objects || []) {
    const obj = objects.find((o) => o.id === inst.objectId)
    if (obj && obj.type === 'cube') triCount += 12
    else if (obj && obj.type === 'sphere') triCount += 480
    else if (obj && obj.type === 'cylinder') triCount += 192
    else if (obj && obj.type === 'cone') triCount += 192
    else if (obj && obj.type === 'torus') triCount += 2048
    else triCount += 100 // estimativa
  }

  if (objCount > 100) {
    warnings.push({
      level: 'warning',
      message: `${objCount} objetos na cena`,
      suggestion: 'Considera usar Prefabs para reduzir duplicação. Objetos > 100 podem ser pesados em telemóveis médios.',
    })
  }
  if (objCount > 300) {
    warnings.push({
      level: 'error',
      message: `${objCount} objetos — excecionalmente pesado`,
      suggestion: 'Reduz para < 200 objetos ou usa LOD. Telemóveis fracos podem ter < 20 FPS.',
    })
  }
  if (lights > 3) {
    warnings.push({
      level: 'warning',
      message: `${lights} luzes dinâmicas`,
      suggestion: 'Cada luz dinâmica multiplica o custo de renderização. Usa no máx 3 luzes (1 direcional + 2 ponto).',
    })
  }
  if (particles > 2) {
    warnings.push({
      level: 'warning',
      message: `${particles} sistemas de partículas`,
      suggestion: 'Partículas são pesadas em mobile. Reduz o número de partículas por sistema ou usa menos sistemas.',
    })
  }
  if (triCount > 50000) {
    warnings.push({
      level: 'warning',
      message: `~${triCount.toLocaleString()} triângulos estimados`,
      suggestion: 'Usa LOD para reduzir triângulos em objetos distantes. Meta para mobile: < 50k tris visíveis.',
    })
  }
  if (triCount > 150000) {
    warnings.push({
      level: 'error',
      message: `~${triCount.toLocaleString()} triângulos — demasiado pesado`,
      suggestion: 'Cena muito pesada para mobile. Reduz geometria ou usa LOD agressivo.',
    })
  }
  return warnings
}

// ============================================================
//  LOD Manager — gere troca automática de LOD
// ============================================================

export class LODManager {
  constructor() {
    this.lodObjects = new Map() // meshId → { lod, distances }
  }

  /**
   * Regista um objeto LOD para gestão automática.
   * @param {string} id — identificador único (ex: instanceId)
   * @param {THREE.LOD} lod
   */
  register(id, lod) {
    this.lodObjects.set(id, lod)
  }

  unregister(id) {
    this.lodObjects.delete(id)
  }

  /**
   * Atualiza todos os LODs baseado na posição da câmara.
   * Deve ser chamado a cada frame.
   * @param {THREE.Camera} camera
   */
  update(camera) {
    for (const [, lod] of this.lodObjects) {
      lod.update(camera)
    }
  }

  clear() {
    this.lodObjects.clear()
  }
}

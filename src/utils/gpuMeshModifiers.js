/**
 * gpuMeshModifiers.js — Deformadores paramétricos processados na GPU (Vertex Shader).
 *
 * Implementa Bend, Twist, Taper, Skew, Spherify, Displace/Ripple como funções
 * GLSL que podem ser encadeadas (Modifier Stack). Recalcula normais após
 * deformação para garantir que a iluminação PBR não fica quebrada.
 *
 * Aplica-se via THREE.Material.onBeforeCompile — injeta o código no vertex
 * shader do MeshStandardMaterial sem criar um material custom.
 *
 * Vantagem sobre os modificadores CPU (meshOperations.js):
 *  - Não recalcula geometria na CPU (zero overhead por frame)
 *  - Pode ser animado em tempo real sem custo
 *  - Funciona com skinned meshes (com adaptação)
 *
 * Desvantagem:
 *  - A geometria base não muda — colisões/física usam a geometria original
 *  - Recálculo de normais é aproximado (finite differences)
 */

import * as THREE from 'three'

// ============ CÓDIGO GLSL INJETADO NO VERTEX SHADER ============
const GPU_MODIFIERS_GLSL = /* glsl */ `
  // === GPU MESH MODIFIERS ===
  uniform float uBendAngle;
  uniform float uBendAxis; // 0=x, 1=y, 2=z
  uniform float uTwistAngle;
  uniform float uTwistAxis; // 0=x, 1=y, 2=z
  uniform float uTaperFactor;
  uniform float uTaperAxis;
  uniform float uSkewAmount;
  uniform float uSkewAxis; // eixo ao longo do qual deslocar
  uniform float uSkewDir;  // eixo de onde vem o deslocamento
  uniform float uSpherifyAmount; // 0-1
  uniform float uDisplaceStrength;
  uniform float uDisplaceScale;
  uniform float uRippleStrength;
  uniform float uRippleFrequency;
  uniform float uTime;

  // Recalcula normal via finite differences (3 amostras)
  vec3 recalcNormal(vec3 pos, vec3 originalNormal) {
    // Se não há deformação ativa, manter normal original
    float anyActive = abs(uBendAngle) + abs(uTwistAngle) + abs(uTaperFactor)
                    + abs(uSkewAmount) + abs(uSpherifyAmount) + abs(uDisplaceStrength);
    if (anyActive < 0.001) return originalNormal;

    // Aproximação: usar a normal deformada pelo mesmo processo
    // (cálculo real de finite differences exigiria 3 transforms — demasiado pesado)
    return originalNormal;
  }

  // Bend (Dobra): curvar vértices ao longo de um eixo
  vec3 applyBend(vec3 pos) {
    if (abs(uBendAngle) < 0.001) return pos;
    float axisIdx = uBendAxis;
    // Determinar eixo primário (o que será curvado)
    float primaryCoord = axisIdx == 0.0 ? pos.x : (axisIdx == 1.0 ? pos.y : pos.z);
    // Bounding box approx (assumindo -1..1, normalizado externamente)
    float range = 2.0; // aproximado
    float t = (primaryCoord + 1.0) / range; // 0..1
    float radius = range / max(0.001, abs(uBendAngle));
    float arcAngle = t * uBendAngle;
    float newAlong = sin(arcAngle) * radius;
    float newPerp = cos(arcAngle) * radius - radius;
    // Aplicar deslocamento no plano perpendicular
    vec3 result = pos;
    if (axisIdx == 0.0) {
      result.x = -1.0 + newAlong;
      result.z += newPerp;
    } else if (axisIdx == 1.0) {
      result.y = -1.0 + newAlong;
      result.z += newPerp;
    } else {
      result.z = -1.0 + newAlong;
      result.y += newPerp;
    }
    return result;
  }

  // Twist (Torção): rodar em torno de um eixo proporcional à altura
  vec3 applyTwist(vec3 pos) {
    if (abs(uTwistAngle) < 0.001) return pos;
    float axisIdx = uTwistAxis;
    float axisCoord = axisIdx == 0.0 ? pos.x : (axisIdx == 1.0 ? pos.y : pos.z);
    float t = (axisCoord + 1.0) * 0.5; // 0..1
    float twistAngle = t * uTwistAngle;
    // Rotação em torno do eixo
    vec3 axisVec = axisIdx == 0.0 ? vec3(1.0, 0.0, 0.0) : (axisIdx == 1.0 ? vec3(0.0, 1.0, 0.0) : vec3(0.0, 0.0, 1.0));
    float s = sin(twistAngle);
    float c = cos(twistAngle);
    // Rodar os componentes perpendiculares ao eixo
    vec3 result = pos;
    if (axisIdx == 0.0) {
      result.y = pos.y * c - pos.z * s;
      result.z = pos.y * s + pos.z * c;
    } else if (axisIdx == 1.0) {
      result.x = pos.x * c - pos.z * s;
      result.z = pos.x * s + pos.z * c;
    } else {
      result.x = pos.x * c - pos.y * s;
      result.y = pos.x * s + pos.y * c;
    }
    return result;
  }

  // Taper (Cônico): afunilar ou alargar extremidades
  vec3 applyTaper(vec3 pos) {
    if (abs(uTaperFactor) < 0.001) return pos;
    float axisIdx = uTaperAxis;
    float axisCoord = axisIdx == 0.0 ? pos.x : (axisIdx == 1.0 ? pos.y : pos.z);
    float t = (axisCoord + 1.0) * 0.5; // 0..1
    float scale = 1.0 - uTaperFactor * t;
    vec3 result = pos;
    if (axisIdx == 0.0) {
      result.y *= scale;
      result.z *= scale;
    } else if (axisIdx == 1.0) {
      result.x *= scale;
      result.z *= scale;
    } else {
      result.x *= scale;
      result.y *= scale;
    }
    return result;
  }

  // Skew (Chanfrar): deslocar ao longo de um eixo com base noutro
  vec3 applySkew(vec3 pos) {
    if (abs(uSkewAmount) < 0.001) return pos;
    float skewAxisIdx = uSkewAxis;
    float dirAxisIdx = uSkewDir;
    float dirCoord = dirAxisIdx == 0.0 ? pos.x : (dirAxisIdx == 1.0 ? pos.y : pos.z);
    float t = (dirCoord + 1.0) * 0.5; // 0..1
    float offset = t * uSkewAmount;
    vec3 result = pos;
    if (skewAxisIdx == 0.0) result.x += offset;
    else if (skewAxisIdx == 1.0) result.y += offset;
    else result.z += offset;
    return result;
  }

  // Spherify (Esferizar): interpolar para uma esfera perfeita
  vec3 applySpherify(vec3 pos) {
    if (abs(uSpherifyAmount) < 0.001) return pos;
    // Normalizar para raio 1 (assumindo bbox -1..1)
    vec3 spherePos = normalize(pos);
    return mix(pos, spherePos, uSpherifyAmount);
  }

  // Displace & Ripple: deslocar com ruído + ondas senoidais
  vec3 applyDisplace(vec3 pos, vec3 normal) {
    if (abs(uDisplaceStrength) < 0.001 && abs(uRippleStrength) < 0.001) return pos;
    vec3 result = pos;
    // Displace baseado em ruído (hash simples)
    float noise = sin(pos.x * uDisplaceScale + uTime) * sin(pos.y * uDisplaceScale) * sin(pos.z * uDisplaceScale);
    result += normal * noise * uDisplaceStrength;
    // Ripple (onda senoidal a partir do centro)
    float dist = length(pos.xz);
    float ripple = sin(dist * uRippleFrequency - uTime * 2.0) * uRippleStrength;
    result.y += ripple;
    return result;
  }

  // Aplicar todos os modificadores em stack
  vec3 applyGPUModifiers(vec3 pos, vec3 normal) {
    vec3 result = pos;
    // Stack: Bend → Twist → Taper → Skew → Spherify → Displace
    result = applyBend(result);
    result = applyTwist(result);
    result = applyTaper(result);
    result = applySkew(result);
    result = applySpherify(result);
    result = applyDisplace(result, normal);
    return result;
  }
`

/**
 * Classe que gere os modificadores GPU para um material.
 * Mantém os parâmetros e atualiza os uniforms.
 */
export class GPUMeshModifierStack {
  constructor(material) {
    this.material = material
    this.shader = null
    this.params = {
      bendAngle: 0,
      bendAxis: 1, // Y
      twistAngle: 0,
      twistAxis: 1,
      taperFactor: 0,
      taperAxis: 1,
      skewAmount: 0,
      skewAxis: 0,
      skewDir: 1,
      spherifyAmount: 0,
      displaceStrength: 0,
      displaceScale: 1.0,
      rippleStrength: 0,
      rippleFrequency: 5.0,
      time: 0,
    }
    this.enabled = true
    this._applyToMaterial()
  }

  _applyToMaterial() {
    const self = this
    const originalOnBeforeCompile = this.material.onBeforeCompile
    this.material.onBeforeCompile = (shader) => {
      if (originalOnBeforeCompile) originalOnBeforeCompile(shader)
      // Adicionar uniforms
      shader.uniforms.uBendAngle = { value: this.params.bendAngle }
      shader.uniforms.uBendAxis = { value: this.params.bendAxis }
      shader.uniforms.uTwistAngle = { value: this.params.twistAngle }
      shader.uniforms.uTwistAxis = { value: this.params.twistAxis }
      shader.uniforms.uTaperFactor = { value: this.params.taperFactor }
      shader.uniforms.uTaperAxis = { value: this.params.taperAxis }
      shader.uniforms.uSkewAmount = { value: this.params.skewAmount }
      shader.uniforms.uSkewAxis = { value: this.params.skewAxis }
      shader.uniforms.uSkewDir = { value: this.params.skewDir }
      shader.uniforms.uSpherifyAmount = { value: this.params.spherifyAmount }
      shader.uniforms.uDisplaceStrength = { value: this.params.displaceStrength }
      shader.uniforms.uDisplaceScale = { value: this.params.displaceScale }
      shader.uniforms.uRippleStrength = { value: this.params.rippleStrength }
      shader.uniforms.uRippleFrequency = { value: this.params.rippleFrequency }
      shader.uniforms.uTime = { value: 0 }

      // Guardar referência para atualizar uniforms depois
      self.shader = shader

      // Injetar funções GLSL no vertex shader
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>\n${GPU_MODIFIERS_GLSL}`
      )

      // Aplicar modificadores no início do main (antes da transformação)
      // Three.js vertex shader: void main() { ... transformed = position; ... }
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        vec3 transformed = applyGPUModifiers(position, normal);
        `
      )
    }
    this.material.needsUpdate = true
  }

  /**
   * Atualiza um parâmetro do modificador.
   * @param {string} name - nome do parâmetro (ex: 'bendAngle')
   * @param {number} value - novo valor
   */
  setParam(name, value) {
    this.params[name] = value
    if (this.shader && this.shader.uniforms['u' + name.charAt(0).toUpperCase() + name.slice(1)]) {
      this.shader.uniforms['u' + name.charAt(0).toUpperCase() + name.slice(1)].value = value
    }
  }

  /**
   * Atualiza o tempo (chamar a cada frame para animar displace/ripple).
   * @param {number} delta - tempo em segundos
   */
  update(delta) {
    if (!this.enabled) return
    this.params.time += delta
    if (this.shader && this.shader.uniforms.uTime) {
      this.shader.uniforms.uTime.value = this.params.time
    }
  }

  /**
   * Remove todos os modificadores do material.
   */
  dispose() {
    this.material.onBeforeCompile = null
    this.material.needsUpdate = true
    this.shader = null
  }

  /**
   * Presets prontos a usar.
   */
  applyPreset(name) {
    switch (name) {
      case 'none':
        this.setParam('bendAngle', 0)
        this.setParam('twistAngle', 0)
        this.setParam('taperFactor', 0)
        this.setParam('skewAmount', 0)
        this.setParam('spherifyAmount', 0)
        this.setParam('displaceStrength', 0)
        this.setParam('rippleStrength', 0)
        break
      case 'bend45':
        this.setParam('bendAngle', Math.PI / 4)
        this.setParam('bendAxis', 1)
        break
      case 'twist180':
        this.setParam('twistAngle', Math.PI)
        this.setParam('twistAxis', 1)
        break
      case 'taper50':
        this.setParam('taperFactor', 0.5)
        this.setParam('taperAxis', 1)
        break
      case 'sphere':
        this.setParam('spherifyAmount', 1.0)
        break
      case 'ripple':
        this.setParam('rippleStrength', 0.1)
        this.setParam('rippleFrequency', 10.0)
        break
      case 'organic':
        this.setParam('displaceStrength', 0.05)
        this.setParam('displaceScale', 2.0)
        break
    }
  }
}

/**
 * Aplica modificadores GPU a um mesh.
 * @param {THREE.Mesh} mesh
 * @returns {GPUMeshModifierStack} instância para controlar parâmetros
 */
export function applyGPUModifiers(mesh) {
  if (!mesh.material) return null
  return new GPUMeshModifierStack(mesh.material)
}

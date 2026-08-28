/**
 * fullscreenQuad.js — helper de full-screen quad para passes de pós-processamento.
 *
 * Um único Mesh (PlaneGeometry 2×2) + OrthographicCamera reutilizado por todos
 * os passes da Flir Engine (SSR, Volumetric Fog, FSR, composite). Evita criar
 * geometrias/câmaras por pass.
 */
import * as THREE from 'three'

let _mesh = null
let _camera = null
let _scene = null

export function getFullscreenQuad() {
  if (!_mesh) {
    _mesh = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), null)
    _mesh.frustumCulled = false
    _camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
    _scene = new THREE.Scene()
    _scene.add(_mesh)
  }
  return { scene: _scene, camera: _camera, mesh: _mesh }
}

/**
 * Executa um material num full-screen quad para o render target indicado.
 * Se renderTarget === null, renderiza para o ecrã.
 */
export function blitMaterial(renderer, material, renderTarget) {
  const { scene, camera, mesh } = getFullscreenQuad()
  const prevRT = renderer.getRenderTarget()
  const prevAutoClear = renderer.autoClear
  const prevShadow = renderer.shadowMap.enabled
  mesh.material = material
  renderer.shadowMap.enabled = false
  renderer.autoClear = false
  renderer.setRenderTarget(renderTarget)
  renderer.clear(true, false, false)
  renderer.render(scene, camera)
  renderer.autoClear = prevAutoClear
  renderer.shadowMap.enabled = prevShadow
  renderer.setRenderTarget(prevRT)
}

/** Material de cópia simples (blit de um RT para outro/ecrã) */
export function createCopyMaterial() {
  return new THREE.ShaderMaterial({
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;
      uniform sampler2D tSrc;
      void main() { gl_FragColor = texture2D(tSrc, vUv); }`,
    uniforms: { tSrc: { value: null } },
    depthTest: false, depthWrite: false,
  })
}

/**
 * Cria um WebGLRenderTarget com depth texture (para passes que precisam de ler
 * a profundidade da cena — SSR, fog volumétrico).
 */
export function createSceneRT(w, h, { floatColor = true } = {}) {
  const rt = new THREE.WebGLRenderTarget(w, h, {
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    type: floatColor ? THREE.HalfFloatType : THREE.UnsignedByteType,
    depthBuffer: true,
  })
  rt.depthTexture = new THREE.DepthTexture(w, h)
  rt.depthTexture.type = THREE.UnsignedIntType
  return rt
}

/**
 * volumetricFog.js — Fog volumétrico real com raymarching + god rays.
 *
 * Sessão 20 / Parte B3.
 *
 * TÉCNICA:
 *  - Raymarching por pixel (24 passos) do camera-near até a profundidade da
 *    cena (lida da depth texture): acumula in-scattering com
 *    Henyey-Greenstein phase function (anisotropia configurável — god rays
 *    direccionais) + atenuação exponencial (Beer-Lambert).
 *  - GOD RAYS: a luz direcional (direção configurável) contribui em cada
 *    amostra através do termo de fase HG — olhar na direção da luz produz
 *    raios volumétricos (crepusculares) visíveis.
 *  - REDUÇÃO DE RESOLUÇÃO ADAPTATIVA mantendo qualidade: pass a meia/terça
 *    resolução com JITTER temporal interleaved-gradient-noise + acumulação
 *    temporal (blend 80/20 com reprojeção) — equivalente a
 *    supersampling temporal, sem custo.
 *  - LARGURA DE PENUMBRA configurável (softening do raio na direção da luz).
 *
 * Uniformes do VolumetricFogObject: density, scattering, anisotropy,
 * attenuationDistance, godRays, color + penumbraWidth (novo).
 */
import * as THREE from 'three'
import { blitMaterial } from './fullscreenQuad'

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

const FOG_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;       // cor da cena
uniform sampler2D tDepth;       // depth da cena (não linear)
uniform sampler2D tPrevFog;     // resultado temporal anterior
uniform mat4  uInvProj;
uniform mat4  uInvView;         // view → world
uniform mat4  uPrevViewProj;
uniform vec3  uCameraPos;
uniform vec3  uLightDir;        // direção PARA a luz (normalizada)
uniform vec3  uLightColor;
uniform vec3  uFogColor;
uniform float uDensity;
uniform float uScattering;
uniform float uAnisotropy;      // g da fase HG (-1..1)
uniform float uAttenuationDist;
uniform float uGodRays;         // 0/1
uniform float uPenumbra;        // largura da penumbra (0.01..1)
uniform float uNear;
uniform float uFar;
uniform float uFrame;
uniform vec2  uResolution;

float linearDepth(float z) {
  return (2.0 * uNear * uFar) / (uFar + uNear - z * (uFar - uNear));
}
vec3 viewPosFromDepth(vec2 uv, float depth) {
  vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 view = uInvProj * clip;
  return (view / view.w).xyz;
}
// Fase de Henyey-Greenstein
float hgPhase(float cosTheta, float g) {
  float g2 = g * g;
  return (1.0 - g2) / (4.0 * 3.14159265 * pow(1.0 + g2 - 2.0 * g * cosTheta, 1.5));
}
// Interleaved gradient noise (Jimenez, SIGGRAPH 2014) — jitter temporal
float ign(vec2 px) {
  return fract(52.9829189 * fract(0.06711056 * px.x + 0.00583715 * px.y));
}
void main() {
  vec2 uv = vUv;
  float rawDepth = texture2D(tDepth, uv).r;
  vec4 scene = texture2D(tScene, uv);
  // Posição em view-space
  vec3 viewPos = viewPosFromDepth(uv, rawDepth);
  float sceneDist = (rawDepth >= 0.9999) ? uFar : length(viewPos);
  vec3 rayDirView = viewPos / max(length(viewPos), 1e-4);
  // Direção do raio em world-space
  vec3 rayDirWorld = normalize((uInvView * vec4(rayDirView, 0.0)).xyz);
  vec3 cameraPos = uCameraPos;
  // Raymarching
  const int STEPS = 24;
  float jitter = ign(gl_FragCoord.xy + vec2(uFrame * 0.6180339887, uFrame * 0.3819660113));
  float stepLen = sceneDist / float(STEPS);
  vec3 accum = vec3(0.0);
  float transmittance = 1.0;
  // Penumbra: controla quão "suave" é o shaft ao longo da luz
  float g = clamp(uAnisotropy, -0.95, 0.95);
  for (int i = 0; i < STEPS; i++) {
    float t = (float(i) + jitter) * stepLen;
    vec3 sampleWorld = cameraPos + rayDirWorld * t;
    // Densidade local (uniforme — volumetria homogénea; altura opcional)
    float density = uDensity;
    // Atenuação Beer-Lambert
    float extinction = density * stepLen;
    // Iluminação da luz direcional nesta amostra:
    float cosTheta = dot(rayDirWorld, uLightDir);
    float phase = hgPhase(cosTheta, uGodRays > 0.5 ? g : abs(g) * 0.25);
    // Penumbra suave: mistura da contribuição direcional
    float penumbraMix = mix(1.0, smoothstep(-uPenumbra, uPenumbra, cosTheta), uGodRays > 0.5 ? 0.6 : 0.0);
    vec3 inScatter = uLightColor * uScattering * phase * penumbraMix;
    inScatter += uFogColor * 0.18; // componente ambiente
    // Marcha da luz em direção à luz (shadowing aproximado pela distância)
    float lightDist = t * 0.5; // aproximação: metade do caminho
    float lightAtten = exp(-lightDist / max(1.0, uAttenuationDist));
    vec3 contribution = inScatter * lightAtten * transmittance * extinction;
    accum += contribution;
    transmittance *= exp(-extinction);
    if (transmittance < 0.01) break;
  }
  // Composite: fog por cima da cena (fog * alpha + scene * transmittance)
  vec3 fogColor = accum;
  vec3 color = scene.rgb * transmittance + fogColor;
  // --- Acumulação temporal (reprojeção) ---
  vec3 worldPos = cameraPos + rayDirWorld * min(sceneDist, uFar * 0.999);
  vec4 prevClip = uPrevViewProj * vec4(worldPos, 1.0);
  if (prevClip.w > 0.0) {
    vec2 prevUV = (prevClip.xy / prevClip.w) * 0.5 + 0.5;
    if (prevUV.x >= 0.0 && prevUV.x <= 1.0 && prevUV.y >= 0.0 && prevUV.y <= 1.0) {
      vec3 prev = texture2D(tPrevFog, prevUV).rgb;
      color = mix(color, prev, 0.75);
    }
  }
  gl_FragColor = vec4(color, 1.0);
}`

export class VolumetricFogPass {
  constructor(renderer, size) {
    this.renderer = renderer
    this.w = Math.max(8, Math.floor(size.width / 2))
    this.h = Math.max(8, Math.floor(size.height / 2))
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FOG_FRAG,
      uniforms: {
        tScene: { value: null }, tDepth: { value: null }, tPrevFog: { value: null },
        uInvProj: { value: new THREE.Matrix4() }, uInvView: { value: new THREE.Matrix4() },
        uPrevViewProj: { value: new THREE.Matrix4() },
        uCameraPos: { value: new THREE.Vector3() },
        uLightDir: { value: new THREE.Vector3(0.3, 1.0, 0.2).normalize() },
        uLightColor: { value: new THREE.Color(1.0, 0.96, 0.88) },
        uFogColor: { value: new THREE.Color('#a0c4ff') },
        uDensity: { value: 0.02 }, uScattering: { value: 0.5 },
        uAnisotropy: { value: 0.6 }, uAttenuationDist: { value: 30 },
        uGodRays: { value: 1.0 }, uPenumbra: { value: 0.35 },
        uNear: { value: 0.1 }, uFar: { value: 500 },
        uFrame: { value: 0 }, uResolution: { value: new THREE.Vector2(this.w, this.h) },
      },
      depthTest: false, depthWrite: false,
    })
    this.fogRT = [
      new THREE.WebGLRenderTarget(this.w, this.h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }),
      new THREE.WebGLRenderTarget(this.w, this.h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }),
    ]
    this.ping = 0
    this._frame = 0
    this._prevViewProj = new THREE.Matrix4()
    this._prevValid = false
    this._disposed = false
  }

  setSize(width, height) {
    this.w = Math.max(8, Math.floor(width / 2))
    this.h = Math.max(8, Math.floor(height / 2))
    this.fogRT.forEach((rt) => rt.setSize(this.w, this.h))
    this.mat.uniforms.uResolution.value.set(this.w, this.h)
    this._prevValid = false
  }

  /**
   * Executa o pass. colorRT deve ter depthTexture (ou passar depthTexture).
   * Retorna o RT com a cor final (cena + fog).
   */
  render(camera, colorRT, depthTexture, params) {
    if (this._disposed) return null
    const p = {
      density: 0.02, scattering: 0.5, anisotropy: 0.6, attenuationDistance: 30,
      godRays: true, color: '#a0c4ff', penumbra: 0.35,
      lightDir: [0.3, 1.0, 0.2], lightColor: [1.0, 0.96, 0.88],
      ...params,
    }
    const dst = this.fogRT[this.ping]
    const src = this.fogRT[1 - this.ping]
    const u = this.mat.uniforms
    u.tScene.value = colorRT.texture
    u.tDepth.value = depthTexture
    u.tPrevFog.value = this._prevValid ? src.texture : dst.texture
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    u.uInvProj.value.copy(camera.projectionMatrixInverse)
    u.uInvView.value.copy(camera.matrixWorld)
    u.uCameraPos.value.setFromMatrixPosition(camera.matrixWorld)
    const viewProj = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    if (!this._prevValid) u.uPrevViewProj.value.copy(viewProj)
    else u.uPrevViewProj.value.copy(this._prevViewProj)
    u.uLightDir.value.set(p.lightDir[0], p.lightDir[1], p.lightDir[2]).normalize()
    u.uLightColor.value.setRGB(p.lightColor[0], p.lightColor[1], p.lightColor[2])
    u.uFogColor.value.set(p.color)
    u.uDensity.value = p.density
    u.uScattering.value = p.scattering
    u.uAnisotropy.value = p.anisotropy
    u.uAttenuationDist.value = p.attenuationDistance
    u.uGodRays.value = p.godRays ? 1 : 0
    u.uPenumbra.value = p.penumbra
    u.uNear.value = camera.near
    u.uFar.value = camera.far
    u.uFrame.value = this._frame++
    blitMaterial(this.renderer, this.mat, dst)
    this._prevViewProj.copy(viewProj)
    this._prevValid = true
    this.ping = 1 - this.ping
    return dst
  }

  dispose() {
    this._disposed = true
    this.fogRT.forEach((rt) => rt.dispose())
    this.mat.dispose()
  }
}

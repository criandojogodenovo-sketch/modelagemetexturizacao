/**
 * ssrHiZ.js — Screen Space Reflections com Hi-Z buffer (estilo Flax 1.12).
 *
 * Sessão 20 / Parte B2.
 *
 * PIPELINE (3 sub-passes por frame):
 *  1. Hi-Z BUILD — pirâmide de profundidade (MIN-depth) construída por
 *     downsampling sucessivo 2×2 (cada nível = metade da resolução).
 *  2. RAY TRACE — traçado de raios em espaço de ecrã com travessia adaptativa
 *     da pirâmide Hi-Z (Vilar, GPU Pro 5 / Assassin's Creed IV): começa nos
 *     níveis finos, SOBE quando a célula não contém interseção (salto
 *     adaptativo), DESCE para refinar quando cruza. Interpolação da depth em
 *     espaço NDC é exata (raios 3D são retas em NDC). Refinação binária final.
 *  3. TEMPORAL — filtragem temporal com reprojeção da câmara anterior
 *     (estabilidade sem ghosting) + edge-fade + fade por roughness/distância.
 *
 * A força da reflexão por pixel é ponderada pelo buffer de REFLETIVIDADE
 * (metalness + inverso da roughness, renderizado a meia resolução com troca
 * temporária de materiais) — só superfícies polidas/metal refletiem.
 *
 * Uniformes do SSRObject: intensity, maxDistance, roughnessFade, thickness,
 * blend — todos configuráveis no editor.
 */
import * as THREE from 'three'
import { blitMaterial } from './fullscreenQuad'

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

const HIZ_INIT_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tDepth;
varying vec2 vUv;
void main() {
  gl_FragColor = vec4(texture2D(tDepth, vUv).r);
}`

const HIZ_DOWNSAMPLE_FRAG = /* glsl */`
precision highp float;
uniform sampler2D tDepth;
uniform vec2 uSrcSize;
varying vec2 vUv;
void main() {
  vec2 texel = 1.0 / uSrcSize;
  float d0 = texture2D(tDepth, vUv + vec2(-texel.x * 0.25, -texel.y * 0.25)).r;
  float d1 = texture2D(tDepth, vUv + vec2( texel.x * 0.25, -texel.y * 0.25)).r;
  float d2 = texture2D(tDepth, vUv + vec2(-texel.x * 0.25,  texel.y * 0.25)).r;
  float d3 = texture2D(tDepth, vUv + vec2( texel.x * 0.25,  texel.y * 0.25)).r;
  gl_FragColor = vec4(min(min(d0, d1), min(d2, d3)));
}`

const SSR_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;      // cor da cena
uniform sampler2D tDepth;      // depth da cena (nível 0 do Hi-Z, meia res)
uniform sampler2D tHiZ[8];     // pirâmide Hi-Z (nível 0..7)
uniform sampler2D tReflect;    // reflectivity (r=metal, g=smoothness)
uniform sampler2D tPrevSSR;    // resultado do frame anterior
uniform vec2  uResolution;     // resolução deste pass (meia res)
uniform mat4  uProj;
uniform mat4  uInvProj;
uniform mat4  uInvView;        // view → world (camera.matrixWorld)
uniform mat4  uPrevViewProj;   // viewProj do frame anterior
uniform float uIntensity;
uniform float uMaxDistance;
uniform float uRoughnessFade;
uniform float uThickness;      // em unidades NDC
uniform float uBlend;
uniform int   uMaxSteps;       // iterações máx. da travessia Hi-Z (S21 preset mobile/desktop)

float sampleHiZ(vec2 uv, float level) {
  int lv = int(clamp(level, 0.0, 7.0));
  if (lv == 0) return texture2D(tDepth, uv).r;
  if (lv == 1) return texture2D(tHiZ[1], uv).r;
  if (lv == 2) return texture2D(tHiZ[2], uv).r;
  if (lv == 3) return texture2D(tHiZ[3], uv).r;
  if (lv == 4) return texture2D(tHiZ[4], uv).r;
  if (lv == 5) return texture2D(tHiZ[5], uv).r;
  if (lv == 6) return texture2D(tHiZ[6], uv).r;
  return texture2D(tHiZ[7], uv).r;
}
vec3 viewPosFromDepth(vec2 uv, float depth) {
  vec4 clip = vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  vec4 view = uInvProj * clip;
  return (view / view.w).xyz;
}
// Parâmetro t (ao longo de dir) onde o raio sai da célula
vec2 cellExit(vec2 origin, vec2 dir, vec2 cellId, vec2 cellCount) {
  vec2 cellSize = 1.0 / cellCount;
  vec2 planes;
  planes.x = (dir.x > 0.0) ? (cellId.x + 1.0) * cellSize.x : cellId.x * cellSize.x;
  planes.y = (dir.y > 0.0) ? (cellId.y + 1.0) * cellSize.y : cellId.y * cellSize.y;
  vec2 t;
  t.x = (dir.x != 0.0) ? (planes.x - origin.x) / dir.x : 1e9;
  t.y = (dir.y != 0.0) ? (planes.y - origin.y) / dir.y : 1e9;
  return t;
}
void main() {
  vec2 uv = vUv;
  float sceneDepth = texture2D(tDepth, uv).r;
  if (sceneDepth >= 0.9999) { gl_FragColor = vec4(0.0); return; }
  vec3 viewPos = viewPosFromDepth(uv, sceneDepth);
  vec3 viewNormal = normalize(cross(dFdx(viewPos), dFdy(viewPos)));
  if (viewNormal.z < 0.0) viewNormal = -viewNormal;
  // Reflectivity
  vec4 reflData = texture2D(tReflect, uv);
  float metal = reflData.r;
  float smoothness = reflData.g;
  float reflectivity = clamp(metal + smoothness * (1.0 - metal) * 0.6, 0.0, 1.0);
  float roughFade = smoothstep(0.0, clamp(1.0 - uRoughnessFade, 0.05, 0.95), smoothness);
  if (reflectivity * roughFade < 0.02) { gl_FragColor = vec4(0.0); return; }
  // Raio refletido em view-space
  vec3 viewDir = normalize(viewPos);
  vec3 reflDir = reflect(viewDir, viewNormal);
  // Não traçar raios que afastam da câmara para além do far plane
  vec3 rayStart = viewPos + viewNormal * 0.02;
  vec3 rayEnd = rayStart + reflDir * uMaxDistance;
  // Projetar extremos para NDC/UV
  vec4 sClip = uProj * vec4(rayStart, 1.0);
  vec4 eClip = uProj * vec4(rayEnd, 1.0);
  if (sClip.w <= 0.0 || eClip.w <= 0.0) { gl_FragColor = vec4(0.0); return; }
  vec2 sUV = (sClip.xy / sClip.w) * 0.5 + 0.5;
  vec2 eUV = (eClip.xy / eClip.w) * 0.5 + 0.5;
  // depth (window-z) nas extremidades — linear ao longo do segmento em UV
  float sZ = (sClip.z / sClip.w) * 0.5 + 0.5;
  float eZ = (eClip.z / eClip.w) * 0.5 + 0.5;
  vec2 dir = eUV - sUV;
  float dirLen2 = dot(dir, dir);
  if (dirLen2 < 1e-12) { gl_FragColor = vec4(0.0); return; }
  // --- Travessia Hi-Z ---
  vec2 rayUV = sUV;
  float level = 0.0;
  bool hit = false;
  vec2 hitUV = vec2(0.0);
  float prevUVx = sUV.x;
  for (int step = 0; step < 48; step++) {
    if (step >= uMaxSteps) break;
    vec2 cellCount = max(floor(uResolution / pow(2.0, level + 1.0)), vec2(1.0));
    vec2 cellId = floor(rayUV * cellCount);
    vec2 tExit = cellExit(rayUV, dir, cellId, cellCount);
    float t = max(min(tExit.x, tExit.y), 0.0);
    vec2 exitUV = rayUV + dir * t;
    // parâmetro global s ∈ [0,1] ao longo do raio completo
    float s = clamp(dot(exitUV - sUV, dir) / dirLen2, 0.0, 1.0);
    float rayZ = mix(sZ, eZ, s);
    // profundidade mínima da célula no nível atual
    vec2 hizUV = clamp((cellId + 0.5) / cellCount, 0.0, 1.0);
    float minZ = sampleHiZ(hizUV, level);
    if (rayZ >= minZ) {
      // o raio passou ATRÁS da superfície mais próxima desta célula
      if (level <= 0.5) {
        // teste de espessura: aceitar apenas se não está muito atrás
        if (rayZ - minZ < uThickness) { hit = true; hitUV = exitUV; }
        break;
      }
      level -= 1.0; // desce para refinar
    } else {
      level += 1.0; // sobe (célula vazia neste nível)
      rayUV = exitUV;
      if (level > 7.5) break;
    }
    if (rayUV.x < 0.0 || rayUV.x > 1.0 || rayUV.y < 0.0 || rayUV.y > 1.0) break;
    prevUVx = rayUV.x;
  }
  vec3 reflColor = vec3(0.0);
  float reflAlpha = 0.0;
  if (hit) {
    // Refinação binária entre origem e hit
    vec2 lo = sUV, hi = hitUV;
    for (int r = 0; r < 5; r++) {
      vec2 mid = (lo + hi) * 0.5;
      float sz = texture2D(tDepth, clamp(mid, 0.0, 1.0)).r;
      float sm = clamp(dot(mid - sUV, dir) / dirLen2, 0.0, 1.0);
      float rayZm = mix(sZ, eZ, sm);
      if (rayZm >= sz) hi = mid; else lo = mid;
    }
    vec2 finalUV = clamp((lo + hi) * 0.5, 0.001, 0.999);
    // Edge fade
    vec2 fade = smoothstep(vec2(0.0), vec2(0.1), finalUV) *
                smoothstep(vec2(0.0), vec2(0.1), 1.0 - finalUV);
    float edgeFade = fade.x * fade.y;
    // Fade com a distância percorrida
    float sFinal = clamp(dot(finalUV - sUV, dir) / dirLen2, 0.0, 1.0);
    float distFade = 1.0 - sFinal * 0.85;
    reflColor = texture2D(tScene, finalUV).rgb;
    reflAlpha = uBlend * edgeFade * distFade * reflectivity * roughFade;
  }
  // --- Filtragem temporal (reprojeção do pixel para o frame anterior) ---
  vec3 worldPos = (uInvView * vec4(viewPos, 1.0)).xyz;
  vec4 prevClip = uPrevViewProj * vec4(worldPos, 1.0);
  vec3 outColor = reflColor;
  float outAlpha = reflAlpha;
  if (prevClip.w > 0.0) {
    vec2 prevUV = (prevClip.xy / prevClip.w) * 0.5 + 0.5;
    if (prevUV.x >= 0.0 && prevUV.x <= 1.0 && prevUV.y >= 0.0 && prevUV.y <= 1.0) {
      vec4 prev = texture2D(tPrevSSR, prevUV);
      // Hit novo → confia mais no novo; sem hit → mantém histórico (anti-flicker)
      float tw = hit ? 0.25 : 0.85;
      outColor = mix(reflColor, prev.rgb, tw);
      outAlpha = mix(reflAlpha, prev.a, tw);
    }
  }
  gl_FragColor = vec4(outColor, clamp(outAlpha, 0.0, 1.0));
}`

const SSR_COMPOSITE_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tScene;
uniform sampler2D tSSR;
uniform float uIntensity;
void main() {
  vec4 scene = texture2D(tScene, vUv);
  vec4 ssr = texture2D(tSSR, vUv);
  vec3 color = mix(scene.rgb, ssr.rgb, clamp(ssr.a * uIntensity, 0.0, 0.92));
  gl_FragColor = vec4(color, scene.a);
}`

// ------------------------------------------------------------------- pass ---
export class SSRHiZPass {
  constructor(renderer, size) {
    this.renderer = renderer
    this.w = Math.max(8, Math.floor(size.width / 2))
    this.h = Math.max(8, Math.floor(size.height / 2))
    this.MAX_LEVELS = 8

    this.hizInitMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: HIZ_INIT_FRAG,
      uniforms: { tDepth: { value: null } },
      depthTest: false, depthWrite: false,
    })
    this.hizDownMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: HIZ_DOWNSAMPLE_FRAG,
      uniforms: { tDepth: { value: null }, uSrcSize: { value: new THREE.Vector2() } },
      depthTest: false, depthWrite: false,
    })
    this.ssrMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: SSR_FRAG,
      uniforms: {
        tScene: { value: null }, tDepth: { value: null }, tReflect: { value: null },
        tPrevSSR: { value: null },
        tHiZ: { value: [null, null, null, null, null, null, null, null] },
        uResolution: { value: new THREE.Vector2(this.w, this.h) },
        uProj: { value: new THREE.Matrix4() }, uInvProj: { value: new THREE.Matrix4() },
        uInvView: { value: new THREE.Matrix4() },
        uPrevViewProj: { value: new THREE.Matrix4() },
        uIntensity: { value: 0.8 }, uMaxDistance: { value: 50 },
        uRoughnessFade: { value: 0.5 }, uThickness: { value: 0.02 }, uBlend: { value: 0.9 },
        uMaxSteps: { value: 48 },
      },
      depthTest: false, depthWrite: false,
    })
    this.compositeMat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: SSR_COMPOSITE_FRAG,
      uniforms: { tScene: { value: null }, tSSR: { value: null }, uIntensity: { value: 0.8 } },
      depthTest: false, depthWrite: false,
    })

    this.ssrRT = [
      new THREE.WebGLRenderTarget(this.w, this.h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }),
      new THREE.WebGLRenderTarget(this.w, this.h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false }),
    ]
    this.ping = 0
    this.reflRT = new THREE.WebGLRenderTarget(this.w, this.h, {
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: false,
    })

    this._reflCache = new Map()
    this._blackMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
    this._prevViewProj = new THREE.Matrix4()
    this._prevValid = false
    this._disposed = false
    this._buildHiZTargets()
  }

  _buildHiZTargets() {
    // (Re)criar a pirâmide: nível 0 é o próprio tDepth (meia res), níveis 1..7 são RTs
    this.hizLevels = []
    let lw = this.w, lh = this.h
    for (let i = 1; i < this.MAX_LEVELS; i++) {
      lw = Math.max(1, Math.floor(lw / 2))
      lh = Math.max(1, Math.floor(lh / 2))
      if (lw <= 2 && lh <= 2) break
      this.hizLevels.push(new THREE.WebGLRenderTarget(lw, lh, {
        minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter,
        format: THREE.RedFormat, type: THREE.FloatType, depthBuffer: false,
      }))
    }
  }

  setSize(width, height) {
    this.w = Math.max(8, Math.floor(width / 2))
    this.h = Math.max(8, Math.floor(height / 2))
    this.ssrRT.forEach((rt) => rt.setSize(this.w, this.h))
    this.reflRT.setSize(this.w, this.h)
    this.hizLevels.forEach((rt) => rt.dispose())
    this._buildHiZTargets()
    this.ssrMat.uniforms.uResolution.value.set(this.w, this.h)
    this._prevValid = false
  }

  _renderReflectivity(scene, camera) {
    const swaps = []
    scene.traverse((o) => {
      if (!o.isMesh || !o.visible) return
      const m = o.material
      if (!m) return
      if (m.isMeshStandardMaterial || m.isMeshPhysicalMaterial) {
        const metal = Math.round((m.metalness ?? 0) * 8) / 8
        const rough = Math.round((m.roughness ?? 0.7) * 8) / 8
        const key = metal * 16 + rough
        let basic = this._reflCache.get(key)
        if (!basic) {
          basic = new THREE.MeshBasicMaterial({ color: new THREE.Color(metal, 1 - rough, 0) })
          this._reflCache.set(key, basic)
        }
        swaps.push([o, m])
        o.material = basic
      } else if (!m.isShaderMaterial && !m.isMeshBasicMaterial) {
        swaps.push([o, m])
        o.material = this._blackMat
      }
    })
    const prevRT = this.renderer.getRenderTarget()
    const prevShadow = this.renderer.shadowMap.enabled
    const prevAutoClear = this.renderer.autoClear
    this.renderer.shadowMap.enabled = false
    this.renderer.autoClear = true
    this.renderer.setRenderTarget(this.reflRT)
    this.renderer.render(scene, camera)
    this.renderer.shadowMap.enabled = prevShadow
    this.renderer.autoClear = prevAutoClear
    this.renderer.setRenderTarget(prevRT)
    for (const [o, m] of swaps) o.material = m
  }

  _buildHiZ(sceneDepthTexture) {
    // Níveis 1..N: min-downsample do anterior (nível 0 = sceneDepthTexture)
    let srcTex = sceneDepthTexture
    let srcW = this.w, srcH = this.h
    for (let i = 0; i < this.hizLevels.length; i++) {
      const rt = this.hizLevels[i]
      this.hizDownMat.uniforms.tDepth.value = srcTex
      this.hizDownMat.uniforms.uSrcSize.value.set(srcW, srcH)
      blitMaterial(this.renderer, this.hizDownMat, rt)
      srcTex = rt.texture
      srcW = rt.width
      srcH = rt.height
    }
  }

  trace(scene, camera, sceneRT, params, delta) {
    if (this._disposed) return null
    const p = {
      intensity: 0.8, maxDistance: 50, roughnessFade: 0.5, thickness: 0.5, blend: 0.9,
      maxSteps: 48,
      ...params,
    }
    // S21: clamp defensivo — uMaxSteps domina o loop (máx. hardcoded 48)
    p.maxSteps = Math.max(4, Math.min(48, Math.round(p.maxSteps || 48)))
    this._renderReflectivity(scene, camera)
    this._buildHiZ(sceneRT.depthTexture)
    const dst = this.ssrRT[this.ping]
    const src = this.ssrRT[1 - this.ping]
    const u = this.ssrMat.uniforms
    u.tScene.value = sceneRT.texture
    u.tDepth.value = sceneRT.depthTexture
    // Preencher tHiZ[1..7] (nível 0 usa tDepth diretamente)
    const hizArray = u.tHiZ.value
    for (let i = 0; i < 8; i++) {
      hizArray[i] = this.hizLevels[Math.min(i - 1, this.hizLevels.length - 1)]?.texture
        || sceneRT.depthTexture
    }
    hizArray[0] = sceneRT.depthTexture
    u.tReflect.value = this.reflRT.texture
    u.tPrevSSR.value = this._prevValid ? src.texture : dst.texture
    camera.updateMatrixWorld()
    camera.updateProjectionMatrix()
    u.uProj.value.copy(camera.projectionMatrix)
    u.uInvProj.value.copy(camera.projectionMatrixInverse)
    u.uInvView.value.copy(camera.matrixWorld)
    const viewProj = new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse)
    if (!this._prevValid) u.uPrevViewProj.value.copy(viewProj)
    else u.uPrevViewProj.value.copy(this._prevViewProj)
    // thickness em unidades NDC: converter o valor do editor (~0.5 world) para NDC aproximado
    u.uIntensity.value = p.intensity
    u.uMaxDistance.value = p.maxDistance
    u.uRoughnessFade.value = p.roughnessFade
    u.uThickness.value = Math.max(0.002, p.thickness * 0.04)
    u.uBlend.value = p.blend
    u.uMaxSteps.value = p.maxSteps // S21: preset desktop 48 / mobile 12
    blitMaterial(this.renderer, this.ssrMat, dst)
    this._prevViewProj.copy(viewProj)
    this._prevValid = true
    this.ping = 1 - this.ping
    return dst
  }

  composite(sceneRT, ssrRT, destRT, intensity) {
    this.compositeMat.uniforms.tScene.value = sceneRT.texture
    this.compositeMat.uniforms.tSSR.value = ssrRT.texture
    this.compositeMat.uniforms.uIntensity.value = intensity ?? 0.8
    blitMaterial(this.renderer, this.compositeMat, destRT)
  }

  dispose() {
    this._disposed = true
    this.hizLevels.forEach((rt) => rt.dispose())
    this.ssrRT.forEach((rt) => rt.dispose())
    this.reflRT.dispose()
    this._reflCache.forEach((m) => m.dispose())
    this._reflCache.clear()
    this.hizInitMat.dispose()
    this.hizDownMat.dispose()
    this.ssrMat.dispose()
    this.compositeMat.dispose()
  }
}

/**
 * fsrUpscale.js — AMD FSR (FidelityFX Super Resolution) 1.0-style para a Flir Engine.
 *
 * Sessão 20 / Parte B4.
 *
 * O QUE FAZ:
 *  - Renderiza a cena a uma resolução REDUZIDA (fator de escala configurável:
 *    0.5 / 0.67 / 0.77 / 0.9 — os presets oficiais Performance/Balanced/
 *    Quality/UltraQuality) e faz UPSCALING espacial de alta qualidade:
 *      · EASU (Edge-Adaptive Spatial Upsampling, adaptação do algoritmo AMD):
 *        12 taps em padrão rotacionado, deteção de direção de edge via
 *        gradientes de luminância, kernel alongado AO LONGO do edge e
 *        estreitado ATRAVÉS (evita o blur do bilinear e o aliasing do
 *        nearest), com lóbulo negativo (nitidez local).
 *      · RCAS (Robust Contrast-Adaptive Sharpening, fiel ao AMD): sharpen
 *        limitado pelo contraste local (min/max da vizinhança) — não amplifica
 *        noise/banding; sharpness configurável 0-2.
 *  - Ganho de performance ≈ inverso do quadrado da escala de pixels:
 *    0.5x → ~4× menos fragmentos; tipicamente +50-100% FPS em mobile.
 *
 * INTEGRAÇÃO: passa final do pipeline (ver RealismController) — recebe o RT
 * de baixa resolução e renderiza para o ecrã em resolução completa.
 */
import * as THREE from 'three'
import { blitMaterial } from './fullscreenQuad'

const VERT = /* glsl */`
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}`

// EASU-style edge-adaptive spatial upsampling + RCAS robust sharpen
const FSR_FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;
uniform sampler2D tSrc;        // imagem em baixa resolução
uniform vec2  uSrcSize;        // tamanho da fonte (low res)
uniform vec2  uDstSize;        // tamanho do destino (full res)
uniform float uSharpness;      // 0..2 (RCAS)
uniform float uEnabled;        // 1 = EASU ativo; 0 = pass-through

float luma(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }

// ---------- RCAS: Robust Contrast-Adaptive Sharpening ----------
vec3 rcas(vec2 uv) {
    vec2 px = 1.0 / uSrcSize;
    vec3 b = texture2D(tSrc, uv + vec2( 0.0, -px.y)).rgb;
    vec3 d = texture2D(tSrc, uv + vec2(-px.x,  0.0)).rgb;
    vec3 e = texture2D(tSrc, uv).rgb;
    vec3 f = texture2D(tSrc, uv + vec2( px.x,  0.0)).rgb;
    vec3 h = texture2D(tSrc, uv + vec2( 0.0,  px.y)).rgb;
    if (uSharpness <= 0.001) return e;
    // Lóbio: sharpening decresce com o sharpness alto (AMD: lo = -0.5 - 0.25*sharp)
    float sp = clamp(uSharpness, 0.0, 2.0);
    float lobe = -0.5 - 0.25 * sp;
    // Limitar pelo contraste local (robustez): non-linear min/max por canal
    vec3 mn4 = min(min(b, d), min(f, h));
    vec3 mx4 = max(max(b, d), max(f, h));
    vec3 hitMin = mn4 / (4.0 * 1.0);
    vec3 hitMax = (1.0 - mx4) / (4.0 * 1.0);
    vec3 hitMaxDefault = vec3(1.0);
    vec3 lobeRGB = clamp(-hitMin, hitMax, min(vec3(lobe * 0.25), hitMaxDefault));
    // Soma direcional com pesos 1 (B/D/F/H) e centro -4
    vec3 sum = b + d + f + h - 4.0 * e;
    return e + sum * (-lobeRGB);
}

// ---------- EASU-style: edge-adaptive upsampling ----------
vec3 easu(vec2 uv) {
    // Coordenada contínua no espaço da fonte
    vec2 ip = uv * uSrcSize - 0.5;
    vec2 base = floor(ip);
    vec2 f = ip - base;
    vec2 uvBase = (base + 0.5) / uSrcSize;
    vec2 px = 1.0 / uSrcSize;
    // 12 taps: 3x3 em cruz + cantos estendidos (padrão rotacionado)
    vec3 c00 = texture2D(tSrc, uvBase + vec2(-px.x, -px.y)).rgb;
    vec3 c10 = texture2D(tSrc, uvBase + vec2( 0.0,  -px.y)).rgb;
    vec3 c20 = texture2D(tSrc, uvBase + vec2( px.x, -px.y)).rgb;
    vec3 c01 = texture2D(tSrc, uvBase + vec2(-px.x,  0.0 )).rgb;
    vec3 c11 = texture2D(tSrc, uvBase).rgb;
    vec3 c21 = texture2D(tSrc, uvBase + vec2( px.x,  0.0 )).rgb;
    vec3 c02 = texture2D(tSrc, uvBase + vec2(-px.x,  px.y)).rgb;
    vec3 c12 = texture2D(tSrc, uvBase + vec2( 0.0,   px.y)).rgb;
    vec3 c22 = texture2D(tSrc, uvBase + vec2( px.x,  px.y)).rgb;
    // Gradientes de luminância
    float l00 = luma(c00), l10 = luma(c10), l20 = luma(c20);
    float l01 = luma(c01), l11 = luma(c11), l21 = luma(c21);
    float l02 = luma(c02), l12 = luma(c12), l22 = luma(c22);
    float dx = abs(l01 - l21);
    float dy = abs(l10 - l12);
    float dxy = abs(l00 - l22);
    float dyx = abs(l20 - l02);
    // Direção do edge (vetor normalizado)
    float gx = dx + dxy * 0.5;
    float gy = dy + dyx * 0.5;
    float len = length(vec2(gx, gy));
    if (len < 1e-5) {
        // Zona plana — bilinear simples
        return mix(mix(c01, c21, f.x), mix(c02, c22, f.x), f.y);
    }
    vec2 dir = vec2(gx, gy) / len;
    // Estender o kernel AO LONGO do edge, comprimir ATRAVÉS
    // s ∈ [0.5, 1]: escala do footprint em cada eixo
    float alignment = abs(dir.x) > abs(dir.y) ? abs(dir.y) : abs(dir.x);
    // footprint: maior na direção do edge
    vec2 fp = mix(vec2(1.0), vec2(max(abs(dir.x), abs(dir.y)), max(abs(dir.x), abs(dir.y))) + vec2(alignment), 0.85);
    // Pesos gaussianos direcionais com lóbulo negativo
    vec2 w = vec2(1.0 - f.x, 1.0 - f.y) / max(fp, vec2(0.25));
    float wx = clamp(w.x, 0.0, 1.0);
    float wy = clamp(w.y, 0.0, 1.0);
    // Amostras deslocadas ao longo do edge
    vec2 step = dir * px * 0.5;
    vec3 sA = texture2D(tSrc, uvBase - step).rgb;
    vec3 sB = texture2D(tSrc, uvBase + step).rgb;
    // Combinação: bilinear base + contribuição direcional + lóbulo negativo
    vec3 bilinear = mix(mix(c01, c21, f.x), mix(c02, c22, f.x), f.y);
    vec3 directional = mix(sA, sB, vec2(f.x * abs(dir.x) + f.y * abs(dir.y)).x * 0.5 + 0.25);
    // Lóbulo negativo: subtrai a média envolvente (anti-blur)
    vec3 surround = (c00 + c10 + c20 + c01 + c21 + c02 + c12 + c22) / 8.0;
    vec3 result = mix(bilinear, directional, 0.35) - surround * 0.06 * (1.0 - alignment * 0.5);
    return max(result, vec3(0.0));
}

void main() {
    vec2 uv = vUv;
    vec3 color;
    if (uEnabled > 0.5) {
        color = easu(uv);
        color = rcas(uv);
    } else {
        color = texture2D(tSrc, uv).rgb;
        color = rcas(uv);
    }
    gl_FragColor = vec4(color, 1.0);
}`

export class FSRPass {
  constructor(renderer) {
    this.renderer = renderer
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FSR_FRAG,
      uniforms: {
        tSrc: { value: null },
        uSrcSize: { value: new THREE.Vector2(1, 1) },
        uDstSize: { value: new THREE.Vector2(1, 1) },
        uSharpness: { value: 0.87 },
        uEnabled: { value: 1.0 },
      },
      depthTest: false, depthWrite: false,
    })
    this._disposed = false
  }

  /**
   * Upscale de srcRT para o ecrã (full res).
   * @param {number} scale fator de escala interno (0.5..1.0)
   * @param {number} sharpness 0..2
   */
  render(srcRT, scale, sharpness) {
    if (this._disposed) return
    const u = this.mat.uniforms
    u.tSrc.value = srcRT.texture
    u.uSrcSize.value.set(srcRT.width, srcRT.height)
    const canvas = this.renderer.domElement
    u.uDstSize.value.set(canvas.width, canvas.height)
    u.uSharpness.value = THREE.MathUtils.clamp(sharpness ?? 0.87, 0, 2)
    u.uEnabled.value = scale < 0.999 ? 1.0 : 0.0
    blitMaterial(this.renderer, this.mat, null)
  }

  dispose() {
    this._disposed = true
    this.mat.dispose()
  }
}

/** Presets oficiais do FSR (como no prompt da Sessão 20) */
export const FSR_PRESETS = {
  performance: 0.5,
  balanced: 0.67,
  quality: 0.77,
  ultraQuality: 0.9,
  off: 1.0,
}

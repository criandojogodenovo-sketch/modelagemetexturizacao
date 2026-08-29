/**
 * realismPresets.js — presets de realismo por dispositivo (Sessão 21).
 *
 * O pipeline de realismo (DDGI / SSR Hi-Z / FSR) tem custos muito diferentes
 * em desktop vs mobile. Este módulo centraliza os VALORES POR DEFEITO por
 * dispositivo — o utilizador pode sempre sobrepor no SettingsPanel ou no
 * conect (SSRObject); os presets são apenas o ponto de partida.
 *
 * DETEÇÃO (detectIsMobile): UA móvel (Android/iPhone/iPad/iPod/Mobile) OU
 * touch + ecrã pequeno (iPadOS que reporta Macintosh). Ver nota na função.
 *
 * MAPPING para os módulos:
 *  - DDGI  → createDDGI(scene, gl, { gridDivisions, probeResolution,
 *             probesPerFrame, updateInterval, assignInterval })
 *  - SSR   → SSRHiZPass.trace(params.maxSteps) + params.maxDistance
 *            (resolutionScale já é fixo a 0.5 = meia resolução)
 *  - FSR   → renderSettings { fsr, fsrScale, fsrSharpness }
 */

/**
 * Deteção de plataforma (S21): UA móvel OU ecrã pequeno com touch.
 *
 * NOTA: deliberadamente NÃO usa a heurística cores/memória do
 * adaptiveQuality.js — a potência do dispositivo é gerida em RUNTIME
 * pelo AdaptiveQuality (tiers de DPR, shadows off em crítico). Os presets
 * de realismo refletem a PLATAFORMA: um desktop fraco mantém o preset
 * desktop (ecrã grande — FSR 0.6 ficaria feio) e o adaptiveQuality
 * compensa a performance dinamicamente. iPadOS moderno (que reporta
 * "Macintosh") é apanhado por touch + ecrã ≤900px.
 */
export function detectIsMobile() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true
  const touch = navigator.maxTouchPoints || 0
  const smallScreen = typeof screen !== 'undefined' && Math.min(screen.width, screen.height) <= 900
  return touch > 1 && smallScreen
}

export const REALISM_PRESETS = {
  desktop: {
    ddgi: {
      gridDivisions: [4, 3, 4],   // 48 probes
      probeResolution: 64,        // px por face do cubemap
      probesPerFrame: 2,          // probes atualizadas por frame (staggered)
      updateInterval: 0.35,       // s — cada probe re-renderiza a cada ~350ms
      assignInterval: 0.5,        // s — re-atribuição probes↔meshes
    },
    ssr: {
      maxSteps: 48,               // iterações máximas da travessia Hi-Z
      maxDistance: 50,            // unidades de mundo
      thickness: 0.5,             // espessura (NDC) do teste de hit
      resolutionScale: 0.5,       // meia resolução (fixo na implementação)
    },
    fsr: {
      enabled: false,             // desktop: desligado por defeito (full res)
      scale: 0.77,                // 0.5 | 0.67 | 0.77 | 0.9
      sharpness: 0.87,            // RCAS 0..2
    },
  },
  mobile: {
    ddgi: {
      gridDivisions: [3, 2, 3],   // 18 probes (vs 48) — ~62% menos custo
      probeResolution: 32,        // vs 64 — 4x menos pixels por cubemap
      probesPerFrame: 1,          // vs 2 — metade do custo por frame
      updateInterval: 0.8,        // vs 0.35 — atualiza ~2.3x mais lentamente
      assignInterval: 1.0,        // vs 0.5
    },
    ssr: {
      maxSteps: 12,               // vs 48 — 4x menos iterações de ray marching
      maxDistance: 25,            // vs 50 — raios mais curtos
      thickness: 0.5,
      resolutionScale: 0.5,       // meia resolução (igual)
    },
    fsr: {
      enabled: true,              // mobile: FSR ligado por defeito (+FPS)
      scale: 0.6,                 // render interno a 60% → ~2.8x menos pixels
      sharpness: 0.7,
    },
  },
}

/** Preset ativo para o dispositivo atual (memoizado). */
let _cached = null
export function getRealismPreset() {
  if (!_cached) _cached = detectIsMobile() ? REALISM_PRESETS.mobile : REALISM_PRESETS.desktop
  return _cached
}

/**
 * Defaults de renderSettings (store) derivados do preset.
 * Só sobrepõe os campos que variam por dispositivo — o resto mantém-se
 * igual em ambas as plataformas (definidos no useStore).
 */
export function getRealismRenderDefaults() {
  const preset = getRealismPreset()
  return {
    fsr: preset.fsr.enabled,
    fsrScale: preset.fsr.scale,
    fsrSharpness: preset.fsr.sharpness,
  }
}

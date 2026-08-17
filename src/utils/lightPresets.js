/**
 * lightPresets.js — Presets de luz cinematográficos e RGB para Flir Engine.
 *
 * Cada preset aplica um par de cores a duas luzes complementares na cena.
 * Inspirado em setups gaming/ambiente e cinematografia clássica.
 *
 * Uso:
 *   import { LIGHT_PRESETS, applyLightPreset } from '../utils/lightPresets'
 *   applyLightPreset('emberGlow', useStore.getState())
 *
 * Presets RGB (7):
 *   - Ember Glow (vermelho+laranja)
 *   - Neon Edge (roxo+azul)
 *   - Ocean Breeze (turquesa+verde)
 *   - Galaxy Vibes (rosa+roxo)
 *   - Arctic Ice (ciano+branco)
 *   - Sunset Drive (amarelo+rosa)
 *   - Deep Space (azul+índigo)
 *
 * Presets cinematográficos (5):
 *   - Chiaroscuro (alto contraste, luz dura)
 *   - Rembrandt (luz lateral suave, sombra triangular na face)
 *   - Three-Point (key + fill + back)
 *   - Golden Hour (luz quente baixa, sombras longas)
 *   - Blue Hour (luz fria, ambiente crepuscular)
 */

export const LIGHT_PRESETS = {
  // ===== Presets RGB =====
  emberGlow: {
    id: 'emberGlow',
    label: 'Ember Glow',
    category: 'rgb',
    description: 'Vermelho + Laranja — calor, fogo, aconchego',
    primary:   { type: 'SunObject',   color: '#ff6b35', intensity: 2.5, position: [5, 8, 5], castShadow: true },
    secondary: { type: 'PointObject', color: '#ff2a00', intensity: 1.5, position: [-3, 2, -2], distance: 15 },
  },
  neonEdge: {
    id: 'neonEdge',
    label: 'Neon Edge',
    category: 'rgb',
    description: 'Roxo + Azul — cyberpunk, neon, futurista',
    primary:   { type: 'SunObject',   color: '#8b00ff', intensity: 1.8, position: [5, 8, 5], castShadow: true },
    secondary: { type: 'PointObject', color: '#00d4ff', intensity: 2.0, position: [-4, 3, -3], distance: 20 },
  },
  oceanBreeze: {
    id: 'oceanBreeze',
    label: 'Ocean Breeze',
    category: 'rgb',
    description: 'Turquesa + Verde — frescura, água, natureza',
    primary:   { type: 'SunObject',   color: '#40e0d0', intensity: 2.0, position: [5, 8, 5], castShadow: true },
    secondary: { type: 'PointObject', color: '#32cd32', intensity: 1.2, position: [-3, 2, 2], distance: 15 },
  },
  galaxyVibes: {
    id: 'galaxyVibes',
    label: 'Galaxy Vibes',
    category: 'rgb',
    description: 'Rosa + Roxo — galáxia, sonho, mistério',
    primary:   { type: 'SunObject',   color: '#ff1493', intensity: 1.5, position: [5, 8, 5], castShadow: true },
    secondary: { type: 'PointObject', color: '#9370db', intensity: 2.0, position: [-3, 4, -3], distance: 18 },
  },
  arcticIce: {
    id: 'arcticIce',
    label: 'Arctic Ice',
    category: 'rgb',
    description: 'Ciano + Branco — frio, gelo, limpeza',
    primary:   { type: 'SunObject',   color: '#e0ffff', intensity: 2.8, position: [5, 8, 5], castShadow: true },
    secondary: { type: 'PointObject', color: '#00ffff', intensity: 1.5, position: [-3, 2, -2], distance: 15 },
  },
  sunsetDrive: {
    id: 'sunsetDrive',
    label: 'Sunset Drive',
    category: 'rgb',
    description: 'Amarelo + Rosa — pôr do sol, nostalgia, estrada',
    primary:   { type: 'SunObject',   color: '#ffd700', intensity: 2.2, position: [5, 4, 5], castShadow: true },
    secondary: { type: 'PointObject', color: '#ff69b4', intensity: 1.8, position: [-4, 3, -2], distance: 18 },
  },
  deepSpace: {
    id: 'deepSpace',
    label: 'Deep Space',
    category: 'rgb',
    description: 'Azul + Índigo — espaço profundo, noite, mistério',
    primary:   { type: 'SunObject',   color: '#4169e1', intensity: 1.2, position: [5, 8, 5], castShadow: true },
    secondary: { type: 'PointObject', color: '#4b0082', intensity: 2.5, position: [-3, 2, -3], distance: 20 },
  },

  // ===== Presets Cinematográficos =====
  chiaroscuro: {
    id: 'chiaroscuro',
    label: 'Chiaroscuro',
    category: 'cinematic',
    description: 'Alto contraste — luz dura lateral, sombras profundas (estilo Caravaggio)',
    primary:   { type: 'SunObject',   color: '#fff5e6', intensity: 4.0, position: [8, 5, 2], castShadow: true },
    secondary: { type: 'AmbientObject', color: '#1a1a2e', intensity: 0.15 },
  },
  rembrandt: {
    id: 'rembrandt',
    label: 'Rembrandt',
    category: 'cinematic',
    description: 'Luz lateral suave — sombra triangular na face oposta (retrato clássico)',
    primary:   { type: 'SunObject',   color: '#ffe4c4', intensity: 2.5, position: [4, 6, 3], castShadow: true },
    secondary: { type: 'AmbientObject', color: '#fff8dc', intensity: 0.4 },
  },
  threePoint: {
    id: 'threePoint',
    label: 'Three-Point',
    category: 'cinematic',
    description: 'Key + Fill + Back — iluminação profissional de estúdio',
    primary:   { type: 'SunObject',   color: '#ffffff', intensity: 3.0, position: [5, 6, 4], castShadow: true },
    secondary: { type: 'PointObject', color: '#e6e6fa', intensity: 1.0, position: [-4, 4, 2], distance: 15 },
  },
  goldenHour: {
    id: 'goldenHour',
    label: 'Golden Hour',
    category: 'cinematic',
    description: 'Hora dourada — luz quente baixa, sombras longas, atmosfera cinematográfica',
    primary:   { type: 'SunObject',   color: '#ffa500', intensity: 2.8, position: [8, 3, 4], castShadow: true },
    secondary: { type: 'AmbientObject', color: '#ff8c00', intensity: 0.3 },
  },
  blueHour: {
    id: 'blueHour',
    label: 'Blue Hour',
    category: 'cinematic',
    description: 'Hora azul — luz fria, ambiente crepuscular, melancolia',
    primary:   { type: 'SunObject',   color: '#4682b4', intensity: 1.5, position: [6, 4, 5], castShadow: true },
    secondary: { type: 'AmbientObject', color: '#191970', intensity: 0.5 },
  },
}

/**
 * Aplica um preset de luz à cena ativa.
 * Remove luzes Sun/Point/Ambient existentes e cria as 2 do preset.
 *
 * @param {string} presetId — ID do preset (ex: 'emberGlow', 'chiaroscuro')
 * @param {object} store — instância do useStore (useStore.getState())
 * @returns {boolean} — true se aplicado com sucesso
 */
export function applyLightPreset(presetId, store) {
  const preset = LIGHT_PRESETS[presetId]
  if (!preset || !store) return false

  const { activeSceneId, scenes } = store
  const activeScene = scenes.find(s => s.id === activeSceneId)
  if (!activeScene) {
    store.toast?.('Crie uma cena primeiro', 'error')
    return false
  }

  // Remover luzes Sun/Point/Ambient existentes na cena
  const lightTypes = new Set(['SunObject', 'PointObject', 'AmbientObject'])
  const remainingConects = (activeScene.conects || []).filter(c => !lightTypes.has(c.type))

  // Criar as 2 luzes do preset
  const newLights = []
  for (const lightDef of [preset.primary, preset.secondary]) {
    const conect = {
      instanceId: `conect_${Math.random().toString(36).slice(2, 10)}`,
      type: lightDef.type,
      name: `${preset.label} ${lightDef.type === 'SunObject' ? '☀️' : lightDef.type === 'PointObject' ? '🔵' : '🌫️'}`,
      position: lightDef.position || [0, 5, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      visible: true,
      color: lightDef.color,
      intensity: lightDef.intensity,
      castShadow: lightDef.castShadow ?? false,
      // PointObject specific
      distance: lightDef.distance ?? 10,
      decay: 2,
      // SunObject specific
      elevation: 45,
      azimuth: 180,
      temperature: 6500,
    }
    newLights.push(conect)
  }

  // Aplicar ao store
  store._pushHistory?.()
  store.set({
    scenes: scenes.map(sc =>
      sc.id === activeSceneId
        ? { ...sc, conects: [...remainingConects, ...newLights] }
        : sc
    ),
  })
  store.toast?.(`Preset "${preset.label}" aplicado`, 'success', 1500)
  return true
}

/**
 * Retorna presets agrupados por categoria.
 * @returns {{ rgb: Array, cinematic: Array }}
 */
export function getPresetsByCategory() {
  const rgb = []
  const cinematic = []
  for (const preset of Object.values(LIGHT_PRESETS)) {
    if (preset.category === 'rgb') rgb.push(preset)
    else if (preset.category === 'cinematic') cinematic.push(preset)
  }
  return { rgb, cinematic }
}

export default LIGHT_PRESETS

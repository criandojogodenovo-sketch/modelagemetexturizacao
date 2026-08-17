/**
 * skyPresets.js — Presets de céu para Flir Engine.
 *
 * Fase 4 — World Environment presets.
 *
 * Expande o SkyObject com presets prontos a aplicar, todos baseados no
 * shader procedural existente (skyShaderPro). Cada preset configura
 * rayleigh, turbidity, sunElevation, sunAzimuth, starsEnabled e cores
 * para criar ambientes distintos.
 *
 * Presets (5):
 *  - Cloudy (nublado) — céu cinzento, sol difuso
 *  - Stormy (tempestuoso) — céu escuro, turbidez alta
 *  - Aurora (aurora boreal) — céu noturno com estrelas, tons verde/roxo
 *  - Starry Night (estrelado) — céu escuro com muitas estrelas
 *  - Dense Fog (nevoeiro denso) — céu branco/acinzentado, visibilidade reduzida
 *
 * Uso:
 *   import { SKY_PRESETS, applySkyPreset } from '../utils/skyPresets'
 *   applySkyPreset('cloudy', useStore.getState())
 */

export const SKY_PRESETS = {
  cloudy: {
    id: 'cloudy',
    label: 'Nublado',
    icon: '☁️',
    description: 'Céu cinzento, sol difuso, sem sombras duras',
    config: {
      skyType: 'procedural',
      sunElevation: 35,
      sunAzimuth: 180,
      rayleigh: 0.5,       // pouco azul — céu acinzentado
      turbidity: 20,        // alta turbidez — difusão
      mieCoefficient: 0.01,
      starsEnabled: false,
      topColor: '#6a7a8a',
      bottomColor: '#a0a8b0',
    },
  },
  stormy: {
    id: 'stormy',
    label: 'Tempestuoso',
    icon: '⛈️',
    description: 'Céu escuro, tempestade iminente, turbidez muito alta',
    config: {
      skyType: 'procedural',
      sunElevation: 15,
      sunAzimuth: 200,
      rayleigh: 0.3,       // quase sem azul — céu escuro
      turbidity: 28,        // turbidez máxima — ar pesado
      mieCoefficient: 0.02,
      starsEnabled: false,
      topColor: '#2a2a3a',
      bottomColor: '#4a4a5a',
    },
  },
  aurora: {
    id: 'aurora',
    label: 'Aurora Boreal',
    icon: '🌌',
    description: 'Céu noturno com estrelas, tons verde/roxo característicos',
    config: {
      skyType: 'procedural',
      sunElevation: 2,     // sol quase no horizonte — noite
      sunAzimuth: 0,
      rayleigh: 3.0,       // azul residual
      turbidity: 2,         // ar limpo
      mieCoefficient: 0.001,
      starsEnabled: true,
      topColor: '#0a1a2a',
      bottomColor: '#1a3a2a',  // tom esverdeado no horizonte
    },
  },
  starryNight: {
    id: 'starryNight',
    label: 'Noite Estrelada',
    icon: '🌟',
    description: 'Céu escuro com muitas estrelas, sol abaixo do horizonte',
    config: {
      skyType: 'procedural',
      sunElevation: 0,     // sol no horizonte — noite
      sunAzimuth: 270,
      rayleigh: 0.8,       // pouco azul — céu escuro
      turbidity: 1,         // ar muito limpo
      mieCoefficient: 0.001,
      starsEnabled: true,
      topColor: '#050a15',
      bottomColor: '#0a1525',
    },
  },
  denseFog: {
    id: 'denseFog',
    label: 'Nevoeiro Denso',
    icon: '🌫️',
    description: 'Céu branco/acinzentado, visibilidade muito reduzida',
    config: {
      skyType: 'procedural',
      sunElevation: 25,
      sunAzimuth: 180,
      rayleigh: 0.2,       // quase sem cor — branco
      turbidity: 25,        // alta turbidez — difusão extrema
      mieCoefficient: 0.03,
      starsEnabled: false,
      topColor: '#b0b0b0',
      bottomColor: '#c8c8c8',
    },
  },
}

/**
 * Aplica um preset de céu à cena ativa.
 * Procura SkyObject existente na cena ativa e atualiza as suas propriedades.
 * Se não existir, cria um novo SkyObject.
 *
 * @param {string} presetId — ID do preset (ex: 'cloudy', 'stormy')
 * @param {object} store — useStore.getState()
 * @returns {boolean} — true se aplicado com sucesso
 */
export function applySkyPreset(presetId, store) {
  const preset = SKY_PRESETS[presetId]
  if (!preset || !store) {
    store?.toast?.('Preset de céu inválido', 'error')
    return false
  }

  if (!store.activeSceneId) {
    store.toast?.('Crie uma cena primeiro', 'error')
    return false
  }

  const { activeSceneId, scenes } = store
  const activeScene = scenes.find(s => s.id === activeSceneId)
  if (!activeScene) return false

  // Procurar SkyObject existente
  const existingSky = (activeScene.conects || []).find(c => c.type === 'SkyObject')

  if (existingSky) {
    // Atualizar SkyObject existente
    store._pushHistory?.()
    store.updateConect(existingSky.instanceId, {
      ...preset.config,
      name: `Céu: ${preset.label}`,
    })
  } else {
    // Criar novo SkyObject
    const sky = store.addConectToScene('SkyObject', [0, 0, 0])
    if (sky) {
      store.updateConect(sky.instanceId, {
        ...preset.config,
        name: `Céu: ${preset.label}`,
      })
    }
  }

  store.toast?.(`Céu "${preset.label}" aplicado`, 'success', 1500)
  return true
}

/**
 * Retorna todos os presets de céu.
 * @returns {Array} — array de presets
 */
export function getSkyPresets() {
  return Object.values(SKY_PRESETS)
}

export default { SKY_PRESETS, applySkyPreset, getSkyPresets }

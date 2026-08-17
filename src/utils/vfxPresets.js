/**
 * vfxPresets.js — Sistema de efeitos visuais (VFX) para Flir Engine.
 *
 * Fase 3 — VFX.
 *
 * Cria ParticleObjects pré-configurados para eventos de jogo comuns:
 * explosões, impactos, rastos de magia, etc.
 *
 * Inspirado no conceito de "VFX invisível" — o efeito deve reforçar a cena
 * sem ser a única coisa que se nota. Efeitos mais evidentes quando pedido.
 *
 * VFX presets (6):
 *  - Explosion (explosão): partículas vermelhas/laranjas, gravidade positiva, vida curta
 *  - Impact (impacto): faíscas amarelas, dispersão direcional, sem gravidade
 *  - Magic Trail (rasto mágico): partículas roxas/azuis, sem gravidade, vida longa
 *  - Smoke (fumo): partículas cinzas, gravidade negativa (sobe), vida longa
 *  - Fire (fogo): partículas vermelhas/laranjas, emissivas, sem gravidade
 *  - Sparkle (brilho): partículas brancas pequenas, emissivas, dispersão ampla
 *
 * Uso:
 *   import { applyVfxPreset, VFX_PRESETS } from '../utils/vfxPresets'
 *   applyVfxPreset('explosion', [5, 2, 3], useStore.getState())
 */

// ===== VFX Presets =====

export const VFX_PRESETS = {
  explosion: {
    id: 'explosion',
    label: 'Explosão',
    icon: '💥',
    category: 'combat',
    description: 'Partículas vermelhas/laranjas com gravidade, vida curta',
    config: {
      maxParticles: 80,
      emissionRate: 40,
      particleLife: 0.8,
      particleSize: 0.3,
      particleSpeed: 5,
      color: '#ff4500',
      spread: 3,
      gravity: 2,
    },
  },
  impact: {
    id: 'impact',
    label: 'Impacto',
    icon: '⚡',
    category: 'combat',
    description: 'Faíscas amarelas, dispersão direcional, sem gravidade',
    config: {
      maxParticles: 30,
      emissionRate: 30,
      particleLife: 0.5,
      particleSize: 0.08,
      particleSpeed: 4,
      color: '#ffdd00',
      spread: 1.5,
      gravity: 0,
    },
  },
  magicTrail: {
    id: 'magicTrail',
    label: 'Rasto Mágico',
    icon: '✨',
    category: 'magic',
    description: 'Partículas roxas/azuis, sem gravidade, vida longa',
    config: {
      maxParticles: 60,
      emissionRate: 15,
      particleLife: 3,
      particleSize: 0.15,
      particleSpeed: 0.5,
      color: '#9933ff',
      spread: 0.8,
      gravity: 0,
    },
  },
  smoke: {
    id: 'smoke',
    label: 'Fumo',
    icon: '💨',
    category: 'environment',
    description: 'Partículas cinzas, sobem (gravidade negativa), vida longa',
    config: {
      maxParticles: 50,
      emissionRate: 8,
      particleLife: 4,
      particleSize: 0.4,
      particleSpeed: 0.3,
      color: '#888888',
      spread: 1.2,
      gravity: -1.5,
    },
  },
  fire: {
    id: 'fire',
    label: 'Fogo',
    icon: '🔥',
    category: 'environment',
    description: 'Partículas vermelhas/laranjas emissivas, sem gravidade',
    config: {
      maxParticles: 70,
      emissionRate: 25,
      particleLife: 1.2,
      particleSize: 0.25,
      particleSpeed: 1.5,
      color: '#ff6600',
      spread: 0.5,
      gravity: 0,
    },
  },
  sparkle: {
    id: 'sparkle',
    label: 'Brilho',
    icon: '⭐',
    category: 'magic',
    description: 'Partículas brancas pequenas, emissivas, dispersão ampla',
    config: {
      maxParticles: 40,
      emissionRate: 20,
      particleLife: 1.5,
      particleSize: 0.05,
      particleSpeed: 2,
      color: '#ffffff',
      spread: 4,
      gravity: 0,
    },
  },
}

/**
 * Aplica um VFX preset numa posição, criando um ParticleObject na cena ativa.
 *
 * @param {string} presetId — ID do preset (ex: 'explosion', 'impact')
 * @param {[number, number, number]} position — posição [x, y, z]
 * @param {object} store — useStore.getState()
 * @returns {string|null} — instanceId do ParticleObject criado, ou null se erro
 */
export function applyVfxPreset(presetId, position, store) {
  const preset = VFX_PRESETS[presetId]
  if (!preset || !store) {
    store?.toast?.('VFX preset inválido', 'error')
    return null
  }

  if (!store.activeSceneId) {
    store.toast?.('Crie uma cena primeiro', 'error')
    return null
  }

  // Criar ParticleObject na cena ativa
  const conect = store.addConectToScene('ParticleObject', position)
  if (!conect) return null

  // Aplicar configuração do preset
  store.updateConect(conect.instanceId, {
    ...preset.config,
    name: `VFX: ${preset.label}`,
  })

  store.toast?.(`VFX "${preset.label}" criado em (${position[0]}, ${position[1]}, ${position[2]})`, 'success', 1500)
  return conect.instanceId
}

/**
 * Retorna VFX presets agrupados por categoria.
 * @returns {{ combat: Array, magic: Array, environment: Array }}
 */
export function getVfxByCategory() {
  const combat = []
  const magic = []
  const environment = []
  for (const preset of Object.values(VFX_PRESETS)) {
    if (preset.category === 'combat') combat.push(preset)
    else if (preset.category === 'magic') magic.push(preset)
    else if (preset.category === 'environment') environment.push(preset)
  }
  return { combat, magic, environment }
}

export default { VFX_PRESETS, applyVfxPreset, getVfxByCategory }

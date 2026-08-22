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
    description: 'Partículas vermelhas/laranjas com gravidade, vida curta, onda de choque',
    config: {
      maxParticles: 120,
      emissionRate: 60,
      particleLife: 0.8,
      particleSize: 0.4,
      particleSpeed: 6,
      color: '#ff4500',
      spread: 4,
      gravity: 3,
      // Fase 13 — VFX profissional: propriedades extra
      emissive: '#ff6600',
      emissiveIntensity: 1.5,
      secondaryColor: '#ffaa00',
      shockwave: true,
      shockwaveRadius: 5,
      shockwaveSpeed: 8,
      smokeTrail: true,
      debris: true,
      debrisCount: 8,
    },
  },
  impact: {
    id: 'impact',
    label: 'Impacto',
    icon: '⚡',
    category: 'combat',
    description: 'Faíscas amarelas, dispersão direcional, sem gravidade, flash',
    config: {
      maxParticles: 50,
      emissionRate: 50,
      particleLife: 0.4,
      particleSize: 0.1,
      particleSpeed: 5,
      color: '#ffdd00',
      spread: 2,
      gravity: 1,
      emissive: '#ffff00',
      emissiveIntensity: 2.0,
      flash: true,
      flashRadius: 2,
      flashDuration: 0.1,
    },
  },
  magicTrail: {
    id: 'magicTrail',
    label: 'Rasto Mágico',
    icon: '✨',
    category: 'magic',
    description: 'Partículas roxas/azuis, sem gravidade, vida longa, brilho pulsante',
    config: {
      maxParticles: 80,
      emissionRate: 20,
      particleLife: 3,
      particleSize: 0.2,
      particleSpeed: 0.5,
      color: '#9933ff',
      spread: 1,
      gravity: 0,
      emissive: '#cc66ff',
      emissiveIntensity: 1.2,
      pulseEffect: true,
      pulseSpeed: 2,
      trailFade: true,
    },
  },
  smoke: {
    id: 'smoke',
    label: 'Fumo',
    icon: '💨',
    category: 'environment',
    description: 'Partículas cinzas que sobem, expandem e dissipam',
    config: {
      maxParticles: 60,
      emissionRate: 10,
      particleLife: 4,
      particleSize: 0.6,
      particleSpeed: 0.3,
      color: '#888888',
      spread: 1.5,
      gravity: -2,
      expand: true,
      expandRate: 0.5,
      opacityFade: true,
    },
  },
  fire: {
    id: 'fire',
    label: 'Fogo',
    icon: '🔥',
    category: 'environment',
    description: 'Partículas vermelhas/laranjas emissivas, flicker, sem gravidade',
    config: {
      maxParticles: 100,
      emissionRate: 35,
      particleLife: 1.0,
      particleSize: 0.35,
      particleSpeed: 2,
      color: '#ff6600',
      spread: 0.8,
      gravity: -0.5,
      emissive: '#ff3300',
      emissiveIntensity: 2.0,
      flicker: true,
      flickerSpeed: 8,
      secondaryColor: '#ffff00',
    },
  },
  sparkle: {
    id: 'sparkle',
    label: 'Brilho',
    icon: '⭐',
    category: 'magic',
    description: 'Partículas brancas pequenas, emissivas, dispersão ampla, twinkle',
    config: {
      maxParticles: 60,
      emissionRate: 25,
      particleLife: 1.5,
      particleSize: 0.08,
      particleSpeed: 3,
      color: '#ffffff',
      spread: 5,
      gravity: 0,
      emissive: '#ffffff',
      emissiveIntensity: 1.5,
      twinkle: true,
      twinkleSpeed: 5,
    },
  },
  // Fase 13 — VFX profissional: novos presets realistas
  muzzleFlash: {
    id: 'muzzleFlash',
    label: 'Flash de Arma',
    icon: '🎯',
    category: 'combat',
    description: 'Flash rápido da boca de uma arma ao disparar',
    config: {
      maxParticles: 15,
      emissionRate: 50,
      particleLife: 0.15,
      particleSize: 0.3,
      particleSpeed: 3,
      color: '#ffff99',
      spread: 0.5,
      gravity: 0,
      emissive: '#ffff00',
      emissiveIntensity: 3.0,
      flash: true,
      flashRadius: 1.5,
      flashDuration: 0.08,
      directionCone: true,
    },
  },
  bloodSplash: {
    id: 'bloodSplash',
    label: 'Salpico de Sangue',
    icon: '🩸',
    category: 'combat',
    description: 'Salpico vermelho com gravidade, gotas que caem',
    config: {
      maxParticles: 40,
      emissionRate: 40,
      particleLife: 1.2,
      particleSize: 0.15,
      particleSpeed: 4,
      color: '#cc0000',
      spread: 3,
      gravity: 5,
      dripEffect: true,
      stainRadius: 0.5,
    },
  },
  portalEffect: {
    id: 'portalEffect',
    label: 'Portal Mágico',
    icon: '🌀',
    category: 'magic',
    description: 'Efeito de portal giratório com partículas em espiral',
    config: {
      maxParticles: 100,
      emissionRate: 30,
      particleLife: 2,
      particleSize: 0.15,
      particleSpeed: 1,
      color: '#00ffff',
      spread: 1,
      gravity: 0,
      emissive: '#0099ff',
      emissiveIntensity: 1.5,
      spiral: true,
      spiralSpeed: 3,
      spiralRadius: 2,
    },
  },
  electricArc: {
    id: 'electricArc',
    label: 'Arco Elétrico',
    icon: '⚡',
    category: 'magic',
    description: 'Arcos elétricos azuis com flicker rápido',
    config: {
      maxParticles: 30,
      emissionRate: 60,
      particleLife: 0.2,
      particleSize: 0.05,
      particleSpeed: 8,
      color: '#00aaff',
      spread: 2,
      gravity: 0,
      emissive: '#00ffff',
      emissiveIntensity: 3.0,
      flicker: true,
      flickerSpeed: 20,
      arc: true,
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

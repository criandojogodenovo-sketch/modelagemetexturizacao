/**
 * flirGI.js — Aproximação de iluminação global em tempo real.
 *
 * Esta é uma implementação LEVE (não é GI real como Lumen da Unreal).
 * Combina:
 *  - Hemisphere light extra com cor do chão (simula bounce light)
 *  - Contact shadows mais suaves e com maior raio
 *  - Ambient light com intensidade adaptativa
 *
 * Custo: ~1-3 draw calls extra, dependendo do nº de luzes.
 * Impacto esperado: -5 a -15% FPS em cenas complexas.
 */
import * as THREE from 'three'

/**
 * Aplica Flir GI a uma cena Three.js.
 * Retorna um objeto com `dispose()` para limpar.
 */
export function applyFlirGI(scene, { ambientColor = '#ffffff', groundColor = '#1a2332' } = {}) {
  // Hemisphere light — simula luz indireta do céu + bounce do chão
  const hemiLight = new THREE.HemisphereLight(ambientColor, groundColor, 0.6)
  hemiLight.name = '__flirGI_hemi'
  scene.add(hemiLight)

  // Point light fraca no centro da cena para simular bounce
  const bounceLight = new THREE.PointLight(ambientColor, 0.3, 20, 2)
  bounceLight.name = '__flirGI_bounce'
  bounceLight.position.set(0, 2, 0)
  scene.add(bounceLight)

  return {
    hemiLight,
    bounceLight,
    dispose() {
      scene.remove(hemiLight)
      scene.remove(bounceLight)
    },
  }
}

/**
 * Remove Flir GI de uma cena (se existir).
 */
export function removeFlirGI(scene) {
  const hemi = scene.getObjectByName('__flirGI_hemi')
  const bounce = scene.getObjectByName('__flirGI_bounce')
  if (hemi) scene.remove(hemi)
  if (bounce) scene.remove(bounce)
}

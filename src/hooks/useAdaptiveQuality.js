/**
 * useAdaptiveQuality — hook que integra AdaptiveQualityController no useFrame do R3F.
 *
 * Performance Core Fase 3.2 — Adaptive Quality.
 *
 * Responsabilidades:
 *  - Iniciar AdaptiveQualityController quando Play Mode começa
 *  - A cada frame, chamar controller.update(deltaMs) para avaliar histerese
 *  - Aplicar DPR via gl.setPixelRatio (callback)
 *  - Aplicar shadows toggle via estado React local (callback)
 *  - No cleanup (Stop), restaurar estado original via controller.restore()
 *
 * Estado React local:
 *  - adaptiveShadowsEnabled: boolean (lido por ShadowOptimizer para saber se deve atuar)
 *
 * Não acoplado ao store Zustand — lê PerformanceBudget diretamente.
 * Não persiste nada no projeto — estado puramente Runtime.
 *
 * Preserva Bug #4 (Editor/Runtime isolation): restore() garante estado original.
 * Preserva Bug #6 (session guard): se Play parar durante CRITICAL, restore limpa tudo.
 * Preserva Bug #7 (collision cleanup): não interfere com collisionEventsRef.
 *
 * FlirScript-friendly: AdaptiveQualityController é singleton acessível via
 * `import { AdaptiveQuality } from '../utils/adaptiveQuality'` para futura API.
 */
import { useEffect, useRef, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { AdaptiveQuality } from '../utils/adaptiveQuality'

export default function useAdaptiveQuality({ enabled = false, originalDpr = 1.5, originalShadowsEnabled = true } = {}) {
  const { gl } = useThree()
  // Estado local para ShadowOptimizer saber se shadows estão temporariamente desligadas
  const [adaptiveShadowsEnabled, setAdaptiveShadowsEnabled] = useState(true)
  const startedRef = useRef(false)

  useEffect(() => {
    if (!enabled) return
    // Iniciar controller com callbacks que aplicam estado
    AdaptiveQuality.start({
      originalDpr,
      originalShadowsEnabled,
      onDprChange: (dpr) => {
        // Aplicar DPR no renderer Three.js
        if (gl) gl.setPixelRatio(dpr)
      },
      onShadowsChange: (enabledFlag) => {
        setAdaptiveShadowsEnabled(enabledFlag)
      },
    })
    startedRef.current = true
    return () => {
      // Cleanup: restaurar DPR e shadows ao original
      AdaptiveQuality.restore()
      // Aplicar DPR original no renderer
      if (gl) gl.setPixelRatio(originalDpr)
      setAdaptiveShadowsEnabled(true)
      startedRef.current = false
    }
  }, [enabled, originalDpr, originalShadowsEnabled, gl])

  // Update a cada frame — chama controller.update(deltaMs)
  useFrame((_, delta) => {
    if (!startedRef.current) return
    AdaptiveQuality.update(delta * 1000)
  })

  return {
    adaptiveShadowsEnabled,
    // Getters expostos para componentes消费者 (futura FlirScript API)
    getDpr: () => AdaptiveQuality.getDpr(),
    getQualityLevel: () => AdaptiveQuality.getQualityLevel(),
    isCritical: () => AdaptiveQuality.isCritical(),
  }
}

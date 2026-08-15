/**
 * AdaptiveQuality — componente R3F que integra Adaptive Quality no Canvas.
 *
 * Performance Core Fase 3.2.
 *
 * Combina:
 *  - useAdaptiveQuality hook (DPR + shadows toggle via state machine)
 *  - ShadowOptimizer component (distance-based castShadow toggle)
 *
 * Uso:
 *   <AdaptiveQuality
 *     meshRefs={meshRefs}
 *     conectMeshRefs={conectMeshRefs}
 *     enabled={isGameMode}
 *     originalDpr={dprMax}
 *     originalShadowsEnabled={renderSettings?.shadowOptimizations !== false}
 *   />
 *
 * Estado puramente Runtime — não persiste no projeto.
 * Preserva Bug #4 (Editor/Runtime isolation): restore no cleanup.
 */
import useAdaptiveQuality from '../../hooks/useAdaptiveQuality'
import ShadowOptimizer from './ShadowOptimizer'

export default function AdaptiveQuality({
  meshRefs,
  conectMeshRefs,
  enabled = false,
  originalDpr = 1.5,
  originalShadowsEnabled = true,
}) {
  const { adaptiveShadowsEnabled } = useAdaptiveQuality({
    enabled,
    originalDpr,
    originalShadowsEnabled,
  })

  // ShadowOptimizer só atua se adaptiveShadowsEnabled === true
  // (quando Adaptive Quality desliga shadows temporariamente, ShadowOptimizer
  //  não precisa de fazer distance culling — tudo está desligado)
  return (
    <ShadowOptimizer
      meshRefs={meshRefs}
      conectMeshRefs={conectMeshRefs}
      enabled={enabled && adaptiveShadowsEnabled}
    />
  )
}

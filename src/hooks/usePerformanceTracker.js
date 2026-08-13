/**
 * usePerformanceTracker — hook que integra PerformanceStats + PerformanceBudget
 * no loop useFrame do R3F, com overhead mínimo.
 *
 * Deve ser usado DENTRO do <Canvas> (precisa de useThree para obter gl e scene).
 *
 * Uso:
 *   import usePerformanceTracker from '../../hooks/usePerformanceTracker'
 *   // dentro do Canvas:
 *   usePerformanceTracker()
 *
 * O hook actualiza PerformanceStats e PerformanceBudget a cada frame,
 * e expõe o snapshot no store Zustand a cada ~500ms (não por frame).
 */
import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { PerformanceStats } from '../utils/performanceStats'
import { PerformanceBudget } from '../utils/performanceBudget'
import { useStore } from '../store/useStore'

// Intervalo para actualizar o store (ms) — não por frame
const STORE_UPDATE_INTERVAL_MS = 500

export default function usePerformanceTracker() {
  const { gl, scene } = useThree()
  const lastStoreUpdateRef = useRef(0)
  const setPerfStats = useStore((s) => s.setPerfStats)

  useFrame((_, delta) => {
    // Clamp delta para evitar saltos (tab em background)
    const dt = Math.min(delta, 0.1)

    // Actualizar métricas (leve — sem allocations)
    PerformanceStats.update(dt, gl, scene)

    // Actualizar budget com frame time real
    const frameTimeMs = dt * 1000
    PerformanceBudget.update(frameTimeMs)

    // Actualizar store a cada STORE_UPDATE_INTERVAL_MS (não por frame)
    const now = (typeof performance !== 'undefined') ? performance.now() : 0
    if (now - lastStoreUpdateRef.current >= STORE_UPDATE_INTERVAL_MS) {
      lastStoreUpdateRef.current = now
      const snapshot = PerformanceStats.getSnapshot()
      const budget = PerformanceBudget.getBudget()
      const state = PerformanceBudget.getState()
      const avgFrameTime = PerformanceBudget.getAverageFrameTime()

      if (setPerfStats) {
        setPerfStats({
          ...snapshot,
          budget,
          state,
          avgFrameTime,
        })
      }
    }
  })

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      PerformanceStats.reset()
      PerformanceBudget.reset()
    }
  }, [])
}

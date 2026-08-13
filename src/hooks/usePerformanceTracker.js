/**
 * usePerformanceTracker — hook que integra PerformanceStats + PerformanceBudget
 * no loop useFrame do R3F, com overhead mínimo.
 */
import { useThree, useFrame } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import { PerformanceStats } from '../utils/performanceStats'
import { PerformanceBudget } from '../utils/performanceBudget'
import { useStore } from '../store/useStore'

const STORE_UPDATE_INTERVAL_MS = 500

export default function usePerformanceTracker() {
  const { gl, scene } = useThree()
  const lastStoreUpdateRef = useRef(0)
  const setPerfStats = useStore((s) => s.setPerfStats)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    PerformanceStats.update(dt, gl, scene)
    PerformanceBudget.update(dt * 1000)
    const now = (typeof performance !== 'undefined') ? performance.now() : 0
    if (now - lastStoreUpdateRef.current >= STORE_UPDATE_INTERVAL_MS) {
      lastStoreUpdateRef.current = now
      const snapshot = PerformanceStats.getSnapshot()
      const state = PerformanceBudget.getState()
      const avgFrameTime = PerformanceBudget.getAverageFrameTime()
      if (setPerfStats) {
        setPerfStats({ ...snapshot, state, avgFrameTime })
      }
    }
  })

  useEffect(() => {
    return () => { PerformanceStats.reset(); PerformanceBudget.reset() }
  }, [])
}

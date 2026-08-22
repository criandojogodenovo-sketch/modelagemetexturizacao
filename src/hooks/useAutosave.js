/**
 * useAutosave — hook para autosave inteligente (ItsMagic-style).
 *
 * - Marca estado como "dirty" quando há alterações
 * - Guarda automaticamente a cada 5s se houver alterações
 * - Mostra toast de confirmação
 */
import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { saveProject, isIndexedDBAvailable } from '../utils/db'

const AUTOSAVE_INTERVAL_MS = 5000

export function useAutosave() {
  const objects = useStore((s) => s.objects)
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const background = useStore((s) => s.background)
  const lights = useStore((s) => s.lights)
  const grid = useStore((s) => s.grid)
  const markDirty = useStore((s) => s.markDirty)
  const markSaving = useStore((s) => s.markSaving)
  const markSaved = useStore((s) => s.markSaved)
  const toast = useStore((s) => s.toast)

  // Snapshot dos valores anteriores para detectar mudanças
  const prevSnapshotRef = useRef('')
  const autosaveTimerRef = useRef(null)

  // Detectar dirty (qualquer alteração no estado relevante)
  useEffect(() => {
    const snapshot = JSON.stringify({ objects, scenes, activeSceneId, background, lights, grid })
    if (snapshot !== prevSnapshotRef.current) {
      if (prevSnapshotRef.current !== '') {
        // Houve mudança real
        markDirty()
      }
      prevSnapshotRef.current = snapshot
    }
  }, [objects, scenes, activeSceneId, background, lights, grid, markDirty])

  // Autosave timer
  useEffect(() => {
    const interval = setInterval(async () => {
      const { autosave } = useStore.getState()
      if (!autosave.dirty || autosave.saving) return

      markSaving()
      try {
        if (isIndexedDBAvailable()) {
          const state = useStore.getState()
          const projectData = {
            objects: state.objects,
            scenes: state.scenes,
            activeSceneId: state.activeSceneId,
            background: state.background,
            lights: state.lights,
            grid: state.grid,
            savedAt: Date.now(),
          }
          await saveProject('default', projectData)
        }
        markSaved()
        // Toast só de vez em quando (não a cada 5s)
        if (Math.random() < 0.3) {
          toast('💾 Guardado automaticamente', 'info', 1500)
        }
      } catch (err) {
        console.warn('[autosave] erro:', err)
        markSaved() // limpar saving state mesmo em erro
      }
    }, AUTOSAVE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [markSaving, markSaved, toast])
}

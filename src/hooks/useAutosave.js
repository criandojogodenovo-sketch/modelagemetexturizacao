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
    // S17 fix (P2-19): durante o Play Mode NÃO se marca dirty — spawns/portais/
    // prefabs expandidos pelo jogo mutam `scenes` e eram sinalizados como
    // alterações do utilizador, sendo persistidos para IndexedDB em ≤5s
    // (contaminação do estado do editor). O snapshot atualiza-se silenciosamente
    // para que, ao SAIR do Play, as mutações do jogo também não marquem dirty.
    const playing = useStore.getState().scenePreviewOpen
    const snapshot = JSON.stringify({ objects, scenes, activeSceneId, background, lights, grid })
    if (snapshot !== prevSnapshotRef.current) {
      if (prevSnapshotRef.current !== '' && !playing) {
        // Houve mudança real do utilizador (fora do Play Mode)
        markDirty()
      }
      prevSnapshotRef.current = snapshot
    }
  }, [objects, scenes, activeSceneId, background, lights, grid, markDirty])

  // Autosave timer
  useEffect(() => {
    const interval = setInterval(async () => {
      // S17 fix (P2-19): nunca guardar durante o Play Mode — o estado em jogo
      // (spawns, portais, expansão de prefabs) não é estado de edição
      if (useStore.getState().scenePreviewOpen) return
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
            projectName: state.projectName, // S17 (P2-20): round-trip completo
            renderSettings: state.renderSettings,
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

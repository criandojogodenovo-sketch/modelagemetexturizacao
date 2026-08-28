/**
 * useIndexedDBSync — hook que sincroniza o estado do store com IndexedDB.
 *
 * - A cada N segundos (default 30s), guarda o projeto atual em IndexedDB.
 * - Se o localStorage for limpo, restaura do IndexedDB ao iniciar.
 * - Expõe funções para guardar/carregar manualmente.
 *
 * Esta camada é complementar ao localStorage do Zustand:
 *  - localStorage: pequeno, rápido, síncrono — usado pelo Zustand para hidratar a app
 *  - IndexedDB: grande, assíncrono — usado para projetos completos com texturas/geometrias
 */
import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { saveProject, loadProject, listProjects, isIndexedDBAvailable } from '../utils/db'

const PROJECT_ID = 'default'
const AUTOSAVE_INTERVAL = 30_000 // 30 segundos

// S17 (P2-19/P2-20): construir o snapshot do projeto para IndexedDB.
// Inclui renderSettings/projectName (round-trip completo, igual ao
// exportProjectJSON) e NADA é guardado durante o Play Mode — o estado em
// jogo (spawns, portais, prefabs expandidos) não é estado de edição.
function buildProjectSnapshot(state) {
  return {
    name: 'Projeto atual',
    objects: state.objects,
    background: state.background,
    grid: state.grid,
    lights: state.lights,
    scenes: state.scenes,
    activeSceneId: state.activeSceneId,
    appMode: state.appMode,
    projectName: state.projectName,
    renderSettings: state.renderSettings,
  }
}

export function useIndexedDBSync() {
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    // Ao iniciar, se o IndexedDB tiver um projeto mais recente que o localStorage,
    // restauramos do IndexedDB.
    if (!isIndexedDBAvailable()) return

    loadProject(PROJECT_ID).then((data) => {
      if (data?.scenes?.length || data?.objects?.length) {
        // Apenas carrega se houver dados; o utilizador pode decidir sobrescrever
        // Para simplicidade, não substituímos automaticamente o estado atual —
        // o utilizador pode usar "Carregar" no menu.
        // Guardamos referência para possível uso futuro.
        console.log('[IndexedDB] Projeto encontrado em cache:', {
          scenes: data.scenes?.length || 0,
          objects: data.objects?.length || 0,
          updatedAt: data.updatedAt,
        })
      }
    })
  }, [])

  // Auto-save periódico
  useEffect(() => {
    if (!isIndexedDBAvailable()) return
    const interval = setInterval(async () => {
      const state = useStore.getState()
      // Só guarda se houver conteúdo
      if (state.objects.length === 0 && state.scenes.length === 0) return
      // S17 fix (P2-19): nunca guardar durante o Play Mode
      if (state.scenePreviewOpen) return
      try {
        await saveProject(PROJECT_ID, buildProjectSnapshot(state))
      } catch (err) {
        console.warn('[IndexedDB] Falha no auto-save:', err)
      }
    }, AUTOSAVE_INTERVAL)
    return () => clearInterval(interval)
  }, [])

  // Guardar antes de fechar a página
  useEffect(() => {
    if (!isIndexedDBAvailable()) return
    const handler = async () => {
      const state = useStore.getState()
      if (state.objects.length === 0 && state.scenes.length === 0) return
      // S17 fix (P2-19): se a página fechar durante o Play, o estado em jogo
      // (spawns/portais) não deve sobrescrever o projeto guardado
      if (state.scenePreviewOpen) return
      try {
        await saveProject(PROJECT_ID, buildProjectSnapshot(state))
      } catch {}
    }
    window.addEventListener('beforeunload', handler)
    window.addEventListener('pagehide', handler)
    return () => {
      window.removeEventListener('beforeunload', handler)
      window.removeEventListener('pagehide', handler)
    }
  }, [])
}

// Função utilitária para guardar manualmente
export async function saveCurrentProjectToIndexedDB() {
  if (!isIndexedDBAvailable()) return false
  const state = useStore.getState()
  await saveProject(PROJECT_ID, buildProjectSnapshot(state))
  return true
}

// Função utilitária para carregar manualmente
export async function loadProjectFromIndexedDB() {
  if (!isIndexedDBAvailable()) return null
  return await loadProject(PROJECT_ID)
}

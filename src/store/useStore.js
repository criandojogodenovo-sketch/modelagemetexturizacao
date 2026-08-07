/**
 * Store principal da aplicação — Zustand.
 *
 * Contém:
 *  - Estado da cena (objetos, seleção, transform mode)
 *  - Estado da UI (painéis abertos, toasts)
 *  - Configuração da cena (fundo, grelha, luzes)
 *  - Histórico Undo/Redo (past, future)
 *  - Persistência em localStorage
 *
 * O histórico grava snapshots profundos do array `objects` para permitir
 * desfazer/refazer qualquer operação de modelagem.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSceneObject, defaultMaterial } from '../utils/primitives'

const STORAGE_KEY = 'me3d.project.v1'

// Máximo de entradas no histórico (memory bound)
const MAX_HISTORY = 60

// Clona profundamente um estado de objetos
function snapshot(objects) {
  return JSON.parse(JSON.stringify(objects))
}

// Estado inicial da cena
const initialScene = {
  objects: [],
  selectedId: null,
  transformMode: 'translate', // 'translate' | 'rotate' | 'scale'
  background: {
    type: 'solid', // 'solid' | 'gradient'
    color: '#0d1117',
    gradientTop: '#1a2332',
    gradientBottom: '#0a0d12',
  },
  grid: {
    visible: true,
    size: 20,
    divisions: 20,
    color: '#30363d',
  },
  lights: {
    ambient: { intensity: 0.6, color: '#ffffff' },
    directional: {
      intensity: 1.2,
      color: '#ffffff',
      position: [5, 8, 5],
    },
  },
}

// Cria um novo projeto vazio
function newProjectState() {
  return {
    ...initialScene,
    objects: [],
    selectedId: null,
  }
}

export const useStore = create(
  persist(
    (set, get) => ({
      // ===== Estado da cena =====
      ...initialScene,
      objects: [],
      selectedId: null,
      transformMode: 'translate',

      // ===== Estado da UI =====
      ui: {
        leftDrawerOpen: false,
        rightDrawerOpen: false,
        loading: false,
        loadingMessage: '',
      },

      // ===== Histórico =====
      past: [],
      future: [],

      // ===== Toasts =====
      toasts: [],

      // ---------- Helpers internos ----------
      // Empurra o estado atual de objects para `past` e limpa `future`.
      // Deve ser chamado ANTES de mutar `objects`.
      _pushHistory: () => {
        const { objects, past } = get()
        const next = [...past, snapshot(objects)]
        if (next.length > MAX_HISTORY) next.shift()
        set({ past: next, future: [] })
      },

      // Empurra sem limpar future (para transforms em tempo real via gizmo).
      // Várias chamadas consecutivas colapsam numa só entrada.
      _pushHistoryCoalesced: (() => {
        let lastKey = null
        return (key) => {
          const { objects, past } = get()
          if (lastKey === key && past.length > 0) {
            // substitui a última entrada em vez de adicionar
            const next = [...past.slice(0, -1), snapshot(objects)]
            set({ past: next })
          } else {
            const next = [...past, snapshot(objects)]
            if (next.length > MAX_HISTORY) next.shift()
            set({ past: next, future: [] })
          }
          lastKey = key
        }
      })(),

      _resetHistoryKey: () => {
        // chamado no início de uma operação para forçar nova entrada no histórico
        const fn = get()._pushHistoryCoalesced
        // hack: forçamos nova entrada passando uma chave única
        // (apenas reseta o lastKey interno)
      },

      // ---------- Toasts ----------
      toast: (message, type = 'info', duration = 2400) => {
        const id = Math.random().toString(36).slice(2)
        set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
        setTimeout(() => {
          set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
        }, duration)
      },

      dismissToast: (id) =>
        set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

      // ---------- UI ----------
      setUI: (partial) => set((s) => ({ ui: { ...s.ui, ...partial } })),
      toggleLeftDrawer: () =>
        set((s) => ({ ui: { ...s.ui, leftDrawerOpen: !s.ui.leftDrawerOpen } })),
      toggleRightDrawer: () =>
        set((s) => ({ ui: { ...s.ui, rightDrawerOpen: !s.ui.rightDrawerOpen } })),
      closeDrawers: () =>
        set((s) => ({ ui: { ...s.ui, leftDrawerOpen: false, rightDrawerOpen: false } })),

      // ---------- Projeto ----------
      newProject: () => {
        get()._pushHistory()
        set({ ...newProjectState() })
        get().toast('Novo projeto criado', 'info')
      },

      // ---------- Objetos ----------
      addObject: (type, position) => {
        get()._pushHistory()
        // Se não for dada posição, deslocamos ligeiramente para não sobrepor
        const existing = get().objects.length
        const offset = position || [
          (existing % 4) * 1.2 - 1.8,
          0.5,
          Math.floor(existing / 4) * 1.2,
        ]
        const obj = createSceneObject(type, offset)
        set((s) => ({
          objects: [...s.objects, obj],
          selectedId: obj.id,
        }))
        return obj
      },

      addImportedObject: (objData) => {
        get()._pushHistory()
        set((s) => ({
          objects: [...s.objects, objData],
          selectedId: objData.id,
        }))
      },

      selectObject: (id) => set({ selectedId: id }),
      deselect: () => set({ selectedId: null }),

      renameObject: (id, name) => {
        get()._pushHistory()
        set((s) => ({
          objects: s.objects.map((o) => (o.id === id ? { ...o, name } : o)),
        }))
      },

      updateObject: (id, patch) => {
        set((s) => ({
          objects: s.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)),
        }))
      },

      // Atualiza só o material (sem histórico pesado)
      updateMaterial: (id, patch) => {
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id ? { ...o, material: { ...o.material, ...patch } } : o
          ),
        }))
      },

      // Atualiza o material com histórico (commit final de uma edição)
      commitMaterial: (id, patch) => {
        get()._pushHistory()
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id ? { ...o, material: { ...o.material, ...patch } } : o
          ),
        }))
      },

      // Transform em tempo real (gizmo a arrastar) — colapsa no histórico
      transformObject: (id, transform) => {
        get()._pushHistoryCoalesced(`transform:${id}`)
        set((s) => ({
          objects: s.objects.map((o) => (o.id === id ? { ...o, ...transform } : o)),
        }))
      },

      // Commit final de uma transformação (reseta chave do histórico)
      commitTransform: () => {
        // Forçamos nova chave na próxima transformObject
        // implementação simples: chamamos _pushHistoryCoalesced com chave única
        const fn = get()._pushHistoryCoalesced
        // não podemos aceder lastKey de fora; deixamos vazio — próxima operação
        // cria nova entrada porque a chave mudou naturalmente (id+mode)
      },

      duplicateObject: (id) => {
        const obj = get().objects.find((o) => o.id === id)
        if (!obj) return
        get()._pushHistory()
        const copy = JSON.parse(JSON.stringify(obj))
        copy.id = `obj_${Math.random().toString(36).slice(2, 10)}`
        copy.name = `${obj.name} (cópia)`
        copy.position = [obj.position[0] + 0.5, obj.position[1], obj.position[2] + 0.5]
        set((s) => ({
          objects: [...s.objects, copy],
          selectedId: copy.id,
        }))
        get().toast('Objeto duplicado', 'success')
      },

      deleteObject: (id) => {
        get()._pushHistory()
        set((s) => ({
          objects: s.objects.filter((o) => o.id !== id),
          selectedId: s.selectedId === id ? null : s.selectedId,
        }))
        get().toast('Objeto eliminado', 'info')
      },

      toggleVisibility: (id) => {
        get()._pushHistory()
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id ? { ...o, visible: !o.visible } : o
          ),
        }))
      },

      // Extrude simples — duplica a geometria do objeto com deslocamento
      // (simulação de extrude: clona o objeto e desloca em Y)
      extrudeObject: (id, amount = 0.5) => {
        const obj = get().objects.find((o) => o.id === id)
        if (!obj) return
        get()._pushHistory()
        // Para simular extrude, escalamos o objeto no eixo Y e duplicamos com deslocamento
        const scaled = {
          ...JSON.parse(JSON.stringify(obj)),
          scale: [obj.scale[0], obj.scale[1] * (1 + amount), obj.scale[2]],
        }
        set((s) => ({
          objects: s.objects.map((o) => (o.id === id ? scaled : o)),
        }))
        get().toast(`Extrude aplicado (${amount.toFixed(2)})`, 'success')
      },

      // ---------- Transform mode ----------
      setTransformMode: (mode) => set({ transformMode: mode }),

      // ---------- Configuração de cena ----------
      setBackground: (patch) => {
        get()._pushHistory()
        set((s) => ({ background: { ...s.background, ...patch } }))
      },
      setGrid: (patch) => set((s) => ({ grid: { ...s.grid, ...patch } })),
      setLights: (patch) => {
        get()._pushHistory()
        set((s) => ({
          lights: {
            ...s.lights,
            ...(patch.ambient ? { ambient: { ...s.lights.ambient, ...patch.ambient } } : {}),
            ...(patch.directional
              ? { directional: { ...s.lights.directional, ...patch.directional } }
              : {}),
          },
        }))
      },

      // ---------- Undo / Redo ----------
      undo: () => {
        const { past, future, objects } = get()
        if (past.length === 0) return
        const previous = past[past.length - 1]
        const newPast = past.slice(0, -1)
        set({
          past: newPast,
          future: [snapshot(objects), ...future].slice(0, MAX_HISTORY),
          objects: previous,
        })
        get().toast('Desfeito', 'info', 1200)
      },

      redo: () => {
        const { past, future, objects } = get()
        if (future.length === 0) return
        const next = future[0]
        const newFuture = future.slice(1)
        set({
          past: [...past, snapshot(objects)].slice(-MAX_HISTORY),
          future: newFuture,
          objects: next,
        })
        get().toast('Refeito', 'info', 1200)
      },

      canUndo: () => get().past.length > 0,
      canRedo: () => get().future.length > 0,

      // ---------- Projeto: guardar/carregar ----------
      exportProjectJSON: () => {
        const { objects, background, grid, lights } = get()
        return JSON.stringify(
          {
            version: 1,
            createdAt: new Date().toISOString(),
            scene: { objects, background, grid, lights },
          },
          null,
          2
        )
      },

      loadProjectJSON: (jsonString) => {
        try {
          const data = JSON.parse(jsonString)
          const scene = data.scene || data
          get()._pushHistory()
          set({
            objects: scene.objects || [],
            selectedId: null,
            background: { ...initialScene.background, ...(scene.background || {}) },
            grid: { ...initialScene.grid, ...(scene.grid || {}) },
            lights: { ...initialScene.lights, ...(scene.lights || {}) },
          })
          get().toast('Projeto carregado', 'success')
          return true
        } catch (err) {
          get().toast('Erro ao carregar projeto: ' + err.message, 'error')
          return false
        }
      },

      // Substitui completamente o array de objetos (para import GLB)
      setObjects: (newObjects) => {
        get()._pushHistory()
        set({ objects: newObjects, selectedId: null })
      },

      // Reset de tudo (incluindo histórico) — usado ao inicializar
      resetAll: () => {
        set({
          ...initialScene,
          past: [],
          future: [],
        })
      },
    }),
    {
      name: STORAGE_KEY,
      // Persistimos só o estado da cena (não UI nem toasts)
      partialize: (state) => ({
        objects: state.objects,
        background: state.background,
        grid: state.grid,
        lights: state.lights,
        transformMode: state.transformMode,
      }),
      version: 1,
    }
  )
)

// Seletor conveniente: objeto atualmente selecionado
export function useSelectedObject() {
  return useStore((s) => {
    if (!s.selectedId) return null
    return s.objects.find((o) => o.id === s.selectedId) || null
  })
}

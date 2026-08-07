/**
 * Store principal da aplicação — Zustand.
 *
 * Estado gerido:
 *  - Cena: objetos, seleção, transform mode, fundo, grelha, luzes
 *  - UI: painéis, modo ativo (object/edit/sculpt/uv/paint/rig/animate), toasts, loading
 *  - Histórico Undo/Redo
 *  - Persistência localStorage
 *
 * Ações expostas (além das originais):
 *  - setMode(mode)                              — alternar entre object/edit/sculpt/uv/paint/rig/animate
 *  - setEditModeSelection(mode)                 — vertex/edge/face
 *  - addModifier(id, type)                      — adicionar modificador
 *  - updateModifier(id, index, patch)           — atualizar parâmetros
 *  - removeModifier(id, index)                  — remover modificador
 *  - applyModifierStack(id)                     — calcular geometria final com modificadores
 *  - applyBooleanOp(targetId, toolId, op)       — booleana entre dois objetos
 *  - applyMeshOp(id, op, params)                — extrude/inset/bevel/loop cut/merge/subdivide
 *  - sculptStrokeAt(id, point, normal, params)  — pincelada de esculpir
 *  - setParent(childId, parentId)               — hierarquia
 *  - clearParent(childId)                       — remover parent
 *  - applyMaterialPreset(id, presetId)          — aplicar material predefinido
 *  - addTextureLayer(id, layer)                 — adicionar camada de textura
 *  - updateTextureLayer(id, index, patch)
 *  - removeTextureLayer(id, index)
 *  - unwrapUV(id, method)                       — unwrap automático
 *  - addBone(objId, position)                   — adicionar osso ao esqueleto
 *  - updateBone(objId, boneId, patch)
 *  - removeBone(objId, boneId)
 *  - addKeyframe(objId, clipName, boneId, frame, transform)
 *  - removeKeyframe(objId, clipName, keyframeId)
 *  - playAnimation(objId, clipName)
 *  - pauseAnimation()
 *  - setAnimationTime(time)
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import * as THREE from 'three'
import { createSceneObject, defaultMaterial, PRIMITIVES } from '../utils/primitives'
import { findMaterial } from '../utils/materialLibrary'
import * as meshOps from '../utils/meshOperations'

const STORAGE_KEY = 'me3d.project.v1'

const MAX_HISTORY = 60

function snapshot(objects) {
  // Clona profundamente mas descarta bufferGeometry (não serializável)
  return JSON.parse(JSON.stringify(objects, (key, value) => {
    if (key === 'bufferGeometry' && value && typeof value === 'object') return undefined
    return value
  }))
}

const initialScene = {
  objects: [],
  selectedId: null,
  transformMode: 'translate',
  background: {
    type: 'solid',
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
    hdri: null, // dataURL do HDRI ou null
  },
}

// Modos da aplicação
export const APP_MODES = ['object', 'edit', 'sculpt', 'uv', 'paint', 'rig', 'animate']

// Modos de seleção em edit mode
export const EDIT_SELECTION_MODES = ['vertex', 'edge', 'face']

// Tipos de modificadores suportados
export const MODIFIER_TYPES = {
  subdivision: {
    label: 'Subdivision Surface',
    icon: 'subdivide',
    defaultParams: { levels: 1 },
    description: 'Suaviza a malha subdividindo cada face',
  },
  mirror: {
    label: 'Mirror (Espelho)',
    icon: 'mirror',
    defaultParams: { axis: 'x' },
    description: 'Espelha a geometria num eixo',
  },
  array: {
    label: 'Array (Repetição)',
    icon: 'array',
    defaultParams: { count: 3, offset: [1.5, 0, 0] },
    description: 'Repete a geometria N vezes',
  },
  solidify: {
    label: 'Solidify (Espessura)',
    icon: 'solidify',
    defaultParams: { thickness: 0.1 },
    description: 'Dá espessura a uma superfície',
  },
}

// Tipos de operações booleanas
export const BOOLEAN_OPS = [
  { id: 'union', label: 'União', description: 'A ∪ B' },
  { id: 'subtract', label: 'Subtração', description: 'A − B' },
  { id: 'intersect', label: 'Interseção', description: 'A ∩ B' },
]

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

      // ===== Modo da aplicação =====
      mode: 'object',           // object | edit | sculpt | uv | paint | rig | animate
      editSelectionMode: 'face', // vertex | edge | face
      selectedVertices: [],     // índices de vértices selecionados em edit mode
      selectedEdges: [],
      selectedFaces: [],

      // ===== Sculpt =====
      sculptSettings: {
        brushSize: 0.5,
        brushStrength: 0.05,
        mode: 'raise', // raise | lower | smooth | flatten
      },

      // ===== Texture painting =====
      paintSettings: {
        color: '#ff5555',
        brushSize: 16,
        opacity: 0.8,
      },

      // ===== Animation =====
      animation: {
        playing: false,
        currentTime: 0,
        duration: 60,
        fps: 30,
        activeClip: 'idle',
        loop: true,
      },

      // ===== Estado da UI =====
      ui: {
        leftDrawerOpen: false,
        rightDrawerOpen: false,
        moreToolsOpen: false,  // grelha de "mais ferramentas" em ecrã cheia
        bottomBarOpen: false,  // drawer de ferramentas em mobile
        loading: false,
        loadingMessage: '',
        activePanel: 'tools', // tools | modifiers | materials | animation | scene
      },

      // ===== Histórico =====
      past: [],
      future: [],

      // ===== Toasts =====
      toasts: [],

      // ---------- Helpers internos ----------
      _pushHistory: () => {
        const { objects, past } = get()
        const next = [...past, snapshot(objects)]
        if (next.length > MAX_HISTORY) next.shift()
        set({ past: next, future: [] })
      },

      _pushHistoryCoalesced: (() => {
        let lastKey = null
        return (key) => {
          const { objects, past } = get()
          if (lastKey === key && past.length > 0) {
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
      toggleMoreTools: () =>
        set((s) => ({ ui: { ...s.ui, moreToolsOpen: !s.ui.moreToolsOpen } })),
      toggleBottomBar: () =>
        set((s) => ({ ui: { ...s.ui, bottomBarOpen: !s.ui.bottomBarOpen } })),
      closeDrawers: () =>
        set((s) => ({ ui: { ...s.ui, leftDrawerOpen: false, rightDrawerOpen: false, moreToolsOpen: false, bottomBarOpen: false } })),
      setActivePanel: (panel) =>
        set((s) => ({ ui: { ...s.ui, activePanel: panel, moreToolsOpen: false } })),

      // ---------- Modo ----------
      setMode: (mode) => {
        set({ mode, selectedVertices: [], selectedEdges: [], selectedFaces: [] })
        if (mode === 'edit') set({ transformMode: 'translate' })
        if (mode === 'sculpt' || mode === 'paint') {
          // desligar TransformControls nestes modos
        }
      },
      setEditModeSelection: (mode) => set({ editSelectionMode: mode }),
      setSculptSettings: (patch) =>
        set((s) => ({ sculptSettings: { ...s.sculptSettings, ...patch } })),
      setPaintSettings: (patch) =>
        set((s) => ({ paintSettings: { ...s.paintSettings, ...patch } })),

      // ---------- Projeto ----------
      newProject: () => {
        get()._pushHistory()
        set({ ...newProjectState() })
        get().toast('Novo projeto criado', 'info')
      },

      // ---------- Objetos ----------
      addObject: (type, position) => {
        get()._pushHistory()
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

      selectObject: (id) => set({ selectedId: id, selectedVertices: [], selectedEdges: [], selectedFaces: [] }),
      deselect: () => set({ selectedId: null, selectedVertices: [], selectedEdges: [], selectedFaces: [] }),

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

      updateMaterial: (id, patch) => {
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id ? { ...o, material: { ...o.material, ...patch } } : o
          ),
        }))
      },

      commitMaterial: (id, patch) => {
        get()._pushHistory()
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id ? { ...o, material: { ...o.material, ...patch } } : o
          ),
        }))
      },

      transformObject: (id, transform) => {
        get()._pushHistoryCoalesced(`transform:${id}`)
        set((s) => ({
          objects: s.objects.map((o) => (o.id === id ? { ...o, ...transform } : o)),
        }))
      },

      duplicateObject: (id) => {
        const obj = get().objects.find((o) => o.id === id)
        if (!obj) return
        get()._pushHistory()
        const copy = JSON.parse(JSON.stringify(obj))
        copy.id = `obj_${Math.random().toString(36).slice(2, 10)}`
        copy.name = `${obj.name} (cópia)`
        copy.position = [obj.position[0] + 0.5, obj.position[1], obj.position[2] + 0.5]
        // limpar parent para não herdar transformações
        copy.parentId = null
        set((s) => ({
          objects: [...s.objects, copy],
          selectedId: copy.id,
        }))
        get().toast('Objeto duplicado', 'success')
      },

      deleteObject: (id) => {
        get()._pushHistory()
        set((s) => ({
          objects: s.objects
            .filter((o) => o.id !== id)
            .map((o) => (o.parentId === id ? { ...o, parentId: null } : o)),
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

      extrudeObject: (id, amount = 0.5) => {
        const obj = get().objects.find((o) => o.id === id)
        if (!obj) return
        get()._pushHistory()
        const scaled = {
          ...JSON.parse(JSON.stringify(obj)),
          scale: [obj.scale[0], obj.scale[1] * (1 + amount), obj.scale[2]],
        }
        set((s) => ({
          objects: s.objects.map((o) => (o.id === id ? scaled : o)),
        }))
        get().toast(`Extrude aplicado (${amount.toFixed(2)})`, 'success')
      },

      // ---------- Hierarquia (parent/child) ----------
      setParent: (childId, parentId) => {
        if (childId === parentId) return
        // Evitar ciclos: o parentId não pode ser descendente do childId
        const objects = get().objects
        const wouldCycle = (id, target) => {
          if (id === target) return true
          const obj = objects.find((o) => o.id === id)
          if (!obj || !obj.parentId) return false
          return wouldCycle(obj.parentId, target)
        }
        if (wouldCycle(parentId, childId)) {
          get().toast('Não é possível criar ciclo de parentesco', 'error')
          return
        }
        get()._pushHistory()
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === childId ? { ...o, parentId: parentId || null } : o
          ),
        }))
        get().toast('Objetos agrupados', 'success')
      },

      clearParent: (childId) => {
        get()._pushHistory()
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === childId ? { ...o, parentId: null } : o
          ),
        }))
      },

      // ---------- Modificadores (não destrutivos) ----------
      addModifier: (id, type) => {
        const def = MODIFIER_TYPES[type]
        if (!def) return
        get()._pushHistory()
        const modifier = {
          id: `mod_${Math.random().toString(36).slice(2, 10)}`,
          type,
          enabled: true,
          params: { ...def.defaultParams },
        }
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id ? { ...o, modifiers: [...(o.modifiers || []), modifier] } : o
          ),
        }))
        get().toast(`Modificador "${def.label}" adicionado`, 'success')
      },

      updateModifier: (id, modifierId, patch) => {
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id
              ? {
                  ...o,
                  modifiers: (o.modifiers || []).map((m) =>
                    m.id === modifierId ? { ...m, ...patch, params: { ...m.params, ...(patch.params || {}) } } : m
                  ),
                }
              : o
          ),
        }))
      },

      removeModifier: (id, modifierId) => {
        get()._pushHistory()
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id
              ? { ...o, modifiers: (o.modifiers || []).filter((m) => m.id !== modifierId) }
              : o
          ),
        }))
        get().toast('Modificador removido', 'info')
      },

      // ---------- Operações de malha (edit mode) ----------
      // Aplica uma operação de malha e guarda o resultado em customGeometry
      applyMeshOp: (id, op, params = {}) => {
        const obj = get().objects.find((o) => o.id === id)
        if (!obj) return
        get()._pushHistory()

        // Construir geometria atual
        let geometry
        if (obj.customGeometry) {
          geometry = new THREE.BufferGeometry()
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(obj.customGeometry.positions, 3))
          if (obj.customGeometry.normals) {
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(obj.customGeometry.normals, 3))
          }
          if (obj.customGeometry.uvs) {
            geometry.setAttribute('uv', new THREE.Float32BufferAttribute(obj.customGeometry.uvs, 2))
          }
        } else if (obj.imported && obj.bufferGeometry) {
          geometry = obj.bufferGeometry
        } else {
          const def = PRIMITIVES[obj.type]
          geometry = def ? def.build(THREE, obj.args) : new THREE.BoxGeometry(1, 1, 1)
        }

        let result = geometry
        switch (op) {
          case 'subdivide':
            result = meshOps.subdivide(geometry, params.levels || 1)
            break
          case 'extrude':
            result = meshOps.extrudeFaces(geometry, params.amount ?? 0.5)
            break
          case 'inset':
            result = meshOps.insetFaces(geometry, params.amount ?? 0.1)
            break
          case 'bevel':
            result = meshOps.bevelGeometry(geometry, params.radius ?? 0.05, params.segments ?? 2)
            break
          case 'loopCut':
            result = meshOps.loopCut(geometry, params.axis || 'y', params.position || 0)
            break
          case 'merge':
            result = meshOps.mergeVertices(geometry, params.threshold ?? 0.001)
            break
          case 'unwrap':
            result = meshOps.unwrapUV(geometry, params.method || 'planar')
            break
          default:
            get().toast(`Operação desconhecida: ${op}`, 'error')
            return
        }

        // Serializar para o store
        const positions = result.getAttribute('position').array
        const normals = result.getAttribute('normal')?.array
        const uvs = result.getAttribute('uv')?.array
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id
              ? {
                  ...o,
                  customGeometry: {
                    positions: Array.from(positions),
                    normals: normals ? Array.from(normals) : null,
                    uvs: uvs ? Array.from(uvs) : null,
                  },
                }
              : o
          ),
        }))
        get().toast(`Operação "${op}" aplicada`, 'success')
      },

      // ---------- Booleanas entre objetos ----------
      applyBooleanOp: (targetId, toolId, op) => {
        const objects = get().objects
        const target = objects.find((o) => o.id === targetId)
        const tool = objects.find((o) => o.id === toolId)
        if (!target || !tool) return
        get()._pushHistory()

        const buildGeo = (obj) => {
          if (obj.customGeometry) {
            const g = new THREE.BufferGeometry()
            g.setAttribute('position', new THREE.Float32BufferAttribute(obj.customGeometry.positions, 3))
            if (obj.customGeometry.normals) {
              g.setAttribute('normal', new THREE.Float32BufferAttribute(obj.customGeometry.normals, 3))
            }
            return g
          }
          if (obj.imported && obj.bufferGeometry) return obj.bufferGeometry
          const def = PRIMITIVES[obj.type]
          return def ? def.build(THREE, obj.args) : new THREE.BoxGeometry(1, 1, 1)
        }

        const geoA = buildGeo(target)
        const geoB = buildGeo(tool)
        // Aplicar transform do tool ao geoB
        geoB.applyMatrix4(new THREE.Matrix4().compose(
          new THREE.Vector3(...tool.position),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(...tool.rotation)),
          new THREE.Vector3(...tool.scale)
        ))
        const result = meshOps.booleanOp(geoA, geoB, op)

        const positions = result.getAttribute('position').array
        const normals = result.getAttribute('normal')?.array
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === targetId
              ? {
                  ...o,
                  customGeometry: {
                    positions: Array.from(positions),
                    normals: normals ? Array.from(normals) : null,
                    uvs: null,
                  },
                }
              : o
          ),
        }))
        // Remover o objeto ferramenta
        set((s) => ({
          objects: s.objects.filter((o) => o.id !== toolId),
          selectedId: targetId,
        }))
        get().toast(`Booleana "${op}" aplicada`, 'success')
      },

      // ---------- Sculpt ----------
      sculptStrokeAt: (id, point, normal, params = {}) => {
        const obj = get().objects.find((o) => o.id === id)
        if (!obj) return

        // Construir geometria
        let geometry
        if (obj.customGeometry) {
          geometry = new THREE.BufferGeometry()
          geometry.setAttribute('position', new THREE.Float32BufferAttribute(obj.customGeometry.positions, 3))
          if (obj.customGeometry.normals) {
            geometry.setAttribute('normal', new THREE.Float32BufferAttribute(obj.customGeometry.normals, 3))
          }
        } else if (obj.imported && obj.bufferGeometry) {
          geometry = obj.bufferGeometry.clone()
        } else {
          const def = PRIMITIVES[obj.type]
          geometry = def ? def.build(THREE, obj.args) : new THREE.BoxGeometry(1, 1, 1)
        }
        geometry.computeVertexNormals()

        const settings = { ...get().sculptSettings, ...params }
        const result = meshOps.sculptStroke(
          geometry,
          point,
          normal,
          settings.brushSize,
          settings.brushStrength,
          settings.mode
        )

        const positions = result.getAttribute('position').array
        const normals = result.getAttribute('normal').array
        // Coalesced history
        get()._pushHistoryCoalesced(`sculpt:${id}`)
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id
              ? {
                  ...o,
                  customGeometry: {
                    positions: Array.from(positions),
                    normals: Array.from(normals),
                    uvs: obj.customGeometry?.uvs || null,
                  },
                }
              : o
          ),
        }))
      },

      // ---------- Material presets ----------
      applyMaterialPreset: (id, presetId) => {
        const preset = findMaterial(presetId)
        if (!preset) return
        get()._pushHistory()
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id ? { ...o, material: { ...preset.material } } : o
          ),
        }))
        get().toast(`Material "${preset.name}" aplicado`, 'success')
      },

      // ---------- Camadas de textura ----------
      addTextureLayer: (id, layer) => {
        get()._pushHistory()
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id
              ? {
                  ...o,
                  material: {
                    ...o.material,
                    layers: [...(o.material.layers || []), { ...layer }],
                  },
                }
              : o
          ),
        }))
      },
      updateTextureLayer: (id, index, patch) => {
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id
              ? {
                  ...o,
                  material: {
                    ...o.material,
                    layers: (o.material.layers || []).map((l, i) =>
                      i === index ? { ...l, ...patch } : l
                    ),
                  },
                }
              : o
          ),
        }))
      },
      removeTextureLayer: (id, index) => {
        get()._pushHistory()
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === id
              ? {
                  ...o,
                  material: {
                    ...o.material,
                    layers: (o.material.layers || []).filter((_, i) => i !== index),
                  },
                }
              : o
          ),
        }))
      },

      // ---------- Skeleton / Rigging ----------
      addBone: (objId, position = [0, 0, 0]) => {
        get()._pushHistory()
        const bone = {
          id: `bone_${Math.random().toString(36).slice(2, 10)}`,
          name: 'Osso',
          position: [...position],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          parentId: null,
          length: 0.5,
        }
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === objId
              ? {
                  ...o,
                  skeleton: o.skeleton
                    ? { ...o.skeleton, bones: [...o.skeleton.bones, bone] }
                    : { bones: [bone] },
                }
              : o
          ),
        }))
        get().toast('Osso adicionado', 'success')
      },

      updateBone: (objId, boneId, patch) => {
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === objId && o.skeleton
              ? {
                  ...o,
                  skeleton: {
                    ...o.skeleton,
                    bones: o.skeleton.bones.map((b) =>
                      b.id === boneId ? { ...b, ...patch } : b
                    ),
                  },
                }
              : o
          ),
        }))
      },

      removeBone: (objId, boneId) => {
        get()._pushHistory()
        set((s) => ({
          objects: s.objects.map((o) =>
            o.id === objId && o.skeleton
              ? {
                  ...o,
                  skeleton: {
                    ...o.skeleton,
                    bones: o.skeleton.bones
                      .filter((b) => b.id !== boneId)
                      .map((b) => (b.parentId === boneId ? { ...b, parentId: null } : b)),
                  },
                }
              : o
          ),
        }))
      },

      // ---------- Animação / Keyframes ----------
      addKeyframe: (objId, clipName, boneId, frame, transform) => {
        get()._pushHistory()
        const kf = {
          id: `kf_${Math.random().toString(36).slice(2, 10)}`,
          time: frame,
          boneId,
          ...transform,
          interpolation: 'ease', // linear | ease | step
        }
        set((s) => ({
          objects: s.objects.map((o) => {
            if (o.id !== objId) return o
            const anims = { ...(o.animations || {}) }
            anims[clipName] = [...(anims[clipName] || []), kf]
              .sort((a, b) => a.time - b.time)
            return { ...o, animations: anims }
          }),
        }))
        get().toast('Keyframe adicionado', 'success', 1200)
      },

      removeKeyframe: (objId, clipName, keyframeId) => {
        get()._pushHistory()
        set((s) => ({
          objects: s.objects.map((o) => {
            if (o.id !== objId || !o.animations?.[clipName]) return o
            const anims = { ...o.animations }
            anims[clipName] = anims[clipName].filter((k) => k.id !== keyframeId)
            return { ...o, animations: anims }
          }),
        }))
      },

      setAnimationTime: (time) =>
        set((s) => ({ animation: { ...s.animation, currentTime: time } })),
      setAnimation: (patch) =>
        set((s) => ({ animation: { ...s.animation, ...patch } })),
      playAnimation: () => set((s) => ({ animation: { ...s.animation, playing: true } })),
      pauseAnimation: () => set((s) => ({ animation: { ...s.animation, playing: false } })),

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
            ...(patch.hdri !== undefined ? { hdri: patch.hdri } : {}),
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
            version: 2,
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

      setObjects: (newObjects) => {
        get()._pushHistory()
        set({ objects: newObjects, selectedId: null })
      },

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
      partialize: (state) => ({
        objects: state.objects,
        background: state.background,
        grid: state.grid,
        lights: state.lights,
        transformMode: state.transformMode,
        mode: state.mode,
      }),
      version: 2,
    }
  )
)

export function useSelectedObject() {
  return useStore((s) => {
    if (!s.selectedId) return null
    return s.objects.find((o) => o.id === s.selectedId) || null
  })
}

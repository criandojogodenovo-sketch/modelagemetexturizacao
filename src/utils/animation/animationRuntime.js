/**
 * animationRuntime.js — registry global dos sistemas de animação avançada (S20/D).
 *
 * Liga o AnimationPanel/Timeline (UI) ao render loop (SceneLevel3D/Scene3D):
 *  - ANIMATION LAYERS por objeto (createAnimationLayers)
 *  - SPRING BONES por cena (createSpringBoneSystem)
 *  - MOTION VALUES (persistentes/assináveis, spring physics)
 *
 * O loop chama animationRuntime.update(delta) uma vez por frame.
 * A UI cria/configura os sistemas através deste módulo.
 */
import * as THREE from 'three'
import { createAnimationLayers } from './animationLayers'
import { createSpringBoneSystem } from './springBones'
import { motionValue } from './motionValues'

const layerSystems = new Map()   // objectId → layersSystem
const springSystems = new Map()  // sceneKey → springSystem
const motionValueRegistry = new Map() // name → motionValue
let _scene = null
let _renderer = null

export function bindAnimationRuntime(scene, renderer) {
  _scene = scene
  _renderer = renderer
}

/** Layers de animação para um objeto (cria se não existir) */
export function getLayerSystem(objectId, getBones, getMesh) {
  if (!layerSystems.has(objectId)) {
    layerSystems.set(objectId, createAnimationLayers(getBones, {}))
  }
  return layerSystems.get(objectId)
}

/** Spring bones para a cena atual (cria se não existir) */
export function getSpringSystem(sceneKey = 'main') {
  if (!springSystems.has(sceneKey)) {
    if (!_scene) return null
    springSystems.set(sceneKey, createSpringBoneSystem(_scene, {}))
  }
  return springSystems.get(sceneKey)
}

/** Motion value nomeado (cria se não existir) */
export function getMotionValue(name, initial = 0, opts = {}) {
  if (!motionValueRegistry.has(name)) {
    motionValueRegistry.set(name, motionValue(initial, opts))
  }
  return motionValueRegistry.get(name)
}

export function listMotionValues() {
  return [...motionValueRegistry.entries()].map(([name, mv]) => ({
    name, value: mv.value, target: mv.target, velocity: mv.velocity, settled: mv.isSettled(),
  }))
}

export function listLayers(objectId) {
  const sys = layerSystems.get(objectId)
  if (!sys) return []
  return sys.layers.map((l) => ({
    name: l.name, clipName: l.clipName, weight: l.weight, targetWeight: l.targetWeight,
    mode: l.mode, mask: l.maskName, loop: l.loop, speed: l.speed, playing: l.playing,
  }))
}

export function listSpringChains(sceneKey = 'main') {
  const sys = springSystems.get(sceneKey)
  if (!sys) return []
  return sys.chains.map((c) => ({
    name: c.name, bones: c.bones.length,
    stiffness: c.stiffness, drag: c.drag, inertia: c.inertia, gravityScale: c.gravityScale,
  }))
}

/** Atualização por frame — chamar do render loop */
export function updateAnimationRuntime(delta) {
  const dt = Math.min(delta || 1 / 60, 0.1)
  for (const [, sys] of layerSystems) sys.update(dt, sys._animations || {}, sys._getMesh)
  for (const [, sys] of springSystems) sys.update(dt)
  for (const [, mv] of motionValueRegistry) mv.update(dt)
}

/** Para Play Mode: layers precisam das animações do objeto — injeta no update */
export function feedLayerAnimations(objectId, animations, getMesh) {
  const sys = layerSystems.get(objectId)
  if (!sys) return
  // Guardar para o update usar (o update das layers recebe animações)
  sys._animations = animations
  sys._getMesh = getMesh
}

export function disposeAnimationRuntime() {
  for (const [, sys] of layerSystems) sys.dispose()
  for (const [, sys] of springSystems) sys.dispose()
  layerSystems.clear()
  springSystems.clear()
  motionValueRegistry.clear()
}

/**
 * sharedAnimationCache.js — Cache partilhado de poses de animação.
 *
 * Otimizeição-chave para 200+ NPCs: em vez de calcular a interpolação
 * de keyframes para CADA NPC individualmente (200 × 20 bones = 4000
 * interpolações por frame), calcula a pose UMA VEZ por clip+tempo
 * e reutiliza para todos os NPCs que tocam o mesmo clip.
 *
 * Como funciona:
 * 1. Para cada (clipName, currentTime), calcula a pose interpolada
 * 2. Guarda num cache: { clipName_time: { boneId: {pos, rot, scale} } }
 * 3. NPCs com o mesmo clip no mesmo tempo reutilizam a pose calculada
 * 4. O cache é limpo no início de cada frame
 *
 * Isto reduz 4000 interpolações para ~20 (uma por osso do clip).
 */
import * as THREE from 'three'

// Cache: clipName → { time → { boneId → { position, rotation, scale } } }
const poseCache = new Map()
let currentFrame = 0

// CORREÇÃO BUG7: Limite de tamanho para poseCache (LRU eviction)
// Sem limite, em editor mode o cache cresce indefinidamente (cada time.toFixed(4) é uma key nova)
const POSE_CACHE_MAX = 500 // ~500 poses únicas, suficiente para 30fps em 16s de animação
const POSE_CACHE_KEYS = [] // lista de keys por ordem de inserção (LRU)

// Pré-ordenar keyframes por tempo e boneId (uma vez por clip)
const sortedClipsCache = new Map()
const SORTED_CLIPS_MAX = 50 // limite de clips no cache

function getSortedKeyframes(clipName, keyframes) {
  if (sortedClipsCache.has(clipName)) {
    return sortedClipsCache.get(clipName)
  }
  // Agrupar por boneId e ordenar por tempo
  const byBone = new Map()
  for (const kf of keyframes) {
    if (!byBone.has(kf.boneId)) byBone.set(kf.boneId, [])
    byBone.get(kf.boneId).push(kf)
  }
  for (const [boneId, kfs] of byBone) {
    kfs.sort((a, b) => a.time - b.time)
  }
  // CORREÇÃO BUG7: Limite de tamanho para sortedClipsCache (LRU)
  if (sortedClipsCache.size >= SORTED_CLIPS_MAX) {
    const firstKey = sortedClipsCache.keys().next().value
    if (firstKey !== undefined) sortedClipsCache.delete(firstKey)
  }
  sortedClipsCache.set(clipName, byBone)
  return byBone
}

// Binary search para encontrar keyframe pair
function findKeyframeBinary(sortedKfs, time) {
  if (sortedKfs.length === 0) return null
  if (sortedKfs.length === 1) return { prev: sortedKfs[0], next: sortedKfs[0], t: 0 }
  
  let lo = 0, hi = sortedKfs.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (sortedKfs[mid].time <= time) lo = mid
    else hi = mid
  }
  
  const prev = sortedKfs[lo]
  const next = sortedKfs[hi]
  if (prev.time === next.time) return { prev, next, t: 0 }
  const t = Math.max(0, Math.min(1, (time - prev.time) / (next.time - prev.time)))
  return { prev, next, t }
}

function interpolateVal(a, b, t, type) {
  if (type === 'step') return a
  if (type === 'linear') return a + (b - a) * t
  // Fase 7/11 — Curvas de interpolação reais
  if (type === 'easeIn') {
    const eased = t * t
    return a + (b - a) * eased
  }
  if (type === 'easeOut') {
    const eased = 1 - (1 - t) * (1 - t)
    return a + (b - a) * eased
  }
  if (type === 'easeInOut') {
    const eased = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)
    return a + (b - a) * eased
  }
  // ease (smoothstep) — default
  const eased = t * t * (3 - 2 * t)
  return a + (b - a) * eased
}

function interpolateVec3(a, b, t, type) {
  return [
    interpolateVal(a[0], b[0], t, type),
    interpolateVal(a[1], b[1], t, type),
    interpolateVal(a[2], b[2], t, type),
  ]
}

/**
 * Calcula a pose interpolada para um clip num determinado tempo.
 * Usa cache — se a mesma pose já foi calculada neste frame, reutiliza.
 */
export function getCachedPose(clipName, keyframes, time) {
  const cacheKey = clipName + '_' + time.toFixed(4) // 4 decimal places

  // Verificar cache
  if (poseCache.has(cacheKey)) {
    return poseCache.get(cacheKey)
  }

  // Calcular pose
  const sortedByBone = getSortedKeyframes(clipName, keyframes)
  const pose = new Map()

  for (const [boneId, sortedKfs] of sortedByBone) {
    const pair = findKeyframeBinary(sortedKfs, time)
    if (!pair) continue
    const { prev, next, t } = pair
    const interp = next.interpolation || 'ease'

    pose.set(boneId, {
      position: interpolateVec3(prev.position || [0,0,0], next.position || [0,0,0], t, interp),
      rotation: interpolateVec3(prev.rotation || [0,0,0], next.rotation || [0,0,0], t, interp),
      scale: interpolateVec3(prev.scale || [1,1,1], next.scale || [1,1,1], t, interp),
    })
  }

  // CORREÇÃO BUG7: LRU eviction — se cache excede o limite, remover entrada mais antiga
  if (poseCache.size >= POSE_CACHE_MAX) {
    const oldestKey = POSE_CACHE_KEYS.shift()
    if (oldestKey !== undefined) poseCache.delete(oldestKey)
  }
  poseCache.set(cacheKey, pose)
  POSE_CACHE_KEYS.push(cacheKey)
  return pose
}

/**
 * Aplica uma pose calculada aos bones de um NPC.
 * Não recalcula interpolação — apenas copia valores.
 *
 * Suporta três formas de identificar o osso:
 *  - b.id === boneId              (quando bones são objetos do store)
 *  - b.name === boneId            (quando bones são THREE.Bone com .name = boneDef.id)
 *  - b.userData.boneId === boneId (quando bones são THREE.Bone com userData definido)
 */
export function applyPose(pose, bones) {
  if (!pose || !bones) return
  for (const [boneId, transform] of pose) {
    if (boneId === 'object') continue
    const bone = bones.find(
      (b) => b.id === boneId || b.name === boneId || b.userData?.boneId === boneId
    )
    if (bone) {
      bone.position.set(...transform.position)
      bone.rotation.set(...transform.rotation)
      bone.scale.set(...transform.scale)
    }
  }
}

/**
 * Limpa o cache no início de cada frame.
 */
export function clearPoseCache() {
  poseCache.clear()
  POSE_CACHE_KEYS.length = 0
}

/**
 * Limpa o cache de clips ordenados (quando um clip muda).
 */
export function clearClipCache(clipName) {
  if (clipName) {
    sortedClipsCache.delete(clipName)
  } else {
    sortedClipsCache.clear()
  }
}

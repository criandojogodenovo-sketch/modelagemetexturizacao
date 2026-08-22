/**
 * animationSerializer.js — serializar/deserializar THREE.AnimationClip para JSON.
 *
 * Problema: THREE.AnimationClip contém THREE.KeyframeTrack subclasses com
 * protótipos que se perdem ao fazer JSON.stringify. Este módulo converte
 * AnimationClip para plain JSON e vice-versa.
 *
 * Também converte AnimationClip para o formato do animationPlayer
 * (array de keyframes { boneId, time, position, rotation, scale }).
 */

import * as THREE from 'three'

/**
 * Serializa um THREE.AnimationClip para plain JSON.
 */
export function serializeAnimationClip(clip) {
  if (!clip) return null
  // Se já é plain JSON (não é AnimationClip), retornar diretamente
  if (!(clip instanceof THREE.AnimationClip) && !clip.tracks?.[0]?.getValue) {
    return clip
  }
  return {
    name: clip.name || 'anim',
    duration: clip.duration || 0,
    tracks: (clip.tracks || []).map(track => ({
      name: track.name,
      type: track.constructor.name,
      times: Array.from(track.times),
      values: Array.from(track.values),
    })),
  }
}

/**
 * Deserializa plain JSON para THREE.AnimationClip.
 */
export function deserializeAnimationClip(data) {
  if (!data) return null
  if (data instanceof THREE.AnimationClip) return data
  if (data.tracks && data.tracks.length > 0 && data.tracks[0].getValue) {
    return new THREE.AnimationClip(data.name, data.duration, data.tracks)
  }

  const tracks = (data.tracks || []).map(t => {
    const times = new Float32Array(t.times || [])
    const values = new Float32Array(t.values || [])
    let TrackClass
    switch (t.type) {
      case 'QuaternionKeyframeTrack': TrackClass = THREE.QuaternionKeyframeTrack; break
      case 'VectorKeyframeTrack': TrackClass = THREE.VectorKeyframeTrack; break
      case 'NumberKeyframeTrack': TrackClass = THREE.NumberKeyframeTrack; break
      default:
        if (t.name.endsWith('.quaternion')) TrackClass = THREE.QuaternionKeyframeTrack
        else if (t.name.endsWith('.morphTargetInfluences')) TrackClass = THREE.NumberKeyframeTrack
        else TrackClass = THREE.VectorKeyframeTrack
    }
    return new TrackClass(t.name, times, values)
  })

  return new THREE.AnimationClip(data.name || 'anim', data.duration || 0, tracks)
}

/**
 * Serializa um dicionário de AnimationClips.
 */
export function serializeAnimations(animations) {
  if (!animations) return null
  const result = {}
  for (const [name, clip] of Object.entries(animations)) {
    result[name] = serializeAnimationClip(clip)
  }
  return result
}

/**
 * Deserializa um dicionário de AnimationClips.
 */
export function deserializeAnimations(data) {
  if (!data) return null
  const result = {}
  for (const [name, clipData] of Object.entries(data)) {
    result[name] = deserializeAnimationClip(clipData)
  }
  return result
}

/**
 * Converte THREE.AnimationClip para o formato do animationPlayer
 * (array de keyframes { boneId, time, position, rotation, scale }).
 *
 * @param {THREE.AnimationClip} clip
 * @returns {Array} keyframes no formato do animationPlayer
 */
export function convertClipToKeyframes(clip) {
  if (!clip || !clip.tracks) return []
  const keyframesByBone = new Map()

  for (const track of clip.tracks) {
    const parts = track.name.split('.')
    if (parts.length < 2) continue
    const boneName = parts[0]
    const property = parts[1]

    if (!keyframesByBone.has(boneName)) {
      keyframesByBone.set(boneName, new Map())
    }
    const boneMap = keyframesByBone.get(boneName)

    const times = track.times
    const values = track.values
    const stride = property === 'quaternion' ? 4 : 3

    for (let i = 0; i < times.length; i++) {
      const t = times[i]
      if (!boneMap.has(t)) {
        boneMap.set(t, {
          time: t,
          boneId: boneName,
          position: [0, 0, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          interpolation: 'ease',
        })
      }
      const kf = boneMap.get(t)
      const offset = i * stride
      if (property === 'position') {
        kf.position = [values[offset], values[offset + 1], values[offset + 2]]
      } else if (property === 'quaternion') {
        const qx = values[offset], qy = values[offset + 1], qz = values[offset + 2], qw = values[offset + 3]
        const euler = new THREE.Euler().setFromQuaternion(new THREE.Quaternion(qx, qy, qz, qw))
        kf.rotation = [euler.x, euler.y, euler.z]
      } else if (property === 'scale') {
        kf.scale = [values[offset], values[offset + 1], values[offset + 2]]
      }
    }
  }

  const keyframes = []
  for (const boneMap of keyframesByBone.values()) {
    for (const kf of boneMap.values()) {
      keyframes.push(kf)
    }
  }
  return keyframes
}


/**
 * animationPlayer.js — reproduz animações de keyframes em tempo real.
 *
 * Funcionalidades:
 *  - Interpola keyframes (linear, ease-in-out, step)
 *  - Aplica transform ao objeto 3D (mesh ou bones)
 *  - Suporta loops e velocidade de reprodução
 *  - Dispara evento onComplete quando termina
 *
 * API:
 *  - createAnimationPlayer(animations, getMesh, getBones) → player
 *  - player.play(clipName, options) — inicia reprodução
 *  - player.stop()
 *  - player.update(deltaTime) — chamar a cada frame
 *  - player.getCurrentClip()
 *
 * Os keyframes têm a estrutura:
 *  { id, time, boneId, position, rotation, scale, interpolation }
 *
 * Para animar o objeto inteiro (sem bones), usamos keyframes com boneId = 'object'.
 */
import * as THREE from 'three'
import { getCachedPose, applyPose, clearPoseCache } from './sharedAnimationCache'

// Funções de interpolação
function interpolate(a, b, t, type = 'ease') {
  if (type === 'step') return a
  if (type === 'linear') return a + (b - a) * t
  // ease (smoothstep)
  const eased = t * t * (3 - 2 * t)
  return a + (b - a) * eased
}

function interpolateVec3(a, b, t, type) {
  return [
    interpolate(a[0], b[0], t, type),
    interpolate(a[1], b[1], t, type),
    interpolate(a[2], b[2], t, type),
  ]
}

export function createAnimationPlayer(animations, getMesh, getBones) {
  let currentClip = null
  let currentTime = 0
  let playing = false
  let loop = false
  let speed = 1
  let onComplete = null

  // AnimationBoost: blending entre clips
  let prevClip = null
  let prevTime = 0
  let blendTime = 0
  let blendDuration = 0
  let boostEnabled = false

  // Cache de maxTime por clip (evita keyframes.map() por frame)
  const _maxTimeCache = new Map()

  function play(clipName, options = {}) {
    if (!animations[clipName] || animations[clipName].length === 0) return false
    // AnimationBoost: guardar clip anterior para blending
    if (boostEnabled && currentClip && currentClip !== clipName) {
      prevClip = currentClip
      prevTime = currentTime
      blendTime = 0
      blendDuration = options.blendTime ?? 0.3
    }
    currentClip = clipName
    currentTime = 0
    playing = true
    loop = options.loop ?? false
    speed = options.speed ?? 1
    onComplete = options.onComplete
    return true
  }
  
  function setBoost(enabled, blendDur = 0.3) {
    boostEnabled = enabled
    blendDuration = blendDur
  }

  function stop() {
    playing = false
    currentClip = null
    currentTime = 0
  }

  function pause() { playing = false }
  function resume() { playing = true }

  function getCurrentClip() { return currentClip }
  function isPlaying() { return playing }
  function getCurrentTime() { return currentTime }

  // Encontrar os 2 keyframes que rodeiam o tempo atual para um boneId
  function findKeyframePair(keyframes, time, boneId) {
    const boneKfs = keyframes.filter((k) => k.boneId === boneId).sort((a, b) => a.time - b.time)
    if (boneKfs.length === 0) return null
    if (boneKfs.length === 1) return { prev: boneKfs[0], next: boneKfs[0], t: 0 }
    for (let i = 0; i < boneKfs.length - 1; i++) {
      if (time >= boneKfs[i].time && time <= boneKfs[i + 1].time) {
        const t = (time - boneKfs[i].time) / (boneKfs[i + 1].time - boneKfs[i].time || 1)
        return { prev: boneKfs[i], next: boneKfs[i + 1], t }
      }
    }
    // Depois do último keyframe
    return { prev: boneKfs[boneKfs.length - 1], next: boneKfs[boneKfs.length - 1], t: 0 }
  }

  function update(deltaTime) {
    if (!playing || !currentClip) return
    const keyframes = animations[currentClip]
    if (!keyframes || keyframes.length === 0) return

    // AnimationBoost: avançar blending
    if (prevClip && blendTime < blendDuration) {
      blendTime += deltaTime
      prevTime += deltaTime * speed
      if (blendTime >= blendDuration) {
        prevClip = null // blending completo
      }
    }

    currentTime += deltaTime * speed

    // Calcular duração total do clip (cached — evita keyframes.map() por frame)
    let maxTime = _maxTimeCache.get(currentClip)
    if (maxTime === undefined) {
      maxTime = 0
      for (let i = 0; i < keyframes.length; i++) {
        if (keyframes[i].time > maxTime) maxTime = keyframes[i].time
      }
      _maxTimeCache.set(currentClip, maxTime)
    }

    if (currentTime >= maxTime) {
      if (loop) {
        currentTime = currentTime % maxTime
      } else {
        currentTime = maxTime
        playing = false
        onComplete?.()
        onComplete = null
      }
    }

    // OTIMIZAÇÃO: usar cache partilhado de poses
    // Se 200 NPCs tocam o mesmo clip no mesmo tempo, a interpolação
    // é calculada UMA VEZ e reutilizada para todos
    const mesh = getMesh?.()
    const bones = getBones?.()

    const pose = getCachedPose(currentClip, keyframes, currentTime)

    // Aplicar 'object' (transform do mesh inteiro)
    const objTransform = pose.get('object')
    if (objTransform && mesh) {
      mesh.position.set(...objTransform.position)
      mesh.rotation.set(...objTransform.rotation)
      mesh.scale.set(...objTransform.scale)
    }

    // Aplicar aos bones (apenas copiar valores — sem recalcular)
    if (bones) {
      // AnimationBoost: se estamos em blending, interpolar entre prevPose e pose
      if (prevClip && blendTime < blendDuration) {
        const prevKeyframes = animations[prevClip]
        if (prevKeyframes && prevKeyframes.length > 0) {
          const prevPose = getCachedPose(prevClip, prevKeyframes, prevTime)
          const blendWeight = 1 - (blendTime / blendDuration)
          // Interpolar entre prevPose e pose
          for (const [boneId, currentTransform] of pose) {
            const prevTransform = prevPose.get(boneId)
            const bone = bones.find(
              (b) => b.id === boneId || b.name === boneId || b.userData?.boneId === boneId
            )
            if (!bone) continue
            if (prevTransform) {
              bone.position.set(
                prevTransform.position[0] * blendWeight + currentTransform.position[0] * (1 - blendWeight),
                prevTransform.position[1] * blendWeight + currentTransform.position[1] * (1 - blendWeight),
                prevTransform.position[2] * blendWeight + currentTransform.position[2] * (1 - blendWeight),
              )
              bone.rotation.set(
                prevTransform.rotation[0] * blendWeight + currentTransform.rotation[0] * (1 - blendWeight),
                prevTransform.rotation[1] * blendWeight + currentTransform.rotation[1] * (1 - blendWeight),
                prevTransform.rotation[2] * blendWeight + currentTransform.rotation[2] * (1 - blendWeight),
              )
              bone.scale.set(
                prevTransform.scale[0] * blendWeight + currentTransform.scale[0] * (1 - blendWeight),
                prevTransform.scale[1] * blendWeight + currentTransform.scale[1] * (1 - blendWeight),
                prevTransform.scale[2] * blendWeight + currentTransform.scale[2] * (1 - blendWeight),
              )
            } else {
              // Osso não existe no clip anterior — usar apenas o atual
              bone.position.set(...currentTransform.position)
              bone.rotation.set(...currentTransform.rotation)
              bone.scale.set(...currentTransform.scale)
            }
          }
        }
      } else {
        // Sem blending — aplicar diretamente
        applyPose(pose, bones)
      }
    }
  }

  return {
    play, stop, pause, resume, update, setBoost,
    getCurrentClip, isPlaying, getCurrentTime,
  }
}


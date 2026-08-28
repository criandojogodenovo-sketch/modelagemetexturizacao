/**
 * animationLayers.js — sistema de animation layers com blending e máscaras.
 *
 * Sessão 20 / Parte D1 (estilo Babylon.js 7.0 / UE5 Animation Blueprints).
 *
 * CONCEITO:
 *  - Várias layers tocam clips EM PARALELO sobre o mesmo esqueleto.
 *  - Cada layer tem: peso (0-1), modo (override | additive), máscara por ossos
 *    (só braços, só pernas, upper body…), blend de entrada/saída (fade).
 *  - RESULTADO final = composição ordenada:
 *      base layer (walk) → upper body layer (attack, máscara braços) →
 *      additive layer (respiração/vibração)
 *
 * MÁSCARAS por ossos: padrões ('all', 'upper', 'lower', 'arms', 'legs') ou
 * lista explícita de boneIds. Ossos fora da máscara NÃO são tocados pela layer.
 *
 * API:
 *   const layers = createAnimationLayers(getBones)
 *   layers.addLayer({ name, clipName, weight, mode, mask, loop, speed })
 *   layers.setWeight(name, w) / layers.fadeTo(name, w, duration)
 *   layers.update(deltaTime, animations, getMesh)
 */

const MASK_PATTERNS = {
  all: null, // null = todos os ossos
  upper: (boneId) => /^(spine|chest|neck|head|shoulder|arm|hand|clavicle)/i.test(boneId),
  lower: (boneId) => /^(hip|leg|foot|thigh|calf|pelvis|upleg)/i.test(boneId),
  arms: (boneId) => /^(shoulder|arm|hand|clavicle)/i.test(boneId),
  legs: (boneId) => /^(hip|leg|foot|thigh|calf|upleg)/i.test(boneId),
}

export function resolveMask(mask) {
  if (!mask || mask === 'all') return null
  if (typeof mask === 'function') return mask
  if (Array.isArray(mask)) {
    const set = new Set(mask)
    return (boneId) => set.has(boneId)
  }
  if (typeof mask === 'string' && MASK_PATTERNS[mask]) return MASK_PATTERNS[mask]
  return null
}

export function createAnimationLayers(getBones, options = {}) {
  const layers = []
  let order = 0

  function addLayer(cfg) {
    const layer = {
      name: cfg.name || `layer${order}`,
      clipName: cfg.clipName || null,
      weight: cfg.weight ?? 1,
      targetWeight: cfg.weight ?? 1,
      mode: cfg.mode || 'override', // 'override' | 'additive'
      mask: resolveMask(cfg.mask || 'all'),
      maskName: cfg.mask || 'all',
      loop: cfg.loop ?? true,
      speed: cfg.speed ?? 1,
      time: 0,
      fadeSpeed: cfg.fadeDuration ? 1 / cfg.fadeDuration : 4,
      playing: cfg.playing ?? true,
      order: order++,
      _prevPose: null, // pose no momento em que o peso começou a baixar (para blend suave)
    }
    layers.push(layer)
    return layer
  }

  function removeLayer(name) {
    const i = layers.findIndex((l) => l.name === name)
    if (i >= 0) layers.splice(i, 1)
  }

  function getLayer(name) { return layers.find((l) => l.name === name) }

  function setWeight(name, w) {
    const l = getLayer(name)
    if (l) { l.weight = w; l.targetWeight = w }
  }

  /** Transição suave de peso (fade in/out) */
  function fadeTo(name, w, duration = 0.3) {
    const l = getLayer(name)
    if (!l) return
    l.targetWeight = w
    l.fadeSpeed = 1 / Math.max(0.01, duration)
  }

  function play(name, clipName, opts = {}) {
    const l = getLayer(name)
    if (!l) return false
    l.clipName = clipName
    l.time = 0
    l.playing = true
    l.loop = opts.loop ?? l.loop
    l.speed = opts.speed ?? l.speed
    return true
  }

  function stop(name) {
    const l = getLayer(name)
    if (l) l.playing = false
  }

  /** Interpola uma pose (map boneId → transform) num tempo t */
  function samplePose(animations, clipName, time) {
    const keyframes = animations[clipName]
    if (!keyframes || keyframes.length === 0) return null
    const pose = new Map()
    // Agrupar por boneId uma vez (cache leve por chamada)
    const byBone = new Map()
    for (const kf of keyframes) {
      if (!byBone.has(kf.boneId)) byBone.set(kf.boneId, [])
      byBone.get(kf.boneId).push(kf)
    }
    const lerp = (a, b, t) => a + (b - a) * t
    const lerpArr = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]
    for (const [boneId, kfs] of byBone) {
      kfs.sort((x, y) => x.time - y.time)
      if (kfs.length === 1) {
        pose.set(boneId, kfs[0])
        continue
      }
      let prev = kfs[0], next = kfs[1]
      for (let i = 0; i < kfs.length - 1; i++) {
        if (time >= kfs[i].time && time <= kfs[i + 1].time) {
          prev = kfs[i]; next = kfs[i + 1]
          break
        }
        if (time > kfs[kfs.length - 1].time) { prev = next = kfs[kfs.length - 1] }
      }
      const span = Math.max(1e-5, next.time - prev.time)
      const t = Math.min(1, Math.max(0, (time - prev.time) / span))
      // interpolação (ease smoothstep por defeito; step se ambos step)
      let tt = t
      const ip = next.interpolation || prev.interpolation || 'ease'
      if (ip === 'step') tt = 0
      else if (ip === 'linear') tt = t
      else tt = t * t * (3 - 2 * t)
      pose.set(boneId, {
        boneId,
        position: lerpArr(prev.position, next.position, tt),
        rotation: lerpArr(prev.rotation, next.rotation, tt),
        scale: lerpArr(prev.scale, next.scale, tt),
      })
    }
    return pose
  }

  /** Duração de um clip */
  function clipDuration(animations, clipName) {
    const kfs = animations[clipName]
    if (!kfs || !kfs.length) return 0
    let max = 0
    for (const kf of kfs) if (kf.time > max) max = kf.time
    return max
  }

  /**
   * Atualiza todas as layers e compõe a pose final nos bones.
   * @param {number} deltaTime
   * @param {Object} animations — mapa clipName → keyframes[]
   * @param {Function} getMesh — mesh raiz (para 'object' transforms da base layer)
   */
  function update(deltaTime, animations, getMesh) {
    const bones = getBones?.()
    if (!bones || layers.length === 0) return
    // 1. Avançar tempo + fade de pesos
    for (const layer of layers) {
      if (!layer.playing || !layer.clipName) continue
      const dur = clipDuration(animations, layer.clipName)
      layer.time += deltaTime * layer.speed
      if (dur > 0) {
        if (layer.loop) layer.time = layer.time % dur
        else if (layer.time >= dur) layer.time = dur
      }
      // fade para targetWeight
      const dw = layer.targetWeight - layer.weight
      if (Math.abs(dw) > 1e-4) {
        const step = Math.sign(dw) * layer.fadeSpeed * deltaTime
        layer.weight = Math.abs(step) >= Math.abs(dw) ? layer.targetWeight : layer.weight + step
      }
    }
    // 2. Compor pose final (ordem = ordem de criação)
    const boneMap = new Map()
    for (const b of bones) {
      boneMap.set(b.id ?? b.name ?? b.userData?.boneId, b)
    }
    const finalPose = new Map() // boneId → {position, rotation, scale} acumulado
    const accumulatedWeight = new Map() // boneId → soma de pesos override

    for (const layer of layers) {
      if (!layer.playing || !layer.clipName || layer.weight <= 0.001) continue
      const pose = samplePose(animations, layer.clipName, layer.time)
      if (!pose) continue
      for (const [boneId, tr] of pose) {
        if (layer.mask && !layer.mask(boneId)) continue
        const bone = boneMap.get(boneId)
        if (!bone) continue
        if (boneId === 'object') {
          // transform do mesh inteiro — só a base layer (weight máximo)
          const mesh = getMesh?.()
          if (mesh && layer.mode === 'override') {
            mesh.position.set(...tr.position)
            mesh.rotation.set(...tr.rotation)
            mesh.scale.set(...tr.scale)
          }
          continue
        }
        if (layer.mode === 'additive') {
          // Aditivo: soma delta em relação à pose neutra (0,0,0)/(escala 1)
          const cur = finalPose.get(boneId) || { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
          finalPose.set(boneId, {
            position: [
              cur.position[0] + tr.position[0] * layer.weight,
              cur.position[1] + tr.position[1] * layer.weight,
              cur.position[2] + tr.position[2] * layer.weight,
            ],
            rotation: [
              cur.rotation[0] + tr.rotation[0] * layer.weight,
              cur.rotation[1] + tr.rotation[1] * layer.weight,
              cur.rotation[2] + tr.rotation[2] * layer.weight,
            ],
            scale: [
              cur.scale[0] * (1 + (tr.scale[0] - 1) * layer.weight),
              cur.scale[1] * (1 + (tr.scale[1] - 1) * layer.weight),
              cur.scale[2] * (1 + (tr.scale[2] - 1) * layer.weight),
            ],
          })
        } else {
          // Override com blending ponderado pelo acumulado
          const prevW = accumulatedWeight.get(boneId) || 0
          const newW = prevW + layer.weight
          const cur = finalPose.get(boneId) || { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] }
          const a = prevW / Math.max(1e-5, newW)
          const b = layer.weight / Math.max(1e-5, newW)
          finalPose.set(boneId, {
            position: [
              cur.position[0] * a + tr.position[0] * b,
              cur.position[1] * a + tr.position[1] * b,
              cur.position[2] * a + tr.position[2] * b,
            ],
            rotation: [
              cur.rotation[0] * a + tr.rotation[0] * b,
              cur.rotation[1] * a + tr.rotation[1] * b,
              cur.rotation[2] * a + tr.rotation[2] * b,
            ],
            scale: [
              cur.scale[0] * a + tr.scale[0] * b,
              cur.scale[1] * a + tr.scale[1] * b,
              cur.scale[2] * a + tr.scale[2] * b,
            ],
          })
          accumulatedWeight.set(boneId, Math.min(1, newW))
        }
      }
    }
    // 3. Aplicar aos bones
    for (const [boneId, tr] of finalPose) {
      const bone = boneMap.get(boneId)
      if (!bone) continue
      bone.position.set(...tr.position)
      bone.rotation.set(...tr.rotation)
      bone.scale.set(...tr.scale)
    }
  }

  function dispose() {
    layers.length = 0
  }

  return {
    layers, addLayer, removeLayer, getLayer, setWeight, fadeTo, play, stop,
    update, samplePose, clipDuration, dispose,
  }
}

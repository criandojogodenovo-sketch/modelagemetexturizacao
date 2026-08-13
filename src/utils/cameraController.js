/**
 * cameraController.js — Sistema de câmara unificado e robusto.
 *
 * Arquitetura:
 *  - Estado da câmara (yaw/pitch) vive num único objecto: `cameraState`
 *  - Uma única função `updateCamera()` aplica posição + rotação a qualquer câmara THREE
 *  - Suporta 5 modos: 'none' | 'first' | 'third' | 'top' | 'side'
 *  - Funciona tanto no editor (SceneLevel3D) como no jogo exportado (gameRuntime)
 *  - Resolve bugs anteriores: targetMesh nulo, lookAt(0,0,0) errado, rotação YXZ inconsistente
 *
 * Uso no editor (SceneLevel3D):
 *   import { getCameraState, updateCamera } from '../../utils/cameraController'
 *   const camState = getCameraState()
 *   // no useFrame:
 *   updateCamera(camera, activeView, targetMesh, camState, { gameCamera, hasTouchZone })
 *
 * Uso no jogo exportado (gameRuntime):
 *   // mesmo módulo, mesma função — importado via string inline
 */

// ============================================================
//  ESTADO PARTILHADO
// ============================================================
// Single source of truth para a rotação da câmara FPS.
// Substitui o window._flirCameraRotation disperso.

export function createCameraState() {
  return {
    yaw: 0,
    pitch: 0,
    sensitivity: 1.0,
    enabled: false,        // true quando há CameraTouchZone activa
    hasTouchZone: false,   // true se a cena tem pelo menos 1 CameraTouchZone
    // Configuração de clamp
    minPitch: -1.4,        // ~-80°
    maxPitch: 1.4,         // ~+80°
    invertY: false,
    // Smoothing
    targetYaw: 0,
    targetPitch: 0,
    smoothing: 0.25,       // 0 = instant, 1 = muito lento
    // Última posição conhecida (fallback quando targetMesh é null)
    lastValidPosition: [5, 4, 6],
  }
}

let _globalState = null
export function getCameraState() {
  if (!_globalState) {
    _globalState = createCameraState()
    // Sincronizar com window._flirCameraRotation para compatibilidade
    if (typeof window !== 'undefined') {
      window._flirCameraRotation = _globalState
    }
  }
  return _globalState
}

export function resetCameraState() {
  const s = getCameraState()
  s.yaw = 0
  s.pitch = 0
  s.targetYaw = 0
  s.targetPitch = 0
  s.enabled = true
  s.hasTouchZone = false
}

// Aplicar input (do toque, rato ou setas)
export function applyCameraInput(dx, dy, state) {
  if (!state) state = getCameraState()
  const sens = state.sensitivity * 0.005
  state.targetYaw -= dx * sens
  const pitchDelta = state.invertY ? dy * sens : -dy * sens
  state.targetPitch = Math.max(
    state.minPitch,
    Math.min(state.maxPitch, state.targetPitch + pitchDelta)
  )
}

// Aplicar input de teclado (setas)
export function applyCameraKeyInput(key, state) {
  if (!state) state = getCameraState()
  const sens = 0.04
  if (key === 'arrowleft') state.targetYaw += sens
  if (key === 'arrowright') state.targetYaw -= sens
  if (key === 'arrowup') state.targetPitch = Math.max(state.minPitch, state.targetPitch + sens)
  if (key === 'arrowdown') state.targetPitch = Math.min(state.maxPitch, state.targetPitch - sens)
}

// ============================================================
//  HELPERS
// ============================================================

// Vector temporário reutilizado (evita GC pressure)
const _v1 = { x: 0, y: 0, z: 0 }
const _v2 = { x: 0, y: 0, z: 0 }

function lerp(a, b, t) {
  return a + (b - a) * t
}

// Suavizar yaw/pitch em direção ao target
function smoothRotation(state, dt) {
  const t = state.smoothing > 0 ? 1 - Math.pow(state.smoothing, dt * 60) : 1
  state.yaw = lerp(state.yaw, state.targetYaw, t)
  state.pitch = lerp(state.pitch, state.targetPitch, t)
}

// ============================================================
//  FUNÇÃO PRINCIPAL: updateCamera
// ============================================================

/**
 * Atualiza a posição e rotação de uma câmara THREE com base no ViewObject.
 *
 * @param {THREE.Camera} camera - A câmara a actualizar
 * @param {Object|null} activeView - O ViewObject conect (ou null)
 * @param {Object|null} targetMesh - O mesh a seguir (PersonalObject, etc.)
 * @param {Object} camState - Estado da câmara (de getCameraState())
 * @param {Object} options - { gameCamera, hasTouchZone, delta }
 *   - gameCamera: fallback se não há ViewObject
 *   - hasTouchZone: true se há CameraTouchZone na cena
 *   - delta: delta time para smoothing (default: 1/60)
 */
export function updateCamera(camera, activeView, targetMesh, camState, options = {}) {
  const { gameCamera = null, hasTouchZone = false, delta = 1 / 60 } = options

  // Suavizar rotação
  smoothRotation(camState, delta)

  // Determinar configuração efectiva
  const config = activeView || gameCamera || {}
  const mode = activeView?.followMode || 'none'
  const eyeHeight = activeView?.eyeHeight || 1.6
  const followDistance = activeView?.followDistance || 6
  const followHeight = activeView?.followHeight || 3

  // Aplicar FOV/Near/Far se mudou
  const targetFov = activeView?.fov || gameCamera?.fov || 60
  const targetNear = activeView?.near || gameCamera?.near || 0.1
  const targetFar = activeView?.far || gameCamera?.far || 200
  if (camera.fov !== undefined && camera.fov !== targetFov) {
    camera.fov = targetFov
    camera.near = targetNear
    camera.far = targetFar
    camera.updateProjectionMatrix()
  }

  // Determinar target position
  const targetPos = targetMesh
    ? { x: targetMesh.position.x, y: targetMesh.position.y, z: targetMesh.position.z }
    : null

  // Se há targetMesh, guardar como última posição válida
  if (targetMesh) {
    camState.lastValidPosition = [targetPos.x, targetPos.y, targetPos.z]
  }

  // ============================================================
  //  MODOS DE FOLLOW
  // ============================================================

  if (mode === 'first' && targetPos) {
    // ---- FIRST PERSON ----
    // Câmara nos olhos do jogador, rotação pelo toque/setas
    camera.position.set(
      targetPos.x,
      targetPos.y + eyeHeight,
      targetPos.z
    )
    // Rotação: usar sempre YXZ (yaw → pitch → roll)
    camera.rotation.set(camState.pitch, camState.yaw, 0, 'YXZ')

  } else if (mode === 'third' && targetPos) {
    // ---- THIRD PERSON ----
    if (camState.enabled && hasTouchZone) {
      // Orbita à volta do jogador (FPS-style)
      const dist = followDistance
      const offsetY = Math.sin(camState.pitch) * dist
      const cosP = Math.cos(camState.pitch)
      const offsetX = Math.sin(camState.yaw) * cosP * dist
      const offsetZ = Math.cos(camState.yaw) * cosP * dist
      camera.position.set(
        targetPos.x + offsetX,
        targetPos.y + followHeight + offsetY,
        targetPos.z + offsetZ
      )
      camera.lookAt(targetPos.x, targetPos.y + 1, targetPos.z)
    } else {
      // Third-person clássico (atrás do jogador)
      const targetX = targetPos.x
      const targetY = targetPos.y + followHeight
      const targetZ = targetPos.z + followDistance
      camera.position.set(
        lerp(camera.position.x, targetX, 0.15),
        lerp(camera.position.y, targetY, 0.15),
        lerp(camera.position.z, targetZ, 0.15)
      )
      camera.lookAt(targetPos.x, targetPos.y, targetPos.z)
    }

  } else if (mode === 'top' && targetPos) {
    // ---- TOP-DOWN ----
    const targetX = targetPos.x
    const targetY = targetPos.y + followDistance
    const targetZ = targetPos.z
    camera.position.set(
      lerp(camera.position.x, targetX, 0.15),
      lerp(camera.position.y, targetY, 0.15),
      lerp(camera.position.z, targetZ, 0.15)
    )
    camera.lookAt(targetPos.x, targetPos.y, targetPos.z)

  } else if (mode === 'side' && targetPos) {
    // ---- SIDE ----
    const targetX = targetPos.x + followDistance
    const targetY = targetPos.y + followHeight / 2
    const targetZ = targetPos.z
    camera.position.set(
      lerp(camera.position.x, targetX, 0.15),
      lerp(camera.position.y, targetY, 0.15),
      lerp(camera.position.z, targetZ, 0.15)
    )
    camera.lookAt(targetPos.x, targetPos.y, targetPos.z)

  } else {
    // ---- NONE ou sem target ----
    // Câmara estática na posição do ViewObject/gameCamera
    const pos = activeView?.position || gameCamera?.position || camState.lastValidPosition || [5, 4, 6]
    camera.position.set(pos[0], pos[1], pos[2])

    if (camState.enabled && hasTouchZone) {
      // Rotação pelo toque (FPS look sem movimento)
      camera.rotation.set(camState.pitch, camState.yaw, 0, 'YXZ')
    } else if (activeView?.rotation) {
      // Rotação definida no ViewObject
      camera.rotation.set(activeView.rotation[0], activeView.rotation[1], activeView.rotation[2], 'YXZ')
    } else if (gameCamera?.rotation) {
      camera.rotation.set(gameCamera.rotation[0], gameCamera.rotation[1], gameCamera.rotation[2], 'YXZ')
    } else if (targetPos) {
      // Se há target mas mode='none', olhar para o target
      camera.lookAt(targetPos.x, targetPos.y + 1, targetPos.z)
    }
    // else: manter rotação atual (não fazer lookAt(0,0,0) que era o bug anterior)
  }
}

// ============================================================
//  RESOLUÇÃO DA VIEWOBJECT ACTIVA
// ============================================================

/**
 * Determina qual ViewObject está activa numa cena.
 * Prioridade: cameraRole='player' > 'primary' > primeira ViewObject.
 *
 * @param {Array} conects - Lista de conects da cena
 * @returns {Object|null} O ViewObject activo, ou null
 */
export function resolveActiveView(conects) {
  if (!conects || !Array.isArray(conects)) return null
  const viewConects = conects.filter((c) => c.type === 'ViewObject')
  if (viewConects.length === 0) return null
  return (
    viewConects.find((c) => c.cameraRole === 'player') ||
    viewConects.find((c) => c.cameraRole === 'primary') ||
    viewConects.find((c) => c.isActive !== false) ||
    viewConects[0]
  )
}

/**
 * Determina o ID do target a seguir (PersonalObject se cameraRole='player').
 *
 * @param {Object} activeView - O ViewObject activo
 * @param {Array} conects - Lista de conects da cena
 * @returns {string|null} O instanceId do target, ou null
 */
export function resolveFollowTarget(activeView, conects) {
  if (!activeView) return null
  let targetId = activeView.followTarget
  if (!targetId && activeView.cameraRole === 'player') {
    const player = (conects || []).find((c) => c.type === 'PersonalObject')
    if (player) targetId = player.instanceId
  }
  return targetId
}

/**
 * Verifica se a cena tem pelo menos uma CameraTouchZone.
 *
 * @param {Array} conects - Lista de conects da cena
 * @returns {boolean}
 */
export function hasCameraTouchZone(conects) {
  if (!conects || !Array.isArray(conects)) return false
  return conects.some((c) => c.type === 'CameraTouchZone')
}

// ============================================================
//  VERSÃO SERIALIZÁVEL (para jogo exportado)
// ============================================================
// O gameRuntime.js é exportado como string e injectado no HTML standalone.
// Não pode importar este módulo directamente. Em vez disso, incluímos
// a função updateCamera como string que pode ser embebida.

export const CAMERA_CONTROLLER_SOURCE = `
// === cameraController (embebido) ===
function createCameraState() {
  return {
    yaw: 0, pitch: 0, sensitivity: 1.0, enabled: false, hasTouchZone: false,
    minPitch: -1.4, maxPitch: 1.4, invertY: false,
    targetYaw: 0, targetPitch: 0, smoothing: 0.25,
    lastValidPosition: [5, 4, 6],
  }
}
function lerp(a, b, t) { return a + (b - a) * t }
function smoothRotation(state, dt) {
  var t = state.smoothing > 0 ? 1 - Math.pow(state.smoothing, dt * 60) : 1
  state.yaw = lerp(state.yaw, state.targetYaw, t)
  state.pitch = lerp(state.pitch, state.targetPitch, t)
}
function applyCameraInput(dx, dy, state) {
  var sens = state.sensitivity * 0.005
  state.targetYaw -= dx * sens
  var pitchDelta = state.invertY ? dy * sens : -dy * sens
  state.targetPitch = Math.max(state.minPitch, Math.min(state.maxPitch, state.targetPitch + pitchDelta))
}
function applyCameraKeyInput(key, state) {
  var sens = 0.04
  if (key === 'arrowleft') state.targetYaw += sens
  if (key === 'arrowright') state.targetYaw -= sens
  if (key === 'arrowup') state.targetPitch = Math.max(state.minPitch, state.targetPitch + sens)
  if (key === 'arrowdown') state.targetPitch = Math.min(state.maxPitch, state.targetPitch - sens)
}
function updateCamera(camera, activeView, targetMesh, camState, options) {
  options = options || {}
  var gameCamera = options.gameCamera || null
  var hasTouchZone = options.hasTouchZone || false
  var delta = options.delta || 1/60

  smoothRotation(camState, delta)

  var config = activeView || gameCamera || {}
  var mode = (activeView && activeView.followMode) || 'none'
  var eyeHeight = (activeView && activeView.eyeHeight) || 1.6
  var followDistance = (activeView && activeView.followDistance) || 6
  var followHeight = (activeView && activeView.followHeight) || 3

  var targetFov = (activeView && activeView.fov) || (gameCamera && gameCamera.fov) || 60
  var targetNear = (activeView && activeView.near) || (gameCamera && gameCamera.near) || 0.1
  var targetFar = (activeView && activeView.far) || (gameCamera && gameCamera.far) || 200
  if (camera.fov !== undefined && camera.fov !== targetFov) {
    camera.fov = targetFov
    camera.near = targetNear
    camera.far = targetFar
    camera.updateProjectionMatrix()
  }

  var targetPos = targetMesh
    ? { x: targetMesh.position.x, y: targetMesh.position.y, z: targetMesh.position.z }
    : null

  if (targetMesh) {
    camState.lastValidPosition = [targetPos.x, targetPos.y, targetPos.z]
  }

  if (mode === 'first' && targetPos) {
    camera.position.set(targetPos.x, targetPos.y + eyeHeight, targetPos.z)
    camera.rotation.set(camState.pitch, camState.yaw, 0, 'YXZ')
  } else if (mode === 'third' && targetPos) {
    if (camState.enabled && hasTouchZone) {
      var dist = followDistance
      var offsetY = Math.sin(camState.pitch) * dist
      var cosP = Math.cos(camState.pitch)
      var offsetX = Math.sin(camState.yaw) * cosP * dist
      var offsetZ = Math.cos(camState.yaw) * cosP * dist
      camera.position.set(targetPos.x + offsetX, targetPos.y + followHeight + offsetY, targetPos.z + offsetZ)
      camera.lookAt(targetPos.x, targetPos.y + 1, targetPos.z)
    } else {
      var tx = targetPos.x, ty = targetPos.y + followHeight, tz = targetPos.z + followDistance
      camera.position.set(lerp(camera.position.x, tx, 0.15), lerp(camera.position.y, ty, 0.15), lerp(camera.position.z, tz, 0.15))
      camera.lookAt(targetPos.x, targetPos.y, targetPos.z)
    }
  } else if (mode === 'top' && targetPos) {
    var ttx = targetPos.x, tty = targetPos.y + followDistance, ttz = targetPos.z
    camera.position.set(lerp(camera.position.x, ttx, 0.15), lerp(camera.position.y, tty, 0.15), lerp(camera.position.z, ttz, 0.15))
    camera.lookAt(targetPos.x, targetPos.y, targetPos.z)
  } else if (mode === 'side' && targetPos) {
    var stx = targetPos.x + followDistance, sty = targetPos.y + followHeight/2, stz = targetPos.z
    camera.position.set(lerp(camera.position.x, stx, 0.15), lerp(camera.position.y, sty, 0.15), lerp(camera.position.z, stz, 0.15))
    camera.lookAt(targetPos.x, targetPos.y, targetPos.z)
  } else {
    var pos = (activeView && activeView.position) || (gameCamera && gameCamera.position) || camState.lastValidPosition || [5,4,6]
    camera.position.set(pos[0], pos[1], pos[2])
    if (camState.enabled && hasTouchZone) {
      camera.rotation.set(camState.pitch, camState.yaw, 0, 'YXZ')
    } else if (activeView && activeView.rotation) {
      camera.rotation.set(activeView.rotation[0], activeView.rotation[1], activeView.rotation[2], 'YXZ')
    } else if (gameCamera && gameCamera.rotation) {
      camera.rotation.set(gameCamera.rotation[0], gameCamera.rotation[1], gameCamera.rotation[2], 'YXZ')
    } else if (targetPos) {
      camera.lookAt(targetPos.x, targetPos.y + 1, targetPos.z)
    }
  }
}
function resolveActiveView(conects) {
  if (!conects || !Array.isArray(conects)) return null
  var viewConects = conects.filter(function(c) { return c.type === 'ViewObject' })
  if (viewConects.length === 0) return null
  return viewConects.find(function(c) { return c.cameraRole === 'player' })
    || viewConects.find(function(c) { return c.cameraRole === 'primary' })
    || viewConects.find(function(c) { return c.isActive !== false })
    || viewConects[0]
}
function resolveFollowTarget(activeView, conects) {
  if (!activeView) return null
  var targetId = activeView.followTarget
  if (!targetId && activeView.cameraRole === 'player') {
    var player = (conects || []).find(function(c) { return c.type === 'PersonalObject' })
    if (player) targetId = player.instanceId
  }
  return targetId
}
function hasCameraTouchZone(conects) {
  if (!conects || !Array.isArray(conects)) return false
  return conects.some(function(c) { return c.type === 'CameraTouchZone' })
}
// === fim cameraController ===
`

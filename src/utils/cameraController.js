/**
 * cameraController.js — Controller central da câmara com ViewObject + follow.
 *
 * Resolve qual a ViewObject ativa e aplica a câmara consoante o followMode.
 *
 * Modos suportados (todos):
 *  - 'none'  — câmara estática na posição/rotação da ViewObject
 *  - 'first'  — câmara nos olhos do jogador (primeira pessoa)
 *  - 'third' — câmara atrás do jogador (terceira pessoa)
 *  - 'top'    — câmara vista de cima
 *  - 'side'   — câmara vista de lado
 *
 * O controller foi extraído de SceneLevel3D.jsx para:
 *  1. Centralizar a lógica de câmara
 *  2. Garantir consistência entre editor e runtime exportado
 *  3. Facilitar testes
 */
import * as THREE from 'three'

const tmpVec3 = new THREE.Vector3()
const tmpVec3b = new THREE.Vector3()
const tmpEuler = new THREE.Euler()

/**
 * Resolve qual a ViewObject ativa, por ordem de prioridade:
 *  1. ViewObject com followMode !== 'none' (prioridade máxima)
 *  2. ViewObject com cameraRole='player'
 *  3. ViewObject com cameraRole='primary'
 *  4. Qualquer ViewObject
 *  5. null (caller deve usar gameCamera fallback)
 *
 * @param {Array} conects — lista de conects da cena ativa
 * @returns {object|null} — o conect ViewObject ativo, ou null
 */
export function resolveActiveView(conects) {
  if (!conects || conects.length === 0) return null
  const viewConects = conects.filter((c) => c.type === 'ViewObject')
  if (viewConects.length === 0) return null
  // 1. followMode !== 'none' (prioridade máxima)
  const followView = viewConects.find((c) => c.followMode && c.followMode !== 'none')
  if (followView) return followView
  // 2. cameraRole='player'
  const playerCam = viewConects.find((c) => c.cameraRole === 'player')
  if (playerCam) return playerCam
  // 3. cameraRole='primary'
  const primaryCam = viewConects.find((c) => c.cameraRole === 'primary')
  if (primaryCam) return primaryCam
  // 4. Qualquer ViewObject
  return viewConects[0]
}

/**
 * Resolve o alvo de follow — o mesh que a câmara deve seguir.
 *
 * @param {object} view — conect ViewObject ativo
 * @param {Array} conects — lista de conects da cena
 * @returns {string|null} — instanceId do alvo, ou null
 */
export function resolveFollowTarget(view, conects) {
  if (!view) return null
  // 1. followTarget explícito no ViewObject
  if (view.followTarget) return view.followTarget
  // 2. Se cameraRole='player', seguir o PersonalObject
  if (view.cameraRole === 'player') {
    const player = (conects || []).find((c) => c.type === 'PersonalObject')
    if (player) return player.instanceId
  }
  return null
}

/**
 * Aplica a câmara consoante a ViewObject ativa + alvo de follow.
 *
 * @param {THREE.Camera} camera
 * @param {object} view — conect ViewObject ativo (pode ser null)
 * @param {THREE.Object3D|null} targetMesh — mesh do alvo (pode ser null)
 * @param {object} opts — { lerpFactor=0.1 } smoothing factor
 *   Se lerpFactor=1, sem smoothing (útil para first-person)
 */
export function updateCamera(camera, view, targetMesh, opts = {}) {
  if (!view) return // caller usa fallback (gameCamera)

  const lerpFactor = opts.lerpFactor ?? 0.1
  const mode = view.followMode || 'none'
  const dist = view.followDistance ?? 6
  const height = view.followHeight ?? 3
  const fov = view.fov

  // Aplicar FOV do ViewObject (se definido)
  if (fov && camera.fov !== undefined && camera.isPerspectiveCamera) {
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
  }

  if (mode === 'none' || !targetMesh) {
    // Câmara estática na posição/rotação da ViewObject
    const pos = view.position || [5, 4, 6]
    camera.position.lerp(tmpVec3.set(pos[0], pos[1], pos[2]), lerpFactor)
    if (view.rotation) {
      // Aplicar rotação diretamente com YXZ (yaw-pitch-roll like)
      camera.rotation.order = 'YXZ'
      camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, view.rotation[0], lerpFactor)
      camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, view.rotation[1], lerpFactor)
      camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, view.rotation[2], lerpFactor)
    } else {
      // Olhar para origem por defeito
      camera.lookAt(0, 0, 0)
    }
    return
  }

  // ===== Modos de follow =====
  const tx = targetMesh.position.x
  const ty = targetMesh.position.y
  const tz = targetMesh.position.z

  switch (mode) {
    case 'first': {
      // Primeira pessoa — câmara nos olhos do jogador
      // Offset ligeiro para cima para simular altura dos olhos
      const eyeHeight = height * 0.4 // ~1.2 se height=3
      tmpVec3.set(tx, ty + eyeHeight, tz)
      camera.position.lerp(tmpVec3, Math.min(1, lerpFactor * 2))
      // Olhar na direção do yaw do target (se rotação disponível)
      if (targetMesh.rotation) {
        camera.rotation.order = 'YXZ'
        // Aplicar yaw do jogador à câmara (com smoothing)
        camera.rotation.y = THREE.MathUtils.lerp(
          camera.rotation.y,
          targetMesh.rotation.y,
          lerpFactor
        )
        camera.rotation.x = 0 // sem pitch automático
        camera.rotation.z = 0
      } else {
        camera.lookAt(tx, ty + eyeHeight, tz - 1)
      }
      break
    }

    case 'third': {
      // Terceira pessoa — câmara atrás e acima
      tmpVec3.set(tx, ty + height, tz + dist)
      camera.position.lerp(tmpVec3, lerpFactor)
      camera.lookAt(tx, ty + height * 0.3, tz)
      break
    }

    case 'top': {
      // Vista de cima
      tmpVec3.set(tx, ty + dist, tz)
      camera.position.lerp(tmpVec3, lerpFactor)
      camera.lookAt(tx, ty, tz)
      break
    }

    case 'side': {
      // Vista de lado
      tmpVec3.set(tx + dist, ty + height * 0.5, tz)
      camera.position.lerp(tmpVec3, lerpFactor)
      camera.lookAt(tx, ty, tz)
      break
    }

    default: {
      // Fallback: tratar como 'none'
      const pos = view.position || [5, 4, 6]
      camera.position.lerp(tmpVec3.set(pos[0], pos[1], pos[2]), lerpFactor)
      camera.lookAt(tx, ty, tz)
    }
  }
}

/**
 * Verifica se um ponto (em coordenadas de ecrã normalized -1..1) está numa zona
 * que deveria ativar toque na câmara (e.g., joystick virtual direito).
 *
 * @param {number} nx — coordenada X normalized (-1..1)
 * @param {number} ny — coordenada Y normalized (-1..1)
 * @returns {boolean}
 */
export function hasCameraTouchZone(nx, ny) {
  // Zona direita do ecrã (nx > 0.2) ativa câmara touch
  return nx > 0.2 && Math.abs(ny) < 0.8
}

/**
 * Versão serializada do controller para uso no runtime exportado (gameRuntime.js).
 * Recebe o estado "flat" (sem refs para React) e atualiza a câmara.
 *
 * @param {THREE.Camera} camera
 * @param {object} view — conect ViewObject (plain object)
 * @param {{x:number,y:number,z:number,rotation?:{x,y,z}}} targetState — posição+rotação do alvo
 * @param {object} opts
 */
export function updateCameraSerialized(camera, view, targetState, opts = {}) {
  if (!view) return
  const lerpFactor = opts.lerpFactor ?? 0.1
  const mode = view.followMode || 'none'
  const dist = view.followDistance ?? 6
  const height = view.followHeight ?? 3

  if (mode === 'none' || !targetState) {
    const pos = view.position || [5, 4, 6]
    camera.position.lerp(tmpVec3.set(pos[0], pos[1], pos[2]), lerpFactor)
    if (view.rotation) {
      camera.rotation.order = 'YXZ'
      camera.rotation.x = THREE.MathUtils.lerp(camera.rotation.x, view.rotation[0], lerpFactor)
      camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, view.rotation[1], lerpFactor)
      camera.rotation.z = THREE.MathUtils.lerp(camera.rotation.z, view.rotation[2], lerpFactor)
    } else {
      camera.lookAt(0, 0, 0)
    }
    return
  }

  const tx = targetState.x
  const ty = targetState.y
  const tz = targetState.z

  switch (mode) {
    case 'first': {
      const eyeHeight = height * 0.4
      tmpVec3.set(tx, ty + eyeHeight, tz)
      camera.position.lerp(tmpVec3, Math.min(1, lerpFactor * 2))
      if (targetState.rotation) {
        camera.rotation.order = 'YXZ'
        camera.rotation.y = THREE.MathUtils.lerp(camera.rotation.y, targetState.rotation.y, lerpFactor)
        camera.rotation.x = 0
        camera.rotation.z = 0
      } else {
        camera.lookAt(tx, ty + eyeHeight, tz - 1)
      }
      break
    }
    case 'third': {
      tmpVec3.set(tx, ty + height, tz + dist)
      camera.position.lerp(tmpVec3, lerpFactor)
      camera.lookAt(tx, ty + height * 0.3, tz)
      break
    }
    case 'top': {
      tmpVec3.set(tx, ty + dist, tz)
      camera.position.lerp(tmpVec3, lerpFactor)
      camera.lookAt(tx, ty, tz)
      break
    }
    case 'side': {
      tmpVec3.set(tx + dist, ty + height * 0.5, tz)
      camera.position.lerp(tmpVec3, lerpFactor)
      camera.lookAt(tx, ty, tz)
      break
    }
    default: {
      const pos = view.position || [5, 4, 6]
      camera.position.lerp(tmpVec3.set(pos[0], pos[1], pos[2]), lerpFactor)
      camera.lookAt(tx, ty, tz)
    }
  }
}

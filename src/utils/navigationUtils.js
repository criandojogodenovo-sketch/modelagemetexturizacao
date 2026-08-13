/**
 * navigationUtils.js — Utilitários de navegação 3D partilhados entre Scene3D e SceneLevel3D.
 *
 * Contém:
 *  - focusSelected(orbitRef, mesh, fov): centra a câmara num objeto
 *  - frameAll(orbitRef, meshes, fov): enquadra todos os objetos
 *  - resetCamera(orbitRef, camera): volta à posição inicial
 *  - updatePanSpeed(orbitRef): ajusta panSpeed consoante a distância
 *
 * Constantes configuráveis:
 *  - PAN_BASE_SPEED, PAN_MIN_SPEED, PAN_MAX_SPEED, PAN_DISTANCE_SCALE
 *  - ZOOM_FACTOR_IN, ZOOM_FACTOR_OUT
 *  - DEFAULT_CAMERA_FAR
 */
import * as THREE from 'three'

// ============================================================
//  CONSTANTES CONFIGURÁVEIS
// ============================================================

export const DEFAULT_CAMERA_FAR = 2000
export const DEFAULT_CAMERA_NEAR = 0.1
export const DEFAULT_CAMERA_FOV = 50

export const PAN_BASE_SPEED = 1.0
export const PAN_MIN_SPEED = 0.5
export const PAN_MAX_SPEED = 50
export const PAN_DISTANCE_SCALE = 10  // panSpeed = clamp(distance / PAN_DISTANCE_SCALE, MIN, MAX)

export const ZOOM_FACTOR_IN = 0.9    // zoom in: distance × 0.9
export const ZOOM_FACTOR_OUT = 1.1   // zoom out: distance × 1.1

export const FOCUS_MARGIN = 1.5      // margem ao calcular distância para focus
export const FRAME_MARGIN = 2.0      // margem ao calcular distância para frame all

export const HOME_POSITION = [8, 6, 10]
export const HOME_TARGET = [0, 0, 0]

// ============================================================
//  PAN ADAPTATIVO
// ============================================================

/**
 * Actualiza panSpeed do OrbitControls baseado na distância actual ao target.
 * Deve ser chamado por evento (pointerdown), não por frame.
 *
 * @param {Object} orbitRef - ref do OrbitControls (orbitRef.current)
 */
export function updatePanSpeed(orbitRef) {
  if (!orbitRef?.current) return
  const distance = orbitRef.current.getDistance()
  const speed = Math.max(
    PAN_MIN_SPEED,
    Math.min(PAN_MAX_SPEED, distance / PAN_DISTANCE_SCALE)
  )
  orbitRef.current.panSpeed = speed
}

// ============================================================
//  ZOOM ADAPTATIVO
// ============================================================

/**
 * Aplica zoom logarítmico ao OrbitControls.
 * Deve ser chamado por evento (wheel/pinch), não por frame.
 *
 * @param {Object} orbitRef - ref do OrbitControls
 * @param {number} deltaY - delta do scroll (positivo = zoom out, negativo = zoom in)
 */
export function applyZoom(orbitRef, deltaY) {
  if (!orbitRef?.current) return
  const controls = orbitRef.current
  const distance = controls.getDistance()
  const factor = deltaY > 0 ? ZOOM_FACTOR_OUT : ZOOM_FACTOR_IN
  const newDistance = distance * factor
  // O OrbitControls usa spherical.radius internamente; modificar minDistance/maxDistance
  // temporariamente não é ideal. Em vez disso, usar dollyIn/dollyOut.
  // Mas o dollyIn/dollyOut usa uma escala interna fixa.
  // Solução: ajustar a posição da câmara diretamente ao longo do eixo câmara→target.
  const dir = new THREE.Vector3()
  dir.subVectors(controls.object.position, controls.target)
  dir.normalize()
  controls.object.position.copy(controls.target).addScaledVector(dir, newDistance)
  controls.update()
}

// ============================================================
//  FOCUS SELECTED
// ============================================================

/**
 * Foca a câmara num mesh específico.
 * Calcula bounding box em world-space, centra o target e posiciona a câmara.
 *
 * @param {Object} orbitRef - ref do OrbitControls
 * @param {Object} camera - THREE.Camera
 * @param {Object} mesh - THREE.Object3D a focar
 * @param {number} fov - FOV actual da câmara (graus)
 */
export function focusSelected(orbitRef, camera, mesh, fov = DEFAULT_CAMERA_FOV) {
  if (!orbitRef?.current || !mesh) return

  const box = new THREE.Box3().setFromObject(mesh)
  if (box.isEmpty()) {
    // Fallback: usar a posição do mesh
    orbitRef.current.target.copy(mesh.position)
    return
  }

  const center = new THREE.Vector3()
  box.getCenter(center)

  const size = new THREE.Vector3()
  box.getSize(size)

  const maxDim = Math.max(size.x, size.y, size.z) || 1
  const fovRad = (fov * Math.PI) / 180
  const distance = (maxDim / (2 * Math.tan(fovRad / 2))) * FOCUS_MARGIN

  // Posicionar câmara numa posição diagonal (ângulo isométrico suave)
  const offset = new THREE.Vector3(distance * 0.5, distance * 0.5, distance)
  camera.position.copy(center).add(offset)

  orbitRef.current.target.copy(center)
  orbitRef.current.update()
}

// ============================================================
//  FRAME ALL
// ============================================================

/**
 * Enquadra todos os meshes na câmara.
 * Calcula bounding box de todos os objetos e posiciona a câmara.
 *
 * @param {Object} orbitRef - ref do OrbitControls
 * @param {Object} camera - THREE.Camera
 * @param {Array} meshes - array de THREE.Object3D
 * @param {number} fov - FOV actual (graus)
 */
export function frameAll(orbitRef, camera, meshes, fov = DEFAULT_CAMERA_FOV) {
  if (!orbitRef?.current) return

  if (!meshes || meshes.length === 0) {
    // Cena vazia: fallback seguro
    orbitRef.current.target.set(...HOME_TARGET)
    camera.position.set(...HOME_POSITION)
    orbitRef.current.update()
    return
  }

  const box = new THREE.Box3()
  for (const mesh of meshes) {
    if (mesh) box.expandByObject(mesh)
  }

  if (box.isEmpty()) {
    orbitRef.current.target.set(...HOME_TARGET)
    camera.position.set(...HOME_POSITION)
    orbitRef.current.update()
    return
  }

  const center = new THREE.Vector3()
  box.getCenter(center)

  const size = new THREE.Vector3()
  box.getSize(size)

  const maxDim = Math.max(size.x, size.y, size.z) || 10
  const fovRad = (fov * Math.PI) / 180
  const distance = (maxDim / (2 * Math.tan(fovRad / 2))) * FRAME_MARGIN

  const offset = new THREE.Vector3(distance * 0.5, distance * 0.5, distance)
  camera.position.copy(center).add(offset)

  orbitRef.current.target.copy(center)
  orbitRef.current.update()
}

// ============================================================
//  RESET / HOME CAMERA
// ============================================================

/**
 * Reposiciona a câmara na posição inicial sem afectar a cena.
 *
 * @param {Object} orbitRef - ref do OrbitControls
 * @param {Object} camera - THREE.Camera
 */
export function resetCamera(orbitRef, camera) {
  if (!orbitRef?.current) return
  camera.position.set(...HOME_POSITION)
  orbitRef.current.target.set(...HOME_TARGET)
  orbitRef.current.update()
}

// ============================================================
//  TARGET DINÂMICO
// ============================================================

/**
 * Actualiza o target do OrbitControls para o centro de um mesh.
 * NÃO move a câmara — apenas prepara o target.
 *
 * @param {Object} orbitRef - ref do OrbitControls
 * @param {Object} mesh - THREE.Object3D seleccionado (ou null para fallback)
 */
export function updateTargetToSelection(orbitRef, mesh) {
  if (!orbitRef?.current) return
  if (!mesh) {
    // Sem seleção: manter target actual (não forçar [0,0,0])
    return
  }
  // Usar posição mundial do mesh como target
  const worldPos = new THREE.Vector3()
  mesh.getWorldPosition(worldPos)
  orbitRef.current.target.copy(worldPos)
}

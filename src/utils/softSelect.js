/**
 * softSelect.js — Soft Selection / Proportional Editing.
 *
 * Funções expostas:
 *  - computeSoftSelection(geometry, centerVertexIndex, radius, falloff)
 *      → Float32Array de pesos (0..1) por vértice.
 *  - applySoftTransform(geometry, centerVertexIndex, transform, params)
 *      → aplica transform (translate/rotate/scale) ponderado por soft selection.
 *  - getVerticesInRadius(geometry, center, radius)
 *      → [{ index, distance, weight }] para os vértices dentro do raio.
 *
 * Falloff curves:
 *  - linear: (1 - d/r)
 *  - smooth: (1 - d/r)^2
 *  - sharp:  (1 - d/r)^4
 *
 * applySoftTransform devolve NOVA BufferGeometry (não muta a original).
 */
import * as THREE from 'three'

/**
 * Devolve Float32Array de pesos (0..1) por vértice.
 * falloff: 'linear' | 'smooth' | 'sharp' (default 'smooth').
 */
export function computeSoftSelection(geometry, centerVertexIndex, radius, falloff = 'smooth') {
  const pos = geometry.getAttribute('position')
  const n = pos.count
  const weights = new Float32Array(n)
  if (centerVertexIndex < 0 || centerVertexIndex >= n) return weights

  const cx = pos.getX(centerVertexIndex)
  const cy = pos.getY(centerVertexIndex)
  const cz = pos.getZ(centerVertexIndex)
  const r = Math.max(1e-6, radius)
  const r2 = r * r
  const fn = getFalloffFn(falloff)

  for (let i = 0; i < n; i++) {
    const dx = pos.getX(i) - cx
    const dy = pos.getY(i) - cy
    const dz = pos.getZ(i) - cz
    const d2 = dx * dx + dy * dy + dz * dz
    if (d2 > r2) {
      weights[i] = 0
    } else {
      const t = 1 - Math.sqrt(d2) / r
      weights[i] = fn(Math.max(0, t))
    }
  }
  weights[centerVertexIndex] = 1.0
  return weights
}

/**
 * Aplica transform (translate/rotate/scale) ponderado por soft selection.
 * params: { radius, falloff, transform }
 *   transform: { translate?: [x,y,z], rotate?: {axis, angle, pivot}, scale?: {factor, pivot} }
 * Devolve NOVA BufferGeometry.
 */
export function applySoftTransform(geometry, centerVertexIndex, transform, params = {}) {
  const radius = Math.max(1e-6, params.radius ?? 1.0)
  const falloff = params.falloff ?? 'smooth'
  const weights = computeSoftSelection(geometry, centerVertexIndex, radius, falloff)

  const src = geometry.clone()
  const srcPos = geometry.getAttribute('position')
  const outPos = src.getAttribute('position')
  const tmp = new THREE.Vector3()
  const transformed = new THREE.Vector3()

  // Pré-computa componentes do transform
  const hasTranslate = !!transform.translate
  const hasRotate = !!transform.rotate
  const hasScale = !!transform.scale
  const tr = hasTranslate ? new THREE.Vector3().fromArray(transform.translate) : null
  let quat = null
  let rotPivot = null
  if (hasRotate) {
    quat = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3().fromArray(transform.rotate.axis).normalize(),
      transform.rotate.angle
    )
    rotPivot = transform.rotate.pivot
      ? new THREE.Vector3().fromArray(transform.rotate.pivot)
      : null
  }
  let scaleFactor = 1
  let scalePivot = null
  if (hasScale) {
    scaleFactor = transform.scale.factor
    scalePivot = transform.scale.pivot
      ? new THREE.Vector3().fromArray(transform.scale.pivot)
      : null
  }

  for (let i = 0; i < outPos.count; i++) {
    const w = weights[i]
    if (w <= 0) {
      outPos.setXYZ(i, srcPos.getX(i), srcPos.getY(i), srcPos.getZ(i))
      continue
    }
    tmp.set(srcPos.getX(i), srcPos.getY(i), srcPos.getZ(i))
    transformed.copy(tmp)

    if (hasScale) {
      if (scalePivot) {
        transformed.sub(scalePivot).multiplyScalar(scaleFactor).add(scalePivot)
      } else {
        transformed.multiplyScalar(scaleFactor)
      }
    }
    if (hasRotate) {
      if (rotPivot) {
        transformed.sub(rotPivot).applyQuaternion(quat).add(rotPivot)
      } else {
        transformed.applyQuaternion(quat)
      }
    }
    if (hasTranslate) {
      transformed.add(tr)
    }
    // Interpola: final = original + (transformed - original) * weight
    outPos.setXYZ(
      i,
      tmp.x + (transformed.x - tmp.x) * w,
      tmp.y + (transformed.y - tmp.y) * w,
      tmp.z + (transformed.z - tmp.z) * w
    )
  }

  outPos.needsUpdate = true
  src.computeVertexNormals()
  return src
}

/**
 * Helper: devolve vértices dentro de `radius` de `center` (THREE.Vector3 ou [x,y,z]).
 * Saída: [{ index, distance, weight }] ordenado por distância ascendente.
 */
export function getVerticesInRadius(geometry, center, radius, falloff = 'smooth') {
  const pos = geometry.getAttribute('position')
  const c = toVec3(center)
  const r = Math.max(1e-6, radius)
  const r2 = r * r
  const fn = getFalloffFn(falloff)
  const out = []
  const tmp = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    tmp.set(pos.getX(i), pos.getY(i), pos.getZ(i))
    const d = tmp.distanceTo(c)
    if (d > r) continue
    const t = 1 - d / r
    out.push({ index: i, distance: d, weight: fn(Math.max(0, t)) })
  }
  out.sort((a, b) => a.distance - b.distance)
  return out
}

// ---------- Internal ----------

function getFalloffFn(falloff) {
  switch (falloff) {
    case 'linear':
      return (t) => t
    case 'sharp':
      return (t) => t * t * t * t
    case 'smooth':
    default:
      return (t) => t * t
  }
}

function toVec3(v) {
  if (v && v.isVector3) return v.clone()
  if (Array.isArray(v)) return new THREE.Vector3(v[0] || 0, v[1] || 0, v[2] || 0)
  if (v && typeof v === 'object') return new THREE.Vector3(v.x || 0, v.y || 0, v.z || 0)
  return new THREE.Vector3()
}

export default {
  computeSoftSelection,
  applySoftTransform,
  getVerticesInRadius
}

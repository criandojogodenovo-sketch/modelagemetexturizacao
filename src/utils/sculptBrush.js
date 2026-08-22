/**
 * sculptBrush.js — Sistema de Escultura Avançada (ZBrush/Blender-style).
 *
 * Class SculptBrush: aplica strokes de esculpir sobre BufferGeometry
 * in-place (muta positions + needsUpdate + computeVertexNormals).
 *
 * Brush types:
 *  - grab     : puxa vértices na direção do arrasto
 *  - clay     : adiciona volume (buildup) à superfície
 *  - smooth   : suaviza via laplaciano (média dos vizinhos)
 *  - flatten  : aplaina para o plano point/normal
 *  - inflate  : expande ao longo da normal
 *  - pinch    : puxa vértices para o centro do pincel
 *  - mask     : marca vértices como imóveis (mask=0)
 *  - crease   : vincos acentuados (falloff sharp)
 *  - symmetry : toggle mirror X para strokes subsequentes
 *
 * Falloff: (1 - dist/radius)^2 (quadrático smooth).
 * Symmetry: mirror across X (configurable via options.axis).
 */
import * as THREE from 'three'

const BRUSH_TYPES = new Set([
  'grab', 'clay', 'smooth', 'flatten', 'inflate',
  'pinch', 'mask', 'crease', 'symmetry'
])

export class SculptBrush {
  constructor(geometry, options = {}) {
    if (!geometry || !geometry.getAttribute('position')) {
      throw new Error('SculptBrush: geometry requer atributo position')
    }
    this.geometry = geometry
    this.posAttr = geometry.getAttribute('position')
    this.normAttr = geometry.getAttribute('normal')
    // Mask: 1.0 = movable, 0.0 = fixed
    this.mask = new Float32Array(this.posAttr.count).fill(1.0)
    // Symmetry
    this.symmetryEnabled = !!options.symmetry
    this.symmetryAxis = options.symmetryAxis || 'x' // 'x' | 'y' | 'z'
    // Drag tracking (para grab)
    this._lastPoint = null
    // Topology cache (vertex → neighbors) — built lazily
    this._neighbors = null
  }

  // ---------- Public API ----------

  /**
   * Aplica um stroke em `point` (world coords, [x,y,z] ou THREE.Vector3)
   * com `normal` (geometria da superfície, [x,y,z]).
   * brushType: ver lista acima.
   * params: { radius, strength, falloff, symmetry, mask }
   *   - radius: raio do pincel (world units)
   *   - strength: intensidade 0..1
   *   - falloff: expoente do falloff (default 2 → quadrático)
   *   - symmetry: bool one-shot para este stroke
   *   - mask: Float32Array opcional para override da mask interna
   * Returns this.geometry (mutado in-place).
   */
  stroke(point, normal, brushType, params = {}) {
    if (!BRUSH_TYPES.has(brushType)) {
      console.warn(`SculptBrush: brushType desconhecido "${brushType}"`)
      return this.geometry
    }

    const p = toVec3(point)
    const n = toVec3(normal)
    if (!n.lengthSq()) n.set(0, 1, 0)
    n.normalize()

    const radius = Math.max(1e-6, params.radius ?? 0.5)
    const strength = Math.max(0, Math.min(1, params.strength ?? 0.1))
    const falloffPow = params.falloff ?? 2

    // Override mask se fornecida (clone para não mutar input)
    const effectiveMask = params.mask ? params.mask : this.mask

    // brushType 'symmetry' apenas faz toggle do flag persistente
    if (brushType === 'symmetry') {
      this.symmetryEnabled = !this.symmetryEnabled
      return this.geometry
    }

    // Aplicar stroke principal
    this._applyBrushAt(p, n, brushType, radius, strength, falloffPow, effectiveMask)

    // Symmetry one-shot (params.symmetry) ou persistente (this.symmetryEnabled)
    const useSymmetry = params.symmetry === true || this.symmetryEnabled
    if (useSymmetry) {
      const mirrorP = p.clone()
      const mirrorN = n.clone()
      mirrorP[this.symmetryAxis] = -mirrorP[this.symmetryAxis]
      mirrorN[this.symmetryAxis] = -mirrorN[this.symmetryAxis]
      this._applyBrushAt(mirrorP, mirrorN, brushType, radius, strength, falloffPow, effectiveMask)
    }

    // Atualizar buffer de normais + flag needsUpdate
    this.posAttr.needsUpdate = true
    if (this.normAttr) this.normAttr.needsUpdate = true
    this.geometry.computeVertexNormals()
    this.normAttr = this.geometry.getAttribute('normal')

    // Guardar último ponto para grab
    this._lastPoint = p.clone()
    return this.geometry
  }

  /** Devolve a mask atual (1.0 = movable, 0.0 = fixed). */
  getMask() {
    return this.mask
  }

  /** Reseta a mask para 1.0 (todos móveis). */
  clearMask() {
    this.mask.fill(1.0)
  }

  /**
   * Devolve vértices dentro de `radius` de `point`.
   * Retorna [{ index, distance, position: THREE.Vector3 }].
   */
  getVerticesInRadius(point, radius) {
    const p = toVec3(point)
    const r2 = radius * radius
    const out = []
    const tmp = new THREE.Vector3()
    for (let i = 0; i < this.posAttr.count; i++) {
      tmp.set(this.posAttr.getX(i), this.posAttr.getY(i), this.posAttr.getZ(i))
      const d2 = tmp.distanceToSquared(p)
      if (d2 <= r2) {
        out.push({
          index: i,
          distance: Math.sqrt(d2),
          position: tmp.clone()
        })
      }
    }
    return out
  }

  // ---------- Internal ----------

  _applyBrushAt(p, n, brushType, radius, strength, falloffPow, mask) {
    const r2 = radius * radius
    const tmp = new THREE.Vector3()
    const dragVec = this._computeDragVec(p)
    const neighbors = (brushType === 'smooth' || brushType === 'crease')
      ? this._getNeighbors()
      : null

    // Para smooth/crease precisamos de acumular antes de aplicar
    let deltas = null
    if (brushType === 'smooth') {
      deltas = this._computeSmoothDeltas(p, radius, falloffPow, strength, mask, neighbors)
    }

    for (let i = 0; i < this.posAttr.count; i++) {
      if (mask && mask[i] <= 0.001) continue // vértice fixo
      tmp.set(this.posAttr.getX(i), this.posAttr.getY(i), this.posAttr.getZ(i))
      const d2 = tmp.distanceToSquared(p)
      if (d2 > r2) continue
      const dist = Math.sqrt(d2)
      const t = 1 - dist / radius
      const falloff = Math.pow(Math.max(0, t), falloffPow)

      switch (brushType) {
        case 'grab': {
          // Puxa na direção do arrasto (drag). Se não há drag, usa normal.
          const dir = dragVec.lengthSq() > 1e-10 ? dragVec : n
          this.posAttr.setXYZ(
            i,
            tmp.x + dir.x * strength * falloff,
            tmp.y + dir.y * strength * falloff,
            tmp.z + dir.z * strength * falloff
          )
          break
        }
        case 'clay': {
          // Buildup: move ao longo da normal da superfície
          this.posAttr.setXYZ(
            i,
            tmp.x + n.x * strength * falloff * 0.5,
            tmp.y + n.y * strength * falloff * 0.5,
            tmp.z + n.z * strength * falloff * 0.5
          )
          break
        }
        case 'smooth': {
          // delta pre-computado (laplaciano)
          const dx = deltas[i * 3]
          const dy = deltas[i * 3 + 1]
          const dz = deltas[i * 3 + 2]
          this.posAttr.setXYZ(
            i,
            tmp.x + dx,
            tmp.y + dy,
            tmp.z + dz
          )
          break
        }
        case 'flatten': {
          // Projeta para o plano definido por point/normal
          const v = tmp.clone().sub(p)
          const d = v.dot(n)
          const amt = d * falloff * strength
          this.posAttr.setXYZ(
            i,
            tmp.x - n.x * amt,
            tmp.y - n.y * amt,
            tmp.z - n.z * amt
          )
          break
        }
        case 'inflate': {
          // Move ao longo da normal do vértice
          const vn = this._vertexNormal(i)
          this.posAttr.setXYZ(
            i,
            tmp.x + vn.x * strength * falloff,
            tmp.y + vn.y * strength * falloff,
            tmp.z + vn.z * strength * falloff
          )
          break
        }
        case 'pinch': {
          // Puxa para o centro do pincel
          const toCenter = p.clone().sub(tmp)
          this.posAttr.setXYZ(
            i,
            tmp.x + toCenter.x * falloff * strength,
            tmp.y + toCenter.y * falloff * strength,
            tmp.z + toCenter.z * falloff * strength
          )
          break
        }
        case 'mask': {
          // Marca vértices como fixos (mask = 0)
          this.mask[i] = 0.0
          break
        }
        case 'crease': {
          // Vinco: falloff sharp + move negativo (afunda) ao longo da normal
          const sharpFalloff = Math.pow(Math.max(0, t), Math.max(4, falloffPow * 2))
          const vn = this._vertexNormal(i)
          const sign = i % 2 === 0 ? -1 : 1 // alterna para criar vinco
          this.posAttr.setXYZ(
            i,
            tmp.x + vn.x * strength * sharpFalloff * sign,
            tmp.y + vn.y * strength * sharpFalloff * sign,
            tmp.z + vn.z * strength * sharpFalloff * sign
          )
          break
        }
        default:
          break
      }
    }
  }

  _computeDragVec(p) {
    if (!this._lastPoint) return new THREE.Vector3()
    return p.clone().sub(this._lastPoint)
  }

  _vertexNormal(i) {
    if (!this.normAttr) return new THREE.Vector3(0, 1, 0)
    const v = new THREE.Vector3(
      this.normAttr.getX(i),
      this.normAttr.getY(i),
      this.normAttr.getZ(i)
    )
    if (v.lengthSq() < 1e-10) v.set(0, 1, 0)
    return v.normalize()
  }

  // Suavização Laplaciana: move cada vértice para a média dos vizinhos
  _computeSmoothDeltas(p, radius, falloffPow, strength, mask, neighbors) {
    const count = this.posAttr.count
    const deltas = new Float32Array(count * 3)
    const tmp = new THREE.Vector3()
    const centroid = new THREE.Vector3()
    const r2 = radius * radius
    for (let i = 0; i < count; i++) {
      if (mask && mask[i] <= 0.001) continue
      tmp.set(this.posAttr.getX(i), this.posAttr.getY(i), this.posAttr.getZ(i))
      const d2 = tmp.distanceToSquared(p)
      if (d2 > r2) continue
      const dist = Math.sqrt(d2)
      const t = 1 - dist / radius
      const falloff = Math.pow(Math.max(0, t), falloffPow)
      const nb = neighbors.get(i)
      if (!nb || nb.size === 0) continue
      centroid.set(0, 0, 0)
      nb.forEach((j) => {
        centroid.x += this.posAttr.getX(j)
        centroid.y += this.posAttr.getY(j)
        centroid.z += this.posAttr.getZ(j)
      })
      centroid.multiplyScalar(1 / nb.size)
      deltas[i * 3] = (centroid.x - tmp.x) * falloff * strength
      deltas[i * 3 + 1] = (centroid.y - tmp.y) * falloff * strength
      deltas[i * 3 + 2] = (centroid.z - tmp.z) * falloff * strength
    }
    return deltas
  }

  // Topologia: map de índice de vértice → Set de vizinhos (vertex-adjacency).
  // Construído uma vez e cacheado. Invalidado se a geometria mudar externamente.
  _getNeighbors() {
    if (this._neighbors) return this._neighbors
    const count = this.posAttr.count
    const map = new Map()
    for (let i = 0; i < count; i++) map.set(i, new Set())
    const index = this.geometry.index
    if (index) {
      const arr = index.array
      for (let k = 0; k < arr.length; k += 3) {
        const a = arr[k], b = arr[k + 1], c = arr[k + 2]
        map.get(a).add(b); map.get(a).add(c)
        map.get(b).add(a); map.get(b).add(c)
        map.get(c).add(a); map.get(c).add(b)
      }
    } else {
      // Não-indexada: cada 3 vértices consecutivos formam um triângulo
      const total = Math.floor(this.posAttr.count / 3) * 3
      for (let k = 0; k < total; k += 3) {
        const a = k, b = k + 1, c = k + 2
        map.get(a).add(b); map.get(a).add(c)
        map.get(b).add(a); map.get(b).add(c)
        map.get(c).add(a); map.get(c).add(b)
      }
    }
    this._neighbors = map
    return map
  }
}

// ---------- Helpers ----------

function toVec3(v) {
  if (v && v.isVector3) return v.clone()
  if (Array.isArray(v)) return new THREE.Vector3(v[0] || 0, v[1] || 0, v[2] || 0)
  if (v && typeof v === 'object') return new THREE.Vector3(v.x || 0, v.y || 0, v.z || 0)
  return new THREE.Vector3()
}

export default SculptBrush

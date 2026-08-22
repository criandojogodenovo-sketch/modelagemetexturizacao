/**
 * treeBuilder.js — realistic procedural trees.
 *
 * Types: oak | pine | palm
 *   - tapered trunk (radiusTop < radiusBottom), brown bark with per-segment jitter
 *   - oak: 3-5 jittered spheres clustered (sheen for soft foliage)
 *   - pine: stacked cones (decreasing radius)
 *   - palm: tall trunk + flattened frond spheres + coconuts
 */
import * as THREE from 'three'
import {
  hexToRgb, jitter, paintGeometry, mergeGeometriesWithColors, makeObject,
} from './_helpers'

export function generateTree(params = {}) {
  const {
    type = 'oak',       // oak | pine | palm
    height = 5,
    trunkRadius = 0.25,
    foliageColor = '#3a7d2c',
  } = params

  const geos = []
  const trunkRgb = [0.32, 0.20, 0.12]
  const folRgb = hexToRgb(foliageColor)

  const trunkH = type === 'palm' ? height * 0.85 : height * 0.4
  const trunk = new THREE.CylinderGeometry(
    trunkRadius * 0.75, trunkRadius, trunkH, 12,
  )
  trunk.translate(0, trunkH / 2, 0)
  geos.push(paintGeometry(trunk, jitter(trunkRgb, 0.04)))

  if (type === 'oak') {
    // 3-5 spheres clustered at top
    const top = trunkH
    const r = trunkRadius * 3.5
    const clusters = [
      [0, top + r * 0.3, 0, r],
      [r * 0.6, top + r * 0.6, r * 0.3, r * 0.8],
      [-r * 0.5, top + r * 0.5, -r * 0.4, r * 0.85],
      [0.1, top + r * 0.9, -r * 0.6, r * 0.7],
      [r * 0.4, top + r * 0.4, -r * 0.2, r * 0.75],
    ]
    for (const p of clusters) {
      const s = new THREE.SphereGeometry(p[3], 16, 12)
      s.translate(p[0], p[1], p[2])
      geos.push(paintGeometry(s, jitter(folRgb, 0.08)))
    }
  } else if (type === 'pine') {
    // Stack of cones (decreasing radius going up)
    const levels = 4
    const coneH = (height - trunkH) / levels
    const baseR = trunkRadius * 4
    for (let i = 0; i < levels; i++) {
      const r = baseR * (1 - i / (levels + 1))
      const c = new THREE.ConeGeometry(r, coneH * 1.3, 12)
      c.translate(0, trunkH + i * coneH + coneH * 0.15, 0)
      geos.push(paintGeometry(c, jitter(folRgb, 0.06)))
    }
  } else { // palm
    // Flattened frond spheres around the crown
    const top = trunkH
    const frondCount = 6
    const r = trunkRadius * 2.5
    for (let i = 0; i < frondCount; i++) {
      const a = (i / frondCount) * Math.PI * 2
      const s = new THREE.SphereGeometry(r, 12, 8)
      s.scale(1.4, 0.4, 1.0)
      s.translate(Math.cos(a) * r * 0.8, top + r * 0.2, Math.sin(a) * r * 0.8)
      geos.push(paintGeometry(s, jitter(folRgb, 0.05)))
    }
    // Coconuts beneath the crown
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2
      const c = new THREE.SphereGeometry(trunkRadius * 0.4, 8, 6)
      c.translate(Math.cos(a) * trunkRadius, top - 0.1, Math.sin(a) * trunkRadius)
      geos.push(paintGeometry(c, [0.25, 0.15, 0.05]))
    }
  }

  const merged = mergeGeometriesWithColors(geos)
  merged.computeVertexNormals()

  return makeObject({
    idPrefix: 'tree',
    name: `Árvore ${type}`,
    geometry: merged,
    material: {
      color: foliageColor,
      roughness: 0.85,
      metalness: 0.0,
      sheen: 0.3,
      sheenColor: foliageColor,
    },
  })
}

export const generate = generateTree
export default { generate, generateTree }

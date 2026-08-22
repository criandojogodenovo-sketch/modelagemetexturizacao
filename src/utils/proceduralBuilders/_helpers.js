/**
 * _helpers.js — shared utilities for proceduralBuilders/*.
 *
 * Pattern mirrors buildingGenerator.js: each builder constructs a list of
 * THREE.BufferGeometry pieces, paints every vertex of each piece with the
 * part's color, then merges into ONE non-indexed geometry with a `color`
 * attribute. The catalog object then uses `vertexColors: true` on a single
 * MeshPhysicalMaterial so different parts (wall/window/roof/etc.) read as
 * different colors without needing multi-material support.
 */
import * as THREE from 'three'

// hex string → [r,g,b] normalized 0..1
export function hexToRgb(hex) {
  if (!hex || typeof hex !== 'string') return [0.8, 0.8, 0.8]
  try {
    const c = new THREE.Color(hex)
    return [c.r, c.g, c.b]
  } catch {
    return [0.8, 0.8, 0.8]
  }
}

// Slight per-channel jitter — adds natural variation between foliage clusters / bark segments.
export function jitter(rgb, amount = 0.05) {
  return [
    Math.max(0, Math.min(1, rgb[0] + (Math.random() - 0.5) * amount)),
    Math.max(0, Math.min(1, rgb[1] + (Math.random() - 0.5) * amount)),
    Math.max(0, Math.min(1, rgb[2] + (Math.random() - 0.5) * amount)),
  ]
}

// Paint every vertex of a geometry with a uniform color (sets `color` attribute).
export function paintGeometry(geo, color) {
  const count = geo.attributes.position.count
  const colors = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    colors[i * 3] = color[0]
    colors[i * 3 + 1] = color[1]
    colors[i * 3 + 2] = color[2]
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

// Merge multiple geometries (with vertex colors) into a single non-indexed BufferGeometry.
// `toNonIndexed()` preserves all BufferAttributes including `color`.
export function mergeGeometriesWithColors(geometries) {
  const nonIndexed = geometries.map(g => (g.index ? g.toNonIndexed() : g))
  let totalVerts = 0
  for (const g of nonIndexed) totalVerts += g.attributes.position.count

  const positions = new Float32Array(totalVerts * 3)
  const normals = new Float32Array(totalVerts * 3)
  const colors = new Float32Array(totalVerts * 3)
  let offset = 0

  for (const g of nonIndexed) {
    positions.set(g.attributes.position.array, offset * 3)
    if (g.attributes.normal) normals.set(g.attributes.normal.array, offset * 3)
    if (g.attributes.color) {
      colors.set(g.attributes.color.array, offset * 3)
    } else {
      for (let i = 0; i < g.attributes.position.count; i++) {
        colors[(offset + i) * 3] = 0.8
        colors[(offset + i) * 3 + 1] = 0.8
        colors[(offset + i) * 3 + 2] = 0.8
      }
    }
    offset += g.attributes.position.count
  }

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
  merged.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return merged
}

// Serialize a THREE.BufferGeometry into plain arrays for the catalog object format.
export function serializeGeometry(geo) {
  return {
    positions: Array.from(geo.attributes.position.array),
    normals: Array.from(geo.attributes.normal.array),
    uvs: geo.attributes.uv ? Array.from(geo.attributes.uv.array) : [],
    colors: geo.attributes.color ? Array.from(geo.attributes.color.array) : [],
  }
}

// Build the catalog object consumed by useStore.addImportedObject.
// `material` should be a PBR-shaped object (color, roughness, metalness, etc.);
// `vertexColors: true` is force-enabled so the painted part colors show through.
export function makeObject({ idPrefix, name, geometry, material, position = [0, 0, 0] }) {
  return {
    id: `obj_${idPrefix}_${Math.random().toString(36).slice(2, 10)}`,
    name,
    type: 'custom',
    position: [...position],
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    material: { vertexColors: true, ...material },
    customGeometry: serializeGeometry(geometry),
    modifiers: [],
  }
}

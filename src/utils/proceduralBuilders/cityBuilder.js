/**
 * cityBuilder.js — procedural city grid.
 *
 * Lays out `blocks × blocks` blocks, each with `buildingsPerBlock` houses
 * placed in a regular sub-cell pattern. Houses are produced by generateHouse
 * with randomized params (style, floors, wall/roof colors, dimensions) for
 * variety. Street lamps (post + emissive head) are placed at every outer
 * corner of the grid.
 *
 * Returns `{ objects, centerOffset }` — caller iterates `objects` and calls
 * addImportedObject for each. centerOffset is [0,0,0] since we center the
 * city around the world origin already.
 */
import * as THREE from 'three'
import {
  paintGeometry, mergeGeometriesWithColors, makeObject,
} from './_helpers'
import { generateHouse } from './houseBuilder'

export function generateCity(params = {}) {
  const {
    blocks = 3,             // grid: blocks × blocks
    buildingsPerBlock = 4,
    streetWidth = 6,
  } = params

  const objects = []
  const blockSize = 14
  const perRow = Math.max(1, Math.ceil(Math.sqrt(buildingsPerBlock)))
  const cellSize = blockSize / perRow
  const gridStride = blockSize + streetWidth
  const offset = ((blocks - 1) * gridStride) / 2

  const styles = ['modern', 'classic', 'cottage']
  const palette = ['#e8e2d5', '#d8c8a8', '#c0b098', '#9aa8b0', '#b88860', '#dcd0c0']
  const roofPalette = ['#2c2c30', '#5a2618', '#7a2a1f', '#3a3a40', '#6a2a1c']

  for (let bx = 0; bx < blocks; bx++) {
    for (let bz = 0; bz < blocks; bz++) {
      const blockOriginX = bx * gridStride - offset
      const blockOriginZ = bz * gridStride - offset
      let placed = 0
      for (let i = 0; i < perRow && placed < buildingsPerBlock; i++) {
        for (let j = 0; j < perRow && placed < buildingsPerBlock; j++) {
          const px = blockOriginX - blockSize / 2 + cellSize * (i + 0.5)
          const pz = blockOriginZ - blockSize / 2 + cellSize * (j + 0.5)
          const style = styles[Math.floor(Math.random() * styles.length)]
          const house = generateHouse({
            style,
            floors: 1 + Math.floor(Math.random() * 3),
            width: 3.5 + Math.random() * 2.5,
            depth: 3 + Math.random() * 2,
            floorHeight: 2.8,
            wallColor: palette[Math.floor(Math.random() * palette.length)],
            roofColor: style === 'modern'
              ? '#2c2c30'
              : roofPalette[Math.floor(Math.random() * roofPalette.length)],
          })
          house.position = [px, 0, pz]
          house.rotation = [0, Math.floor(Math.random() * 4) * (Math.PI / 2), 0]
          objects.push(house)
          placed++
        }
      }
    }
  }

  // Street lamps at outer grid corners
  for (let bx = 0; bx <= blocks; bx++) {
    for (let bz = 0; bz <= blocks; bz++) {
      const px = bx * gridStride - offset - streetWidth / 2 - 0.5
      const pz = bz * gridStride - offset - streetWidth / 2 - 0.5
      objects.push(makeStreetLamp(px, pz))
    }
  }

  return {
    objects,
    centerOffset: [0, 0, 0],
  }
}

function makeStreetLamp(x, z) {
  const geos = []
  const dark = [0.15, 0.15, 0.18]
  // Pole
  const pole = new THREE.CylinderGeometry(0.05, 0.07, 4, 8)
  pole.translate(0, 2, 0)
  geos.push(paintGeometry(pole, dark))
  // Arm extending over street
  const arm = new THREE.BoxGeometry(0.06, 0.06, 0.6)
  arm.translate(0, 4, 0.3)
  geos.push(paintGeometry(arm, dark))
  // Lamp head (warm emissive)
  const head = new THREE.SphereGeometry(0.18, 12, 8)
  head.translate(0, 4, 0.6)
  geos.push(paintGeometry(head, [1.0, 0.92, 0.65]))
  // Base plate
  const base = new THREE.CylinderGeometry(0.15, 0.18, 0.2, 8)
  base.translate(0, 0.1, 0)
  geos.push(paintGeometry(base, [0.18, 0.18, 0.20]))
  // Lamp shade cone
  const shade = new THREE.ConeGeometry(0.25, 0.15, 8)
  shade.translate(0, 4.18, 0.6)
  geos.push(paintGeometry(shade, dark))

  const merged = mergeGeometriesWithColors(geos)
  merged.computeVertexNormals()

  const obj = makeObject({
    idPrefix: 'lamp',
    name: 'Lampada rua',
    geometry: merged,
    material: {
      color: '#1a1a1a',
      roughness: 0.6,
      metalness: 0.7,
      emissive: '#fff2c0',
      emissiveIntensity: 1.5,
    },
  })
  obj.position = [x, 0, z]
  return obj
}

export const generate = generateCity
export default { generate, generateCity }

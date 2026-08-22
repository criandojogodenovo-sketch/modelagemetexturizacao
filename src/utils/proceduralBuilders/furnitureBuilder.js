/**
 * furnitureBuilder.js — procedural furniture.
 *
 * Types: chair | table | sofa | bed
 *   - chair: seat + back + 4 cylindrical legs
 *   - table: rectangular top + 4 legs
 *   - sofa: base + back + 2 arms + 2 cushions
 *   - bed: frame + mattress + headboard + 2 pillows
 *
 * Wood parts (chair/table/bed-frame): roughness 0.6.
 * Fabric parts (sofa/bed mattress): roughness 0.8, sheen 0.5.
 */
import * as THREE from 'three'
import {
  hexToRgb, paintGeometry, mergeGeometriesWithColors, makeObject,
} from './_helpers'

export function generateFurniture(params = {}) {
  const {
    type = 'chair',   // chair | table | sofa | bed
    color = '#7a4a2b',
  } = params

  const geos = []
  const wood = hexToRgb(color)
  const woodDark = [wood[0] * 0.6, wood[1] * 0.6, wood[2] * 0.6]
  const fabric = [0.55, 0.45, 0.40]
  const fabricLight = [0.65, 0.55, 0.50]
  const white = [0.92, 0.90, 0.85]
  const white2 = [0.97, 0.96, 0.93]

  if (type === 'chair') {
    const seat = new THREE.BoxGeometry(0.5, 0.08, 0.5)
    seat.translate(0, 0.5, 0)
    geos.push(paintGeometry(seat, wood))
    const back = new THREE.BoxGeometry(0.5, 0.6, 0.06)
    back.translate(0, 0.84, -0.22)
    geos.push(paintGeometry(back, wood))
    for (const [x, z] of [[0.22, 0.22], [-0.22, 0.22], [0.22, -0.22], [-0.22, -0.22]]) {
      const leg = new THREE.CylinderGeometry(0.04, 0.04, 0.5, 8)
      leg.translate(x, 0.25, z)
      geos.push(paintGeometry(leg, woodDark))
    }
    // Back slats
    for (let i = -1; i <= 1; i++) {
      const slat = new THREE.BoxGeometry(0.04, 0.5, 0.04)
      slat.translate(i * 0.18, 0.78, -0.22)
      geos.push(paintGeometry(slat, woodDark))
    }
  } else if (type === 'table') {
    const top = new THREE.BoxGeometry(1.5, 0.08, 0.9)
    top.translate(0, 0.75, 0)
    geos.push(paintGeometry(top, wood))
    for (const [x, z] of [[0.65, 0.38], [-0.65, 0.38], [0.65, -0.38], [-0.65, -0.38]]) {
      const leg = new THREE.CylinderGeometry(0.05, 0.05, 0.75, 10)
      leg.translate(x, 0.375, z)
      geos.push(paintGeometry(leg, woodDark))
    }
    // Skirt under top
    const skirtF = new THREE.BoxGeometry(1.4, 0.08, 0.04)
    skirtF.translate(0, 0.66, 0.43)
    geos.push(paintGeometry(skirtF, wood))
    const skirtB = skirtF.clone(); skirtB.translate(0, 0, -0.86)
    geos.push(paintGeometry(skirtB, wood))
  } else if (type === 'sofa') {
    // Base
    const base = new THREE.BoxGeometry(2.0, 0.45, 0.85)
    base.translate(0, 0.25, 0)
    geos.push(paintGeometry(base, fabric))
    // Back
    const back = new THREE.BoxGeometry(2.0, 0.6, 0.18)
    back.translate(0, 0.75, -0.33)
    geos.push(paintGeometry(back, fabric))
    // Arms
    const armL = new THREE.BoxGeometry(0.18, 0.55, 0.85)
    armL.translate(-0.91, 0.4, 0)
    geos.push(paintGeometry(armL, fabric))
    const armR = armL.clone(); armR.translate(1.82, 0, 0)
    geos.push(paintGeometry(armR, fabric))
    // Cushions
    for (const x of [-0.5, 0.5]) {
      const cush = new THREE.BoxGeometry(0.85, 0.15, 0.7)
      cush.translate(x, 0.55, 0.05)
      geos.push(paintGeometry(cush, fabricLight))
    }
    // Legs (short)
    for (const [x, z] of [[-0.9, 0.35], [0.9, 0.35], [-0.9, -0.35], [0.9, -0.35]]) {
      const leg = new THREE.CylinderGeometry(0.04, 0.04, 0.1, 6)
      leg.translate(x, 0.05, z)
      geos.push(paintGeometry(leg, woodDark))
    }
  } else if (type === 'bed') {
    // Frame
    const frame = new THREE.BoxGeometry(2.0, 0.35, 2.2)
    frame.translate(0, 0.2, 0)
    geos.push(paintGeometry(frame, woodDark))
    // Mattress
    const mat = new THREE.BoxGeometry(1.85, 0.25, 2.05)
    mat.translate(0, 0.5, 0.05)
    geos.push(paintGeometry(mat, white))
    // Headboard
    const hb = new THREE.BoxGeometry(2.0, 0.9, 0.1)
    hb.translate(0, 0.65, -1.1)
    geos.push(paintGeometry(hb, wood))
    // Pillows
    for (const x of [-0.5, 0.5]) {
      const pil = new THREE.BoxGeometry(0.6, 0.12, 0.4)
      pil.translate(x, 0.7, -0.75)
      geos.push(paintGeometry(pil, white2))
    }
    // Blanket (folded at foot)
    const blanket = new THREE.BoxGeometry(1.85, 0.08, 0.7)
    blanket.translate(0, 0.66, 0.7)
    geos.push(paintGeometry(blanket, fabricLight))
  }

  const merged = mergeGeometriesWithColors(geos)
  merged.computeVertexNormals()

  const isFabric = type === 'sofa' || type === 'bed'

  return makeObject({
    idPrefix: 'furniture',
    name: `Móvel ${type}`,
    geometry: merged,
    material: {
      color,
      roughness: isFabric ? 0.8 : 0.6,
      metalness: 0.0,
      sheen: isFabric ? 0.5 : 0.0,
      sheenColor: color,
    },
  })
}

export const generate = generateFurniture
export default { generate, generateFurniture }

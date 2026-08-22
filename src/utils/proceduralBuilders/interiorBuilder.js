/**
 * interiorBuilder.js — procedural room interior.
 *
 * Generates:
 *   - floor (wood) + ceiling (light)
 *   - 4 walls: back/left/right full, front split into 3 segments around a door opening
 *   - open door leaf rotated 45° around its hinge (left edge)
 *   - baseboard trims along the perimeter
 *   - bed (frame + mattress + headboard + pillow) in back-left corner
 *   - table with 4 legs in front-right corner
 *
 * Wall material drives the PBR (roughness 0.8). Vertex colors differentiate
 * floor (wood) / ceiling (light) / door (wood) / furniture pieces.
 */
import * as THREE from 'three'
import {
  paintGeometry, mergeGeometriesWithColors, makeObject,
} from './_helpers'

export function generateInterior(params = {}) {
  const {
    roomWidth = 6,
    roomDepth = 5,
    roomHeight = 3,
    style = 'modern', // modern | rustic
  } = params

  const geos = []
  const wallT = 0.15
  const wallRgb = style === 'rustic' ? [0.78, 0.65, 0.55] : [0.92, 0.92, 0.90]
  const floorRgb = style === 'rustic' ? [0.45, 0.30, 0.20] : [0.65, 0.50, 0.35]
  const ceilRgb = [0.95, 0.95, 0.95]
  const trimRgb = [0.92, 0.92, 0.90]
  const doorRgb = style === 'rustic' ? [0.40, 0.25, 0.15] : [0.55, 0.40, 0.30]
  const woodDark = [0.30, 0.20, 0.15]
  const white = [0.92, 0.90, 0.85]

  // Floor
  const floor = new THREE.BoxGeometry(roomWidth, 0.05, roomDepth)
  floor.translate(0, 0.025, 0)
  geos.push(paintGeometry(floor, floorRgb))

  // Ceiling
  const ceil = new THREE.BoxGeometry(roomWidth, 0.05, roomDepth)
  ceil.translate(0, roomHeight - 0.025, 0)
  geos.push(paintGeometry(ceil, ceilRgb))

  // Back wall (full)
  const wallBack = new THREE.BoxGeometry(roomWidth, roomHeight, wallT)
  wallBack.translate(0, roomHeight / 2, -roomDepth / 2)
  geos.push(paintGeometry(wallBack, wallRgb))

  // Left wall
  const wallLeft = new THREE.BoxGeometry(wallT, roomHeight, roomDepth)
  wallLeft.translate(-roomWidth / 2, roomHeight / 2, 0)
  geos.push(paintGeometry(wallLeft, wallRgb))

  // Right wall
  const wallRight = new THREE.BoxGeometry(wallT, roomHeight, roomDepth)
  wallRight.translate(roomWidth / 2, roomHeight / 2, 0)
  geos.push(paintGeometry(wallRight, wallRgb))

  // Front wall — with door opening (3 segments: left, top, right)
  const doorW = 1.0
  const doorH = 2.1
  const segSideW = (roomWidth - doorW) / 2
  const segL = new THREE.BoxGeometry(segSideW, roomHeight, wallT)
  segL.translate(-roomWidth / 2 + segSideW / 2, roomHeight / 2, roomDepth / 2)
  geos.push(paintGeometry(segL, wallRgb))
  const segR = new THREE.BoxGeometry(segSideW, roomHeight, wallT)
  segR.translate(roomWidth / 2 - segSideW / 2, roomHeight / 2, roomDepth / 2)
  geos.push(paintGeometry(segR, wallRgb))
  const segTop = new THREE.BoxGeometry(doorW, roomHeight - doorH, wallT)
  segTop.translate(0, doorH + (roomHeight - doorH) / 2, roomDepth / 2)
  geos.push(paintGeometry(segTop, wallRgb))

  // Door leaf — hinged on left edge, rotated 45° open inward
  const doorLeaf = new THREE.BoxGeometry(doorW, doorH, 0.05)
  doorLeaf.translate(doorW / 2, 0, 0)           // move pivot to left edge
  doorLeaf.rotateY(Math.PI / 4)                  // open inward
  doorLeaf.translate(-doorW / 2, doorH / 2, roomDepth / 2 + 0.05)
  geos.push(paintGeometry(doorLeaf, doorRgb))
  // Door knob
  const knob = new THREE.SphereGeometry(0.04, 8, 6)
  knob.translate(doorW - 0.15, doorH / 2, roomDepth / 2 + 0.18)
  geos.push(paintGeometry(knob, [0.85, 0.75, 0.30]))

  // Baseboard trims around the perimeter (skip across door opening)
  const trimH = 0.1
  const trims = [
    new THREE.BoxGeometry(roomWidth, trimH, 0.02).translate(0, trimH / 2, -roomDepth / 2 + wallT),
    new THREE.BoxGeometry(0.02, trimH, roomDepth).translate(-roomWidth / 2 + wallT, trimH / 2, 0),
    new THREE.BoxGeometry(0.02, trimH, roomDepth).translate(roomWidth / 2 - wallT, trimH / 2, 0),
    new THREE.BoxGeometry((roomWidth - doorW) / 2, trimH, 0.02)
      .translate(-roomWidth / 4 - doorW / 4, trimH / 2, roomDepth / 2 - wallT),
    new THREE.BoxGeometry((roomWidth - doorW) / 2, trimH, 0.02)
      .translate(roomWidth / 4 + doorW / 4, trimH / 2, roomDepth / 2 - wallT),
  ]
  for (const t of trims) geos.push(paintGeometry(t, trimRgb))

  // Furniture — bed in back-left corner
  const bedX = -roomWidth / 2 + 0.95
  const bedZ = -roomDepth / 2 + 1.15
  const bedFrame = new THREE.BoxGeometry(1.4, 0.3, 2.0)
  bedFrame.translate(bedX, 0.15, bedZ)
  geos.push(paintGeometry(bedFrame, [0.40, 0.30, 0.25]))
  const mattress = new THREE.BoxGeometry(1.3, 0.18, 1.9)
  mattress.translate(bedX, 0.39, bedZ)
  geos.push(paintGeometry(mattress, white))
  const pillow = new THREE.BoxGeometry(1.0, 0.1, 0.35)
  pillow.translate(bedX, 0.53, bedZ - 0.7)
  geos.push(paintGeometry(pillow, [0.97, 0.93, 0.88]))
  // Headboard
  const headboard = new THREE.BoxGeometry(1.5, 0.7, 0.08)
  headboard.translate(bedX, 0.45, bedZ - 1.05)
  geos.push(paintGeometry(headboard, [0.35, 0.25, 0.18]))

  // Table in front-right corner
  const tableX = roomWidth / 2 - 0.85
  const tableZ = roomDepth / 2 - 0.55
  const tableTop = new THREE.BoxGeometry(1.2, 0.06, 0.7)
  tableTop.translate(tableX, 0.75, tableZ)
  geos.push(paintGeometry(tableTop, floorRgb))
  for (const [dx, dz] of [[-0.5, -0.28], [0.5, -0.28], [-0.5, 0.28], [0.5, 0.28]]) {
    const leg = new THREE.CylinderGeometry(0.04, 0.04, 0.75, 8)
    leg.translate(tableX + dx, 0.375, tableZ + dz)
    geos.push(paintGeometry(leg, woodDark))
  }
  // Chair at table
  const chairX = tableX
  const chairZ = tableZ - 0.6
  const chairSeat = new THREE.BoxGeometry(0.45, 0.05, 0.45)
  chairSeat.translate(chairX, 0.45, chairZ)
  geos.push(paintGeometry(chairSeat, [0.45, 0.32, 0.22]))
  const chairBack = new THREE.BoxGeometry(0.45, 0.4, 0.04)
  chairBack.translate(chairX, 0.67, chairZ - 0.22)
  geos.push(paintGeometry(chairBack, [0.45, 0.32, 0.22]))
  for (const [dx, dz] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) {
    const leg = new THREE.CylinderGeometry(0.02, 0.02, 0.45, 6)
    leg.translate(chairX + dx, 0.22, chairZ + dz)
    geos.push(paintGeometry(leg, woodDark))
  }

  // Rug under the table area
  const rug = new THREE.BoxGeometry(2.0, 0.02, 1.5)
  rug.translate(0, 0.06, 0.5)
  geos.push(paintGeometry(rug, [0.55, 0.40, 0.35]))

  const merged = mergeGeometriesWithColors(geos)
  merged.computeVertexNormals()

  return makeObject({
    idPrefix: 'interior',
    name: `Interior ${style}`,
    geometry: merged,
    material: {
      color: '#cccccc',
      roughness: 0.8,
      metalness: 0.0,
    },
  })
}

export const generate = generateInterior
export default { generate, generateInterior }

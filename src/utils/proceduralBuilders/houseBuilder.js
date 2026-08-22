/**
 * houseBuilder.js — realistic procedural houses.
 *
 * Style-driven geometry (modern | classic | cottage):
 *   - foundation slab (slightly larger + darker than walls)
 *   - 4 walls with recessed window cutouts (frame flush, glass inset)
 *   - recessed door with frame + knob + entry step
 *   - style-specific roof (flat parapet / gabled red tile / steep pitched)
 *   - brick chimney on classic & cottage
 *
 * Multi-part coloring uses vertex colors (single merged mesh, single material).
 * Walls drive the PBR (roughness 0.7); glass/door/roof read via vertex color.
 */
import * as THREE from 'three'
import {
  hexToRgb, jitter, paintGeometry, mergeGeometriesWithColors, makeObject,
} from './_helpers'

export function generateHouse(params = {}) {
  const {
    style = 'modern',        // modern | classic | cottage
    floors = 2,
    width = 6,
    depth = 4,
    floorHeight = 3,
    wallColor = '#e8e2d5',
    roofColor = '#2c2c30',
  } = params

  const geos = []
  const totalH = floors * floorHeight
  const wallT = 0.2
  const wallRgb = jitter(hexToRgb(wallColor), 0.03)
  const foundRgb = [0.32, 0.28, 0.24]      // darker foundation slab
  const winRgb = [0.42, 0.62, 0.80]        // glassy blue
  const frameRgb = [0.12, 0.12, 0.14]
  const doorRgb = [0.30, 0.18, 0.10]
  const knobRgb = [0.85, 0.75, 0.30]
  const stepRgb = [0.30, 0.27, 0.23]
  const chimneyRgb = [0.55, 0.30, 0.22]
  const capRgb = [0.25, 0.25, 0.25]

  // 1. Foundation slab — slightly larger + darker than walls
  const found = new THREE.BoxGeometry(width + 0.5, 0.4, depth + 0.5)
  found.translate(0, -0.2, 0)
  geos.push(paintGeometry(found, foundRgb))

  // 2. Walls
  const wF = new THREE.BoxGeometry(width, totalH, wallT)
  wF.translate(0, totalH / 2, depth / 2)
  geos.push(paintGeometry(wF, wallRgb))
  const wB = new THREE.BoxGeometry(width, totalH, wallT)
  wB.translate(0, totalH / 2, -depth / 2)
  geos.push(paintGeometry(wB, wallRgb))
  const wL = new THREE.BoxGeometry(wallT, totalH, depth)
  wL.translate(-width / 2, totalH / 2, 0)
  geos.push(paintGeometry(wL, wallRgb))
  const wR = new THREE.BoxGeometry(wallT, totalH, depth)
  wR.translate(width / 2, totalH / 2, 0)
  geos.push(paintGeometry(wR, wallRgb))

  // 3. Recessed windows — frame flush with wall, glass inset behind, mullions on classic/cottage
  const winSize = 0.9
  const frameT = 0.08
  const inset = 0.12
  const perFloor = Math.max(1, Math.floor(width / 2.5))
  for (let f = 0; f < floors; f++) {
    const y = f * floorHeight + floorHeight / 2
    for (let w = 0; w < perFloor; w++) {
      const x = -width / 2 + (w + 1) * (width / (perFloor + 1))
      addWindow(geos, x, y, depth / 2, +1, winSize, frameT, inset, winRgb, frameRgb, style)
      addWindow(geos, x, y, -depth / 2, -1, winSize, frameT, inset, winRgb, frameRgb, style)
    }
    // Side windows
    if (depth >= 4) {
      const sx = Math.max(1, Math.floor(depth / 2.5))
      for (let s = 0; s < sx; s++) {
        const z = -depth / 2 + (s + 1) * (depth / (sx + 1))
        addSideWindow(geos, width / 2, z, y, +1, winSize, frameT, inset, winRgb, frameRgb)
        addSideWindow(geos, -width / 2, z, y, -1, winSize, frameT, inset, winRgb, frameRgb)
      }
    }
  }

  // 4. Recessed door with frame + knob + step
  const doorH = Math.min(floorHeight * 0.75, 2.1)
  const doorW = 1.0
  const doorFrame = new THREE.BoxGeometry(doorW + 0.16, doorH + 0.08, 0.04)
  doorFrame.translate(0, doorH / 2, depth / 2 + 0.02)
  geos.push(paintGeometry(doorFrame, frameRgb))
  const door = new THREE.BoxGeometry(doorW, doorH, 0.05)
  door.translate(0, doorH / 2, depth / 2 - 0.08)
  geos.push(paintGeometry(door, doorRgb))
  const knob = new THREE.SphereGeometry(0.05, 8, 6)
  knob.translate(doorW / 2 - 0.15, doorH / 2, depth / 2 - 0.06)
  geos.push(paintGeometry(knob, knobRgb))
  const step = new THREE.BoxGeometry(doorW + 0.4, 0.1, 0.4)
  step.translate(0, 0.05, depth / 2 + 0.2)
  geos.push(paintGeometry(step, stepRgb))

  // 5. Roof per style — user's roofColor always wins; otherwise style default
  let roofRgb = hexToRgb(roofColor)
  if (style === 'modern') {
    // Flat roof + parapet + thin slab (dark concrete)
    const slab = new THREE.BoxGeometry(width + 0.4, 0.15, depth + 0.4)
    slab.translate(0, totalH + 0.05, 0)
    geos.push(paintGeometry(slab, roofRgb))
    addParapet(geos, width, depth, totalH, wallRgb, wallT)
  } else if (style === 'classic') {
    // Gabled red-tile roof + chimney
    addGabledRoof(geos, width, depth, totalH, roofRgb, wallT)
    addChimney(geos, totalH, width, depth, Math.min(width, depth) * 0.45, chimneyRgb, capRgb)
  } else {
    // cottage: steep pitched roof + chimney
    addGabledRoof(geos, width, depth, totalH, roofRgb, wallT, 0.55, 0.4)
    addChimney(geos, totalH, width, depth, Math.min(width, depth) * 0.55, chimneyRgb, capRgb)
  }

  const merged = mergeGeometriesWithColors(geos)
  merged.computeVertexNormals()

  return makeObject({
    idPrefix: 'house',
    name: `Casa ${style} ${floors}p`,
    geometry: merged,
    material: {
      color: wallColor,
      roughness: 0.7,
      metalness: 0.0,
    },
  })
}

function addWindow(geos, x, y, wallZ, dir, size, frameT, inset, winRgb, frameRgb, style) {
  const sign = Math.sign(dir) || 1
  // Frame flush with wall surface
  const frame = new THREE.BoxGeometry(size + frameT * 2, size + frameT * 2, 0.04)
  frame.translate(x, y, wallZ + sign * 0.02)
  geos.push(paintGeometry(frame, frameRgb))
  // Glass inset behind frame (recessed)
  const glass = new THREE.BoxGeometry(size, size, 0.03)
  glass.translate(x, y, wallZ - sign * inset)
  geos.push(paintGeometry(glass, winRgb))
  // Sill under window
  const sill = new THREE.BoxGeometry(size + 0.1, 0.06, 0.08)
  sill.translate(x, y - size / 2 - 0.03, wallZ + sign * 0.04)
  geos.push(paintGeometry(sill, frameRgb))
  // Mullions on classic/cottage
  if (style !== 'modern') {
    const mullV = new THREE.BoxGeometry(0.04, size, 0.02)
    mullV.translate(x, y, wallZ - sign * (inset - 0.01))
    geos.push(paintGeometry(mullV, frameRgb))
    const mullH = new THREE.BoxGeometry(size, 0.04, 0.02)
    mullH.translate(x, y, wallZ - sign * (inset - 0.01))
    geos.push(paintGeometry(mullH, frameRgb))
  }
}

function addSideWindow(geos, wallX, z, y, dir, size, frameT, inset, winRgb, frameRgb) {
  const sign = Math.sign(dir) || 1
  const frame = new THREE.BoxGeometry(0.04, size + frameT * 2, size + frameT * 2)
  frame.translate(wallX + sign * 0.02, y, z)
  geos.push(paintGeometry(frame, frameRgb))
  const glass = new THREE.BoxGeometry(0.03, size, size)
  glass.translate(wallX - sign * inset, y, z)
  geos.push(paintGeometry(glass, winRgb))
}

function addParapet(geos, width, depth, totalH, color, wallT) {
  const pF = new THREE.BoxGeometry(width + 0.3, 0.4, wallT)
  pF.translate(0, totalH + 0.2, depth / 2 + 0.1)
  geos.push(paintGeometry(pF, color))
  const pB = pF.clone(); pB.translate(0, 0, -depth - 0.2)
  geos.push(paintGeometry(pB, color))
  const pL = new THREE.BoxGeometry(wallT, 0.4, depth + 0.2)
  pL.translate(-width / 2 - 0.1, totalH + 0.2, 0)
  geos.push(paintGeometry(pL, color))
  const pR = pL.clone(); pR.translate(width + 0.2, 0, 0)
  geos.push(paintGeometry(pR, color))
}

function addGabledRoof(geos, width, depth, totalH, color, wallT, hFactor = 0.45, overhang = 0.3) {
  const roofH = Math.min(width, depth) * hFactor
  const shape = new THREE.Shape()
  shape.moveTo(-depth / 2 - overhang, 0)
  shape.lineTo(depth / 2 + overhang, 0)
  shape.lineTo(0, roofH)
  shape.closePath()
  const roofGeo = new THREE.ExtrudeGeometry(shape, {
    depth: width + overhang * 2, bevelEnabled: false,
  })
  roofGeo.rotateY(Math.PI / 2)
  roofGeo.translate(-width / 2 - overhang, totalH, 0)
  geos.push(paintGeometry(roofGeo, color))
}

function addChimney(geos, totalH, width, depth, roofH, brick, cap) {
  const chimH = 1.0
  const cx = width / 4
  const cy = totalH + roofH * 0.45 + chimH / 2
  const chim = new THREE.BoxGeometry(0.5, chimH, 0.4)
  chim.translate(cx, cy, 0)
  geos.push(paintGeometry(chim, brick))
  const capBox = new THREE.BoxGeometry(0.55, 0.1, 0.45)
  capBox.translate(cx, cy + chimH / 2 + 0.05, 0)
  geos.push(paintGeometry(capBox, cap))
}

export const generate = generateHouse
export default { generate, generateHouse }

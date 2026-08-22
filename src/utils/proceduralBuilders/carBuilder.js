/**
 * carBuilder.js — realistic procedural vehicles.
 *
 * Types: sedan | suv | sports | truck
 *   - lower body chassis + cabin (sports uses long hood + rear deck + splitter + spoiler)
 *   - truck has cab-forward + open bed at rear
 *   - 4 wheels (rubber tire + chrome rim)
 *   - sloped windshield + rear glass + side windows
 *   - front bumper, rear bumper (dark plastic)
 *   - emissive-style headlight (white) + taillight (red) boxes
 *
 * Single merged mesh with vertex colors; body PBR drives the material
 * (clearcoat 1.0, metalness 0.8, roughness 0.15 → car paint look).
 */
import * as THREE from 'three'
import {
  hexToRgb, paintGeometry, mergeGeometriesWithColors, makeObject,
} from './_helpers'

export function generateCar(params = {}) {
  const {
    type = 'sedan',   // sedan | suv | sports | truck
    color = '#c0392b',
    wheelSize = 0.4,
  } = params

  const geos = []
  const bodyRgb = hexToRgb(color)
  const glassRgb = [0.10, 0.15, 0.20]
  const tireRgb = [0.04, 0.04, 0.04]
  const rimRgb = [0.78, 0.78, 0.82]
  const bumperRgb = [0.10, 0.10, 0.12]
  const headRgb = [1.0, 0.95, 0.75]
  const tailRgb = [0.85, 0.10, 0.10]
  const bedFloorRgb = [0.18, 0.18, 0.20]

  let bodyLen, bodyW, bodyH, cabLen, cabH, cabOffsetX, bedLen = 0
  if (type === 'sedan') {
    bodyLen = 4.5; bodyW = 1.8; bodyH = 0.65; cabLen = 2.0; cabH = 0.6; cabOffsetX = -0.2
  } else if (type === 'suv') {
    bodyLen = 4.8; bodyW = 1.9; bodyH = 0.85; cabLen = 2.6; cabH = 0.85; cabOffsetX = -0.1
  } else if (type === 'sports') {
    bodyLen = 4.4; bodyW = 1.95; bodyH = 0.45; cabLen = 1.4; cabH = 0.5; cabOffsetX = -0.05
  } else { // truck
    bodyLen = 5.8; bodyW = 2.1; bodyH = 0.75; cabLen = 2.0; cabH = 0.85; cabOffsetX = 1.4; bedLen = 2.0
  }

  // Lower chassis
  const lower = new THREE.BoxGeometry(bodyLen, bodyH * 0.6, bodyW)
  lower.translate(0, wheelSize + bodyH * 0.3, 0)
  geos.push(paintGeometry(lower, bodyRgb))

  // Cabin / superstructure
  if (type === 'sports') {
    addSportsBody(geos, bodyLen, bodyW, bodyH, wheelSize, bodyRgb, bumperRgb)
    cabLen = 1.4; cabOffsetX = -0.05; cabH = 0.5
  } else if (type === 'truck') {
    // Cab
    const cab = new THREE.BoxGeometry(cabLen, cabH, bodyW - 0.2)
    cab.translate(cabOffsetX, wheelSize + bodyH + cabH / 2, 0)
    geos.push(paintGeometry(cab, bodyRgb))
    addTruckBed(geos, bodyLen, bodyW, bodyH, wheelSize, bedLen, bodyRgb, bedFloorRgb)
  } else {
    // sedan / suv cabin
    const cab = new THREE.BoxGeometry(cabLen, cabH, bodyW - 0.2)
    cab.translate(cabOffsetX, wheelSize + bodyH + cabH / 2, 0)
    geos.push(paintGeometry(cab, bodyRgb))
  }

  // Glass: windshield (sloped), rear window (sloped), side windows
  const wsAngle = type === 'sports' ? 0.55 : 0.35
  const glassY = wheelSize + bodyH + cabH * 0.5
  const windshield = new THREE.BoxGeometry(0.06, cabH * 0.8, bodyW - 0.3)
  windshield.rotateZ(-wsAngle)
  windshield.translate(cabOffsetX + cabLen / 2 - 0.1, glassY, 0)
  geos.push(paintGeometry(windshield, glassRgb))
  const rearWin = new THREE.BoxGeometry(0.06, cabH * 0.7, bodyW - 0.3)
  rearWin.rotateZ(wsAngle)
  rearWin.translate(cabOffsetX - cabLen / 2 + 0.1, glassY, 0)
  geos.push(paintGeometry(rearWin, glassRgb))
  const sideL = new THREE.BoxGeometry(cabLen * 0.8, cabH * 0.45, 0.05)
  sideL.translate(cabOffsetX, wheelSize + bodyH + cabH * 0.55, bodyW / 2 - 0.05)
  geos.push(paintGeometry(sideL, glassRgb))
  const sideR = sideL.clone(); sideR.translate(0, 0, -bodyW + 0.1)
  geos.push(paintGeometry(sideR, glassRgb))

  // Wheels (tire + rim)
  const wRadius = type === 'sports' ? Math.max(wheelSize, 0.42) : wheelSize
  const wWidth = 0.35
  const wFront = bodyLen / 2 - 0.7
  const wRear = -(bodyLen / 2 - 0.7)
  const wheelPos = [
    [wFront, wRadius, bodyW / 2 - 0.05],
    [wFront, wRadius, -(bodyW / 2 - 0.05)],
    [wRear, wRadius, bodyW / 2 - 0.05],
    [wRear, wRadius, -(bodyW / 2 - 0.05)],
  ]
  for (const p of wheelPos) {
    const tire = new THREE.CylinderGeometry(wRadius, wRadius, wWidth, 24)
    tire.rotateZ(Math.PI / 2)
    tire.translate(p[0], p[1], p[2])
    geos.push(paintGeometry(tire, tireRgb))
    const rim = new THREE.CylinderGeometry(wRadius * 0.55, wRadius * 0.55, wWidth * 1.05, 12)
    rim.rotateZ(Math.PI / 2)
    rim.translate(p[0], p[1], p[2])
    geos.push(paintGeometry(rim, rimRgb))
    // Hub center (chrome)
    const hub = new THREE.CylinderGeometry(wRadius * 0.15, wRadius * 0.15, wWidth * 1.1, 8)
    hub.rotateZ(Math.PI / 2)
    hub.translate(p[0], p[1], p[2])
    geos.push(paintGeometry(hub, rimRgb))
  }

  // Bumpers (front + rear)
  const fB = new THREE.BoxGeometry(0.18, 0.32, bodyW)
  fB.translate(bodyLen / 2 + 0.05, wheelSize + bodyH * 0.4, 0)
  geos.push(paintGeometry(fB, bumperRgb))
  const rB = new THREE.BoxGeometry(0.18, 0.32, bodyW)
  rB.translate(-bodyLen / 2 - 0.05, wheelSize + bodyH * 0.4, 0)
  geos.push(paintGeometry(rB, bumperRgb))

  // Headlights (emissive-style)
  const hl1 = new THREE.BoxGeometry(0.08, 0.14, 0.35)
  hl1.translate(bodyLen / 2 - 0.05, wheelSize + bodyH * 0.7, bodyW * 0.3)
  geos.push(paintGeometry(hl1, headRgb))
  const hl2 = hl1.clone(); hl2.translate(0, 0, -bodyW * 0.6)
  geos.push(paintGeometry(hl2, headRgb))

  // Tail lights (red emissive-style)
  const tl1 = new THREE.BoxGeometry(0.08, 0.16, 0.35)
  tl1.translate(-bodyLen / 2 + 0.05, wheelSize + bodyH * 0.7, bodyW * 0.3)
  geos.push(paintGeometry(tl1, tailRgb))
  const tl2 = tl1.clone(); tl2.translate(0, 0, -bodyW * 0.6)
  geos.push(paintGeometry(tl2, tailRgb))

  // Side mirrors
  const mirrorL = new THREE.BoxGeometry(0.08, 0.08, 0.15)
  mirrorL.translate(cabOffsetX + cabLen / 2 - 0.15, wheelSize + bodyH + cabH * 0.6, bodyW / 2 + 0.04)
  geos.push(paintGeometry(mirrorL, bodyRgb))
  const mirrorR = mirrorL.clone(); mirrorR.translate(0, 0, -bodyW - 0.08)
  geos.push(paintGeometry(mirrorR, bodyRgb))

  const merged = mergeGeometriesWithColors(geos)
  merged.computeVertexNormals()

  return makeObject({
    idPrefix: 'car',
    name: `Carro ${type}`,
    geometry: merged,
    material: {
      color,
      roughness: 0.15,
      metalness: 0.8,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      emissive: '#000000',
      emissiveIntensity: 0,
    },
  })
}

function addSportsBody(geos, bodyLen, bodyW, bodyH, wheelSize, bodyRgb, bumperRgb) {
  // Long hood
  const hood = new THREE.BoxGeometry(bodyLen * 0.45, bodyH * 0.4, bodyW * 0.95)
  hood.translate(bodyLen * 0.2, wheelSize + bodyH * 0.55, 0)
  geos.push(paintGeometry(hood, bodyRgb))
  // Rear engine deck
  const rearDeck = new THREE.BoxGeometry(bodyLen * 0.3, bodyH * 0.6, bodyW * 0.9)
  rearDeck.translate(-bodyLen * 0.3, wheelSize + bodyH * 0.75, 0)
  geos.push(paintGeometry(rearDeck, bodyRgb))
  // Front splitter
  const splitter = new THREE.BoxGeometry(bodyLen * 0.3, 0.06, bodyW * 1.02)
  splitter.translate(bodyLen / 2 - 0.3, wheelSize + 0.03, 0)
  geos.push(paintGeometry(splitter, bumperRgb))
  // Rear diffuser
  const diffuser = new THREE.BoxGeometry(bodyLen * 0.15, 0.12, bodyW * 0.95)
  diffuser.translate(-bodyLen / 2 + 0.1, wheelSize + 0.06, 0)
  geos.push(paintGeometry(diffuser, bumperRgb))
  // Spoiler wing + stands
  const wing = new THREE.BoxGeometry(0.45, 0.04, bodyW * 0.9)
  wing.translate(-bodyLen / 2 + 0.35, wheelSize + bodyH + 0.2, 0)
  geos.push(paintGeometry(wing, bumperRgb))
  const stand1 = new THREE.BoxGeometry(0.06, 0.2, 0.06)
  stand1.translate(-bodyLen / 2 + 0.35, wheelSize + bodyH + 0.1, bodyW * 0.3)
  geos.push(paintGeometry(stand1, bumperRgb))
  const stand2 = stand1.clone(); stand2.translate(0, 0, -bodyW * 0.6)
  geos.push(paintGeometry(stand2, bumperRgb))
}

function addTruckBed(geos, bodyLen, bodyW, bodyH, wheelSize, bedLen, bodyRgb, bedFloorRgb) {
  const bx = -bodyLen / 2 + bedLen / 2 + 0.1
  // Bed floor
  const floor = new THREE.BoxGeometry(bedLen, 0.1, bodyW - 0.2)
  floor.translate(bx, wheelSize + bodyH + 0.05, 0)
  geos.push(paintGeometry(floor, bedFloorRgb))
  // Bed walls (left, right, back; front is cab back)
  const wallL = new THREE.BoxGeometry(bedLen, 0.5, 0.08)
  wallL.translate(bx, wheelSize + bodyH + 0.3, bodyW / 2 - 0.04)
  geos.push(paintGeometry(wallL, bodyRgb))
  const wallR = wallL.clone(); wallR.translate(0, 0, -bodyW + 0.08)
  geos.push(paintGeometry(wallR, bodyRgb))
  const wallBack = new THREE.BoxGeometry(0.08, 0.5, bodyW - 0.2)
  wallBack.translate(-bodyLen / 2 + 0.05, wheelSize + bodyH + 0.3, 0)
  geos.push(paintGeometry(wallBack, bodyRgb))
}

export const generate = generateCar
export default { generate, generateCar }

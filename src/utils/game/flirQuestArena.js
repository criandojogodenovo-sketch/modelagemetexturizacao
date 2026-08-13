/**
 * FlirQuest Arena — jogo completo de demonstração profissional.
 *
 * Gera um projeto .flirengine pronto a abrir na Flir Engine.
 *
 * Cenário: arena FPS 3D com:
 *  - Terreno procedural (Simplex+Ridged+Warping)
 *  - Jogador (PersonalObject) com ViewObject FPS (followMode='first')
 *  - Câmara Touch Zone para rodar a câmara (rato/setas em desktop)
 *  - Arma (WeaponObject) com shoot/reload
 *  - 3 inimigos (NpcObject) com IA simples (perseguir jogador, tomar dano)
 *  - 5 itens coleccionáveis (ItemObject) para recolher
 *  - 2 checkpoints (CheckpointObject)
 *  - SkyObject procedural (Rayleigh+Mie)
 *  - LuminousObject (sol) + AmbientObject
 *  - HUD com botões de tiro, reload, vida, munição
 *  - FlirCode em NPCs: perseguir jogador, atacar quando próximo
 *  - FlirCode no jogador: actualizar HUD com vida/munição
 */
import * as THREE from 'three'
import { generateTerrainHeightmap } from '../terrain/terrainNoise.js'

// Gerar heightmap procedural (64x64) com Simplex+Ridged+Warping
const SEG = 64
const heightmap = generateTerrainHeightmap(SEG, {
  seed: 4242,
  scale: 30,
  octaves: 5,
  persistence: 0.55,
  lacunarity: 2.1,
  ridgedAmount: 0.5,
  warpStrength: 1.5,
  terracing: false,
  erosion: false,
})

// Splatmap automático por altura (relva/terra/pedra/neve)
function autoSplat(hm, seg, maxLayers = 4) {
  const sm = new Float32Array((seg + 1) * (seg + 1) * maxLayers)
  for (let i = 0; i < hm.length; i++) {
    const h = (hm[i] + 1) * 0.5 // [0,1]
    if (h < 0.3) { sm[i * 4] = 1; sm[i * 4 + 1] = 0; sm[i * 4 + 2] = 0; sm[i * 4 + 3] = 0 }
    else if (h < 0.55) { sm[i * 4] = 0.3; sm[i * 4 + 1] = 0.7; sm[i * 4 + 2] = 0; sm[i * 4 + 3] = 0 }
    else if (h < 0.8) { sm[i * 4] = 0; sm[i * 4 + 1] = 0.4; sm[i * 4 + 2] = 0.6; sm[i * 4 + 3] = 0 }
    else { sm[i * 4] = 0; sm[i * 4 + 1] = 0; sm[i * 4 + 2] = 0.4; sm[i * 4 + 3] = 0.6 }
  }
  return sm
}
const splatmap = autoSplat(heightmap, SEG, 4)

// Helper: gerar ID único
let _idCounter = 1
const uid = () => `obj_${Date.now()}_${_idCounter++}`

// Helper: amostrar altura do heightmap numa posição (x,z) do mundo
// Garante que o jogador faz spawn ACIMA do terreno (não dentro dele)
function sampleTerrainHeight(hm, seg, worldX, worldZ, terrainWidth, terrainDepth, heightScale) {
  // Converter coords mundo → índices do heightmap
  // Terreno é centrado na origem, vai de -width/2 a +width/2
  const nx = (worldX / terrainWidth + 0.5) * seg
  const nz = (worldZ / terrainDepth + 0.5) * seg
  const ix = Math.max(0, Math.min(seg, Math.round(nx)))
  const iz = Math.max(0, Math.min(seg, Math.round(nz)))
  const idx = iz * (seg + 1) + ix
  const h = hm[idx] || 0  // valor em [-1, 1]
  return h * heightScale  // altura em mundo
}

// ===== Catálogo de objetos (modelos 3D do jogo) =====
const objects = [
  {
    id: 'obj_player_marker',
    type: 'capsule',
    name: 'PlayerMarker',
    position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    args: { radius: 0.4, length: 1.2, capSegments: 8, radialSegments: 16 },
    material: { color: '#3fb950', roughness: 0.5, metalness: 0.1 },
    visible: true,
  },
  {
    id: 'obj_enemy',
    type: 'capsule',
    name: 'EnemyMarker',
    position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    args: { radius: 0.4, length: 1.2, capSegments: 8, radialSegments: 16 },
    material: { color: '#dc2626', roughness: 0.5, metalness: 0.1, emissive: '#7f1d1d' },
    visible: true,
  },
  {
    id: 'obj_wall',
    type: 'box',
    name: 'Wall',
    position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    args: { width: 1, height: 1, depth: 1 },
    material: { color: '#475569', roughness: 0.9, metalness: 0.0 },
    visible: true,
  },
  {
    id: 'obj_pillar',
    type: 'cylinder',
    name: 'Pillar',
    position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    args: { radiusTop: 0.5, radiusBottom: 0.5, height: 4, radialSegments: 12 },
    material: { color: '#64748b', roughness: 0.7, metalness: 0.2 },
    visible: true,
  },
]

// ===== Conects da cena =====
const conects = []

// Sky procedural
conects.push({
  instanceId: uid(),
  type: 'SkyObject',
  name: 'Sky',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  skyType: 'procedural',
  topColor: '#1e3a8a',
  bottomColor: '#fbbf24',
  solidColor: '#87ceeb',
  sunPosition: [10, 20, 5],
  sunIntensity: 1.2,
  turbidity: 8,
  rayleigh: 2,
})

// Sun light (direcional)
conects.push({
  instanceId: uid(),
  type: 'SunObject',
  name: 'Sol',
  position: [10, 20, 5], rotation: [0, 0, 0], scale: [1, 1, 1],
  color: '#fff7d6',
  intensity: 1.4,
  castShadows: true,
})

// Ambient light
conects.push({
  instanceId: uid(),
  type: 'AmbientObject',
  name: 'Ambiente',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  color: '#a0c4ff',
  intensity: 0.4,
})

// Terrain
conects.push({
  instanceId: uid(),
  type: 'TerrainObject',
  name: 'Terreno',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  width: 60, depth: 60, segments: SEG,
  heightScale: 6,
  heightmap: Array.from(heightmap),
  splatmap: Array.from(splatmap),
  textureLayers: [
    { id: 'grass', label: 'Relva', color: '#5a7d3a' },
    { id: 'dirt', label: 'Terra', color: '#8b5a2b' },
    { id: 'rock', label: 'Pedra', color: '#6e7681' },
    { id: 'snow', label: 'Neve', color: '#f0f0f0' },
  ],
  maxLayers: 4,
})

// 4 Pilares decorativos (cover para o jogador)
const pillarPositions = [[8, 0, 8], [-8, 0, -8], [8, 0, -8], [-8, 0, 8]]
for (let i = 0; i < pillarPositions.length; i++) {
  conects.push({
    instanceId: uid(),
    type: 'StaticObject',
    name: `Pilar_${i + 1}`,
    sourceObjectId: 'obj_pillar',
    position: [pillarPositions[i][0], 2, pillarPositions[i][2]],
    rotation: [0, 0, 0], scale: [1, 1, 1],
    physicsType: 'box',
    width: 1, height: 4, depth: 1,
  })
}

// 4 Muros (arena boundary)
const wallSpecs = [
  { pos: [0, 1.5, 15], rot: [0, 0, 0], scale: [30, 3, 0.5] },
  { pos: [0, 1.5, -15], rot: [0, 0, 0], scale: [30, 3, 0.5] },
  { pos: [15, 1.5, 0], rot: [0, 0, 0], scale: [0.5, 3, 30] },
  { pos: [-15, 1.5, 0], rot: [0, 0, 0], scale: [0.5, 3, 30] },
]
for (let i = 0; i < wallSpecs.length; i++) {
  conects.push({
    instanceId: uid(),
    type: 'StaticObject',
    name: `Muro_${i + 1}`,
    sourceObjectId: 'obj_wall',
    position: wallSpecs[i].pos,
    rotation: wallSpecs[i].rot,
    scale: wallSpecs[i].scale,
    physicsType: 'box',
    width: wallSpecs[i].scale[0], height: wallSpecs[i].scale[1], depth: wallSpecs[i].scale[2],
  })
}

// Jogador (PersonalObject) — no centro, posicionado ACIMA do terreno
const playerId = uid()
const playerY = sampleTerrainHeight(heightmap, SEG, 0, 0, 60, 60, 5) + 2  // +2m acima do terreno
conects.push({
  instanceId: playerId,
  type: 'PersonalObject',
  name: 'Jogador',
  position: [0, playerY, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  // CRITICAL: mass > 0 required or cannon-es makes the body STATIC (immovable).
  // moveSpeed is the property name expected by GameMode (taxonomy standard).
  // fixedRotation prevents the capsule from tipping over.
  mass: 1,
  moveSpeed: 5,
  jumpForce: 8,
  canJump: true,
  fixedRotation: true,
  health: 100,
  maxHealth: 100,
  isPlayer: true,
  // FlirCode para actualizar HUD
  flirCode: `
begincode update
  set_var _vida getHealth player
  set_var _muni getAmmo
  setUIValue vida "VIDA: " + _vida
  setUIValue muni "MUNI: " + _muni
  if _vida < 30
    setUIValue aviso "CUIDADO!"
  else
    setUIValue aviso ""
  endif
endcode
`,
})

// ViewObject FPS — segue jogador em first-person
conects.push({
  instanceId: uid(),
  type: 'ViewObject',
  name: 'CamFPS',
  position: [0, 3, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  cameraType: 'perspective',
  fov: 75,
  near: 0.05,
  far: 200,
  followTarget: playerId,
  followMode: 'first',
  followDistance: 0,
  followHeight: 0,
  eyeHeight: 1.6,
  isActive: true,
  cameraRole: 'player',
})

// CameraTouchZone — zona de toque para rodar câmara (metade direita do ecrã)
conects.push({
  instanceId: uid(),
  type: 'CameraTouchZone',
  name: 'TouchZone',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  zone: { x: 50, y: 0, w: 50, h: 100 },
  sensitivity: 1.5,
  invertY: false,
  minPitch: -1.4,
  maxPitch: 1.4,
})

// JoystickObject — joystick virtual no canto inferior esquerdo (controlo de movimento em mobile)
conects.push({
  instanceId: uid(),
  type: 'JoystickObject',
  name: 'Joystick',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  side: 'left',
  size: 130,
  color: '#2f81f7',
  deadzone: 0.15,
  targetPersonal: playerId,
})

// WeaponObject — pistola do jogador
conects.push({
  instanceId: uid(),
  type: 'WeaponObject',
  name: 'Pistola',
  position: [0.3, 1.6, -0.5], rotation: [0, 0, 0], scale: [0.6, 0.6, 0.6],
  damage: 34,
  range: 80,
  maxAmmo: 12,
  fireRate: 0.3,
  automatic: false,
})

// 3 Inimigos (NpcObject) com IA simples
const enemyPositions = [[10, 2, 10], [-10, 2, -10], [12, 2, -8]]
const enemyIds = []
for (let i = 0; i < enemyPositions.length; i++) {
  const eid = uid()
  enemyIds.push(eid)
  conects.push({
    instanceId: eid,
    type: 'NpcObject',
    name: `Inimigo_${i + 1}`,
    sourceObjectId: 'obj_enemy',
    position: [enemyPositions[i][0], enemyPositions[i][1], enemyPositions[i][2]],
    rotation: [0, 0, 0], scale: [1, 1, 1],
    // CRITICAL: mass > 0 required for cannon-es DYNAMIC body (else NPC can't move).
    mass: 1,
    moveSpeed: 3,
    fixedRotation: true,
    health: 100,
    maxHealth: 100,
    damage: 10,
    aiMode: 'chase',
    physicsType: 'box',
    width: 0.8, height: 1.8, depth: 0.8,
    // FlirCode: perseguir jogador e atacar
    flirCode: `
begincode update
  set_var _dist distanceTo player
  if _dist < 15
    move_towards player 3
    if _dist < 2
      if get_var _cooldown > 0
      else
        set_var _cooldown 1
        takeDamage player 10
      endif
    endif
  endif
  set_var _cooldown get_var _cooldown - 0.016
endcode

begincode onHit
  set_var _vida getHealth self
  if _vida <= 0
    hide self
    setUIValue aviso "INIMIGO ELIMINADO!"
  endif
endcode
`,
  })
}

// 5 Itens coleccionáveis (gemas)
const itemPositions = [
  [5, 1, 5], [-5, 1, -5], [8, 1, -3], [-8, 1, 3], [0, 1, 10],
]
const itemIds = []
for (let i = 0; i < itemPositions.length; i++) {
  const iid = uid()
  itemIds.push(iid)
  conects.push({
    instanceId: iid,
    type: 'ItemObject',
    name: `Gema_${i + 1}`,
    position: [itemPositions[i][0], itemPositions[i][1], itemPositions[i][2]],
    rotation: [0, 0, 0], scale: [1, 1, 1],
    color: ['#fbbf24', '#a855f7', '#3b82f6', '#10b981', '#ef4444'][i],
    collectible: true,
    value: 10,
    flirCode: `
begincode update
  set_var _dist distanceTo player
  if _dist < 1.5
    hide self
    setUIValue aviso "GEMA RECOLHIDA!"
  endif
endcode
`,
  })
}

// Checkpoint inicial
conects.push({
  instanceId: uid(),
  type: 'CheckpointObject',
  name: 'Checkpoint1',
  position: [0, 0, 5], rotation: [0, 0, 0], scale: [1, 1, 1],
  triggerRadius: 2,
})

// ===== UI Screen (HUD) =====
const uiScreens = [{
  id: uid(),
  name: 'HUD',
  visible: true,
  elements: [
    { id: uid(), type: 'Text', name: 'vida', label: 'VIDA: 100', position: [3, 5], size: [150, 30], color: '#22c55e', textColor: '#ffffff', fontSize: 18 },
    { id: uid(), type: 'Text', name: 'muni', label: 'MUNI: 12', position: [3, 10], size: [150, 30], color: '#fbbf24', textColor: '#ffffff', fontSize: 18 },
    { id: uid(), type: 'Text', name: 'aviso', label: '', position: [50, 15], size: [300, 30], color: 'transparent', textColor: '#ef4444', fontSize: 22 },
    { id: uid(), type: 'Button', name: 'btn_tiro', label: 'TIRO', position: [85, 88], size: [80, 60], color: '#dc2626', textColor: '#ffffff', fontSize: 16, eventName: 'onShoot' },
    { id: uid(), type: 'Button', name: 'btn_reload', label: 'RELOAD', position: [70, 88], size: [80, 60], color: '#3b82f6', textColor: '#ffffff', fontSize: 14, eventName: 'onReload' },
    { id: uid(), type: 'Button', name: 'btn_pular', label: 'PULAR', position: [15, 88], size: [80, 60], color: '#10b981', textColor: '#ffffff', fontSize: 14, eventName: 'onJump' },
  ],
}]

// ===== Cena =====
const scenes = [{
  id: uid(),
  name: 'Arena FPS',
  objects: [],
  conects,
  gameCamera: {
    cameraType: 'perspective',
    position: [0, 5, 10],
    rotation: [0, 0, 0],
    fov: 75,
    near: 0.05,
    far: 200,
  },
  physics: { gravity: [0, -9.82, 0] },
  playerObjectId: playerId,
}]

// ===== Projeto completo =====
const project = {
  version: 4,
  projectName: 'FlirQuest Arena — FPS 3D Demo',
  appMode: 'scene',
  objects,
  scenes,
  activeSceneId: scenes[0].id,
  background: { type: 'gradient', gradientTop: '#1e3a8a', gradientBottom: '#fbbf24', color: '#0d1117' },
  grid: { visible: false, size: 30, divisions: 30, color: '#1f2937' },
  lights: {
    ambient: { intensity: 0.4, color: '#a0c4ff' },
    directional: { intensity: 1.4, color: '#fff7d6', position: [10, 20, 5] },
  },
  uiScreens,
  renderSettings: {
    qualityLevel: 'realista',
    flirGI: false,
    flirAdaptiveMesh: false,
    shadowOptimizations: true,
    shadowDistance: 30,
    shadowMapSize: 1024,
    vertexAO: true,
    pom: false,
    postProcessing: true,
    waterQuality: 'professional',
    pixelRatio: 1,
  },
}

// Serializar para JSON
const json = JSON.stringify(project)
console.log('FlirQuest Arena gerado:', json.length, 'bytes')
console.log('Conects:', conects.length, '| Objetos:', objects.length, '| Cenas:', scenes.length)

// Exportar
export { project as flirQuestArenaProject, json as flirQuestArenaJSON }

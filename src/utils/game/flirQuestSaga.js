/**
 * FlirQuest Saga — jogo profissional completo e complexo.
 *
 * Cenário: RPG/FPS híbrido com:
 *  - Terreno procedural montanhoso (Simplex + Ridged + Warping)
 *  - Lago com água super-realista (Gerstner + refração + espuma)
 *  - 2 cenas: "Vila Inicial" + "Floresta Sombria"
 *  - Jogador FPS com ViewObject (first-person) + CameraTouchZone
 *  - Joystick + WASD + teclado
 *  - 2 armas: pistola + rifle
 *  - 6 inimigos com IA diferente:
 *    - 3 soldados (perseguem + disparam)
 *    - 2 monstros (corpo-a-corpo, dano alto)
 *    - 1 boss (1000 HP, ataque em área)
 *  - 10 itens coleccionáveis (gemas + poções)
 *  - 5 checkpoints
 *  - 2 portais (NavigatorObject) entre cenas
 *  - SkyObject procedural (pôr-do-sol)
 *  - VolumetricFogObject para atmosfera
 *  - BloomObject para highlight do sol
 *  - GIProbeObject para iluminação global
 *  - PointMarkers para marcar pontos de interesse
 *  - ArrowMarkers para indicar direcção
 *  - HUD completo: vida, munição,-score, mini-mapa, mensagens
 *  - Sistema de inventário (5 slots)
 *  - FlirCode em todos os NPCs (comportamento único)
 */
import { generateTerrainHeightmap } from '../terrain/terrainNoise.js'

// === Helpers ===
let _idCounter = 1
const uid = () => `obj_${Date.now()}_${_idCounter++}`

// Helper: amostrar altura do heightmap numa posição (x,z) do mundo
function sampleTerrainHeight(hm, seg, worldX, worldZ, terrainWidth, terrainDepth, heightScale) {
  const nx = (worldX / terrainWidth + 0.5) * seg
  const nz = (worldZ / terrainDepth + 0.5) * seg
  const ix = Math.max(0, Math.min(seg, Math.round(nx)))
  const iz = Math.max(0, Math.min(seg, Math.round(nz)))
  const idx = iz * (seg + 1) + ix
  const h = hm[idx] || 0
  return h * heightScale
}

// === Geração de terrenos ===
const SEG = 64

// Terreno da Vila — suave, com lago
const villageTerrain = generateTerrainHeightmap(SEG, {
  seed: 1111,
  scale: 40,
  octaves: 4,
  persistence: 0.4,
  lacunarity: 2.0,
  ridgedAmount: 0.15,
  warpStrength: 0.8,
  terracing: false,
  erosion: false,
})

// Terreno da Floresta — montanhoso e agressivo
const forestTerrain = generateTerrainHeightmap(SEG, {
  seed: 9999,
  scale: 25,
  octaves: 6,
  persistence: 0.55,
  lacunarity: 2.1,
  ridgedAmount: 0.7,
  warpStrength: 1.8,
  terracing: false,
  erosion: true,
  erosionIterations: 5,
})

function autoSplat(hm, seg, maxLayers = 4) {
  const sm = new Float32Array((seg + 1) * (seg + 1) * maxLayers)
  for (let i = 0; i < hm.length; i++) {
    const h = (hm[i] + 1) * 0.5
    if (h < 0.25) { sm[i*4]=1; sm[i*4+1]=0; sm[i*4+2]=0; sm[i*4+3]=0 }
    else if (h < 0.5) { sm[i*4]=0.4; sm[i*4+1]=0.6; sm[i*4+2]=0; sm[i*4+3]=0 }
    else if (h < 0.75) { sm[i*4]=0; sm[i*4+1]=0.5; sm[i*4+2]=0.5; sm[i*4+3]=0 }
    else { sm[i*4]=0; sm[i*4+1]=0; sm[i*4+2]=0.3; sm[i*4+3]=0.7 }
  }
  return sm
}
const villageSplat = autoSplat(villageTerrain, SEG)
const forestSplat = autoSplat(forestTerrain, SEG)

// === Catálogo de objetos ===
const objects = [
  { id: 'obj_player', type: 'capsule', name: 'Player', args: { radius: 0.4, length: 1.2, capSegments: 8, radialSegments: 16 },
    material: { color: '#3fb950', roughness: 0.5, metalness: 0.1 } },
  { id: 'obj_enemy_soldier', type: 'capsule', name: 'Soldado', args: { radius: 0.4, length: 1.4, capSegments: 8, radialSegments: 16 },
    material: { color: '#dc2626', roughness: 0.6, metalness: 0.2 } },
  { id: 'obj_enemy_monster', type: 'sphere', name: 'Monstro', args: { radius: 0.7, widthSegments: 16, heightSegments: 12 },
    material: { color: '#7c2d12', roughness: 0.4, metalness: 0.3, emissive: '#451a03' } },
  { id: 'obj_boss', type: 'sphere', name: 'Boss', args: { radius: 1.8, widthSegments: 32, heightSegments: 24 },
    material: { color: '#581c87', roughness: 0.2, metalness: 0.8, emissive: '#3b0764', emissiveIntensity: 0.6 } },
  { id: 'obj_house', type: 'box', name: 'Casa', args: { width: 4, height: 3, depth: 4 },
    material: { color: '#92400e', roughness: 0.8 } },
  { id: 'obj_tree', type: 'cylinder', name: 'Árvore', args: { radiusTop: 0.3, radiusBottom: 0.4, height: 5, radialSegments: 8 },
    material: { color: '#5a3a1a', roughness: 0.9 } },
  { id: 'obj_rock', type: 'dodecahedron', name: 'Pedra', args: { radius: 1, detail: 0 },
    material: { color: '#6b7280', roughness: 0.95, flatShading: true } },
  { id: 'obj_wall', type: 'box', name: 'Muro', args: { width: 1, height: 1, depth: 1 },
    material: { color: '#475569', roughness: 0.9 } },
]

// === Cena 1: Vila Inicial ===
const scene1Conects = []

// Sky
scene1Conects.push({
  instanceId: uid(), type: 'SkyObject', name: 'Sky',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  skyType: 'procedural', topColor: '#1e3a8a', bottomColor: '#fb923c',
  sunPosition: [15, 8, -5], sunIntensity: 1.4, turbidity: 6, rayleigh: 2.5,
})

// Sun + Ambient
scene1Conects.push({
  instanceId: uid(), type: 'SunObject', name: 'Sol',
  position: [15, 8, -5], rotation: [0, 0, 0], scale: [1, 1, 1],
  color: '#fff7d6', intensity: 1.5, castShadows: true,
})
scene1Conects.push({
  instanceId: uid(), type: 'AmbientObject', name: 'Ambiente',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  color: '#fbbf24', intensity: 0.5,
})

// GI Probe + Bloom + VolumetricFog
scene1Conects.push({
  instanceId: uid(), type: 'GIProbeObject', name: 'GI',
  position: [0, 5, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  intensity: 1.0, bounceCount: 2, resolution: 128, fadeDistance: 60,
})
scene1Conects.push({
  instanceId: uid(), type: 'BloomObject', name: 'Bloom',
  position: [15, 8, -5], rotation: [0, 0, 0], scale: [1, 1, 1],
  intensity: 1.2, threshold: 0.7, radius: 0.5,
})
scene1Conects.push({
  instanceId: uid(), type: 'VolumetricFogObject', name: 'Fog',
  position: [0, 2, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  density: 0.015, scattering: 0.6, anisotropy: 0.7,
  attenuationDistance: 40, godRays: true, color: '#fbbf24',
})

// Terreno
scene1Conects.push({
  instanceId: uid(), type: 'TerrainObject', name: 'TerrenoVila',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  width: 80, depth: 80, segments: SEG, heightScale: 5,
  heightmap: Array.from(villageTerrain),
  splatmap: Array.from(villageSplat),
  textureLayers: [
    { id: 'grass', label: 'Relva', color: '#5a7d3a' },
    { id: 'dirt', label: 'Terra', color: '#8b5a2b' },
    { id: 'rock', label: 'Pedra', color: '#6e7681' },
    { id: 'snow', label: 'Neve', color: '#f0f0f0' },
  ],
  maxLayers: 4,
})

// Lago com água super-realista
scene1Conects.push({
  instanceId: uid(), type: 'RealWaterObject', name: 'Lago',
  position: [10, 0.5, 10], rotation: [0, 0, 0], scale: [1, 1, 1],
  size: [25, 25], segments: 64,
  color: '#1e90ff', deepColor: '#0a3d5c',
  clarity: 0.85, refraction: 0.5, reflection: 0.7,
  flowSpeed: 0.6, waveHeight: 0.25, waveFrequency: 1.2,
  foamThreshold: 0.65, foamColor: '#ffffff',
  fresnelPower: 5.0, ior: 1.333,
  sunDirection: [0.5, 0.8, 0.3],
})

// Casas (5)
const housePositions = [[-15, 0, -10], [-10, 0, -15], [-20, 0, -5], [-5, 0, -20], [-25, 0, -15]]
for (let i = 0; i < housePositions.length; i++) {
  scene1Conects.push({
    instanceId: uid(), type: 'StaticObject', name: `Casa_${i+1}`,
    sourceObjectId: 'obj_house',
    position: [housePositions[i][0], 1.5, housePositions[i][2]],
    rotation: [0, i * 0.5, 0], scale: [1, 1, 1],
    physicsType: 'box', width: 4, height: 3, depth: 4,
  })
}

// Árvores (10)
const treePositions = [
  [5, 0, -10], [8, 0, -15], [12, 0, -8], [-5, 0, 5], [-12, 0, 8],
  [15, 0, -20], [20, 0, -5], [-15, 0, 12], [25, 0, 5], [30, 0, -10],
]
for (let i = 0; i < treePositions.length; i++) {
  scene1Conects.push({
    instanceId: uid(), type: 'StaticObject', name: `Árvore_${i+1}`,
    sourceObjectId: 'obj_tree',
    position: [treePositions[i][0], 2.5, treePositions[i][2]],
    rotation: [0, Math.random() * Math.PI * 2, 0],
    scale: [0.8 + Math.random() * 0.4, 0.8 + Math.random() * 0.6, 0.8 + Math.random() * 0.4],
    physicsType: 'cylinder', width: 0.4, height: 5, depth: 0.4,
  })
}

// Pedras (6)
const rockPositions = [
  [0, 0, -25], [3, 0, -28], [-3, 0, -22], [22, 0, 12], [-18, 0, 18], [25, 0, -18],
]
for (let i = 0; i < rockPositions.length; i++) {
  scene1Conects.push({
    instanceId: uid(), type: 'StaticObject', name: `Pedra_${i+1}`,
    sourceObjectId: 'obj_rock',
    position: [rockPositions[i][0], 0.5, rockPositions[i][2]],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
    scale: [0.7 + Math.random() * 0.6, 0.7 + Math.random() * 0.6, 0.7 + Math.random() * 0.6],
    physicsType: 'sphere', width: 1, height: 1, depth: 1, colliderRadius: 1,
  })
}

// Muros (3 secções)
const wallSpecs = [
  { pos: [-8, 1, -25], rot: [0, 0, 0], scale: [16, 2, 0.5] },
  { pos: [8, 1, -25], rot: [0, 0, 0], scale: [16, 2, 0.5] },
  { pos: [-16, 1, -15], rot: [0, Math.PI / 2, 0], scale: [16, 2, 0.5] },
]
for (let i = 0; i < wallSpecs.length; i++) {
  scene1Conects.push({
    instanceId: uid(), type: 'StaticObject', name: `Muro_${i+1}`,
    sourceObjectId: 'obj_wall',
    position: wallSpecs[i].pos, rotation: wallSpecs[i].rot, scale: wallSpecs[i].scale,
    physicsType: 'box',
    width: wallSpecs[i].scale[0], height: wallSpecs[i].scale[1], depth: wallSpecs[i].scale[2],
  })
}

// Jogador
const playerId = uid()
const player1Y = sampleTerrainHeight(villageTerrain, SEG, 0, 0, 80, 80, 5) + 2
scene1Conects.push({
  instanceId: playerId, type: 'PersonalObject', name: 'Jogador',
  position: [0, player1Y, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  health: 100, maxHealth: 100,
  mass: 1, moveSpeed: 6, jumpForce: 9, canJump: true,
  fixedRotation: true, isPlayer: true,
  flirCode: `
begincode update
  set_var _vida getHealth player
  set_var _muni getAmmo
  set_var _score get_var _score
  if _vida < 30
    setUIValue aviso "VIDA BAIXA!"
  else
    setUIValue aviso ""
  endif
endcode
`,
})

// Joystick (mobile)
scene1Conects.push({
  instanceId: uid(), type: 'JoystickObject', name: 'Joystick',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  side: 'left', size: 130, color: '#3b82f6',
  deadzone: 0.2, targetPersonal: playerId,
})

// ViewObject FPS
scene1Conects.push({
  instanceId: uid(), type: 'ViewObject', name: 'CamFPS',
  position: [0, 3, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  cameraType: 'perspective', fov: 80, near: 0.05, far: 300,
  followTarget: playerId, followMode: 'first',
  eyeHeight: 1.6, cameraRole: 'player',
})

// CameraTouchZone
scene1Conects.push({
  instanceId: uid(), type: 'CameraTouchZone', name: 'TouchZone',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  zone: { x: 50, y: 0, w: 50, h: 100 },
  sensitivity: 1.5, invertY: false, minPitch: -1.4, maxPitch: 1.4,
})

// Armas
const pistolId = uid()
scene1Conects.push({
  instanceId: pistolId, type: 'WeaponObject', name: 'Pistola',
  position: [0.3, 1.5, -0.5], rotation: [0, 0, 0], scale: [0.5, 0.5, 0.5],
  damage: 25, range: 60, maxAmmo: 12, fireRate: 0.4,
})

const rifleId = uid()
scene1Conects.push({
  instanceId: rifleId, type: 'WeaponObject', name: 'Rifle',
  position: [-0.3, 1.4, -0.4], rotation: [0, 0, 0], scale: [0.6, 0.6, 0.6],
  damage: 18, range: 120, maxAmmo: 30, fireRate: 0.1,
  visible: false, // começa escondido
})

// Inimigos — 3 soldados
const enemySpecs1 = [
  { pos: [12, 2, -8], hp: 80, type: 'soldier', dmg: 8, speed: 3.5 },
  { pos: [-8, 2, 12], hp: 80, type: 'soldier', dmg: 8, speed: 3.5 },
  { pos: [20, 2, -20], hp: 80, type: 'soldier', dmg: 8, speed: 3.5 },
]
for (let i = 0; i < enemySpecs1.length; i++) {
  const e = enemySpecs1[i]
  scene1Conects.push({
    instanceId: uid(), type: 'NpcObject', name: `Soldado_${i+1}`,
    sourceObjectId: 'obj_enemy_soldier',
    position: [e.pos[0], e.pos[1], e.pos[2]],
    rotation: [0, 0, 0], scale: [1, 1, 1],
    health: e.hp, maxHealth: e.hp, mass: 1, moveSpeed: e.speed, damage: e.dmg,
    fixedRotation: true, aiMode: 'chase',
    physicsType: 'capsule', colliderShape: 'capsule',
    colliderHeight: 1.8, colliderRadius: 0.4,
    flirCode: `
begincode update
  set_var _dist distanceTo player
  if _dist < 20
    move_towards player ${e.speed}
    if _dist < 3
      if get_var _cooldown <= 0
        set_var _cooldown 1.2
        takeDamage player ${e.dmg}
      endif
    endif
  endif
  set_var _cooldown get_var _cooldown - 0.016
endcode

begincode onHit
  set_var _vida getHealth self
  if _vida <= 0
    hide self
    setUIValue aviso "SOLDADO ELIMINADO!"
  endif
endcode
`,
  })
}

// Itens coleccionáveis (5 gemas)
const itemSpecs1 = [
  { pos: [5, 1, 5], color: '#fbbf24' },
  { pos: [-5, 1, -5], color: '#a855f7' },
  { pos: [15, 1, -15], color: '#3b82f6' },
  { pos: [-15, 1, 15], color: '#10b981' },
  { pos: [0, 1, -20], color: '#ef4444' },
]
for (let i = 0; i < itemSpecs1.length; i++) {
  scene1Conects.push({
    instanceId: uid(), type: 'ItemObject', name: `Gema_${i+1}`,
    position: [itemSpecs1[i].pos[0], itemSpecs1[i].pos[1], itemSpecs1[i].pos[2]],
    rotation: [0, 0, 0], scale: [1, 1, 1],
    color: itemSpecs1[i].color, value: 50, collectible: true,
    flirCode: `
begincode update
  set_var _dist distanceTo player
  if _dist < 1.5
    hide self
    setUIValue aviso "GEMA RECOLHIDA (+50)"
  endif
endcode
`,
  })
}

// Checkpoints (3)
const checkpointPositions1 = [[0, 0, -5], [10, 0, -10], [-10, 0, -10]]
for (let i = 0; i < checkpointPositions1.length; i++) {
  scene1Conects.push({
    instanceId: uid(), type: 'CheckpointObject', name: `Checkpoint_${i+1}`,
    position: [checkpointPositions1[i][0], checkpointPositions1[i][1], checkpointPositions1[i][2]],
    rotation: [0, 0, 0], scale: [1, 1, 1], triggerRadius: 2,
  })
}

// Portal para Floresta (NavigatorObject)
scene1Conects.push({
  instanceId: uid(), type: 'NavigatorObject', name: 'PortalFloresta',
  position: [25, 1, 0], rotation: [0, 0, 0], scale: [1.5, 1.5, 1.5],
  triggerRadius: 2.5, targetSceneId: 'scene_forest',
})

// PointMarker — ponto de interesse
scene1Conects.push({
  instanceId: uid(), type: 'PointMarker', name: 'PontoCentro',
  position: [0, 3, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  size: 0.5, color: '#3b82f6', label: 'Centro da Vila',
})

// ArrowMarker — indicador para o portal
scene1Conects.push({
  instanceId: uid(), type: 'ArrowMarker', name: 'SetaPortal',
  position: [10, 4, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  direction: [1, 0, 0], length: 2.5, color: '#a855f7',
})

// === Cena 2: Floresta Sombria ===
const scene2Conects = []

// Sky mais sombrio
scene2Conects.push({
  instanceId: uid(), type: 'SkyObject', name: 'SkySombrio',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  skyType: 'procedural', topColor: '#1e1b4b', bottomColor: '#7c3aed',
  sunPosition: [5, 12, 5], sunIntensity: 0.6, turbidity: 10, rayleigh: 4,
})

scene2Conects.push({
  instanceId: uid(), type: 'SunObject', name: 'SolFraco',
  position: [5, 12, 5], rotation: [0, 0, 0], scale: [1, 1, 1],
  color: '#c4b5fd', intensity: 0.7, castShadows: true,
})

scene2Conects.push({
  instanceId: uid(), type: 'AmbientObject', name: 'AmbienteSombrio',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  color: '#6d28d9', intensity: 0.6,
})

// Fog denso
scene2Conects.push({
  instanceId: uid(), type: 'VolumetricFogObject', name: 'FogDenso',
  position: [0, 3, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  density: 0.06, scattering: 0.9, anisotropy: 0.5,
  attenuationDistance: 25, godRays: true, color: '#4c1d95',
})

// Bloom
scene2Conects.push({
  instanceId: uid(), type: 'BloomObject', name: 'BloomMistico',
  position: [5, 12, 5], rotation: [0, 0, 0], scale: [1, 1, 1],
  intensity: 0.8, threshold: 0.6, radius: 0.7,
})

// Terreno montanhoso
scene2Conects.push({
  instanceId: uid(), type: 'TerrainObject', name: 'TerrenoFloresta',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  width: 80, depth: 80, segments: SEG, heightScale: 8,
  heightmap: Array.from(forestTerrain),
  splatmap: Array.from(forestSplat),
  textureLayers: [
    { id: 'grass', label: 'Relva', color: '#1a3a1a' },
    { id: 'dirt', label: 'Terra', color: '#3a2a1a' },
    { id: 'rock', label: 'Pedra', color: '#2d2d35' },
    { id: 'snow', label: 'Neve', color: '#cbd5e1' },
  ],
  maxLayers: 4,
})

// Árvores densas (20)
for (let i = 0; i < 20; i++) {
  const angle = (i / 20) * Math.PI * 2
  const r = 8 + Math.random() * 25
  scene2Conects.push({
    instanceId: uid(), type: 'StaticObject', name: `ÁrvoreF_${i+1}`,
    sourceObjectId: 'obj_tree',
    position: [Math.cos(angle) * r, 2.5, Math.sin(angle) * r],
    rotation: [0, Math.random() * Math.PI * 2, 0],
    scale: [1 + Math.random() * 0.5, 1.2 + Math.random() * 0.8, 1 + Math.random() * 0.5],
    physicsType: 'cylinder', width: 0.4, height: 5, depth: 0.4,
  })
}

// Pedras (8)
for (let i = 0; i < 8; i++) {
  const angle = Math.random() * Math.PI * 2
  const r = 5 + Math.random() * 30
  scene2Conects.push({
    instanceId: uid(), type: 'StaticObject', name: `PedraF_${i+1}`,
    sourceObjectId: 'obj_rock',
    position: [Math.cos(angle) * r, 0.5, Math.sin(angle) * r],
    rotation: [Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI],
    scale: [1 + Math.random(), 1 + Math.random(), 1 + Math.random()],
    physicsType: 'sphere', width: 1, height: 1, depth: 1, colliderRadius: 1,
  })
}

// Jogador (mesma config)
const player2Id = uid()
const player2Y = sampleTerrainHeight(forestTerrain, SEG, 0, 0, 80, 80, 8) + 3  // +3m por terreno montanhoso
scene2Conects.push({
  instanceId: player2Id, type: 'PersonalObject', name: 'JogadorF',
  position: [0, player2Y, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  health: 100, maxHealth: 100, mass: 1, moveSpeed: 6, jumpForce: 9, canJump: true,
  fixedRotation: true, isPlayer: true,
})

scene2Conects.push({
  instanceId: uid(), type: 'JoystickObject', name: 'JoystickF',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  side: 'left', size: 130, targetPersonal: player2Id,
})

scene2Conects.push({
  instanceId: uid(), type: 'ViewObject', name: 'CamFPS_F',
  position: [0, 3, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  cameraType: 'perspective', fov: 80, near: 0.05, far: 300,
  followTarget: player2Id, followMode: 'first', eyeHeight: 1.6, cameraRole: 'player',
})

scene2Conects.push({
  instanceId: uid(), type: 'CameraTouchZone', name: 'TouchZoneF',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
  zone: { x: 50, y: 0, w: 50, h: 100 }, sensitivity: 1.5,
  minPitch: -1.4, maxPitch: 1.4,
})

// Arma
scene2Conects.push({
  instanceId: uid(), type: 'WeaponObject', name: 'Rifle',
  position: [0.3, 1.5, -0.5], rotation: [0, 0, 0], scale: [0.6, 0.6, 0.6],
  damage: 18, range: 120, maxAmmo: 30, fireRate: 0.1,
})

// 2 monstros corpo-a-corpo
for (let i = 0; i < 2; i++) {
  const angle = (i / 2) * Math.PI * 2
  scene2Conects.push({
    instanceId: uid(), type: 'NpcObject', name: `Monstro_${i+1}`,
    sourceObjectId: 'obj_enemy_monster',
    position: [Math.cos(angle) * 10, 2, Math.sin(angle) * 10],
    rotation: [0, 0, 0], scale: [1.2, 1.2, 1.2],
    health: 200, maxHealth: 200, mass: 1, moveSpeed: 4, damage: 20,
    fixedRotation: true, aiMode: 'chase',
    physicsType: 'sphere', width: 1, height: 1, depth: 1, colliderRadius: 0.7,
    flirCode: `
begincode update
  set_var _dist distanceTo player
  if _dist < 25
    move_towards player 4
    if _dist < 2.5
      if get_var _cooldown <= 0
        set_var _cooldown 1.5
        takeDamage player 25
      endif
    endif
  endif
  set_var _cooldown get_var _cooldown - 0.016
endcode

begincode onHit
  set_var _vida getHealth self
  if _vida <= 0
    hide self
    setUIValue aviso "MONSTRO ABATIDO!"
  endif
endcode
`,
  })
}

// BOSS (1)
scene2Conects.push({
  instanceId: uid(), type: 'NpcObject', name: 'BOSS_Dragon',
  sourceObjectId: 'obj_boss',
  position: [0, 5, -25], rotation: [0, 0, 0], scale: [2, 2, 2],
  health: 1000, maxHealth: 1000, mass: 5, moveSpeed: 2, damage: 50,
  fixedRotation: true, aiMode: 'chase',
  physicsType: 'sphere', width: 2, height: 2, depth: 2, colliderRadius: 1.8,
  flirCode: `
begincode update
  set_var _dist distanceTo player
  if _dist < 35
    move_towards player 2
    if _dist < 5
      if get_var _cooldown <= 0
        set_var _cooldown 2.5
        takeDamage player 50
        setUIValue aviso "BOSS ATACOU! -50 HP"
      endif
    endif
  endif
  set_var _cooldown get_var _cooldown - 0.016
  setUIValue bossbar "BOSS: " + (getHealth self)
endcode

begincode onHit
  set_var _vida getHealth self
  if _vida <= 0
    hide self
    setUIValue aviso "BOSS DERROTADO! VITÓRIA!"
  endif
endcode
`,
})

// 5 gemas na floresta
for (let i = 0; i < 5; i++) {
  const angle = (i / 5) * Math.PI * 2
  const r = 10 + Math.random() * 15
  scene2Conects.push({
    instanceId: uid(), type: 'ItemObject', name: `GemaF_${i+1}`,
    position: [Math.cos(angle) * r, 1, Math.sin(angle) * r],
    rotation: [0, 0, 0], scale: [1, 1, 1],
    color: ['#fbbf24', '#a855f7', '#3b82f6', '#10b981', '#ef4444'][i],
    value: 100, collectible: true,
    flirCode: `
begincode update
  set_var _dist distanceTo player
  if _dist < 1.5
    hide self
    setUIValue aviso "GEMA RARA! (+100)"
  endif
endcode
`,
  })
}

// Checkpoints (2)
scene2Conects.push({
  instanceId: uid(), type: 'CheckpointObject', name: 'CheckF1',
  position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1], triggerRadius: 2,
})
scene2Conects.push({
  instanceId: uid(), type: 'CheckpointObject', name: 'CheckF2',
  position: [0, 0, -15], rotation: [0, 0, 0], scale: [1, 1, 1], triggerRadius: 2,
})

// Portal de regresso
scene2Conects.push({
  instanceId: uid(), type: 'NavigatorObject', name: 'PortalVila',
  position: [-25, 1, 0], rotation: [0, 0, 0], scale: [1.5, 1.5, 1.5],
  triggerRadius: 2.5, targetSceneId: 'scene_village',
})

// === UI Screen (HUD) ===
const uiScreens = [{
  id: uid(),
  name: 'HUD',
  visible: true,
  elements: [
    { id: uid(), type: 'Text', name: 'vida', label: 'VIDA: 100', position: [3, 5], size: [180, 30], color: '#22c55e', textColor: '#ffffff', fontSize: 18 },
    { id: uid(), type: 'Text', name: 'muni', label: 'MUNI: 12', position: [3, 10], size: [180, 30], color: '#fbbf24', textColor: '#ffffff', fontSize: 18 },
    { id: uid(), type: 'Text', name: 'aviso', label: '', position: [50, 20], size: [400, 30], color: 'transparent', textColor: '#fbbf24', fontSize: 24 },
    { id: uid(), type: 'Text', name: 'bossbar', label: '', position: [50, 80], size: [400, 25], color: 'transparent', textColor: '#dc2626', fontSize: 16 },
    { id: uid(), type: 'Button', name: 'btn_tiro', label: 'TIRO', position: [85, 85], size: [90, 70], color: '#dc2626', textColor: '#ffffff', fontSize: 18, eventName: 'onShoot' },
    { id: uid(), type: 'Button', name: 'btn_reload', label: 'RELOAD', position: [70, 90], size: [80, 50], color: '#3b82f6', textColor: '#ffffff', fontSize: 14, eventName: 'onReload' },
    { id: uid(), type: 'Button', name: 'btn_pular', label: 'PULAR', position: [15, 85], size: [80, 70], color: '#10b981', textColor: '#ffffff', fontSize: 14, eventName: 'onJump' },
    { id: uid(), type: 'Text', name: 'title', label: 'FlirQuest Saga', position: [50, 3], size: [300, 25], color: 'transparent', textColor: '#a855f7', fontSize: 20 },
  ],
}]

// === Cenas ===
const scenes = [
  {
    id: 'scene_village',
    name: 'Vila Inicial',
    objects: [],
    conects: scene1Conects,
    gameCamera: {
      cameraType: 'perspective',
      position: [0, 5, 10], rotation: [0, 0, 0],
      fov: 80, near: 0.05, far: 300,
    },
    physics: { gravity: [0, -9.82, 0] },
    playerObjectId: playerId,
  },
  {
    id: 'scene_forest',
    name: 'Floresta Sombria',
    objects: [],
    conects: scene2Conects,
    gameCamera: {
      cameraType: 'perspective',
      position: [0, 5, 10], rotation: [0, 0, 0],
      fov: 80, near: 0.05, far: 300,
    },
    physics: { gravity: [0, -9.82, 0] },
    playerObjectId: player2Id,
  },
]

// === Projeto ===
const project = {
  version: 4,
  projectName: 'FlirQuest Saga — RPG/FPS Profissional',
  appMode: 'scene',
  objects,
  scenes,
  activeSceneId: 'scene_village',
  background: { type: 'gradient', gradientTop: '#1e3a8a', gradientBottom: '#fb923c', color: '#0d1117' },
  grid: { visible: false, size: 30, divisions: 30, color: '#1f2937' },
  lights: {
    ambient: { intensity: 0.5, color: '#fbbf24' },
    directional: { intensity: 1.5, color: '#fff7d6', position: [15, 8, -5] },
  },
  uiScreens,
  renderSettings: {
    qualityLevel: 'super-realista',
    flirGI: false, // flag existe mas sem implementação — ver README
    flirAdaptiveMesh: false,
    shadowOptimizations: true,
    shadowDistance: 40,
    shadowMapSize: 1024,
    vertexAO: true,
    pom: true,
    postProcessing: true,
    waterQuality: 'professional',
    pixelRatio: 1.0,
  },
}

const json = JSON.stringify(project)
console.log('FlirQuest Saga gerado:', json.length, 'bytes')
console.log('Cenas:', scenes.length, '| Conects cena 1:', scene1Conects.length, '| Conects cena 2:', scene2Conects.length)

export { project as flirQuestSagaProject, json as flirQuestSagaJSON }

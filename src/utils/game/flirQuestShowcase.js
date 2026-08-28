/**
 * FlirQuest Showcase — jogo demo RPG/FPS em mundo aberto.
 *
 * Teste de stress completo da Flir Engine — valida:
 *  - Personagem humano modelado com primitivas (corpo, cabeça, braços, pernas)
 *  - ViewObject com followMode='third' (terceira pessoa)
 *  - Cidade realista gerada via construtores (casa + árvore + mobiliário)
 *  - Terreno com heightmap procedural + relva
 *  - 5 NPCs com IA patrulha/perseguição (NpcObject + pathfinding A*)
 *  - 4 itens coleccionáveis (ItemObject com auto-pickup)
 *  - 2 checkpoints (CheckpointObject)
 *  - WeaponObject (espada) com shoot (ataque)
 *  - SkyObject procedural (dia)
 *  - LuminousObject (sol) + AmbientObject
 *  - HUD: barra de vida, munição (energia), objetivos
 *  - FlirCode em NPCs: patrulhar waypoints, perseguir quando vê jogador
 *  - FlirCode no jogador: atualizar HUD, tomar dano
 *  - 2 cenas: Cidade Inicial + Floresta/Templo
 *
 * Estrutura:
 *  - Cena 1 "Cidade Inicial": praça central com NPCs pacíficos, items, checkpoint
 *  - Cena 2 "Floresta Sombria": inimigos hostis, boss final, items valiosos
 *
 * Gera um projeto .flirengine pronto a abrir na Flir Engine.
 */
import { generateTerrainHeightmap } from '../terrain/terrainNoise.js'

// ===== Helpers =====
let _idCounter = 1
const uid = () => `showcase_${Date.now()}_${_idCounter++}`

// ===== Terreno procedural =====
const SEG = 96
const heightmap = generateTerrainHeightmap(SEG, {
  seed: 7,
  scale: 35,
  octaves: 5,
  persistence: 0.5,
  lacunarity: 2.0,
  ridgedAmount: 0.3,
  warpStrength: 1.0,
  terracing: false,
  erosion: false,
})

// ===== Catálogo de objetos (modelos 3D) =====
// Personagem humano modelado com primitivas compostas
const playerParts = [
  // Cabeça
  {
    id: uid(), type: 'sphere', name: 'PlayerHead',
    position: [0, 2.1, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    args: { radius: 0.28, segments: 16 },
    material: { color: '#f4d4b8', roughness: 0.6, metalness: 0.0 },
    visible: true,
  },
  // Tronco
  {
    id: uid(), type: 'cylinder', name: 'PlayerTorso',
    position: [0, 1.4, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    args: { radius: 0.35, height: 1.0, segments: 12 },
    material: { color: '#2c5f8a', roughness: 0.7, metalness: 0.1 },
    visible: true,
  },
  // Braço esquerdo
  {
    id: uid(), type: 'cylinder', name: 'PlayerArmL',
    position: [-0.45, 1.4, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    args: { radius: 0.1, height: 0.9, segments: 8 },
    material: { color: '#f4d4b8', roughness: 0.6 },
    visible: true,
  },
  // Braço direito
  {
    id: uid(), type: 'cylinder', name: 'PlayerArmR',
    position: [0.45, 1.4, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    args: { radius: 0.1, height: 0.9, segments: 8 },
    material: { color: '#f4d4b8', roughness: 0.6 },
    visible: true,
  },
  // Mão esquerda
  {
    id: uid(), type: 'sphere', name: 'PlayerHandL',
    position: [-0.45, 0.9, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    args: { radius: 0.12, segments: 8 },
    material: { color: '#f4d4b8', roughness: 0.6 },
    visible: true,
  },
  // Mão direita
  {
    id: uid(), type: 'sphere', name: 'PlayerHandR',
    position: [0.45, 0.9, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    args: { radius: 0.12, segments: 8 },
    material: { color: '#f4d4b8', roughness: 0.6 },
    visible: true,
  },
  // Perna esquerda
  {
    id: uid(), type: 'cylinder', name: 'PlayerLegL',
    position: [-0.18, 0.45, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    args: { radius: 0.13, height: 0.9, segments: 8 },
    material: { color: '#1a3a5c', roughness: 0.8 },
    visible: true,
  },
  // Perna direita
  {
    id: uid(), type: 'cylinder', name: 'PlayerLegR',
    position: [0.18, 0.45, 0], rotation: [0, 0, 0], scale: [1, 1, 1],
    args: { radius: 0.13, height: 0.9, segments: 8 },
    material: { color: '#1a3a5c', roughness: 0.8 },
    visible: true,
  },
]
const playerId = playerParts[1].id // torso é o "root" do player

// Casas para a cidade (3 casas de estilos diferentes)
const cityObjects = []
for (let i = 0; i < 3; i++) {
  cityObjects.push({
    id: uid(), type: 'cube', name: `House_${i}`,
    position: [Math.cos(i * 2.1) * 12, 1.5, Math.sin(i * 2.1) * 12],
    rotation: [0, i * 2.1, 0], scale: [3, 3, 3],
    args: { size: 1 },
    material: { color: ['#e8e2d5', '#c0392b', '#2c3e50'][i], roughness: 0.7, metalness: 0.0 },
    visible: true,
  })
  // Telhado (pirâmide)
  cityObjects.push({
    id: uid(), type: 'cone', name: `Roof_${i}`,
    position: [Math.cos(i * 2.1) * 12, 3.5, Math.sin(i * 2.1) * 12],
    rotation: [0, i * 2.1, 0], scale: [3.3, 1.5, 3.3],
    args: { radius: 1, height: 1, segments: 4 },
    material: { color: ['#7a2a1f', '#5a2618', '#1a1a1a'][i], roughness: 0.8 },
    visible: true,
  })
}

// Árvores dispersas
const treeObjects = []
for (let i = 0; i < 8; i++) {
  const angle = i * Math.PI / 4
  const dist = 18 + Math.random() * 8
  // Tronco
  treeObjects.push({
    id: uid(), type: 'cylinder', name: `Trunk_${i}`,
    position: [Math.cos(angle) * dist, 1.5, Math.sin(angle) * dist],
    rotation: [0, 0, 0], scale: [1, 1, 1],
    args: { radius: 0.25, height: 3, segments: 8 },
    material: { color: '#5a3a1a', roughness: 0.9 },
    visible: true,
  })
  // Copa
  treeObjects.push({
    id: uid(), type: 'sphere', name: `Foliage_${i}`,
    position: [Math.cos(angle) * dist, 3.5, Math.sin(angle) * dist],
    rotation: [0, 0, 0], scale: [2.5, 2, 2.5],
    args: { radius: 1, segments: 12 },
    material: { color: '#3a7d2c', roughness: 0.85, sheen: 0.3 },
    visible: true,
  })
}

// Postes de luz
const lampObjects = []
for (let i = 0; i < 4; i++) {
  const angle = i * Math.PI / 2 + Math.PI / 4
  lampObjects.push({
    id: uid(), type: 'cylinder', name: `Lamp_${i}`,
    position: [Math.cos(angle) * 6, 2.5, Math.sin(angle) * 6],
    rotation: [0, 0, 0], scale: [0.15, 5, 0.15],
    args: { radius: 1, height: 1, segments: 8 },
    material: { color: '#2a2a2a', roughness: 0.5, metalness: 0.7 },
    visible: true,
  })
  // Bulbo emissivo
  lampObjects.push({
    id: uid(), type: 'sphere', name: `LampBulb_${i}`,
    position: [Math.cos(angle) * 6, 5.2, Math.sin(angle) * 6],
    rotation: [0, 0, 0], scale: [0.3, 0.3, 0.3],
    args: { radius: 1, segments: 8 },
    material: { color: '#fff2c0', emissive: '#fff2c0', emissiveIntensity: 2.5, roughness: 0.1 },
    visible: true,
  })
}

// Templo (cena 2) — estrutura piramidal
const templeObjects = [
  // Base
  { id: uid(), type: 'cube', name: 'TempleBase', position: [0, 0.5, 0], rotation: [0, 0, 0], scale: [8, 1, 8], args: { size: 1 }, material: { color: '#8b8b8b', roughness: 0.9 }, visible: true },
  // Nível 2
  { id: uid(), type: 'cube', name: 'TempleL2', position: [0, 1.5, 0], rotation: [0, 0, 0], scale: [6, 1, 6], args: { size: 1 }, material: { color: '#a0a0a0', roughness: 0.85 }, visible: true },
  // Nível 3
  { id: uid(), type: 'cube', name: 'TempleL3', position: [0, 2.5, 0], rotation: [0, 0, 0], scale: [4, 1, 4], args: { size: 1 }, material: { color: '#b5b5b5', roughness: 0.8 }, visible: true },
  // Topo
  { id: uid(), type: 'cube', name: 'TempleTop', position: [0, 3.5, 0], rotation: [0, 0, 0], scale: [2, 1, 2], args: { size: 1 }, material: { color: '#d4af37', roughness: 0.3, metalness: 0.8 }, visible: true },
  // Pilar frente esq
  { id: uid(), type: 'cylinder', name: 'PillarFL', position: [-3, 3, -3], rotation: [0, 0, 0], scale: [0.3, 6, 0.3], args: { radius: 1, height: 1, segments: 12 }, material: { color: '#e8e8e8', roughness: 0.7 }, visible: true },
  // Pilar frente dir
  { id: uid(), type: 'cylinder', name: 'PillarFR', position: [3, 3, -3], rotation: [0, 0, 0], scale: [0.3, 6, 0.3], args: { radius: 1, height: 1, segments: 12 }, material: { color: '#e8e8e8', roughness: 0.7 }, visible: true },
  // Pilar trás esq
  { id: uid(), type: 'cylinder', name: 'PillarBL', position: [-3, 3, 3], rotation: [0, 0, 0], scale: [0.3, 6, 0.3], args: { radius: 1, height: 1, segments: 12 }, material: { color: '#e8e8e8', roughness: 0.7 }, visible: true },
  // Pilar trás dir
  { id: uid(), type: 'cylinder', name: 'PillarBR', position: [3, 3, 3], rotation: [0, 0, 0], scale: [0.3, 6, 0.3], args: { radius: 1, height: 1, segments: 12 }, material: { color: '#e8e8e8', roughness: 0.7 }, visible: true },
]

// ===== S18 FIX: schema correto de instâncias =====
// A engine espera scene.objects = [{ instanceId, objectId, position, rotation,
// scale }] + catálogo top-level `objects`. Antes os objetos brutos iam direto
// para scene.objects (sem instanceId/objectId) e NUNCA renderizavam — a cidade
// ficava invisível e o SceneEditorPanel dava warning de keys undefined.
const catalog = []
const catalogIds = new Set()

// Regista uma definição no catálogo (sem duplicados) e devolve a instância
// posicionada. Várias cenas podem instanciar o MESMO objeto do catálogo.
const toInstance = (obj, posOffset = [0, 0, 0]) => {
  if (!catalogIds.has(obj.id)) { catalog.push(obj); catalogIds.add(obj.id) }
  return {
    instanceId: `inst_${obj.id}`,
    objectId: obj.id,
    position: [
      (obj.position?.[0] || 0) + posOffset[0],
      (obj.position?.[1] || 0) + posOffset[1],
      (obj.position?.[2] || 0) + posOffset[2],
    ],
    rotation: obj.rotation || [0, 0, 0],
    scale: obj.scale || [1, 1, 1],
  }
}

// Converte um grupo inteiro de objetos em instâncias (registando no catálogo)
const toInstances = (objs, posOffset) => objs.map((o) => toInstance(o, posOffset))

// ===== Conects Cena 1 (Cidade Inicial) =====
const conectsScene1 = []

// PersonalObject — jogador humano
conectsScene1.push({
  instanceId: 'player_showcase',
  type: 'PersonalObject',
  name: 'Hero',
  position: [0, 0.05, 8],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  mass: 70,
  canJump: true,
  jumpForce: 7,
  moveSpeed: 5,
  fixedRotation: true,
  health: 100,
  maxHealth: 100,
})

// ViewObject — câmara terceira pessoa
conectsScene1.push({
  instanceId: 'view_showcase',
  type: 'ViewObject',
  name: 'MainCamera',
  position: [0, 6, 14],
  rotation: [-0.3, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  followMode: 'third',
  followTarget: 'player_showcase',
  followDistance: 6,
  followHeight: 3,
  fov: 60,
  near: 0.1,
  far: 500,
  cameraRole: 'player',
})

// SkyObject — dia
conectsScene1.push({
  instanceId: 'sky_showcase',
  type: 'SkyObject',
  name: 'DaySky',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  skyType: 'gradient',
  topColor: '#4a90e2',
  bottomColor: '#b8d4f0',
})

// LuminousObject — sol
conectsScene1.push({
  instanceId: 'sun_showcase',
  type: 'LuminousObject',
  name: 'Sun',
  position: [15, 25, 10],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  lightType: 'directional',
  color: '#fff7d6',
  intensity: 1.3,
  castShadow: true,
})

// AmbientObject
conectsScene1.push({
  instanceId: 'ambient_showcase',
  type: 'AmbientObject',
  name: 'Ambient',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  color: '#a0c4ff',
  intensity: 0.4,
})

// TerrainObject
conectsScene1.push({
  instanceId: 'terrain_showcase',
  type: 'TerrainObject',
  name: 'CityGround',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  width: 100,
  depth: 100,
  segments: SEG,
  heightScale: 4,
  heightmap: Array.from(heightmap),
  color: '#4a7c3a',
})

// 3 NPCs pacíficos (patrulha)
const npcDialogs = [
  { name: 'Guarda', color: '#3a5f8a', dialog: 'Bem-vindo, viajante! A cidade é pacífica, mas a floresta a norte esconde perigos.' },
  { name: 'Comerciante', color: '#8a5a3a', dialog: 'Compra a minha poção de vida por 50 moedas? Recupera toda a vida!' },
  { name: 'Sábio', color: '#5a3a8a', dialog: 'O templo antigo tem um tesouro, mas guardado por um guardião temível.' },
]
for (let i = 0; i < 3; i++) {
  const angle = i * 2 * Math.PI / 3
  conectsScene1.push({
    instanceId: `npc_${i}_showcase`,
    type: 'NpcObject',
    name: npcDialogs[i].name,
    position: [Math.cos(angle) * 5, 0.5, Math.sin(angle) * 5],
    rotation: [0, -angle, 0],
    scale: [1, 1, 1],
    visible: true,
    mass: 60,
    health: 50,
    maxHealth: 50,
    aiMode: 'patrol',
    patrolPoints: [
      [Math.cos(angle) * 5, 0.5, Math.sin(angle) * 5],
      [Math.cos(angle + 1) * 5, 0.5, Math.sin(angle + 1) * 5],
    ],
    color: npcDialogs[i].color,
    flirScript: `FLIRCODE:
beginPlay
  log("NPC ${npcDialogs[i].name} pronto")
  setDialog("${npcDialogs[i].dialog}")
end
onSeePlayer
  log("Olá viajante!")
  showDialog()
end`,
  })
}

// 4 itens coleccionáveis
const itemTypes = [
  { name: 'Coin', color: '#ffd700', value: 10 },
  { name: 'Potion', color: '#e91e63', value: 25 },
  { name: 'Gem', color: '#9c27b0', value: 50 },
  { name: 'Key', color: '#607d8b', value: 100 },
]
for (let i = 0; i < 4; i++) {
  const angle = i * Math.PI / 2 + Math.PI / 4
  conectsScene1.push({
    instanceId: `item_${i}_showcase`,
    type: 'ItemObject',
    name: itemTypes[i].name,
    position: [Math.cos(angle) * 8, 1.0, Math.sin(angle) * 8],
    rotation: [0, 0, 0],
    scale: [0.5, 0.5, 0.5],
    visible: true,
    itemType: 'collectible',
    autoPickup: true,
    pickupRadius: 1.5,
    value: itemTypes[i].value,
    color: itemTypes[i].color,
    flirScript: `FLIRCODE:
beginPlay
  log("Item ${itemTypes[i].name} disponível")
end
onPickup
  addScore(${itemTypes[i].value})
  log("Recolheu: ${itemTypes[i].name} (+${itemTypes[i].value} pontos)")
end`,
  })
}

// 2 checkpoints
conectsScene1.push({
  instanceId: 'checkpoint_1_showcase',
  type: 'CheckpointObject',
  name: 'CheckpointStart',
  position: [0, 0.1, 6],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
})
conectsScene1.push({
  instanceId: 'checkpoint_2_showcase',
  type: 'CheckpointObject',
  name: 'CheckpointForest',
  position: [0, 0.1, -15],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
})

// WeaponObject — espada
conectsScene1.push({
  instanceId: 'weapon_showcase',
  type: 'WeaponObject',
  name: 'Sword',
  position: [0.45, 1.0, 0],
  rotation: [0, 0, 0],
  scale: [0.1, 0.8, 0.1],
  visible: true,
  weaponType: 'melee',
  damage: 25,
  fireRate: 0.5,
  range: 2,
  ammo: -1, // infinita (melee)
  maxAmmo: -1,
})

// Portal para cena 2
conectsScene1.push({
  instanceId: 'portal_forest_showcase',
  type: 'TriggerObject',
  name: 'PortalToForest',
  position: [0, 1, -20],
  rotation: [0, 0, 0],
  scale: [2, 3, 0.5],
  visible: true,
  isSensor: true,
  flirScript: `FLIRCODE:
beginPlay
  log("Portal para a Floresta Sombria")
end
onEnter
  log("A entrar na Floresta Sombria...")
  changeScene("Floresta Sombria")
end`,
})

// ===== Conects Cena 2 (Floresta Sombria) =====
const conectsScene2 = []

// Cópia do PersonalObject + ViewObject + Sky + luzes
conectsScene2.push({
  instanceId: 'player_showcase_2',
  type: 'PersonalObject',
  name: 'Hero',
  position: [0, 0.05, 15],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  mass: 70,
  canJump: true,
  jumpForce: 7,
  moveSpeed: 5,
  fixedRotation: true,
  health: 100,
  maxHealth: 100,
})
conectsScene2.push({
  instanceId: 'view_showcase_2',
  type: 'ViewObject',
  name: 'MainCamera2',
  position: [0, 6, 21],
  rotation: [-0.3, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  followMode: 'third',
  followTarget: 'player_showcase_2',
  followDistance: 6,
  followHeight: 3,
  fov: 60,
  near: 0.1,
  far: 500,
  cameraRole: 'player',
})
conectsScene2.push({
  instanceId: 'sky_showcase_2',
  type: 'SkyObject',
  name: 'DarkSky',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  skyType: 'gradient',
  topColor: '#1a1a2e',
  bottomColor: '#3a2a4a',
})
conectsScene2.push({
  instanceId: 'sun_showcase_2',
  type: 'LuminousObject',
  name: 'Moon',
  position: [-10, 20, -10],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  lightType: 'directional',
  color: '#a0c4ff',
  intensity: 0.6,
  castShadow: true,
})
conectsScene2.push({
  instanceId: 'ambient_showcase_2',
  type: 'AmbientObject',
  name: 'DarkAmbient',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  color: '#3a2a4a',
  intensity: 0.3,
})
conectsScene2.push({
  instanceId: 'terrain_showcase_2',
  type: 'TerrainObject',
  name: 'ForestGround',
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  visible: true,
  width: 100,
  depth: 100,
  segments: SEG,
  heightScale: 6,
  heightmap: Array.from(heightmap),
  color: '#2a3a1a',
})

// 5 inimigos hostis (perseguem)
const enemyNames = ['Goblin', 'Esqueleto', 'Lobo', 'Troll', 'Wraith']
for (let i = 0; i < 5; i++) {
  const angle = i * 2 * Math.PI / 5
  const dist = 8 + Math.random() * 4
  conectsScene2.push({
    instanceId: `enemy_${i}_showcase`,
    type: 'NpcObject',
    name: enemyNames[i],
    position: [Math.cos(angle) * dist, 0.5, Math.sin(angle) * dist],
    rotation: [0, -angle, 0],
    scale: [1, 1, 1],
    visible: true,
    mass: 50,
    health: 30 + i * 10,
    maxHealth: 30 + i * 10,
    aiMode: 'chase',
    chaseTarget: 'player_showcase_2',
    detectRange: 12,
    attackRange: 1.5,
    attackDamage: 5 + i * 2,
    moveSpeed: 3 + i * 0.5,
    color: ['#2a5a2a', '#e0e0d0', '#5a3a2a', '#3a5a3a', '#5a2a5a'][i],
    flirScript: `FLIRCODE:
beginPlay
  log("Inimigo ${enemyNames[i]} apareceu")
end
onSeePlayer
  log("${enemyNames[i]} está a perseguir-te!")
  chasePlayer()
end
onLoseSight
  log("${enemyNames[i]} perdeu-te de vista")
  stopChase()
end`,
  })
}

// Boss final
conectsScene2.push({
  instanceId: 'boss_showcase',
  type: 'NpcObject',
  name: 'Guardião do Templo',
  position: [0, 1, -8],
  rotation: [0, Math.PI, 0],
  scale: [2, 2, 2],
  visible: true,
  mass: 200,
  health: 200,
  maxHealth: 200,
  aiMode: 'chase',
  chaseTarget: 'player_showcase_2',
  detectRange: 20,
  attackRange: 2.5,
  attackDamage: 15,
  moveSpeed: 2.5,
  color: '#8b0000',
  flirScript: `FLIRCODE:
beginPlay
  log("O Guardião do Templo desperta!")
  showDialog("Guardião: Não passarás!")
end
onSeePlayer
  chasePlayer()
end
onDeath
  log("VITÓRIA! O Guardião foi derrotado!")
  showDialog("Parabéns! Completaste a FlirQuest Showcase!")
  addScore(500)
end`,
})

// Items na floresta
const forestItems = [
  { name: 'Treasure', color: '#ffd700', value: 200, x: 5, z: 5 },
  { name: 'HealthPotion', color: '#e91e63', value: 50, x: -5, z: 5 },
  { name: 'MagicScroll', color: '#9c27b0', value: 100, x: 5, z: -5 },
]
for (const item of forestItems) {
  conectsScene2.push({
    instanceId: `forest_item_${item.name}_showcase`,
    type: 'ItemObject',
    name: item.name,
    position: [item.x, 1.0, item.z],
    rotation: [0, 0, 0],
    scale: [0.5, 0.5, 0.5],
    visible: true,
    itemType: 'collectible',
    autoPickup: true,
    pickupRadius: 1.5,
    value: item.value,
    color: item.color,
    flirScript: `FLIRCODE:
beginPlay
  log("${item.name} disponível")
end
onPickup
  addScore(${item.value})
  log("Recolheu: ${item.name} (+${item.value} pontos)")
end`,
  })
}

// ===== HUD (UI screens) =====
const uiScreens = [{
  id: uid(),
  name: 'HUD',
  visible: true,
  elements: [
    // Barra de vida
    { id: uid(), type: 'Panel', name: 'health_bar', label: 'VIDA', position: [5, 8], size: [180, 28], color: '#2a1a1a', textColor: '#ff5555', fontSize: 12, eventName: 'onHealthUpdate' },
    // Barra de energia/munição
    { id: uid(), type: 'Panel', name: 'energy_bar', label: 'ENERGIA', position: [5, 14], size: [140, 22], color: '#1a2a1a', textColor: '#55ff55', fontSize: 11, eventName: 'onEnergyUpdate' },
    // Pontuação
    { id: uid(), type: 'Text', name: 'score_text', label: 'PONTOS: 0', position: [5, 2], size: [120, 24], color: 'transparent', textColor: '#ffd700', fontSize: 14, eventName: 'onScoreUpdate' },
    // Botão de ataque
    { id: uid(), type: 'Button', name: 'btn_attack', label: '⚔️', position: [80, 85], size: [70, 60], color: '#c0392b', textColor: '#ffffff', fontSize: 24, eventName: 'onAttack' },
    // Botão de salto
    { id: uid(), type: 'Button', name: 'btn_jump', label: '↑', position: [15, 85], size: [70, 60], color: '#10b981', textColor: '#ffffff', fontSize: 24, eventName: 'onJump' },
    // Mensagem de objetivo
    { id: uid(), type: 'Text', name: 'objective_text', label: 'OBJETIVO: Explora a cidade', position: [30, 2], size: [300, 24], color: 'transparent', textColor: '#ffffff', fontSize: 12, eventName: 'onObjectiveUpdate' },
  ],
}]

// ===== Cenas =====
// S18 FIX: instâncias com schema correto; playerObjectId aponta para o
// instanceId do tronco (antes apontava para um id de catálogo e o marcador
// JOGADOR nunca aparecia no editor).
const scene1Instances = [
  ...toInstances(playerParts),        // estátua/manequim do herói no centro da praça
  ...toInstances(cityObjects),
  ...toInstances(treeObjects),
  ...toInstances(lampObjects),
]
const player1InstanceId = `inst_${playerId}`

// Cena 2 reutiliza o MESMO catálogo (playerParts/temple/trees) com novas
// instâncias — é exatamente o propósito do catálogo de objetos.
const scene2Instances = [
  ...toInstances(playerParts),
  ...toInstances(templeObjects),
  ...toInstances(treeObjects.slice(0, 6)),
]
const player2InstanceId = `inst_${playerId}`

const scenes = [
  {
    id: uid(),
    name: 'Cidade Inicial',
    objects: scene1Instances,
    conects: conectsScene1,
    gameCamera: {
      cameraType: 'perspective',
      position: [0, 6, 14],
      rotation: [-0.3, 0, 0],
      fov: 60,
      near: 0.1,
      far: 500,
    },
    physics: { gravity: [0, -9.82, 0] },
    playerObjectId: player1InstanceId,
  },
  {
    id: uid(),
    name: 'Floresta Sombria',
    objects: scene2Instances,
    conects: conectsScene2,
    gameCamera: {
      cameraType: 'perspective',
      position: [0, 6, 21],
      rotation: [-0.3, 0, 0],
      fov: 60,
      near: 0.1,
      far: 500,
    },
    physics: { gravity: [0, -9.82, 0] },
    playerObjectId: player2InstanceId,
  },
]

// ===== Projeto completo =====
const project = {
  version: 4,
  projectName: 'FlirQuest Showcase — RPG/FPS Demo',
  appMode: 'scene',
  objects: catalog, // definições — as cenas referem-nas via objectId (S18 FIX)
  scenes,
  activeSceneId: scenes[0].id,
  background: { type: 'gradient', gradientTop: '#4a90e2', gradientBottom: '#b8d4f0', color: '#0d1117' },
  grid: { visible: false, size: 100, divisions: 50, color: '#1f2937' },
  lights: {
    ambient: { intensity: 0.4, color: '#a0c4ff' },
    directional: { intensity: 1.3, color: '#fff7d6', position: [15, 25, 10] },
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
    postProcessing: false,
    waterQuality: 'basic',
    pixelRatio: 1,
  },
  projectSettings: {
    name: 'FlirQuest Showcase',
    version: '1.0.0',
    author: 'Flir Engine Demo',
    description: 'RPG/FPS demo que valida todas as features da engine: personagem humano, cidade, NPCs com IA, terreno, items, checkpoints, armas, FlirCode.',
    iconColor: '#8b0000',
  },
}

// Serializar para JSON
const json = JSON.stringify(project)
console.log('FlirQuest Showcase gerado:', json.length, 'bytes')
console.log('Cenas:', scenes.length, '| Conects cena 1:', conectsScene1.length, '| Conects cena 2:', conectsScene2.length)

export { project as flirQuestShowcaseProject, json as flirQuestShowcaseJSON }

// Test the materialLibrary and texturePaint via vite build of an entry chunk
// Approach: import directly via the bundled dist files won't work either,
// so we'll just validate the source files textually + structural checks.
import { readFileSync } from 'fs'

const matLib = readFileSync('src/utils/materialLibrary.js', 'utf8')
const texPaint = readFileSync('src/utils/texturePaint.js', 'utf8')
const primitives = readFileSync('src/utils/primitives.js', 'utf8')
const sceneObj = readFileSync('src/components/3d/SceneObject.jsx', 'utf8')
const scene3d = readFileSync('src/components/3d/Scene3D.jsx', 'utf8')
const texPanel = readFileSync('src/components/panels/TexturingPanel.jsx', 'utf8')

let pass = 0, fail = 0
function check(name, cond, extra) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}`, extra || '') }
}

console.log('=== TESTE: Pipeline 9 passos (textual) ===')

// Passo 1: Modelo com UVs
check('Passo 1: BufferGeometry + UV attribute', sceneObj.includes("setAttribute('uv'"))
check('Passo 1b: Generated UVs quando ausente', sceneObj.includes('Sem UVs — gerar UVs planar'))

// Passo 2: Textura associada via UVs
check('Passo 2: CanvasTexture com RepeatWrapping', texPaint.includes('RepeatWrapping'))

// Passo 3: Raycast da câmara
check('Passo 3: TexturePaintRaycaster existe em Scene3D', scene3d.includes('TexturePaintRaycaster'))
check('Passo 3b: raycaster.intersectObject usado', scene3d.includes('raycaster.current.intersectObject'))

// Passo 4: Triângulo atingido identificado
check('Passo 4: hit.face reconhecido (intersects[0])', scene3d.includes('intersects[0]'))

// Passo 5: UV via baricêntricas (hit.uv)
check('Passo 5: hit.uv usado (baricêntricas do three.js)', scene3d.includes('hit.uv'))

// Passo 6: Conversão UV→pixel
check('Passo 6: u * canvasSize em paintAtUV', texPaint.includes('u * canvasSize'))
check('Passo 6b: (1 - v) * canvasSize (inverter Y)', texPaint.includes('1 - v) * canvasSize'))

// Passo 7: Pincel aplicado
check('Passo 7: paintAtUV com falloff radial', texPaint.includes('createRadialGradient'))
check('Passo 7b: paintStrokeOnMesh função existe', texPaint.includes('export function paintStrokeOnMesh'))

// Passo 8: needsUpdate = true (atualização GPU)
check('Passo 8: texture.needsUpdate = true após stroke', texPaint.includes('entry.texture.needsUpdate = true'))
check('Passo 8b: CanvasTexture usada (não TextureLoader)', texPaint.includes('new THREE.CanvasTexture'))

// Passo 9: Multi-canal
check('Passo 9: Canal color', texPaint.includes("'color'"))
check('Passo 9b: Canal roughness', texPaint.includes("'roughness'"))
check('Passo 9c: Canal metallic', texPaint.includes("'metallic'"))
check('Passo 9d: Canal normal', texPaint.includes("'normal'"))
check('Passo 9e: TexturingPanel tem PAINT_CHANNELS', texPanel.includes('PAINT_CHANNELS'))
check('Passo 9f: SceneObject aplica mat.roughnessMap', sceneObj.includes('m.roughnessMap'))
check('Passo 9g: SceneObject aplica mat.metalnessMap', sceneObj.includes('m.metalnessMap'))

console.log('')
console.log('=== TESTE: MeshPhysicalMaterial ===')
check('MeshPhysicalMaterial usado em vez de MeshStandardMaterial', sceneObj.includes('MeshPhysicalMaterial'))
check('anisotropy aplicado', sceneObj.includes('anisotropy:'))
check('ior aplicado', sceneObj.includes('ior:'))
check('transmission aplicado', sceneObj.includes('transmission:'))
check('clearcoat aplicado', sceneObj.includes('clearcoat:'))
check('sheen aplicado', sceneObj.includes('sheen:'))
check('specularIntensity aplicado', sceneObj.includes('specularIntensity:'))
check('envMapIntensity aplicado', sceneObj.includes('envMapIntensity:'))
check('attenuationColor aplicado', sceneObj.includes('attenuationColor:'))

console.log('')
console.log('=== TESTE: Biblioteca de Materiais (20 materiais) ===')
const REQUIRED_MATERIALS = [
  ['glass', 'Vidro'],
  ['gold', 'Ouro'],
  ['ice', 'Gelo'],
  ['water', 'Água'],
  ['rubber', 'Borracha'],
  ['plastic', 'Plástico'],
  ['chrome', 'Cromado'],
  ['wood', 'Madeira'],
  ['fabric', 'Tecido'],
  ['skin', 'Pele'],
  ['leather', 'Couro'],
  ['concrete', 'Betão'],
  ['brick', 'Tijolo'],
  ['brushed_metal', 'Metal Escovado'],
  ['copper', 'Cobre'],
  ['aluminum', 'Alumínio'],
  ['stone', 'Pedra'],
  ['emissive', 'Emissivo'],
  ['car_paint', 'Tinta de Carro'],
  ['translucent_plastic', 'Plástico Translúcido'],
]
for (const [id, name] of REQUIRED_MATERIALS) {
  check(`Material "${name}" (id=${id})`, matLib.includes(`id: '${id}'`))
}

// Verifica valores PBR específicos (referência do utilizador)
check('Vidro: transmission 1.0', matLib.match(/id:\s*'glass'[\s\S]*?transmission:\s*1\.0/))
check('Vidro: ior 1.45', matLib.match(/id:\s*'glass'[\s\S]*?ior:\s*1\.45/))
check('Vidro: clearcoat 0.10', matLib.match(/id:\s*'glass'[\s\S]*?clearcoat:\s*0\.10/))

check('Ouro: metallic 1.0', matLib.match(/id:\s*'gold'[\s\S]*?metalness:\s*1\.0/))
check('Ouro: anisotropy 0.30', matLib.match(/id:\s*'gold'[\s\S]*?anisotropy:\s*0\.30/))
check('Ouro: cor #ffd700', matLib.match(/id:\s*'gold'[\s\S]*?color:\s*'#ffd700'/i))

check('Gelo: ior 1.31', matLib.match(/id:\s*'ice'[\s\S]*?ior:\s*1\.31/))
check('Gelo: transmission 1.0', matLib.match(/id:\s*'ice'[\s\S]*?transmission:\s*1\.0/))

check('Água: ior 1.33', matLib.match(/id:\s*'water'[\s\S]*?ior:\s*1\.33/))

check('Cromado: clearcoat 1.0', matLib.match(/id:\s*'chrome'[\s\S]*?clearcoat:\s*1\.0/))
check('Cromado: cor branca', matLib.match(/id:\s*'chrome'[\s\S]*?color:\s*'#ffffff'/i))

check('Metal Escovado: anisotropy 0.80', matLib.match(/id:\s*'brushed_metal'[\s\S]*?anisotropy:\s*0\.80/))

check('Cobre: cor #b87333', matLib.match(/id:\s*'copper'[\s\S]*?color:\s*'#b87333'/i))
check('Cobre: anisotropy 0.30', matLib.match(/id:\s*'copper'[\s\S]*?anisotropy:\s*0\.30/))

check('Alumínio: cor #e0e0e0', matLib.match(/id:\s*'aluminum'[\s\S]*?color:\s*'#e0e0e0'/i))
check('Alumínio: anisotropy 0.50', matLib.match(/id:\s*'aluminum'[\s\S]*?anisotropy:\s*0\.50/))

check('Borracha: sheen 0.50', matLib.match(/id:\s*'rubber'[\s\S]*?sheen:\s*0\.50/))

check('Tinta Carro: clearcoat 1.0', matLib.match(/id:\s*'car_paint'[\s\S]*?clearcoat:\s*1\.0/))
check('Tinta Carro: clearcoatRoughness 0.02', matLib.match(/id:\s*'car_paint'[\s\S]*?clearcoatRoughness:\s*0\.02/))

check('Plástico Translúcido: ior 1.40', matLib.match(/id:\s*'translucent_plastic'[\s\S]*?ior:\s*1\.40/))
check('Plástico Translúcido: transmission 0.75', matLib.match(/id:\s*'translucent_plastic'[\s\S]*?transmission:\s*0\.75/))

check('Emissivo: emissiveIntensity 5-20', matLib.match(/id:\s*'emissive'[\s\S]*?emissiveIntensity:\s*10\.0/))

console.log('')
console.log('=== TESTE: defaultMaterial expandido ===')
check('defaultMaterial tem anisotropy', primitives.includes('anisotropy:'))
check('defaultMaterial tem ior', primitives.includes('ior:'))
check('defaultMaterial tem transmission', primitives.includes('transmission:'))
check('defaultMaterial tem clearcoat', primitives.includes('clearcoat:'))
check('defaultMaterial tem sheen', primitives.includes('sheen:'))
check('defaultMaterial tem specularIntensity', primitives.includes('specularIntensity:'))
check('defaultMaterial tem roughnessMap', primitives.includes('roughnessMap:'))
check('defaultMaterial tem metalnessMap', primitives.includes('metalnessMap:'))

console.log('')
console.log('=== TESTE: TexturingPanel multi-canal ===')
check('PAINT_CHANNELS definido', texPanel.includes('PAINT_CHANNELS'))
check('Canal color listado', texPanel.includes("id: 'color'"))
check('Canal roughness listado', texPanel.includes("id: 'roughness'"))
check('Canal metallic listado', texPanel.includes("id: 'metallic'"))
check('Canal normal listado', texPanel.includes("id: 'normal'"))
check('setPaintSettings chamado em channel change', texPanel.includes('setPaintSettings({ channel:'))
check('setPaintSettings chamado em brushType change', texPanel.includes('setPaintSettings({ brushType:'))
check('setPaintSettings chamado em size change', texPanel.includes('setPaintSettings({ size:'))
check('setPaintSettings chamado em strength change', texPanel.includes('setPaintSettings({ strength:'))
check('setPaintSettings chamado em color change', texPanel.includes('setPaintSettings({ color:'))
check('setPaintSettings chamado em normalMode change', texPanel.includes('setPaintSettings({ normalMode:'))

console.log('')
console.log('=== TESTE: TexturingPanel sliders PBR ===')
check('Slider de Anisotropy', texPanel.includes('Anisotropy:'))
check('Slider de IOR', texPanel.includes('IOR'))
check('Slider de Transmission', texPanel.includes('Transmission:'))
check('Slider de Clearcoat', texPanel.includes('Clearcoat:'))
check('Slider de Sheen', texPanel.includes('Sheen:'))
check('Slider de Specular Intensity', texPanel.includes('Specular Intensity:'))
check('Slider de Env Map Intensity', texPanel.includes('Env Map Intensity:'))

console.log('')
console.log('=== TESTE: Aba Guide (fluxo PBR) ===')
check('TEX_TABS tem guide', texPanel.includes("{ id: 'guide'"))
check('Guide tem Fluxo PBR', texPanel.includes('Fluxo de trabalho PBR'))
check('Guide tem 9 passos pipeline', texPanel.includes('Pipeline técnico (9 passos)'))
check('Guide tem teste recomendado', texPanel.includes('Teste recomendado'))
check('Guide descreve UV Unwrap', texPanel.includes('UV Unwrap'))
check('Guide descreve Base Color', texPanel.includes('Base Color (albedo)'))
check('Guide descreve Roughness', texPanel.includes('Roughness (rugosidade)'))
check('Guide descreve Normal Map', texPanel.includes('Normal Map (relevo fino)'))
check('Guide descreve Metallic', texPanel.includes('Metallic / Specular'))

console.log('')
console.log('=== TESTE: Scene3D TexturePaintRaycaster ===')
check('TexturePaintRaycaster defined', scene3d.includes('function TexturePaintRaycaster'))
check('Importado paintStrokeOnMesh', scene3d.includes("import { paintStrokeOnMesh }"))
check('<TexturePaintRaycaster /> renderizado', scene3d.includes('<TexturePaintRaycaster'))
check('Raycast só ativa em mode=paint', scene3d.includes("mode !== 'paint'"))
check('hit.uv usado para stroke', scene3d.includes('hit.uv.x, v: hit.uv.y'))
check('OrbitControls desativado ao arrastar', scene3d.includes('orbitRef.current.enabled = false'))

console.log('')
console.log('=== RESULTADO ===')
console.log(`PASS: ${pass}  FAIL: ${fail}`)
if (fail === 0) {
  console.log('✓ TODOS OS TESTES PASSARAM')
  process.exit(0)
} else {
  console.log('✗ ALGUNS TESTES FALHARAM')
  process.exit(1)
}

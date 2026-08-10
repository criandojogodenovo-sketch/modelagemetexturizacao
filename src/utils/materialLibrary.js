/**
 * materialLibrary.js — biblioteca de materiais predefinidos.
 *
 * Cada entrada devolve um objeto de material no formato do store
 * (cor, roughness, metalness, opcionalmente map/normalMap gerados proceduralmente).
 *
 * Materiais incluídos:
 *  - Metal (cromado, ouro, cobre)
 *  - Madeira (carvalho, nogueira)
 *  - Pedra (mármore, granito)
 *  - Pano (algodão, veludo)
 *  - Plástico (vermelho, branco)
 *  - Vidro (transparente)
 *  - Emissivo (neon)
 *
 * As texturas são geradas proceduralmente via canvas (sem ficheiros externos)
 * para que a biblioteca seja autocontida.
 */
import { defaultMaterial } from './primitives'

// Gera uma textura de madeira procedural
function woodTexture(baseColor = '#8b5a2b', ringColor = '#5d3a1a') {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  // Fundo
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, 256, 256)
  // Anéis
  for (let r = 0; r < 128; r += 4) {
    ctx.strokeStyle = ringColor
    ctx.globalAlpha = 0.3 + Math.random() * 0.2
    ctx.beginPath()
    ctx.arc(128, 128, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  // Ruído
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1)
  }
  return c.toDataURL('image/png')
}

// Gera uma textura de pedra/mármore procedural
function marbleTexture(baseColor = '#e8e8e8', veinColor = '#5a5a5a') {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, 256, 256)
  // Veios
  for (let i = 0; i < 12; i++) {
    ctx.strokeStyle = veinColor
    ctx.globalAlpha = 0.3 + Math.random() * 0.4
    ctx.lineWidth = 1 + Math.random() * 3
    ctx.beginPath()
    ctx.moveTo(Math.random() * 256, Math.random() * 256)
    for (let j = 0; j < 6; j++) {
      ctx.lineTo(Math.random() * 256, Math.random() * 256)
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
  return c.toDataURL('image/png')
}

// Gera uma textura de granito procedural (ruído fino)
function graniteTexture() {
  const c = document.createElement('canvas')
  c.width = c.height = 256
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#3a3a3a'
  ctx.fillRect(0, 0, 256, 256)
  for (let i = 0; i < 8000; i++) {
    const shades = ['#fff', '#aaa', '#444', '#222', '#888']
    ctx.fillStyle = shades[Math.floor(Math.random() * shades.length)]
    ctx.globalAlpha = Math.random() * 0.6
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2)
  }
  ctx.globalAlpha = 1
  return c.toDataURL('image/png')
}

// Gera uma textura de pano procedural
function fabricTexture(baseColor = '#888') {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, 128, 128)
  // Padrão de tear (linhas finas)
  ctx.strokeStyle = 'rgba(0,0,0,0.15)'
  ctx.lineWidth = 1
  for (let x = 0; x < 128; x += 2) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, 128)
    ctx.stroke()
  }
  for (let y = 0; y < 128; y += 2) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(128, y)
    ctx.stroke()
  }
  return c.toDataURL('image/png')
}

// Gera um normal map simples (textura cinzenta com relevo)
function simpleNormalMap() {
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#8080ff' // sem relevo (azul = sem normal Z)
  ctx.fillRect(0, 0, 128, 128)
  return c.toDataURL('image/png')
}

// Biblioteca de materiais predefinidos
export const MATERIAL_LIBRARY = [
  // Metais
  {
    id: 'metal_chrome',
    name: 'Metal Cromado',
    category: 'Metais',
    preview: '#c8c8c8',
    material: { ...defaultMaterial(), color: '#c8c8c8', roughness: 0.15, metalness: 1.0 },
  },
  {
    id: 'metal_gold',
    name: 'Ouro',
    category: 'Metais',
    preview: '#ffb84d',
    material: { ...defaultMaterial(), color: '#ffb84d', roughness: 0.25, metalness: 1.0 },
  },
  {
    id: 'metal_copper',
    name: 'Cobre',
    category: 'Metais',
    preview: '#b87333',
    material: { ...defaultMaterial(), color: '#b87333', roughness: 0.35, metalness: 1.0 },
  },
  {
    id: 'metal_brushed',
    name: 'Aço Escovado',
    category: 'Metais',
    preview: '#9a9a9a',
    material: { ...defaultMaterial(), color: '#9a9a9a', roughness: 0.5, metalness: 0.9 },
  },

  // Madeiras
  {
    id: 'wood_oak',
    name: 'Madeira Carvalho',
    category: 'Madeiras',
    preview: '#8b5a2b',
    material: { ...defaultMaterial(), color: '#8b5a2b', roughness: 0.75, metalness: 0.0, map: woodTexture('#8b5a2b', '#5d3a1a'), normalMap: simpleNormalMap(), repeat: [1, 1] },
  },
  {
    id: 'wood_walnut',
    name: 'Madeira Nogueira',
    category: 'Madeiras',
    preview: '#5d3a1a',
    material: { ...defaultMaterial(), color: '#5d3a1a', roughness: 0.7, metalness: 0.0, map: woodTexture('#5d3a1a', '#2d1a08'), normalMap: simpleNormalMap(), repeat: [1, 1] },
  },

  // Pedras
  {
    id: 'stone_marble',
    name: 'Mármore',
    category: 'Pedras',
    preview: '#e8e8e8',
    material: { ...defaultMaterial(), color: '#ffffff', roughness: 0.3, metalness: 0.0, map: marbleTexture('#f0f0f0', '#666666'), repeat: [1, 1] },
  },
  {
    id: 'stone_granite',
    name: 'Granito',
    category: 'Pedras',
    preview: '#3a3a3a',
    material: { ...defaultMaterial(), color: '#ffffff', roughness: 0.6, metalness: 0.0, map: graniteTexture(), repeat: [2, 2] },
  },
  {
    id: 'stone_sand',
    name: 'Pedra Arenosa',
    category: 'Pedras',
    preview: '#c2a878',
    material: { ...defaultMaterial(), color: '#c2a878', roughness: 0.85, metalness: 0.0 },
  },

  // Panos
  {
    id: 'fabric_cotton',
    name: 'Algodão',
    category: 'Panos',
    preview: '#888888',
    material: { ...defaultMaterial(), color: '#888888', roughness: 0.9, metalness: 0.0, map: fabricTexture('#888888'), repeat: [4, 4] },
  },
  {
    id: 'fabric_velvet',
    name: 'Veludo',
    category: 'Panos',
    preview: '#5a1a3a',
    material: { ...defaultMaterial(), color: '#5a1a3a', roughness: 0.95, metalness: 0.0 },
  },

  // Plásticos
  {
    id: 'plastic_red',
    name: 'Plástico Vermelho',
    category: 'Plásticos',
    preview: '#e63946',
    material: { ...defaultMaterial(), color: '#e63946', roughness: 0.4, metalness: 0.0 },
  },
  {
    id: 'plastic_white',
    name: 'Plástico Branco',
    category: 'Plásticos',
    preview: '#f5f5f5',
    material: { ...defaultMaterial(), color: '#f5f5f5', roughness: 0.5, metalness: 0.0 },
  },

  // Vidro
  {
    id: 'glass_clear',
    name: 'Vidro Transparente',
    category: 'Vidros',
    preview: '#a8d8ea',
    material: { ...defaultMaterial(), color: '#ffffff', roughness: 0.05, metalness: 0.0, opacity: 0.3, transparent: true },
  },
  {
    id: 'glass_frosted',
    name: 'Vidro Fosco',
    category: 'Vidros',
    preview: '#dde2e6',
    material: { ...defaultMaterial(), color: '#ffffff', roughness: 0.7, metalness: 0.0, opacity: 0.5, transparent: true },
  },

  // Emissivos
  {
    id: 'emissive_neon_blue',
    name: 'Neon Azul',
    category: 'Emissivos',
    preview: '#2f81f7',
    material: { ...defaultMaterial(), color: '#2f81f7', roughness: 0.3, metalness: 0.0, emissive: '#2f81f7', emissiveIntensity: 1.5 },
  },
  {
    id: 'emissive_neon_pink',
    name: 'Neon Rosa',
    category: 'Emissivos',
    preview: '#d63384',
    material: { ...defaultMaterial(), color: '#d63384', roughness: 0.3, metalness: 0.0, emissive: '#d63384', emissiveIntensity: 1.5 },
  },
  {
    id: 'emissive_lava',
    name: 'Lava',
    category: 'Emissivos',
    preview: '#ff4500',
    material: { ...defaultMaterial(), color: '#3a0a00', roughness: 0.8, metalness: 0.0, emissive: '#ff4500', emissiveIntensity: 2.0 },
  },

  // Misc
  {
    id: 'rubber',
    name: 'Borracha',
    category: 'Outros',
    preview: '#1a1a1a',
    material: { ...defaultMaterial(), color: '#1a1a1a', roughness: 0.95, metalness: 0.0 },
  },
  {
    id: 'ceramic',
    name: 'Cerâmica',
    category: 'Outros',
    preview: '#fafafa',
    material: { ...defaultMaterial(), color: '#fafafa', roughness: 0.2, metalness: 0.0 },
  },
  {
    id: 'asphalt',
    name: 'Asfalto',
    category: 'Outros',
    preview: '#2a2a2a',
    material: { ...defaultMaterial(), color: '#2a2a2a', roughness: 0.9, metalness: 0.0 },
  },
]

// Lista de categorias (para agrupar na UI)
export const MATERIAL_CATEGORIES = [...new Set(MATERIAL_LIBRARY.map((m) => m.category))]

// Procura um material por id
export function findMaterial(id) {
  return MATERIAL_LIBRARY.find((m) => m.id === id)
}

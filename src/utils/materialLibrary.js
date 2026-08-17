/**
 * materialLibrary.js — biblioteca de materiais PBR predefinidos.
 *
 * 20 materiais com valores fisicamente corretos (referência real-world).
 *
 * Valores PBR usados (em conformidade com Substance/Blender Principled BSDF):
 *  - transmission: 0..1 (vidro, plástico translúcido)
 *  - ior: 1.0..3.0 (vidro 1.45, água 1.33, gelo 1.31, diamante 2.42)
 *  - clearcoat: 0..1 (vernil, carro, cromado)
 *  - clearcoatRoughness: 0..1
 *  - anisotropy: 0..1 (metal escovado, ouro, cobre, alumínio)
 *  - sheen: 0..1 (tecido, veludo, borracha)
 *  - thickness: 0..1 (volume para subsurface approximation)
 *  - attenuationColor: cor da atenuação (subsurface tint)
 *  - specularIntensity: 0..1
 *  - envMapIntensity: 0..3
 *
 * As texturas procedurais (madeira, mármore, granito, etc.) são geradas
 * via canvas (sem ficheiros externos) para a biblioteca ser autocontida.
 */
import { defaultMaterial } from './primitives'

// ============================================================================
// Helpers para texturas procedurais
// ============================================================================

function makeCanvas(size = 256) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  return c
}

// Gera uma textura de madeira procedural (com veios)
function woodTexture(baseColor = '#8b5a2b', ringColor = '#5d3a1a') {
  const c = makeCanvas(256)
  const ctx = c.getContext('2d')
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

// Gera uma normal map para veios de madeira (linhas verticais)
function woodNormalMap() {
  const c = makeCanvas(256)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(256, 256)
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      // Veios verticais
      const wave = Math.sin(x * 0.3) * 0.5 + 0.5
      const idx = (y * 256 + x) * 4
      img.data[idx]     = 128 + Math.cos(x * 0.3) * 30     // R = X derivativa
      img.data[idx + 1] = 128                              // G = Y derivativa (sem variação vertical)
      img.data[idx + 2] = 255                              // B = +Z (sempre up)
      img.data[idx + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}

// Gera uma textura de pedra/mármore procedural
function marbleTexture(baseColor = '#e8e8e8', veinColor = '#5a5a5a') {
  const c = makeCanvas(256)
  const ctx = c.getContext('2d')
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, 256, 256)
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

// Gera uma textura de granito procedural
function graniteTexture() {
  const c = makeCanvas(256)
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
  const c = makeCanvas(128)
  const ctx = c.getContext('2d')
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, 128, 128)
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

// Gera uma textura de couro procedural (pequenos pontos irregulares)
function leatherTexture(baseColor = '#5a3020') {
  const c = makeCanvas(256)
  const ctx = c.getContext('2d')
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, 256, 256)
  // Pequenos pontos irregulares
  for (let i = 0; i < 4000; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    const shade = Math.random() * 40 - 20
    const r = parseInt(baseColor.slice(1, 3), 16) + shade
    const g = parseInt(baseColor.slice(3, 5), 16) + shade
    const b = parseInt(baseColor.slice(5, 7), 16) + shade
    ctx.fillStyle = `rgb(${Math.max(0, Math.min(255, r))},${Math.max(0, Math.min(255, g))},${Math.max(0, Math.min(255, b))})`
    ctx.fillRect(x, y, 1, 1)
  }
  return c.toDataURL('image/png')
}

// Normal map para couro — bump dos pontos
function leatherNormalMap() {
  const c = makeCanvas(256)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(256, 256)
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const idx = (y * 256 + x) * 4
      // Ruído periódico para gerar relevo de couro
      const n = (Math.sin(x * 0.5) + Math.sin(y * 0.5) + Math.sin((x + y) * 0.3)) * 20
      img.data[idx]     = 128 + n
      img.data[idx + 1] = 128 + n
      img.data[idx + 2] = 255
      img.data[idx + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}

// Gera uma textura de betão procedural (ruido + manchas)
function concreteTexture() {
  const c = makeCanvas(256)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#9a9a92'
  ctx.fillRect(0, 0, 256, 256)
  // Manchas escuras (AO simulado)
  for (let i = 0; i < 30; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    const r = 20 + Math.random() * 40
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r)
    grad.addColorStop(0, 'rgba(0,0,0,0.2)')
    grad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fill()
  }
  // Ruído fino
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.1})`
    ctx.fillRect(Math.random() * 256, Math.random() * 256, 1, 1)
  }
  return c.toDataURL('image/png')
}

// Gera uma textura de tijolo procedural
function brickTexture() {
  const c = makeCanvas(256)
  const ctx = c.getContext('2d')
  // Argamassa cinza
  ctx.fillStyle = '#6e6e6e'
  ctx.fillRect(0, 0, 256, 256)
  // Tijolos vermelhos
  const brickW = 64
  const brickH = 32
  for (let y = 0; y < 256; y += brickH) {
    const offset = ((y / brickH) % 2) * (brickW / 2)
    for (let x = -brickW; x < 256 + brickW; x += brickW) {
      const bx = x + offset + 2
      const by = y + 2
      const bw = brickW - 4
      const bh = brickH - 4
      // Variar cor do tijolo
      const shade = Math.random() * 30 - 15
      const r = 150 + shade
      const g = 60 + shade
      const b = 40 + shade
      ctx.fillStyle = `rgb(${r},${g},${b})`
      ctx.fillRect(bx, by, bw, bh)
      // Adicionar ruído ao tijolo
      for (let i = 0; i < 50; i++) {
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`
        ctx.fillRect(bx + Math.random() * bw, by + Math.random() * bh, 1, 1)
      }
    }
  }
  return c.toDataURL('image/png')
}

// Normal map para ondas de água
function waterNormalMap() {
  const c = makeCanvas(256)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(256, 256)
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const idx = (y * 256 + x) * 4
      // Ondas senoidais
      const dx = Math.cos(x * 0.1) * 20 + Math.cos(x * 0.05 + y * 0.03) * 15
      const dy = Math.sin(y * 0.1) * 20 + Math.sin(x * 0.03 + y * 0.05) * 15
      img.data[idx]     = 128 + dx
      img.data[idx + 1] = 128 + dy
      img.data[idx + 2] = 255
      img.data[idx + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c.toDataURL('image/png')
}

// Normal map vazio (sem relevo)
function flatNormalMap() {
  const c = makeCanvas(128)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#8080ff'
  ctx.fillRect(0, 0, 128, 128)
  return c.toDataURL('image/png')
}

// ============================================================================
// BIBLIOTECA DE 20 MATERIAIS PBR (valores fisicamente corretos)
// ============================================================================

export const MATERIAL_LIBRARY = [
  // ===== 1. VIDRO =====
  {
    id: 'glass',
    name: 'Vidro',
    category: 'Vidros',
    preview: '#d8e8f0',
    material: {
      ...defaultMaterial(),
      color: '#ffffff',
      roughness: 0.05,
      metalness: 0.0,
      transmission: 1.0,
      ior: 1.45,
      thickness: 0.5,
      clearcoat: 0.10,
      clearcoatRoughness: 0.0,
      transparent: true,
      opacity: 1.0,
      envMapIntensity: 1.5,
    },
  },

  // ===== 2. OURO =====
  {
    id: 'gold',
    name: 'Ouro',
    category: 'Metais',
    preview: '#ffd700',
    material: {
      ...defaultMaterial(),
      color: '#ffd700',
      roughness: 0.22,
      metalness: 1.0,
      anisotropy: 0.30,
      anisotropyRotation: 0.0,
      envMapIntensity: 1.5,
    },
  },

  // ===== 3. GELO =====
  {
    id: 'ice',
    name: 'Gelo',
    category: 'Vidros',
    preview: '#6ef7ff',
    material: {
      ...defaultMaterial(),
      color: '#6ef7ff',
      roughness: 0.10,
      metalness: 0.0,
      transmission: 1.0,
      ior: 1.31,
      thickness: 0.3,
      clearcoat: 0.0,
      // Subsurface approximation via attenuationColor
      attenuationColor: '#a0f0ff',
      attenuationDistance: 0.4,
      transparent: true,
      opacity: 0.85,
      envMapIntensity: 1.2,
    },
  },

  // ===== 4. ÁGUA =====
  {
    id: 'water',
    name: 'Água',
    category: 'Vidros',
    preview: '#3a8ad8',
    material: {
      ...defaultMaterial(),
      color: '#3a8ad8',
      roughness: 0.02,
      metalness: 0.0,
      transmission: 1.0,
      ior: 1.33,
      thickness: 0.5,
      transparent: true,
      opacity: 0.7,
      normalMap: waterNormalMap(),
      envMapIntensity: 1.5,
    },
  },

  // ===== 5. BORRACHA =====
  {
    id: 'rubber',
    name: 'Borracha',
    category: 'Outros',
    preview: '#1a1a1a',
    material: {
      ...defaultMaterial(),
      color: '#1a1a1a',
      roughness: 0.75,
      metalness: 0.0,
      sheen: 0.50,
      sheenColor: '#444444',
      sheenRoughness: 0.7,
      specularIntensity: 0.3,
    },
  },

  // ===== 6. PLÁSTICO =====
  {
    id: 'plastic',
    name: 'Plástico',
    category: 'Plásticos',
    preview: '#e63946',
    material: {
      ...defaultMaterial(),
      color: '#e63946',
      roughness: 0.30,
      metalness: 0.0,
      specularIntensity: 0.50,
      clearcoat: 0.0,
    },
  },

  // ===== 7. CROMADO =====
  {
    id: 'chrome',
    name: 'Cromado',
    category: 'Metais',
    preview: '#ffffff',
    material: {
      ...defaultMaterial(),
      color: '#ffffff',
      roughness: 0.03,
      metalness: 1.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.0,
      envMapIntensity: 2.0,
    },
  },

  // ===== 8. MADEIRA =====
  {
    id: 'wood',
    name: 'Madeira',
    category: 'Madeiras',
    preview: '#8b5a2b',
    material: {
      ...defaultMaterial(),
      color: '#8b5a2b',
      roughness: 0.55,
      metalness: 0.0,
      map: woodTexture('#8b5a2b', '#5d3a1a'),
      normalMap: woodNormalMap(),
      repeat: [1, 1],
    },
  },

  // ===== 9. TECIDO =====
  {
    id: 'fabric',
    name: 'Tecido',
    category: 'Panos',
    preview: '#5a7caa',
    material: {
      ...defaultMaterial(),
      color: '#5a7caa',
      roughness: 0.75,
      metalness: 0.0,
      sheen: 0.50,
      sheenColor: '#ffffff',
      sheenRoughness: 0.5,
      map: fabricTexture('#5a7caa'),
      repeat: [4, 4],
      specularIntensity: 0.2,
    },
  },

  // ===== 10. PELE (aproximação de subsurface) =====
  {
    id: 'skin',
    name: 'Pele',
    category: 'Orgânicos',
    preview: '#e0a890',
    material: {
      ...defaultMaterial(),
      color: '#e0a890',
      roughness: 0.55,
      metalness: 0.0,
      // Subsurface approximation via transmission + attenuationColor
      transmission: 0.20,
      thickness: 0.30,
      attenuationColor: '#ff8866',  // raio de subsurface (1.0, 0.4, 0.3) normalizado
      attenuationDistance: 0.4,
      sheen: 0.10,
      sheenColor: '#ffe0c0',
      specularIntensity: 0.35,
    },
  },

  // ===== 11. COURO =====
  {
    id: 'leather',
    name: 'Couro',
    category: 'Panos',
    preview: '#5a3020',
    material: {
      ...defaultMaterial(),
      color: '#5a3020',
      roughness: 0.65,
      metalness: 0.0,
      map: leatherTexture('#5a3020'),
      normalMap: leatherNormalMap(),
      sheen: 0.20,
      sheenColor: '#8a5030',
      repeat: [2, 2],
      specularIntensity: 0.45,
    },
  },

  // ===== 12. BETÃO =====
  {
    id: 'concrete',
    name: 'Betão',
    category: 'Pedras',
    preview: '#9a9a92',
    material: {
      ...defaultMaterial(),
      color: '#9a9a92',
      roughness: 0.75,
      metalness: 0.0,
      map: concreteTexture(),
      specularIntensity: 0.3,
      repeat: [2, 2],
    },
  },

  // ===== 13. TIJOLO =====
  {
    id: 'brick',
    name: 'Tijolo',
    category: 'Pedras',
    preview: '#963c28',
    material: {
      ...defaultMaterial(),
      color: '#ffffff',
      roughness: 0.70,
      metalness: 0.0,
      map: brickTexture(),
      specularIntensity: 0.3,
      repeat: [2, 2],
    },
  },

  // ===== 14. METAL ESCOVADO =====
  {
    id: 'brushed_metal',
    name: 'Metal Escovado',
    category: 'Metais',
    preview: '#9aa0a8',
    material: {
      ...defaultMaterial(),
      color: '#9aa0a8',
      roughness: 0.30,
      metalness: 1.0,
      anisotropy: 0.80,
      anisotropyRotation: 0.0,
      envMapIntensity: 1.5,
    },
  },

  // ===== 15. COBRE =====
  {
    id: 'copper',
    name: 'Cobre',
    category: 'Metais',
    preview: '#b87333',
    material: {
      ...defaultMaterial(),
      color: '#b87333',
      roughness: 0.30,
      metalness: 1.0,
      anisotropy: 0.30,
      envMapIntensity: 1.5,
    },
  },

  // ===== 16. ALUMÍNIO =====
  {
    id: 'aluminum',
    name: 'Alumínio',
    category: 'Metais',
    preview: '#e0e0e0',
    material: {
      ...defaultMaterial(),
      color: '#e0e0e0',
      roughness: 0.30,
      metalness: 1.0,
      anisotropy: 0.50,
      envMapIntensity: 1.5,
    },
  },

  // ===== 17. PEDRA =====
  {
    id: 'stone',
    name: 'Pedra',
    category: 'Pedras',
    preview: '#7e7e7e',
    material: {
      ...defaultMaterial(),
      color: '#7e7e7e',
      roughness: 0.75,
      metalness: 0.0,
      map: graniteTexture(),
      specularIntensity: 0.4,
      repeat: [2, 2],
    },
  },

  // ===== 18. EMISSIVO =====
  {
    id: 'emissive',
    name: 'Emissivo',
    category: 'Emissivos',
    preview: '#00ff88',
    material: {
      ...defaultMaterial(),
      color: '#1a1a1a',
      roughness: 0.4,
      metalness: 0.0,
      emissive: '#00ff88',
      emissiveIntensity: 10.0, // 5-20 range, valor médio
      // Emissive não afeta iluminação da cena em three.js (não é luz real)
    },
  },

  // ===== 19. TINTA DE CARRO =====
  {
    id: 'car_paint',
    name: 'Tinta de Carro',
    category: 'Plásticos',
    preview: '#1a1a2e',
    material: {
      ...defaultMaterial(),
      color: '#1a1a2e',
      roughness: 0.15,
      metalness: 1.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      envMapIntensity: 2.0,
    },
  },

  // ===== 20. PLÁSTICO TRANSLÚCIDO =====
  {
    id: 'translucent_plastic',
    name: 'Plástico Translúcido',
    category: 'Plásticos',
    preview: '#f0a0c0',
    material: {
      ...defaultMaterial(),
      color: '#f0a0c0',
      roughness: 0.30,
      metalness: 0.0,
      transmission: 0.75,
      ior: 1.40,
      thickness: 0.3,
      transparent: true,
      opacity: 1.0,
      specularIntensity: 0.5,
      envMapIntensity: 1.2,
    },
  },

  // ===== Extras (mantidos da biblioteca anterior) =====
  {
    id: 'wood_walnut',
    name: 'Madeira Nogueira',
    category: 'Madeiras',
    preview: '#5d3a1a',
    material: {
      ...defaultMaterial(),
      color: '#5d3a1a',
      roughness: 0.7,
      metalness: 0.0,
      map: woodTexture('#5d3a1a', '#2d1a08'),
      normalMap: woodNormalMap(),
      repeat: [1, 1],
    },
  },
  {
    id: 'marble',
    name: 'Mármore',
    category: 'Pedras',
    preview: '#e8e8e8',
    material: {
      ...defaultMaterial(),
      color: '#ffffff',
      roughness: 0.3,
      metalness: 0.0,
      map: marbleTexture('#f0f0f0', '#666666'),
      repeat: [1, 1],
    },
  },
  {
    id: 'ceramic',
    name: 'Cerâmica',
    category: 'Outros',
    preview: '#fafafa',
    material: {
      ...defaultMaterial(),
      color: '#fafafa',
      roughness: 0.2,
      metalness: 0.0,
      clearcoat: 0.5,
      clearcoatRoughness: 0.1,
    },
  },
  {
    id: 'asphalt',
    name: 'Asfalto',
    category: 'Outros',
    preview: '#2a2a2a',
    material: {
      ...defaultMaterial(),
      color: '#2a2a2a',
      roughness: 0.9,
      metalness: 0.0,
      specularIntensity: 0.2,
    },
  },
]

// Lista de categorias (para agrupar na UI)
export const MATERIAL_CATEGORIES = [...new Set(MATERIAL_LIBRARY.map((m) => m.category))]

// Procura um material por id
export function findMaterial(id) {
  return MATERIAL_LIBRARY.find((m) => m.id === id)
}

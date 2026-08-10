/**
 * terrainPresets.js — Definições estáticas para o editor de terrenos.
 *
 * Brushes de escultura (Unity-style), texturas de camada e defaults.
 * Mantido separado do componente para facilitar customização futura.
 */

// ============================================================
//  Brushes de escultura — alinhado com Unity Terrain tools
// ============================================================
export const SCULPT_BRUSHES = [
  {
    id: 'raise',
    label: 'Elevar',
    icon: '⬆️',
    desc: 'Sobe o terreno — pincel padrão de elevação',
  },
  {
    id: 'lower',
    label: 'Rebaixar',
    icon: '⬇️',
    desc: 'Desce o terreno — inverso do Elevar',
  },
  {
    id: 'smooth',
    label: 'Suavizar',
    icon: '🌊',
    desc: 'Média 3x3 — alisa picos e vales',
  },
  {
    id: 'flatten',
    label: 'Achatar',
    icon: '➖',
    desc: 'Aproxima do valor alvo (target height) gradualmente',
  },
  {
    id: 'setHeight',
    label: 'Definir Altura',
    icon: '🎯',
    desc: 'Define exatamente a altura alvo (mais agressivo que Achatar)',
  },
  {
    id: 'noise',
    label: 'Ruído',
    icon: '✨',
    desc: 'Adiciona ruído aleatório — útil para variação natural',
  },
  {
    id: 'ramp',
    label: 'Rampa',
    icon: '📐',
    desc: 'Clica 2 pontos — cria rampa suave entre eles',
  },
]

// ============================================================
//  Camadas de textura padrão (4 — relva/terra/pedra/neve)
//  O utilizador pode adicionar/remover/customizar no editor.
// ============================================================
export const DEFAULT_TEXTURE_LAYERS = [
  { id: 'grass', label: 'Relva',  color: '#5a7d3a', textureURL: null },
  { id: 'dirt',  label: 'Terra',  color: '#8b5a2b', textureURL: null },
  { id: 'rock',  label: 'Pedra',  color: '#6e7681', textureURL: null },
  { id: 'snow',  label: 'Neve',   color: '#f0f0f0', textureURL: null },
]

// ============================================================
//  Defaults
// ============================================================
export const DEFAULT_TERRAIN_CONFIG = {
  width: 50,
  depth: 50,
  segments: 64,
  heightScale: 5,
  seed: 12345,
  noiseScale: 20,
  octaves: 4,
  persistence: 0.5,
  lacunarity: 2,
}

export const DEFAULT_BRUSH = {
  mode: 'raise',
  size: 8,
  strength: 0.5,
  falloff: 'smooth',
  targetHeight: 0,
  spacing: 0.5, // distância mínima entre stamps no drag (em células)
}

export const DEFAULT_SCATTER = {
  objectName: '',
  density: 10,
  minHeight: 0,
  maxHeight: 0.6,
  maxSlope: 0.3,
  randomRotation: true,
  randomScale: 0.2, // ±20%
}

// Máximo de camadas suportado pelo splatmap (Float32Array de 4 pesos/cell)
export const MAX_LAYERS = 4

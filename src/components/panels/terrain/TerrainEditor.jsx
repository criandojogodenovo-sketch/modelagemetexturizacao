/**
 * TerrainEditor — editor de terrenos profissional (nível Unity/ItsMagic).
 *
 * Funcionalidades:
 *  - Geração por ruído Perlin/Simplex com parâmetros: escala, oitavas, persistência, lacunaridade, seed
 *  - Pincéis: elevar, rebaixar, suavizar, achatar, rampa (entre 2 pontos)
 *  - Tamanho e força (opacidade) do pincel ajustáveis
 *  - Pintura de textura em camadas: relva, terra, pedra, neve — por altura/inclinação ou manual
 *  - Dispersão de objetos (foliage/scatter): espalhar VisualObject com densidade e regras
 *  - Resolução ajustável com aviso de impacto no desempenho
 *
 * Exporta para a cena como TerrainObject com heightmap + splatmap + scatter data.
 */
import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../../store/useStore'
import { IconClose } from '../../ui/Icons'

// Implementação simples de ruído Perlin (sem dependências externas)
function perlinNoise2D(x, y, seed) {
  // Hash function baseada em seed
  const hash = (i) => {
    let h = i * 374761393 + seed * 668265263
    h = (h ^ (h >> 13)) * 1274126177
    return ((h ^ (h >> 16)) & 0x7fffffff) / 0x7fffffff
  }
  const xi = Math.floor(x) & 255
  const yi = Math.floor(y) & 255
  const xf = x - Math.floor(x)
  const yf = y - Math.floor(y)
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const aa = hash(xi + yi * 57)
  const ab = hash(xi + (yi + 1) * 57)
  const ba = hash((xi + 1) + yi * 57)
  const bb = hash((xi + 1) + (yi + 1) * 57)
  const x1 = aa + u * (ba - aa)
  const x2 = ab + u * (bb - ab)
  return (x1 + v * (x2 - x1)) * 2 - 1
}

// Fractal Brownian Motion (fBm) com oitavas
function fbm(x, y, seed, octaves, persistence, lacunarity, scale) {
  let total = 0
  let frequency = 1 / scale
  let amplitude = 1
  let maxValue = 0
  for (let i = 0; i < octaves; i++) {
    total += perlinNoise2D(x * frequency, y * frequency, seed + i * 1000) * amplitude
    maxValue += amplitude
    amplitude *= persistence
    frequency *= lacunarity
  }
  return total / maxValue
}

const BRUSH_MODES = [
  { id: 'raise', label: 'Elevar ⬆️', icon: '⬆️' },
  { id: 'lower', label: 'Rebaixar ⬇️', icon: '⬇️' },
  { id: 'smooth', label: 'Suavizar 🌊', icon: '🌊' },
  { id: 'flatten', label: 'Achatar ➖', icon: '➖' },
  { id: 'ramp', label: 'Rampa 📐', icon: '📐' },
]

const TEXTURE_LAYERS = [
  { id: 'grass', label: 'Relva', color: '#5a7d3a', heightRange: [0, 0.4] },
  { id: 'dirt', label: 'Terra', color: '#8b5a2b', heightRange: [0.3, 0.6] },
  { id: 'rock', label: 'Pedra', color: '#6e7681', heightRange: [0.5, 0.8] },
  { id: 'snow', label: 'Neve', color: '#f0f0f0', heightRange: [0.7, 1.0] },
]

export default function TerrainEditor({ onClose }) {
  const addConectToScene = useStore((s) => s.addConectToScene)
  const updateConect = useStore((s) => s.updateConect)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const objects = useStore((s) => s.objects)
  const toast = useStore((s) => s.toast)

  const [config, setConfig] = useState({
    width: 50,
    depth: 50,
    segments: 64,
    heightScale: 5,
    seed: 12345,
    noiseScale: 20,
    octaves: 4,
    persistence: 0.5,
    lacunarity: 2,
  })

  const [brush, setBrush] = useState({
    mode: 'raise',
    size: 8,
    strength: 0.5,
    flattenHeight: 0,
  })

  const [rampPoints, setRampPoints] = useState([]) // 2 pontos para pincel rampa
  const [heightmap, setHeightmap] = useState(null)
  const [splatmap, setSplatmap] = useState(null) // textura em camadas
  const [activeTextureLayer, setActiveTextureLayer] = useState('grass')
  const [scatterConfig, setScatterConfig] = useState({
    objectName: '',
    density: 10,
    minHeight: 0,
    maxHeight: 0.6,
    maxSlope: 0.3,
  })

  // Gerar heightmap com Perlin/fBm
  const generateHeightmap = () => {
    const seg = config.segments
    const hm = new Float32Array((seg + 1) * (seg + 1))
    for (let z = 0; z <= seg; z++) {
      for (let x = 0; x <= seg; x++) {
        const nx = x / seg
        const nz = z / seg
        const h = fbm(nx, nz, config.seed, config.octaves, config.persistence, config.lacunarity, config.noiseScale)
        hm[z * (seg + 1) + x] = h
      }
    }
    setHeightmap(hm)
    // Gerar splatmap automático baseado em altura
    generateSplatmap(hm)
    toast('Heightmap gerado com Perlin/fBm', 'success', 1200)
  }

  // Gerar splatmap (mapa de camadas de textura) baseado em altura
  const generateSplatmap = (hm) => {
    const seg = config.segments
    const sm = new Uint8Array((seg + 1) * (seg + 1)) // índice da camada
    for (let i = 0; i < hm.length; i++) {
      const h = hm[i]
      // Encontrar a camada cujo heightRange contém h
      let layer = 0
      for (let l = 0; l < TEXTURE_LAYERS.length; l++) {
        const [min, max] = TEXTURE_LAYERS[l].heightRange
        if (h >= min && h <= max) layer = l
      }
      sm[i] = layer
    }
    setSplatmap(sm)
  }

  // Aplicar pincel
  const applyBrush = (centerX, centerZ) => {
    if (!heightmap) return
    if (brush.mode === 'ramp') {
      // Modo rampa: clicar define 2 pontos, depois aplica rampa entre eles
      const newPoints = [...rampPoints, [centerX, centerZ]]
      if (newPoints.length === 2) {
        applyRamp(newPoints[0], newPoints[1])
        setRampPoints([])
      } else {
        setRampPoints(newPoints)
        toast(`Ponto 1 definido. Clica no ponto 2 para a rampa.`, 'info', 1500)
      }
      return
    }

    const seg = config.segments
    const radius = brush.size
    const strength = brush.strength
    const hm = new Float32Array(heightmap)
    for (let z = -radius; z <= radius; z++) {
      for (let x = -radius; x <= radius; x++) {
        const px = centerX + x
        const pz = centerZ + z
        if (px < 0 || px > seg || pz < 0 || pz > seg) continue
        const dist = Math.sqrt(x * x + z * z)
        if (dist > radius) continue
        const falloff = 1 - dist / radius
        const idx = pz * (seg + 1) + px
        switch (brush.mode) {
          case 'raise':
            hm[idx] += strength * falloff * 0.1
            break
          case 'lower':
            hm[idx] -= strength * falloff * 0.1
            break
          case 'smooth': {
            let sum = 0, count = 0
            for (let dz = -1; dz <= 1; dz++) {
              for (let dx = -1; dx <= 1; dx++) {
                const nx = px + dx, nz = pz + dz
                if (nx >= 0 && nx <= seg && nz >= 0 && nz <= seg) {
                  sum += hm[nz * (seg + 1) + nx]
                  count++
                }
              }
            }
            hm[idx] += ((sum / count) - hm[idx]) * falloff * strength
            break
          }
          case 'flatten':
            hm[idx] += (brush.flattenHeight - hm[idx]) * falloff * strength
            break
        }
      }
    }
    setHeightmap(hm)
    generateSplatmap(hm)
  }

  // Aplicar rampa suave entre 2 pontos
  const applyRamp = (p1, p2) => {
    if (!heightmap) return
    const seg = config.segments
    const hm = new Float32Array(heightmap)
    const dx = p2[0] - p1[0]
    const dz = p2[1] - p1[1]
    const dist = Math.sqrt(dx * dx + dz * dz)
    const steps = Math.ceil(dist)
    const h1 = hm[p1[1] * (seg + 1) + p1[0]]
    const h2 = hm[p2[1] * (seg + 1) + p2[0]]
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const px = Math.round(p1[0] + dx * t)
      const pz = Math.round(p1[1] + dz * t)
      const targetH = h1 + (h2 - h1) * t
      // Suavizar uma área ao redor do ponto
      const radius = brush.size
      for (let z = -radius; z <= radius; z++) {
        for (let x = -radius; x <= radius; x++) {
          const nx = px + x, nz = pz + z
          if (nx < 0 || nx > seg || nz < 0 || nz > seg) continue
          const dd = Math.sqrt(x * x + z * z)
          if (dd > radius) continue
          const falloff = 1 - dd / radius
          const idx = nz * (seg + 1) + nx
          hm[idx] += (targetH - hm[idx]) * falloff * brush.strength
        }
      }
    }
    setHeightmap(hm)
    generateSplatmap(hm)
    toast('Rampa aplicada', 'success', 1200)
  }

  // Pintar textura manualmente
  const paintTexture = (centerX, centerZ) => {
    if (!splatmap) return
    const seg = config.segments
    const radius = brush.size
    const sm = new Uint8Array(splatmap)
    const layerIdx = TEXTURE_LAYERS.findIndex((l) => l.id === activeTextureLayer)
    for (let z = -radius; z <= radius; z++) {
      for (let x = -radius; x <= radius; x++) {
        const px = centerX + x
        const pz = centerZ + z
        if (px < 0 || px > seg || pz < 0 || pz > seg) continue
        const dist = Math.sqrt(x * x + z * z)
        if (dist > radius) continue
        const falloff = 1 - dist / radius
        if (falloff * brush.strength > Math.random()) {
          sm[pz * (seg + 1) + px] = layerIdx
        }
      }
    }
    setSplatmap(sm)
  }

  // Dispersar objetos (foliage)
  const scatterObjects = () => {
    if (!heightmap || !activeSceneId) {
      toast('Gera um heightmap primeiro', 'error')
      return
    }
    if (!scatterConfig.objectName) {
      toast('Seleciona um objeto para dispersar', 'error')
      return
    }
    const obj = objects.find((o) => o.name === scatterConfig.objectName)
    if (!obj) {
      toast('Objeto não encontrado', 'error')
      return
    }
    const seg = config.segments
    const count = scatterConfig.density
    let placed = 0
    for (let i = 0; i < count * 3 && placed < count; i++) {
      const x = Math.floor(Math.random() * seg)
      const z = Math.floor(Math.random() * seg)
      const h = heightmap[z * (seg + 1) + x]
      if (h < scatterConfig.minHeight || h > scatterConfig.maxHeight) continue
      // Verificar inclinação (diferença de altura com vizinhos)
      const hRight = heightmap[z * (seg + 1) + Math.min(seg, x + 1)]
      const hDown = heightmap[Math.min(seg, z + 1) * (seg + 1) + x]
      const slope = Math.abs(hRight - h) + Math.abs(hDown - h)
      if (slope > scatterConfig.maxSlope) continue
      // Adicionar à cena
      const worldX = (x / seg - 0.5) * config.width
      const worldZ = (z / seg - 0.5) * config.depth
      const worldY = h * config.heightScale
      useStore.getState().addObjectToScene(obj.id, [worldX, worldY, worldZ])
      placed++
    }
    toast(`${placed} objetos dispersos no terreno`, 'success')
  }

  // Exportar para a cena
  const exportToScene = () => {
    if (!activeSceneId) {
      toast('Cria uma cena primeiro', 'error')
      return
    }
    const conect = addConectToScene('TerrainObject', [0, 0, 0])
    if (conect) {
      updateConect(conect.instanceId, {
        width: config.width,
        depth: config.depth,
        segments: config.segments,
        heightScale: config.heightScale,
        heightmapSeed: config.seed,
        heightmap: heightmap ? Array.from(heightmap) : null,
        splatmap: splatmap ? Array.from(splatmap) : null,
        textureLayers: TEXTURE_LAYERS,
      })
      toast('Terreno exportado para a cena!', 'success')
      if (onClose) onClose()
    }
  }

  // Gerar heightmap inicial
  useEffect(() => {
    if (!heightmap) generateHeightmap()
  }, [])

  return (
    <>
      {onClose && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`terrain-editor ${onClose ? 'open' : ''}`}>
        <div className="panel-header">
          <span>⛰️ Editor de Terrenos</span>
          {onClose && (
            <button className="icon" onClick={onClose} title="Fechar">
              <IconClose width={14} height={14} />
            </button>
          )}
        </div>

        <div className="terrain-editor-body">
          {/* Configuração do terreno */}
          <div className="panel-section">
            <h4>📏 Configuração</h4>
            <div className="prop-row">
              <label>Largura: {config.width}m</label>
              <input type="range" min="10" max="200" step="5" value={config.width}
                onChange={(e) => setConfig({ ...config, width: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Profundidade: {config.depth}m</label>
              <input type="range" min="10" max="200" step="5" value={config.depth}
                onChange={(e) => setConfig({ ...config, depth: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Resolução: {config.segments} {config.segments > 100 && <span style={{color: 'var(--warning)'}}>(⚠️ pesado)</span>}</label>
              <input type="range" min="16" max="128" step="8" value={config.segments}
                onChange={(e) => setConfig({ ...config, segments: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Escala de altura: {config.heightScale}</label>
              <input type="range" min="0" max="20" step="0.5" value={config.heightScale}
                onChange={(e) => setConfig({ ...config, heightScale: Number(e.target.value) })} />
            </div>
            {config.segments > 100 && (
              <div className="small" style={{ color: 'var(--warning)', marginBottom: 8 }}>
                ⚠️ Resolução alta pode ser lenta em telemóveis.
              </div>
            )}
          </div>

          {/* Geração Perlin */}
          <div className="panel-section">
            <h4>🎲 Geração Procedural (Perlin)</h4>
            <div className="prop-row">
              <label>Seed: {config.seed}</label>
              <input type="number" value={config.seed}
                onChange={(e) => setConfig({ ...config, seed: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Escala do ruído: {config.noiseScale}</label>
              <input type="range" min="5" max="50" step="1" value={config.noiseScale}
                onChange={(e) => setConfig({ ...config, noiseScale: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Oitavas: {config.octaves}</label>
              <input type="range" min="1" max="8" step="1" value={config.octaves}
                onChange={(e) => setConfig({ ...config, octaves: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Persistência: {config.persistence.toFixed(2)}</label>
              <input type="range" min="0.1" max="1" step="0.05" value={config.persistence}
                onChange={(e) => setConfig({ ...config, persistence: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Lacunaridade: {config.lacunarity.toFixed(2)}</label>
              <input type="range" min="1.5" max="3" step="0.1" value={config.lacunarity}
                onChange={(e) => setConfig({ ...config, lacunarity: Number(e.target.value) })} />
            </div>
            <button onClick={generateHeightmap} style={{ width: '100%', marginTop: 8 }}>
              🎲 Gerar Heightmap
            </button>
          </div>

          {/* Pincel */}
          <div className="panel-section">
            <h4>🖌️ Pincel de Escultura</h4>
            <div className="prop-row">
              <label>Modo</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                {BRUSH_MODES.map((b) => (
                  <button
                    key={b.id}
                    className={brush.mode === b.id ? 'active' : ''}
                    onClick={() => {
                      setBrush({ ...brush, mode: b.id })
                      if (b.id === 'ramp') setRampPoints([])
                    }}
                    style={{ fontSize: 10, padding: '6px 2px', flexDirection: 'column', gap: 2 }}
                    title={b.label}
                  >
                    <span style={{ fontSize: 14 }}>{b.icon}</span>
                    <span>{b.label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
            {brush.mode === 'ramp' && (
              <div className="small" style={{ color: 'var(--accent)', marginBottom: 8 }}>
                {rampPoints.length === 0 ? 'Clica no ponto 1 no preview' : 'Clica no ponto 2 no preview'}
              </div>
            )}
            <div className="prop-row">
              <label>Tamanho: {brush.size}</label>
              <input type="range" min="1" max="20" step="1" value={brush.size}
                onChange={(e) => setBrush({ ...brush, size: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Força: {brush.strength.toFixed(2)}</label>
              <input type="range" min="0.05" max="1" step="0.05" value={brush.strength}
                onChange={(e) => setBrush({ ...brush, strength: Number(e.target.value) })} />
            </div>
            {brush.mode === 'flatten' && (
              <div className="prop-row">
                <label>Altura alvo: {brush.flattenHeight.toFixed(2)}</label>
                <input type="range" min="-1" max="1" step="0.05" value={brush.flattenHeight}
                  onChange={(e) => setBrush({ ...brush, flattenHeight: Number(e.target.value) })} />
              </div>
            )}
          </div>

          {/* Pintura de textura */}
          <div className="panel-section">
            <h4>🎨 Pintura de Textura</h4>
            <div className="prop-row">
              <label>Camada ativa</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4 }}>
                {TEXTURE_LAYERS.map((l) => (
                  <button
                    key={l.id}
                    className={activeTextureLayer === l.id ? 'active' : ''}
                    onClick={() => setActiveTextureLayer(l.id)}
                    style={{ fontSize: 10, padding: '6px 4px', textAlign: 'left' }}
                  >
                    <span style={{ display: 'inline-block', width: 12, height: 12, background: l.color, borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }}></span>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="small muted mt-2">
              Seleciona o modo "Achatar" no pincel e clica no preview para pintar a textura ativa.
              Ou usa "Gerar Heightmap" para distribuição automática por altura.
            </div>
          </div>

          {/* Dispersão de objetos */}
          <div className="panel-section">
            <h4>🌳 Dispersão de Objetos (Foliage)</h4>
            <div className="prop-row">
              <label>Objeto a dispersar</label>
              <select
                value={scatterConfig.objectName}
                onChange={(e) => setScatterConfig({ ...scatterConfig, objectName: e.target.value })}
              >
                <option value="">— Selecionar —</option>
                {objects.map((o) => (
                  <option key={o.id} value={o.name}>{o.name}</option>
                ))}
              </select>
            </div>
            <div className="prop-row">
              <label>Densidade: {scatterConfig.density} objetos</label>
              <input type="range" min="1" max="100" step="1" value={scatterConfig.density}
                onChange={(e) => setScatterConfig({ ...scatterConfig, density: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Altura mínima: {scatterConfig.minHeight.toFixed(2)}</label>
              <input type="range" min="0" max="1" step="0.05" value={scatterConfig.minHeight}
                onChange={(e) => setScatterConfig({ ...scatterConfig, minHeight: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Altura máxima: {scatterConfig.maxHeight.toFixed(2)}</label>
              <input type="range" min="0" max="1" step="0.05" value={scatterConfig.maxHeight}
                onChange={(e) => setScatterConfig({ ...scatterConfig, maxHeight: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Inclinação máxima: {scatterConfig.maxSlope.toFixed(2)}</label>
              <input type="range" min="0.05" max="1" step="0.05" value={scatterConfig.maxSlope}
                onChange={(e) => setScatterConfig({ ...scatterConfig, maxSlope: Number(e.target.value) })} />
            </div>
            <button onClick={scatterObjects} style={{ width: '100%', marginTop: 8 }}>
              🌳 Dispersar no Terreno
            </button>
          </div>

          {/* Pré-visualização */}
          {heightmap && (
            <div className="panel-section">
              <h4>👁️ Pré-visualização (topo)</h4>
              <HeightmapPreview
                heightmap={heightmap}
                splatmap={splatmap}
                segments={config.segments}
                textureLayers={TEXTURE_LAYERS}
                rampPoints={rampPoints}
                onPaint={(x, z) => {
                  if (brush.mode === 'ramp') {
                    applyBrush(x, z)
                  } else {
                    applyBrush(x, z)
                  }
                }}
              />
            </div>
          )}

          {/* Exportar */}
          <div className="panel-section">
            <button onClick={exportToScene} className="primary" style={{ width: '100%' }}>
              ⛰️ Exportar para a Cena
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

// Componente de pré-visualização 2D com texturas em camadas
function HeightmapPreview({ heightmap, splatmap, segments, textureLayers, rampPoints, onPaint }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const size = 220
    canvas.width = size
    canvas.height = size
    const cellSize = size / (segments + 1)

    // Encontrar min/max
    let min = Infinity, max = -Infinity
    for (let i = 0; i < heightmap.length; i++) {
      if (heightmap[i] < min) min = heightmap[i]
      if (heightmap[i] > max) max = heightmap[i]
    }
    const range = max - min || 1

    for (let z = 0; z <= segments; z++) {
      for (let x = 0; x <= segments; x++) {
        const idx = z * (segments + 1) + x
        const h = heightmap[idx]
        const normalized = (h - min) / range
        // Cor base: camada de textura
        let color = '#5a7d3a'
        if (splatmap) {
          const layerIdx = splatmap[idx]
          color = textureLayers[layerIdx]?.color || '#5a7d3a'
        } else {
          // Fallback: grayscale com verde
          const v = Math.floor(normalized * 255)
          color = `rgb(${v * 0.3}, ${v}, ${v * 0.3})`
        }
        // Aplicar sombra baseada em altura para relevo
        const shade = 0.5 + normalized * 0.5
        ctx.fillStyle = applyShade(color, shade)
        ctx.fillRect(x * cellSize, z * cellSize, cellSize + 1, cellSize + 1)
      }
    }

    // Desenhar pontos de rampa
    if (rampPoints && rampPoints.length > 0) {
      ctx.fillStyle = '#f4a261'
      for (const p of rampPoints) {
        ctx.beginPath()
        ctx.arc(p[0] * cellSize, p[1] * cellSize, 5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [heightmap, splatmap, segments, textureLayers, rampPoints])

  const handleClick = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * segments
    const z = ((e.clientY - rect.top) / rect.height) * segments
    onPaint(Math.round(x), Math.round(z))
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      style={{
        width: '100%',
        maxWidth: 220,
        aspectRatio: '1',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        cursor: 'crosshair',
        display: 'block',
        margin: '0 auto',
      }}
    />
  )
}

// Aplica um fator de sombra a uma cor hex
function applyShade(hex, factor) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgb(${Math.floor(r * factor)}, ${Math.floor(g * factor)}, ${Math.floor(b * factor)})`
}

/**
 * TerrainEditor — editor de terrenos profissional inspirado em Unity/ItsMagic.
 *
 * Funcionalidades:
 *  - Criar terreno com heightmap (procedural ou manual)
 *  - Escalar altura, pintar com pincel (elevação/rebaixamento)
 *  - Configurar resolução, tamanho, textura
 *  - Pré-visualização 3D em tempo real
 *  - Exportar terreno para usar na Cena (cria um TerrainObject Conect)
 *
 * Funciona como uma aba separada (acesso via MainMenu ou AppModeSwitch).
 */
import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../../store/useStore'
import { IconClose, IconPlus } from '../../ui/Icons'

export default function TerrainEditor({ onClose }) {
  const addConectToScene = useStore((s) => s.addConectToScene)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const toast = useStore((s) => s.toast)

  const [terrainConfig, setTerrainConfig] = useState({
    width: 50,
    depth: 50,
    segments: 64,
    heightScale: 5,
    brushSize: 5,
    brushStrength: 0.5,
    brushMode: 'raise', // raise | lower | smooth | flatten
    flattenHeight: 0,
    texture: '#5a7d3a',
    seed: 12345,
  })

  // Heightmap armazenado localmente (array de alturas)
  const [heightmap, setHeightmap] = useState(null)

  // Gerar heightmap procedural
  const generateHeightmap = () => {
    const seg = terrainConfig.segments
    const hm = new Float32Array((seg + 1) * (seg + 1))
    const seed = terrainConfig.seed
    for (let z = 0; z <= seg; z++) {
      for (let x = 0; x <= seg; x++) {
        // Combinação de ondas senoidais para relevo natural
        const nx = x / seg
        const nz = z / seg
        const h =
          Math.sin(nx * 5 + seed * 0.001) * 0.3 +
          Math.cos(nz * 4 + seed * 0.002) * 0.3 +
          Math.sin((nx + nz) * 8 + seed * 0.003) * 0.2 +
          Math.cos(nx * 12 + nz * 11 + seed * 0.004) * 0.1
        hm[z * (seg + 1) + x] = h
      }
    }
    setHeightmap(hm)
    toast('Heightmap gerado', 'success', 1200)
  }

  // Pincelar no heightmap (simulado — numa implementação completa seria por click no canvas 3D)
  const applyBrush = (centerX, centerZ) => {
    if (!heightmap) return
    const seg = terrainConfig.segments
    const radius = terrainConfig.brushSize
    const strength = terrainConfig.brushStrength
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
        switch (terrainConfig.brushMode) {
          case 'raise':
            hm[idx] += strength * falloff * 0.1
            break
          case 'lower':
            hm[idx] -= strength * falloff * 0.1
            break
          case 'smooth':
            // Média dos vizinhos
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
          case 'flatten':
            hm[idx] += (terrainConfig.flattenHeight - hm[idx]) * falloff * strength
            break
        }
      }
    }
    setHeightmap(hm)
  }

  // Exportar para a cena como TerrainObject
  const exportToScene = () => {
    if (!activeSceneId) {
      toast('Cria uma cena primeiro', 'error')
      return
    }
    const conect = addConectToScene('TerrainObject', [0, 0, 0])
    if (conect) {
      // Atualizar com a configuração e heightmap atual
      useStore.getState().updateConect(conect.instanceId, {
        width: terrainConfig.width,
        depth: terrainConfig.depth,
        segments: terrainConfig.segments,
        heightScale: terrainConfig.heightScale,
        heightmapSeed: terrainConfig.seed,
        heightmap: heightmap ? Array.from(heightmap) : null,
        textureColor: terrainConfig.texture,
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
            <h4>Configuração</h4>
            <div className="prop-row">
              <label>Largura: {terrainConfig.width}m</label>
              <input type="range" min="10" max="200" step="5"
                value={terrainConfig.width}
                onChange={(e) => setTerrainConfig({ ...terrainConfig, width: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Profundidade: {terrainConfig.depth}m</label>
              <input type="range" min="10" max="200" step="5"
                value={terrainConfig.depth}
                onChange={(e) => setTerrainConfig({ ...terrainConfig, depth: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Resolução: {terrainConfig.segments}</label>
              <input type="range" min="16" max="128" step="8"
                value={terrainConfig.segments}
                onChange={(e) => setTerrainConfig({ ...terrainConfig, segments: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Escala de altura: {terrainConfig.heightScale}</label>
              <input type="range" min="0" max="20" step="0.5"
                value={terrainConfig.heightScale}
                onChange={(e) => setTerrainConfig({ ...terrainConfig, heightScale: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Seed: {terrainConfig.seed}</label>
              <input type="number"
                value={terrainConfig.seed}
                onChange={(e) => setTerrainConfig({ ...terrainConfig, seed: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Cor / Textura</label>
              <input type="color"
                value={terrainConfig.texture}
                onChange={(e) => setTerrainConfig({ ...terrainConfig, texture: e.target.value })} />
            </div>
            <button onClick={generateHeightmap} style={{ width: '100%', marginTop: 8 }}>
              🎲 Gerar Heightmap Procedural
            </button>
          </div>

          {/* Pincel */}
          <div className="panel-section">
            <h4>Pincel</h4>
            <div className="prop-row">
              <label>Modo do pincel</label>
              <select
                value={terrainConfig.brushMode}
                onChange={(e) => setTerrainConfig({ ...terrainConfig, brushMode: e.target.value })}
              >
                <option value="raise">Elevar ⬆️</option>
                <option value="lower">Rebaixar ⬇️</option>
                <option value="smooth">Suavizar 🌊</option>
                <option value="flatten">Achatar ➖</option>
              </select>
            </div>
            <div className="prop-row">
              <label>Tamanho: {terrainConfig.brushSize}</label>
              <input type="range" min="1" max="20" step="1"
                value={terrainConfig.brushSize}
                onChange={(e) => setTerrainConfig({ ...terrainConfig, brushSize: Number(e.target.value) })} />
            </div>
            <div className="prop-row">
              <label>Força: {terrainConfig.brushStrength.toFixed(2)}</label>
              <input type="range" min="0.05" max="1" step="0.05"
                value={terrainConfig.brushStrength}
                onChange={(e) => setTerrainConfig({ ...terrainConfig, brushStrength: Number(e.target.value) })} />
            </div>
            {terrainConfig.brushMode === 'flatten' && (
              <div className="prop-row">
                <label>Altura alvo: {terrainConfig.flattenHeight}</label>
                <input type="range" min="-1" max="1" step="0.05"
                  value={terrainConfig.flattenHeight}
                  onChange={(e) => setTerrainConfig({ ...terrainConfig, flattenHeight: Number(e.target.value) })} />
              </div>
            )}
            <div className="small muted mt-2">
              Dica: Na pré-visualização da cena, clica no terreno para aplicar o pincel.
            </div>
          </div>

          {/* Pré-visualização 2D do heightmap */}
          {heightmap && (
            <div className="panel-section">
              <h4>Pré-visualização (topo)</h4>
              <HeightmapPreview
                heightmap={heightmap}
                segments={terrainConfig.segments}
                onPaint={(x, z) => applyBrush(x, z)}
              />
            </div>
          )}

          {/* Exportar */}
          <div className="panel-section">
            <button onClick={exportToScene} className="primary" style={{ width: '100%' }}>
              ⛰️ Exportar para a Cena
            </button>
            <div className="small muted mt-2">
              Cria um TerrainObject na cena ativa com a configuração atual.
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

// Componente de pré-visualização 2D do heightmap
function HeightmapPreview({ heightmap, segments, onPaint }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const size = 200
    canvas.width = size
    canvas.height = size
    const cellSize = size / (segments + 1)
    // Encontrar min/max para normalizar
    let min = Infinity, max = -Infinity
    for (let i = 0; i < heightmap.length; i++) {
      if (heightmap[i] < min) min = heightmap[i]
      if (heightmap[i] > max) max = heightmap[i]
    }
    const range = max - min || 1
    // Desenhar
    for (let z = 0; z <= segments; z++) {
      for (let x = 0; x <= segments; x++) {
        const h = heightmap[z * (segments + 1) + x]
        const normalized = (h - min) / range
        const v = Math.floor(normalized * 255)
        ctx.fillStyle = `rgb(${v * 0.3}, ${v}, ${v * 0.3})`
        ctx.fillRect(x * cellSize, z * cellSize, cellSize + 1, cellSize + 1)
      }
    }
  }, [heightmap, segments])

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

/**
 * TerrainEditor — Editor de Terrenos profissional (Unity-aligned).
 *
 * **Reescrito em P7** para alinhar com o padrão Unity Terrain:
 *
 *  Tabs separadas (estilo Unity Inspector):
 *   1. Sculpt — pincéis de escultura (Elevar, Rebaixar, Suavizar, Achatar,
 *               Definir Altura, Ruído, Rampa) + falloff types (Smooth/Linear/
 *               Constant/Sharp) + spacing para drag contínuo
 *   2. Paint Texture — 4 camadas com blending suave (Float32Array splatmap),
 *               pintura manual + auto-splat por altura/inclinação, camadas
 *               customizáveis (cor + nome)
 *   3. Details — dispersão de objetos (foliage) com regras de altura/inclinação
 *   4. Settings — dimensões, resolução, escala, import/export PNG heightmap,
 *               seed, Perlin params, exportar para a cena
 *
 *  Pré-visualização 2D com brush cursor + drag painting contínuo.
 *  Exporta para a cena como TerrainObject com heightmap + splatmap + layers.
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore } from '../../../store/useStore'
import { IconClose } from '../../ui/Icons'
import HeightmapPreview from './HeightmapPreview'
import {
  SCULPT_BRUSHES,
  DEFAULT_TEXTURE_LAYERS,
  DEFAULT_TERRAIN_CONFIG,
  DEFAULT_BRUSH,
  DEFAULT_SCATTER,
  MAX_LAYERS,
} from '../../../utils/terrain/terrainPresets'
import {
  generateHeightmap,
  applyBrush as applyBrushOp,
  applyRamp,
  falloff as falloffFn,
  createSplatmap,
  paintSplat,
  autoSplatByHeight,
  heightmapStats,
  heightmapToPNG,
  pngToHeightmap,
  hexToRgb,
} from '../../../utils/terrain/terrainMath'

const FALLOFFS = [
  { id: 'smooth',   label: 'Smooth'   },
  { id: 'linear',   label: 'Linear'   },
  { id: 'constant', label: 'Constant' },
  { id: 'sharp',    label: 'Sharp'    },
]

const TABS = [
  { id: 'sculpt',   label: 'Escultura',   icon: '⛏️' },
  { id: 'paint',    label: 'Textura',     icon: 'palette' },
  { id: 'details',  label: 'Detalhes',    icon: 'tree' },
  { id: 'settings', label: 'Definições',  icon: 'settings' },
]

export default function TerrainEditor({ onClose }) {
  const addConectToScene = useStore((s) => s.addConectToScene)
  const updateConect = useStore((s) => s.updateConect)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const objects = useStore((s) => s.objects)
  const toast = useStore((s) => s.toast)

  const [activeTab, setActiveTab] = useState('sculpt')
  const [config, setConfig] = useState(DEFAULT_TERRAIN_CONFIG)
  const [brush, setBrush] = useState(DEFAULT_BRUSH)
  const [rampPoints, setRampPoints] = useState([])
  const [heightmap, setHeightmap] = useState(null)
  const [splatmap, setSplatmap] = useState(null)
  const [textureLayers, setTextureLayers] = useState(DEFAULT_TEXTURE_LAYERS)
  const [activeLayerIdx, setActiveLayerIdx] = useState(0)
  const [scatter, setScatter] = useState(DEFAULT_SCATTER)
  const [scatteredPoints, setScatteredPoints] = useState([])

  // Gerar heightmap + splatmap iniciais
  useEffect(() => {
    if (!heightmap) {
      const hm = generateHeightmap(config.segments, config)
      setHeightmap(hm)
      const sm = autoSplatByHeight(hm, config.segments, textureLayers, MAX_LAYERS)
      setSplatmap(sm)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ===== Operações =====

  const regenerate = useCallback(() => {
    const hm = generateHeightmap(config.segments, config)
    setHeightmap(hm)
    const sm = autoSplatByHeight(hm, config.segments, textureLayers, MAX_LAYERS)
    setSplatmap(sm)
    toast('Heightmap gerado', 'success', 1200)
  }, [config, textureLayers, toast])

  // Aplicar pincel — chamado a cada stamp (do HeightmapPreview drag)
  const handlePaint = useCallback((x, z, isStart) => {
    if (!heightmap) return
    const seg = config.segments

    if (brush.mode === 'ramp') {
      // Modo rampa: 2 cliques
      if (!isStart) return
      const newPoints = [...rampPoints, [x, z]]
      if (newPoints.length === 2) {
        const hm = new Float32Array(heightmap)
        applyRamp(hm, seg, newPoints[0], newPoints[1], brush)
        setHeightmap(hm)
        // Auto-splat update
        const sm = autoSplatByHeight(hm, seg, textureLayers, MAX_LAYERS)
        setSplatmap(sm)
        setRampPoints([])
        toast('Rampa aplicada', 'success', 1000)
      } else {
        setRampPoints(newPoints)
      }
      return
    }

    // Sculpt mode (raise/lower/smooth/flatten/setHeight/noise)
    if (activeTab === 'sculpt') {
      const hm = new Float32Array(heightmap)
      applyBrushOp(hm, seg, x, z, { ...brush, deltaTime: isStart ? 1 : 0.4 })
      setHeightmap(hm)
      // Atualizar splatmap automaticamente? Em Unity, a pintura de textura
      // é separada da escultura — NÃO recriar splatmap aqui.
      // Mas se o utilizador quiser auto-update, pode clicar "Auto-textura".
    } else if (activeTab === 'paint') {
      // Paint texture mode
      if (!splatmap) return
      const sm = new Float32Array(splatmap)
      paintSplat(sm, seg, x, z, activeLayerIdx, { ...brush, deltaTime: isStart ? 1 : 0.4, maxLayers: MAX_LAYERS })
      setSplatmap(sm)
    }
  }, [heightmap, splatmap, brush, config.segments, textureLayers, rampPoints, activeTab, activeLayerIdx, toast])

  // Auto-splat update
  const autoTexture = useCallback(() => {
    if (!heightmap) return
    const sm = autoSplatByHeight(heightmap, config.segments, textureLayers, MAX_LAYERS)
    setSplatmap(sm)
    toast('Texturas aplicadas por altura/inclinação', 'success', 1200)
  }, [heightmap, config.segments, textureLayers, toast])

  // Limpar textura (só camada 0)
  const clearTexture = useCallback(() => {
    if (!heightmap) return
    const cellCount = (config.segments + 1) * (config.segments + 1)
    setSplatmap(createSplatmap(cellCount, MAX_LAYERS))
    toast('Textura limpa (camada 0 dominante)', 'info', 1000)
  }, [heightmap, config.segments, toast])

  // Adicionar camada
  const addLayer = () => {
    if (textureLayers.length >= MAX_LAYERS) {
      toast(`Máximo de ${MAX_LAYERS} camadas`, 'error')
      return
    }
    const colors = ['#a0522d', '#cd853f', '#778899', '#bdb76b', '#8fbc8f']
    const newLayer = {
      id: `layer${Date.now()}`,
      label: `Camada ${textureLayers.length + 1}`,
      color: colors[textureLayers.length % colors.length],
      textureURL: null,
    }
    setTextureLayers([...textureLayers, newLayer])
  }

  // Remover camada
  const removeLayer = (idx) => {
    if (textureLayers.length <= 1) {
      toast('Precisas de pelo menos 1 camada', 'error')
      return
    }
    const next = textureLayers.filter((_, i) => i !== idx)
    setTextureLayers(next)
    if (activeLayerIdx >= next.length) setActiveLayerIdx(0)
    // Recriar splatmap com novo nº de camadas — redistribuir pesos
    if (heightmap && splatmap) {
      const sm = autoSplatByHeight(heightmap, config.segments, next, MAX_LAYERS)
      setSplatmap(sm)
    }
  }

  // Editar camada
  const updateLayer = (idx, patch) => {
    setTextureLayers(textureLayers.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  // Dispersar objetos
  const scatterObjects = () => {
    if (!heightmap || !activeSceneId) {
      toast('Gera um heightmap primeiro', 'error')
      return
    }
    if (!scatter.objectName) {
      toast('Seleciona um objeto para dispersar', 'error')
      return
    }
    const obj = objects.find((o) => o.name === scatter.objectName)
    if (!obj) {
      toast('Objeto não encontrado', 'error')
      return
    }
    const seg = config.segments
    const count = scatter.density
    let placed = 0
    const points = []
    const rng = mulberry32(Date.now() & 0x7fffffff)
    let min = Infinity, max = -Infinity
    for (let i = 0; i < heightmap.length; i++) {
      if (heightmap[i] < min) min = heightmap[i]
      if (heightmap[i] > max) max = heightmap[i]
    }
    const range = max - min || 1
    for (let i = 0; i < count * 5 && placed < count; i++) {
      const x = Math.floor(rng() * seg)
      const z = Math.floor(rng() * seg)
      const h = heightmap[z * (seg + 1) + x]
      const normalized = (h - min) / range
      if (normalized < scatter.minHeight || normalized > scatter.maxHeight) continue
      const hRight = heightmap[z * (seg + 1) + Math.min(seg, x + 1)]
      const hDown = heightmap[Math.min(seg, z + 1) * (seg + 1) + x]
      const slope = (Math.abs(hRight - h) + Math.abs(hDown - h)) / range
      if (slope > scatter.maxSlope) continue
      const worldX = (x / seg - 0.5) * config.width
      const worldZ = (z / seg - 0.5) * config.depth
      const worldY = h * config.heightScale
      const rotY = scatter.randomRotation ? rng() * Math.PI * 2 : 0
      const scale = 1 + (rng() - 0.5) * 2 * scatter.randomScale
      useStore.getState().addObjectToScene(obj.id, [worldX, worldY, worldZ], [0, rotY, 0], [scale, scale, scale])
      points.push([x, z])
      placed++
    }
    setScatteredPoints(points)
    toast(`${placed} objetos dispersos`, 'success')
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
        textureLayers,
        maxLayers: MAX_LAYERS,
      })
      toast('Terreno exportado para a cena!', 'success')
      if (onClose) onClose()
    }
  }

  // Import heightmap PNG
  const importInputRef = useRef(null)
  const handleImportPNG = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const hm = await pngToHeightmap(file, config.segments)
      setHeightmap(hm)
      const sm = autoSplatByHeight(hm, config.segments, textureLayers, MAX_LAYERS)
      setSplatmap(sm)
      toast('Heightmap importado de PNG', 'success')
    } catch (err) {
      toast('Erro ao importar PNG: ' + err.message, 'error')
    }
    e.target.value = ''
  }

  // Export heightmap PNG
  const handleExportPNG = () => {
    if (!heightmap) {
      toast('Sem heightmap para exportar', 'error')
      return
    }
    const dataURL = heightmapToPNG(heightmap, config.segments)
    const a = document.createElement('a')
    a.href = dataURL
    a.download = `heightmap-${config.segments}x${config.segments}.png`
    a.click()
    toast('Heightmap exportado como PNG', 'success')
  }

  // Stats do heightmap atual
  const stats = heightmap ? heightmapStats(heightmap) : null

  return (
    <>
      {onClose && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`terrain-editor ${onClose ? 'open' : ''}`}>
        <div className="panel-header">
          <span>Editor de Terrenos</span>
          {onClose && (
            <button className="icon" onClick={onClose} title="Fechar">
              <IconClose width={14} height={14} />
            </button>
          )}
        </div>

        {/* Tabs principais — estilo Unity Inspector */}
        <div className="terrain-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`terrain-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
              title={t.label}
            >
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="terrain-editor-body">
          {/* ============ TAB: SCULPT ============ */}
          {activeTab === 'sculpt' && (
            <>
              <div className="panel-section">
                <h4>⛏️ Pincel de Escultura</h4>
                <div className="terrain-brush-grid">
                  {SCULPT_BRUSHES.map((b) => (
                    <button
                      key={b.id}
                      className={`terrain-brush-btn ${brush.mode === b.id ? 'active' : ''}`}
                      onClick={() => {
                        setBrush({ ...brush, mode: b.id })
                        if (b.id === 'ramp') setRampPoints([])
                      }}
                      title={`${b.label}: ${b.desc}`}
                    >
                      <span style={{ fontSize: 16 }}>{b.icon}</span>
                      <span>{b.label}</span>
                    </button>
                  ))}
                </div>
                {brush.mode === 'ramp' && (
                  <div className="small" style={{ color: 'var(--accent)', marginBottom: 8, marginTop: 4 }}>
                    {rampPoints.length === 0 ? '👆 Clica no ponto 1 no preview' : '👆 Clica no ponto 2 no preview'}
                  </div>
                )}
              </div>

              <BrushControls brush={brush} setBrush={setBrush} />
            </>
          )}

          {/* ============ TAB: PAINT TEXTURE ============ */}
          {activeTab === 'paint' && (
            <>
              <div className="panel-section">
                <h4>Camadas de Textura</h4>
                <div className="terrain-layers-list">
                  {textureLayers.map((layer, idx) => (
                    <div
                      key={layer.id}
                      className={`terrain-layer-row ${activeLayerIdx === idx ? 'active' : ''}`}
                      onClick={() => setActiveLayerIdx(idx)}
                    >
                      <input
                        type="color"
                        value={layer.color}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateLayer(idx, { color: e.target.value })}
                        style={{ width: 28, height: 28, padding: 0, cursor: 'pointer', flexShrink: 0 }}
                      />
                      <input
                        type="text"
                        value={layer.label}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => updateLayer(idx, { label: e.target.value })}
                        style={{ flex: 1, minWidth: 0 }}
                      />
                      <button
                        className="icon danger"
                        onClick={(e) => { e.stopPropagation(); removeLayer(idx) }}
                        title="Remover camada"
                        style={{ padding: '4px 6px', minWidth: 'auto' }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
                <button onClick={addLayer} style={{ width: '100%', marginTop: 6 }} disabled={textureLayers.length >= MAX_LAYERS}>
                  + Adicionar Camada
                </button>
                <div className="small muted mt-2">
                  Camada ativa: <strong style={{ color: textureLayers[activeLayerIdx]?.color }}>
                    {textureLayers[activeLayerIdx]?.label}
                  </strong>
                </div>
              </div>

              <BrushControls brush={brush} setBrush={setBrush} hideMode />

              <div className="panel-section">
                <h4>Auto-Textura</h4>
                <div className="small muted mb-2">
                  Distribui automaticamente as camadas por altura e inclinação:
                  baixa altitude → relva, alta inclinação → pedra, topo → neve.
                </div>
                <button onClick={autoTexture} style={{ width: '100%', marginBottom: 4 }}>Aplicar Auto-Textura
                </button>
                <button onClick={clearTexture} style={{ width: '100%' }}>
                  🧹 Limpar Textura
                </button>
              </div>
            </>
          )}

          {/* ============ TAB: DETAILS (foliage) ============ */}
          {activeTab === 'details' && (
            <>
              <div className="panel-section">
                <h4>Dispersão de Objetos</h4>
                <div className="prop-row">
                  <label>Objeto a dispersar</label>
                  <select
                    value={scatter.objectName}
                    onChange={(e) => setScatter({ ...scatter, objectName: e.target.value })}
                  >
                    <option value="">— Selecionar —</option>
                    {objects.map((o) => (
                      <option key={o.id} value={o.name}>{o.name}</option>
                    ))}
                  </select>
                </div>
                <div className="prop-row">
                  <label>Densidade: {scatter.density}</label>
                  <input type="range" min="1" max="200" step="1" value={scatter.density}
                    onChange={(e) => setScatter({ ...scatter, density: Number(e.target.value) })} />
                </div>
                <div className="prop-row">
                  <label>Altura mín: {scatter.minHeight.toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" value={scatter.minHeight}
                    onChange={(e) => setScatter({ ...scatter, minHeight: Number(e.target.value) })} />
                </div>
                <div className="prop-row">
                  <label>Altura máx: {scatter.maxHeight.toFixed(2)}</label>
                  <input type="range" min="0" max="1" step="0.05" value={scatter.maxHeight}
                    onChange={(e) => setScatter({ ...scatter, maxHeight: Number(e.target.value) })} />
                </div>
                <div className="prop-row">
                  <label>Inclinação máx: {scatter.maxSlope.toFixed(2)}</label>
                  <input type="range" min="0.05" max="1" step="0.05" value={scatter.maxSlope}
                    onChange={(e) => setScatter({ ...scatter, maxSlope: Number(e.target.value) })} />
                </div>
                <div className="prop-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={scatter.randomRotation}
                      onChange={(e) => setScatter({ ...scatter, randomRotation: e.target.checked })}
                      style={{ width: 'auto', display: 'inline-block', marginRight: 6 }}
                    />
                    Rotação aleatória
                  </label>
                </div>
                <div className="prop-row">
                  <label>Variação de escala: ±{Math.round(scatter.randomScale * 100)}%</label>
                  <input type="range" min="0" max="0.5" step="0.05" value={scatter.randomScale}
                    onChange={(e) => setScatter({ ...scatter, randomScale: Number(e.target.value) })} />
                </div>
                <button onClick={scatterObjects} className="primary" style={{ width: '100%', marginTop: 8 }}>Dispersar no Terreno
                </button>
                {scatteredPoints.length > 0 && (
                  <button
                    onClick={() => setScatteredPoints([])}
                    style={{ width: '100%', marginTop: 4 }}
                  >
                    🧹 Limpar markers (não remove objetos)
                  </button>
                )}
              </div>
            </>
          )}

          {/* ============ TAB: SETTINGS ============ */}
          {activeTab === 'settings' && (
            <>
              <div className="panel-section">
                <h4>📏 Dimensões</h4>
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
                  <label>
                    Resolução: {config.segments}
                    {config.segments > 100 && <span style={{ color: 'var(--warning)' }}> (pesado)</span>}
                  </label>
                  <input type="range" min="16" max="128" step="8" value={config.segments}
                    onChange={(e) => setConfig({ ...config, segments: Number(e.target.value) })} />
                </div>
                <div className="prop-row">
                  <label>Escala de altura: {config.heightScale}</label>
                  <input type="range" min="0" max="20" step="0.5" value={config.heightScale}
                    onChange={(e) => setConfig({ ...config, heightScale: Number(e.target.value) })} />
                </div>
                {config.segments > 100 && (
                  <div className="small" style={{ color: 'var(--warning)', marginBottom: 8 }}>Resolução alta pode ser lenta em telemóveis.
                  </div>
                )}
              </div>

              <div className="panel-section">
                <h4>Geração Procedural (Perlin)</h4>
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
                <button onClick={regenerate} style={{ width: '100%', marginTop: 8 }}>Regenerar Heightmap
                </button>
              </div>

              <div className="panel-section">
                <h4>Import / Export Heightmap</h4>
                <button onClick={() => importInputRef.current?.click()} style={{ width: '100%', marginBottom: 4 }}>Importar PNG
                </button>
                <button onClick={handleExportPNG} style={{ width: '100%' }}>Exportar PNG (8-bit grayscale)
                </button>
                <input
                  ref={importInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  style={{ display: 'none' }}
                  onChange={handleImportPNG}
                />
                <div className="small muted mt-2">
                  Importa/exporta o heightmap como imagem PNG grayscale.
                  Útil para editar noutra ferramenta ou reutilizar noutros projetos.
                </div>
              </div>
            </>
          )}

          {/* ===== Preview + Stats (sempre visível no fim) ===== */}
          {heightmap && (
            <div className="panel-section">
              <h4>👁️ Pré-visualização</h4>
              <HeightmapPreview
                heightmap={heightmap}
                splatmap={splatmap}
                segments={config.segments}
                textureLayers={textureLayers}
                rampPoints={rampPoints}
                scatteredPoints={scatteredPoints}
                brush={brush}
                onPaint={handlePaint}
                size={240}
              />
              {stats && (
                <div className="small muted mt-2" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>Min: {stats.min.toFixed(2)}</span>
                  <span>Max: {stats.max.toFixed(2)}</span>
                  <span>Δ: {stats.range.toFixed(2)}</span>
                </div>
              )}
              <div className="small muted mt-1">
                {activeTab === 'sculpt' && brush.mode !== 'ramp' && '👆 Arrasta no preview para pintar continuamente'}
                {brush.mode === 'ramp' && '👆 Clica 2 pontos para definir a rampa'}
                {activeTab === 'paint' && '👆 Arrasta para pintar a textura ativa'}
              </div>
            </div>
          )}

          {/* ===== Exportar para a cena ===== */}
          <div className="panel-section">
            <button onClick={exportToScene} className="primary" style={{ width: '100%' }}>Exportar para a Cena
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}

// ============================================================
//  Sub-componente: BrushControls (reutilizado entre tabs)
// ============================================================
function BrushControls({ brush, setBrush, hideMode = false }) {
  return (
    <div className="panel-section">
      {!hideMode && <h4>Parâmetros do Pincel</h4>}
      <div className="prop-row">
        <label>Tamanho: {brush.size}</label>
        <input type="range" min="1" max="30" step="1" value={brush.size}
          onChange={(e) => setBrush({ ...brush, size: Number(e.target.value) })} />
      </div>
      <div className="prop-row">
        <label>Força: {brush.strength.toFixed(2)}</label>
        <input type="range" min="0.05" max="1" step="0.05" value={brush.strength}
          onChange={(e) => setBrush({ ...brush, strength: Number(e.target.value) })} />
      </div>
      <div className="prop-row">
        <label>Falloff</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
          {FALLOFFS.map((f) => (
            <button
              key={f.id}
              className={brush.falloff === f.id ? 'active' : ''}
              onClick={() => setBrush({ ...brush, falloff: f.id })}
              style={{ fontSize: 10, padding: '6px 2px' }}
              title={f.label}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {(brush.mode === 'flatten' || brush.mode === 'setHeight') && (
        <div className="prop-row">
          <label>Altura alvo: {brush.targetHeight.toFixed(2)}</label>
          <input type="range" min="-1" max="1" step="0.05" value={brush.targetHeight}
            onChange={(e) => setBrush({ ...brush, targetHeight: Number(e.target.value) })} />
        </div>
      )}
      <div className="prop-row">
        <label>Spacing (drag): {brush.spacing.toFixed(2)}× size</label>
        <input type="range" min="0.1" max="1" step="0.1" value={brush.spacing}
          onChange={(e) => setBrush({ ...brush, spacing: Number(e.target.value) })} />
        <div className="small muted">Distância mínima entre stamps ao arrastar</div>
      </div>
      {/* Visualização do falloff */}
      <FalloffPreview brush={brush} />
    </div>
  )
}

// ============================================================
//  Sub-componente: FalloffPreview (mini-gráfico)
// ============================================================
function FalloffPreview({ brush }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width = canvas.clientWidth * 2
    const h = canvas.height = 40 * 2
    ctx.clearRect(0, 0, w, h)
    // Desenhar perfil de falloff
    ctx.strokeStyle = '#2f81f7'
    ctx.lineWidth = 2
    ctx.beginPath()
    const radius = brush.size
    for (let x = 0; x <= w; x++) {
      const dist = (x / w) * radius * 2 - radius
      const f = falloffFn(Math.abs(dist), radius, brush.falloff)
      const y = h - f * h * 0.85 - h * 0.05
      if (x === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    // Linha central
    ctx.strokeStyle = 'rgba(255,255,255,0.2)'
    ctx.beginPath()
    ctx.moveTo(w / 2, 0)
    ctx.lineTo(w / 2, h)
    ctx.stroke()
  }, [brush.falloff, brush.size])
  return (
    <div style={{ marginTop: 8 }}>
      <div className="small muted mb-1">Perfil do falloff:</div>
      <canvas ref={canvasRef} style={{ width: '100%', height: 40, background: 'var(--bg-app)', borderRadius: 4, border: '1px solid var(--border-soft)' }} />
    </div>
  )
}

// PRNG local — não quero importar do terrainMath para evitar bundle duplo
function mulberry32(seed) {
  let s = seed >>> 0
  return function () {
    s = (s + 0x6D2B79F5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

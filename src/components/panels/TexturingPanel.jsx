/**
 * TexturingPanel — painel de texturização profissional (inspirado em Blender).
 *
 * Otimizado para telas pequenas e formato horizontal.
 *
 * Funcionalidades:
 *  - Material PBR completo: cor base, roughness, metalness, emissive, opacity
 *  - Texturas: difusa, normal, roughness, metalness, emissive (upload ou URL)
 *  - UV tiling: repeat X/Y, offset X/Y, rotação
 *  - Biblioteca de materiais predefinidos (12 presets)
 *  - Copy/paste material entre objetos
 *  - Texture Paint: pintura direta no modelo (Draw, Soften, Smudge, Clone, Fill, Mask)
 *  - Texturização Procedural: Noise, Voronoi, Wave, Marble, Wood + ColorRamp
 *
 * Layout otimizado para mobile horizontal:
 *  - Tabs compactas no topo (Material | Texturas | UV | Pintar | Procedural | Biblioteca)
 *  - Sliders grandes para toque
 */
import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { IconClose } from '../ui/Icons'
import { findMaterial } from '../../utils/materialLibrary'
import { createPaintCanvas, paintAtUV, canvasToDataURL, dataURLToCanvas, generateProceduralTexture } from '../../utils/texturePaint'

const TEX_TABS = [
  { id: 'material', label: 'Material', icon: 'palette' },
  { id: 'textures', label: 'Texturas', icon: 'image' },
  { id: 'uv', label: 'UV', icon: '📐' },
  { id: 'paint', label: 'Pintar', icon: '🖌️' },
  { id: 'procedural', label: 'Procedural', icon: 'spline' },
  { id: 'library', label: 'Biblio.', icon: 'book' },
]

const MATERIAL_PRESETS = [
  { name: 'Plástico', color: '#ff4444', roughness: 0.4, metalness: 0.0 },
  { name: 'Metal', color: '#cccccc', roughness: 0.2, metalness: 1.0 },
  { name: 'Madeira', color: '#8b5a2b', roughness: 0.8, metalness: 0.0 },
  { name: 'Pedra', color: '#6e7681', roughness: 0.9, metalness: 0.1 },
  { name: 'Vidro', color: '#88ccff', roughness: 0.0, metalness: 0.0, opacity: 0.4 },
  { name: 'Ouro', color: '#ffd700', roughness: 0.15, metalness: 1.0 },
  { name: 'Cobre', color: '#b87333', roughness: 0.25, metalness: 1.0 },
  { name: 'Borracha', color: '#2a2a2a', roughness: 0.95, metalness: 0.0 },
  { name: 'Gelo', color: '#a0e0ff', roughness: 0.1, metalness: 0.2, opacity: 0.7 },
  { name: 'Neon', color: '#00ff00', roughness: 0.3, metalness: 0.0, emissive: '#00ff00', emissiveIntensity: 0.8 },
  { name: 'Holograma', color: '#00ffff', roughness: 0.0, metalness: 0.8, opacity: 0.5, emissive: '#00ffff', emissiveIntensity: 0.3 },
  { name: 'Carro', color: '#1a1a2e', roughness: 0.3, metalness: 0.9 },
]

export default function TexturingPanel({ onClose }) {
  const objects = useStore((s) => s.objects)
  const selectedId = useStore((s) => s.selectedId)
  const updateObject = useStore((s) => s.updateObject)
  const toast = useStore((s) => s.toast)

  const selected = objects.find((o) => o.id === selectedId)

  const [activeTab, setActiveTab] = useState('material')
  const [clipboard, setClipboard] = useState(null)
  const fileInputRef = useRef(null)
  const [textureSlot, setTextureSlot] = useState('map') // map | normalMap | roughnessMap | metalnessMap | emissiveMap

  // Texture Paint state
  const [brush, setBrush] = useState({ type: 'draw', color: '#ff0000', size: 30, strength: 0.5 })
  const [cloneSource, setCloneSource] = useState(null)
  const paintCanvasRef = useRef(null)
  const [paintPreview, setPaintPreview] = useState(null)

  // Procedural state
  const [procType, setProcType] = useState('noise')
  const [procParams, setProcParams] = useState({ scale: 4, color1: '#3a5a2a', color2: '#1a2a1a', octaves: 4 })

  // Inicializar canvas de pintura quando o tab é aberto
  useEffect(() => {
    if (activeTab === 'paint' && selected && !paintCanvasRef.current) {
      // Carregar textura existente ou criar nova
      if (selected.material?.map) {
        dataURLToCanvas(selected.material.map).then((c) => {
          paintCanvasRef.current = c
          setPaintPreview(canvasToDataURL(c))
        })
      } else {
        const c = createPaintCanvas(512)
        paintCanvasRef.current = c
        setPaintPreview(canvasToDataURL(c))
      }
    }
  }, [activeTab, selected])

  const BRUSH_TYPES = [
    { id: 'draw', label: 'Draw', icon: '✏️', desc: 'Pincel padrão para aplicar cor' },
    { id: 'soften', label: 'Soften', icon: 'wind', desc: 'Desfoca e suaviza transições' },
    { id: 'smudge', label: 'Smudge', icon: 'droplet', desc: 'Arrasta e mistura cores' },
    { id: 'clone', label: 'Clone', icon: '📎', desc: 'Copia padrão de uma área para outra' },
    { id: 'fill', label: 'Fill', icon: '🪣', desc: 'Balde de tinta para preencher áreas' },
    { id: 'mask', label: 'Mask', icon: '🚫', desc: 'Bloqueia áreas para não receber tinta' },
  ]

  const PROC_TYPES = [
    { id: 'noise', label: 'Noise', icon: 'gauge' },
    { id: 'voronoi', label: 'Voronoi', icon: 'puzzle' },
    { id: 'wave', label: 'Wave', icon: '〰️' },
    { id: 'marble', label: 'Marble', icon: 'building' },
    { id: 'wood', label: 'Wood', icon: '🪵' },
  ]

  // Simular pintura no canvas (o utilizador pinta no preview 2D)
  const handlePaintClick = (e) => {
    if (!paintCanvasRef.current) return
    const canvas = paintCanvasRef.current
    const ctx = canvas.getContext('2d')
    const rect = e.currentTarget.getBoundingClientRect()
    const u = (e.clientX - rect.left) / rect.width
    const v = (e.clientY - rect.top) / rect.height
    paintAtUV(ctx, u, v, { ...brush, cloneSource })
    setPaintPreview(canvasToDataURL(canvas))
  }

  const handlePaintDrag = (e) => {
    if (e.buttons !== 1) return // só pinta com botão pressionado
    handlePaintClick(e)
  }

  const savePaintTexture = () => {
    if (!paintCanvasRef.current || !selected) return
    const dataURL = canvasToDataURL(paintCanvasRef.current)
    setMat({ map: dataURL })
    toast('Textura pintada aplicada ao objeto', 'success')
  }

  const clearPaint = () => {
    if (!paintCanvasRef.current) return
    const c = createPaintCanvas(512)
    paintCanvasRef.current = c
    setPaintPreview(canvasToDataURL(c))
  }

  const setCloneSrc = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const u = (e.clientX - rect.left) / rect.width
    const v = (e.clientY - rect.top) / rect.height
    setCloneSource({ x: u, y: v })
    toast('Fonte de clone definida', 'info')
  }

  // Gerar textura procedural
  const generateProcedural = () => {
    const canvas = generateProceduralTexture(procType, procParams)
    const dataURL = canvasToDataURL(canvas)
    setMat({ map: dataURL })
    toast(`Textura procedural "${procType}" gerada e aplicada`, 'success')
  }

  const previewProcedural = () => {
    const canvas = generateProceduralTexture(procType, procParams)
    setPaintPreview(canvasToDataURL(canvas))
  }

  if (!selected) {
    return (
      <>
        <div className="drawer-backdrop show" onClick={onClose} />
        <aside className="texturing-panel open">
          <div className="panel-header">
            <span>Texturização</span>
            <button className="icon" onClick={onClose}><IconClose width={14} height={14} /></button>
          </div>
          <div className="panel-body">
            <div className="empty-state">
              <div style={{ fontSize: 32, opacity: 0.4 }}></div>
              <div className="mt-2">Seleciona um objeto para texturizar.</div>
            </div>
          </div>
        </aside>
      </>
    )
  }

  const mat = selected.material || {}
  const setMat = (patch) => {
    updateObject(selected.id, { material: { ...mat, ...patch } })
  }

  const handleTextureUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      setMat({ [textureSlot]: ev.target.result })
      toast(`Textura ${textureSlot} carregada`, 'success')
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const applyPreset = (preset) => {
    setMat({
      color: preset.color,
      roughness: preset.roughness,
      metalness: preset.metalness,
      opacity: preset.opacity ?? 1,
      emissive: preset.emissive || '#000000',
      emissiveIntensity: preset.emissiveIntensity || 0,
    })
    toast(`Material "${preset.name}" aplicado`, 'success')
  }

  const copyMaterial = () => {
    setClipboard({ ...mat })
    toast('Material copiado', 'info')
  }

  const pasteMaterial = () => {
    if (!clipboard) { toast('Sem material copiado', 'error'); return }
    updateObject(selected.id, { material: { ...clipboard } })
    toast('Material colado', 'success')
  }

  return (
    <>
      <div className="drawer-backdrop show" onClick={onClose} />
      <aside className="texturing-panel open">
        <div className="panel-header">
          <span>Texturização</span>
          <button className="icon" onClick={onClose}><IconClose width={14} height={14} /></button>
        </div>

        {/* Tabs compactas */}
        <div className="texturing-tabs">
          {TEX_TABS.map((t) => (
            <button
              key={t.id}
              className={`texturing-tab ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
            >
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        <div className="texturing-body">
          {/* Info do objeto */}
          <div className="texturing-obj-info">
            <strong>{selected.name}</strong>
            <span className="small muted"> · {selected.type}</span>
          </div>

          {/* TAB: Material PBR */}
          {activeTab === 'material' && (
            <>
              <div className="prop-row">
                <label>Cor base</label>
                <input type="color" value={mat.color || '#888888'} onChange={(e) => setMat({ color: e.target.value })} />
              </div>
              <div className="prop-row">
                <label>Roughness: {(mat.roughness ?? 0.7).toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.01" value={mat.roughness ?? 0.7}
                  onChange={(e) => setMat({ roughness: Number(e.target.value) })} />
              </div>
              <div className="prop-row">
                <label>Metalness: {(mat.metalness ?? 0).toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.01" value={mat.metalness ?? 0}
                  onChange={(e) => setMat({ metalness: Number(e.target.value) })} />
              </div>
              <div className="prop-row">
                <label>Opacidade: {(mat.opacity ?? 1).toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.01" value={mat.opacity ?? 1}
                  onChange={(e) => setMat({ opacity: Number(e.target.value) })} />
              </div>
              <div className="prop-row">
                <label>Emissive (cor)</label>
                <input type="color" value={mat.emissive || '#000000'} onChange={(e) => setMat({ emissive: e.target.value })} />
              </div>
              <div className="prop-row">
                <label>Emissive intensidade: {(mat.emissiveIntensity ?? 0).toFixed(2)}</label>
                <input type="range" min="0" max="2" step="0.05" value={mat.emissiveIntensity ?? 0}
                  onChange={(e) => setMat({ emissiveIntensity: Number(e.target.value) })} />
              </div>
              <div className="prop-row">
                <label>
                  <input type="checkbox" checked={mat.wireframe || false} onChange={(e) => setMat({ wireframe: e.target.checked })}
                    style={{ width: 'auto', display: 'inline-block', marginRight: 6 }} />
                  Wireframe
                </label>
              </div>
              <div className="prop-row">
                <label>
                  <input type="checkbox" checked={mat.flatShading || false} onChange={(e) => setMat({ flatShading: e.target.checked })}
                    style={{ width: 'auto', display: 'inline-block', marginRight: 6 }} />
                  Flat shading
                </label>
              </div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={copyMaterial} style={{ flex: 1 }}>Copiar</button>
                <button onClick={pasteMaterial} style={{ flex: 1 }}>Colar</button>
              </div>
            </>
          )}

          {/* TAB: Texturas */}
          {activeTab === 'textures' && (
            <>
              <div className="prop-row">
                <label>Slot de textura</label>
                <select value={textureSlot} onChange={(e) => setTextureSlot(e.target.value)}>
                  <option value="map">Difusa (cor)</option>
                  <option value="normalMap">Normal</option>
                  <option value="roughnessMap">Roughness</option>
                  <option value="metalnessMap">Metalness</option>
                  <option value="emissiveMap">Emissive</option>
                </select>
              </div>
              <div className="prop-row">
                <label>Carregar textura</label>
                <button onClick={() => fileInputRef.current?.click()} style={{ width: '100%' }}>Carregar {textureSlot === 'map' ? 'Difusa' : textureSlot === 'normalMap' ? 'Normal' : textureSlot}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleTextureUpload} />
              </div>
              {mat[textureSlot] && (
                <div className="prop-row">
                  <label>Preview</label>
                  <img src={mat[textureSlot]} alt="texture preview" style={{ width: '100%', borderRadius: 4, border: '1px solid var(--border)' }} />
                  <button className="danger" onClick={() => setMat({ [textureSlot]: null })} style={{ marginTop: 4, width: '100%' }}>
                    Remover textura
                  </button>
                </div>
              )}
              <div className="small muted mt-2">
                Dica: Para texturas seamless, usa UV tiling (aba UV) para repetir a textura.
              </div>
            </>
          )}

          {/* TAB: UV Tiling */}
          {activeTab === 'uv' && (
            <>
              <div className="prop-row">
                <label>Repeat X: {(mat.mapRepeat?.[0] ?? 1).toFixed(1)}</label>
                <input type="range" min="0.1" max="10" step="0.1" value={mat.mapRepeat?.[0] ?? 1}
                  onChange={(e) => setMat({ mapRepeat: [Number(e.target.value), mat.mapRepeat?.[1] ?? 1] })} />
              </div>
              <div className="prop-row">
                <label>Repeat Y: {(mat.mapRepeat?.[1] ?? 1).toFixed(1)}</label>
                <input type="range" min="0.1" max="10" step="0.1" value={mat.mapRepeat?.[1] ?? 1}
                  onChange={(e) => setMat({ mapRepeat: [mat.mapRepeat?.[0] ?? 1, Number(e.target.value)] })} />
              </div>
              <div className="prop-row">
                <label>Offset X: {(mat.mapOffset?.[0] ?? 0).toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.01" value={mat.mapOffset?.[0] ?? 0}
                  onChange={(e) => setMat({ mapOffset: [Number(e.target.value), mat.mapOffset?.[1] ?? 0] })} />
              </div>
              <div className="prop-row">
                <label>Offset Y: {(mat.mapOffset?.[1] ?? 0).toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.01" value={mat.mapOffset?.[1] ?? 0}
                  onChange={(e) => setMat({ mapOffset: [mat.mapOffset?.[0] ?? 0, Number(e.target.value)] })} />
              </div>
              <div className="prop-row">
                <label>Rotação UV: {((mat.mapRotation ?? 0) * 180 / Math.PI).toFixed(0)}°</label>
                <input type="range" min="0" max="6.28" step="0.01" value={mat.mapRotation ?? 0}
                  onChange={(e) => setMat({ mapRotation: Number(e.target.value) })} />
              </div>
              <button onClick={() => setMat({ mapRepeat: [1, 1], mapOffset: [0, 0], mapRotation: 0 })}
                style={{ width: '100%', marginTop: 8 }}>Resetar UV
              </button>
            </>
          )}

          {/* TAB: Texture Paint (Pintura direta) */}
          {activeTab === 'paint' && (
            <>
              <div className="small muted mb-2">
                Pinta diretamente na textura do modelo. Arrasta no preview para pintar.
              </div>

              {/* Tipos de pincel */}
              <div className="prop-row">
                <label>Pincel</label>
                <div className="tex-brush-grid">
                  {BRUSH_TYPES.map((b) => (
                    <button
                      key={b.id}
                      className={`tex-brush-btn ${brush.type === b.id ? 'active' : ''}`}
                      onClick={() => setBrush({ ...brush, type: b.id })}
                      title={b.desc}
                    >
                      <span style={{ fontSize: 16 }}>{b.icon}</span>
                      <span>{b.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Cor do pincel */}
              {brush.type !== 'mask' && brush.type !== 'soften' && brush.type !== 'smudge' && (
                <div className="prop-row">
                  <label>Cor</label>
                  <input type="color" value={brush.color} onChange={(e) => setBrush({ ...brush, color: e.target.value })} />
                </div>
              )}

              {/* Tamanho */}
              <div className="prop-row">
                <label>Tamanho: {brush.size}px</label>
                <input type="range" min="5" max="100" step="1" value={brush.size}
                  onChange={(e) => setBrush({ ...brush, size: Number(e.target.value) })} />
              </div>

              {/* Força */}
              <div className="prop-row">
                <label>Força: {brush.strength.toFixed(2)}</label>
                <input type="range" min="0.05" max="1" step="0.05" value={brush.strength}
                  onChange={(e) => setBrush({ ...brush, strength: Number(e.target.value) })} />
              </div>

              {/* Clone source */}
              {brush.type === 'clone' && (
                <div className="prop-row">
                  <label>Fonte do clone (clica no preview)</label>
                  <div className="small muted">
                    {cloneSource ? `Fonte: (${cloneSource.x.toFixed(2)}, ${cloneSource.y.toFixed(2)})` : 'Ainda não definida'}
                  </div>
                </div>
              )}

              {/* Preview de pintura */}
              <div className="prop-row">
                <label>Preview (pinta aqui)</label>
                <div
                  className="tex-paint-preview"
                  onMouseDown={brush.type === 'clone' && !cloneSource ? setCloneSrc : handlePaintClick}
                  onMouseMove={handlePaintDrag}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    backgroundImage: paintPreview ? `url(${paintPreview})` : 'none',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    border: '2px solid var(--accent)',
                    borderRadius: 'var(--radius-md)',
                    cursor: 'crosshair',
                    imageRendering: 'pixelated',
                  }}
                />
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={clearPaint} style={{ flex: 1 }}>🧹 Limpar</button>
                <button onClick={savePaintTexture} className="primary" style={{ flex: 1 }}>Aplicar ao objeto</button>
              </div>
            </>
          )}

          {/* TAB: Texturização Procedural */}
          {activeTab === 'procedural' && (
            <>
              <div className="small muted mb-2">
                Gera texturas matematicamente — sem imagens externas. Padrões infinitos.
              </div>

              {/* Tipo de textura procedural */}
              <div className="prop-row">
                <label>Tipo</label>
                <div className="tex-brush-grid">
                  {PROC_TYPES.map((p) => (
                    <button
                      key={p.id}
                      className={`tex-brush-btn ${procType === p.id ? 'active' : ''}`}
                      onClick={() => setProcType(p.id)}
                    >
                      <span style={{ fontSize: 16 }}>{p.icon}</span>
                      <span>{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Escala */}
              <div className="prop-row">
                <label>Escala: {procParams.scale}</label>
                <input type="range" min="1" max="20" step="1" value={procParams.scale}
                  onChange={(e) => setProcParams({ ...procParams, scale: Number(e.target.value) })} />
              </div>

              {/* Oitavas (apenas noise/marble/wood) */}
              {(procType === 'noise' || procType === 'marble' || procType === 'wood') && (
                <div className="prop-row">
                  <label>Oitavas: {procParams.octaves}</label>
                  <input type="range" min="1" max="8" step="1" value={procParams.octaves}
                    onChange={(e) => setProcParams({ ...procParams, octaves: Number(e.target.value) })} />
                </div>
              )}

              {/* Cor 1 */}
              <div className="prop-row">
                <label>Cor 1 (escuro)</label>
                <input type="color" value={procParams.color1} onChange={(e) => setProcParams({ ...procParams, color1: e.target.value })} />
              </div>

              {/* Cor 2 */}
              <div className="prop-row">
                <label>Cor 2 (claro)</label>
                <input type="color" value={procParams.color2} onChange={(e) => setProcParams({ ...procParams, color2: e.target.value })} />
              </div>

              {/* Preview */}
              <div className="prop-row">
                <label>Preview</label>
                <div
                  className="tex-proc-preview"
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    backgroundImage: paintPreview ? `url(${paintPreview})` : 'none',
                    backgroundSize: 'cover',
                    border: '2px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                  }}
                />
              </div>

              {/* Ações */}
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={previewProcedural} style={{ flex: 1 }}>👁️ Preview</button>
                <button onClick={generateProcedural} className="primary" style={{ flex: 1 }}>Gerar e Aplicar</button>
              </div>

              <div className="small muted mt-2">
                <strong>Dica:</strong> Usa Noise para sujeira/desgaste, Voronoi para células/escamas,
                Wave para padrões regulares, Marble para veios de mármore, Wood para anéis de madeira.
                Combina com ColorRamp para gradients de cor mais complexos.
              </div>
            </>
          )}

          {/* TAB: Biblioteca */}
          {activeTab === 'library' && (
            <>
              <div className="small muted mb-2">Clica num material para aplicar ao objeto selecionado.</div>
              <div className="tex-presets-grid">
                {MATERIAL_PRESETS.map((preset) => (
                  <button
                    key={preset.name}
                    className="tex-preset-btn"
                    onClick={() => applyPreset(preset)}
                    title={preset.name}
                  >
                    <div className="tex-preset-swatch" style={{
                      background: preset.color,
                      opacity: preset.opacity ?? 1,
                      boxShadow: preset.emissive ? `0 0 8px ${preset.emissive}` : 'none',
                    }} />
                    <span>{preset.name}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  )
}

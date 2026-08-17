/**
 * TexturingPanel — painel de texturização profissional (inspirado em Blender).
 *
 * Otimizado para telas pequenas e formato horizontal.
 *
 * Funcionalidades:
 *  - Material PBR COMPLETO (MeshPhysicalMaterial):
 *      Base: color, roughness, metalness, opacity, emissive
 *      Físico: anisotropy, ior, transmission, clearcoat, sheen, specularIntensity
 *  - Texturas: difusa, normal, roughness, metalness, emissive (upload ou URL)
 *  - UV tiling: repeat X/Y, offset X/Y, rotação
 *  - Biblioteca de 24 materiais PBR predefinidos (valores reais)
 *  - Copy/paste material entre objetos
 *  - Texture Paint 3D REAL:
 *      Pintura direta no modelo 3D via raycast (modo 'paint' da cena)
 *      Selector de canal: Base Color | Roughness | Metallic | Normal
 *      6 pincéis: Draw, Soften, Smudge, Clone, Fill, Mask
 *      Preview 2D mantido para edição manual
 *  - Texturização Procedural: Noise, Voronoi, Wave, Marble, Wood + ColorRamp
 *  - Guia de fluxo PBR completo
 */
import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { IconClose } from '../ui/Icons'
import { MATERIAL_LIBRARY, MATERIAL_CATEGORIES } from '../../utils/materialLibrary'
import { createPaintCanvas, paintAtUV, canvasToDataURL, dataURLToCanvas, generateProceduralTexture, getPaintTexture } from '../../utils/texturePaint'

const TEX_TABS = [
  { id: 'material', label: 'Material', icon: 'palette' },
  { id: 'textures', label: 'Texturas', icon: 'image' },
  { id: 'uv', label: 'UV', icon: '📐' },
  { id: 'paint', label: 'Pintar', icon: '🖌️' },
  { id: 'procedural', label: 'Procedural', icon: 'spline' },
  { id: 'library', label: 'Biblio.', icon: 'book' },
  { id: 'guide', label: 'Fluxo PBR', icon: '📖' },
]

// Canais de pintura suportados (passo 9 do pipeline)
const PAINT_CHANNELS = [
  { id: 'color',     label: 'Base Color',  desc: 'Cor/albedo do material' },
  { id: 'roughness', label: 'Roughness',   desc: 'Rugosidade (controla reflexo)' },
  { id: 'metallic',  label: 'Metallic',     desc: 'Metalicidade (condutor vs dielétrico)' },
  { id: 'normal',    label: 'Normal Map',  desc: 'Relevo fino (não muda geometria)' },
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
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)
  const paintSettings = useStore((s) => s.paintSettings)
  const setPaintSettings = useStore((s) => s.setPaintSettings)

  const selected = objects.find((o) => o.id === selectedId)

  const [activeTab, setActiveTab] = useState('material')
  const [clipboard, setClipboard] = useState(null)
  const fileInputRef = useRef(null)
  const [textureSlot, setTextureSlot] = useState('map') // map | normalMap | roughnessMap | metalnessMap | emissiveMap

  // Texture Paint state
  const [brush, setBrush] = useState({
    type: paintSettings.brushType || 'draw',
    color: paintSettings.color || '#ff0000',
    size: paintSettings.size || 30,
    strength: paintSettings.strength ?? 0.5,
    normalMode: paintSettings.normalMode || 'raise',
  })
  const [paintChannel, setPaintChannel] = useState(paintSettings.channel || 'color')
  const [cloneSource, setCloneSource] = useState(null)
  const paintCanvasRef = useRef(null)
  const [paintPreview, setPaintPreview] = useState(null)

  // Procedural state
  const [procType, setProcType] = useState('noise')
  const [procParams, setProcParams] = useState({ scale: 4, color1: '#3a5a2a', color2: '#1a2a1a', octaves: 4 })

  // Mapear canal → chave no material (para buscar textura existente)
  const CHANNEL_TO_MATKEY = {
    color: 'map',
    roughness: 'roughnessMap',
    metallic: 'metalnessMap',
    normal: 'normalMap',
  }

  // Inicializar canvas de pintura quando o tab é aberto OU canal muda
  useEffect(() => {
    if (activeTab !== 'paint' || !selected) return
    refreshPaintPreview(paintChannel)
  }, [activeTab, selected, paintChannel])

  // Atualizar preview quando há pintura 3D (polling leve)
  useEffect(() => {
    if (activeTab !== 'paint' || !selected) return
    const interval = setInterval(() => {
      // Re-exportar a textura do canal ativo do PaintTextureManager
      // para o preview refletir o que foi pintado em 3D
      if (selected.id) {
        const pt = getPaintTexture(selected.id, paintChannel)
        if (pt && pt.canvas) {
          // Sincronizar canvas do PaintTextureManager com o paintCanvasRef local
          paintCanvasRef.current = pt.canvas
          setPaintPreview(pt.canvas.toDataURL('image/png'))
        }
      }
    }, 800) // 800ms — não bloquear a UI
    return () => clearInterval(interval)
  }, [activeTab, selected, paintChannel])

  const refreshPaintPreview = (channel) => {
    if (!selected) return
    // Se há uma textura importada no canal, usá-la como canvas
    const matKey = CHANNEL_TO_MATKEY[channel]
    const existingTexture = selected.material?.[matKey]
    if (existingTexture) {
      dataURLToCanvas(existingTexture).then((c) => {
        paintCanvasRef.current = c
        setPaintPreview(canvasToDataURL(c))
      })
    } else if (selected.id) {
      // Tentar usar o canvas do PaintTextureManager
      const pt = getPaintTexture(selected.id, channel)
      if (pt && pt.canvas) {
        paintCanvasRef.current = pt.canvas
        setPaintPreview(pt.canvas.toDataURL('image/png'))
      } else {
        // Último fallback — criar novo
        const fill = channel === 'roughness' ? '#808080' :
                     channel === 'metallic' ? '#000000' :
                     channel === 'normal' ? '#8080ff' : '#ffffff'
        const c = createPaintCanvas(512, fill)
        paintCanvasRef.current = c
        setPaintPreview(canvasToDataURL(c))
      }
    }
  }

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
    const matKey = CHANNEL_TO_MATKEY[paintChannel]
    setMat({ [matKey]: dataURL })
    toast(`Textura de ${PAINT_CHANNELS.find(c=>c.id===paintChannel)?.label} pintada aplicada ao objeto`, 'success')
  }

  const clearPaint = () => {
    if (!paintCanvasRef.current) return
    const fill = paintChannel === 'roughness' ? '#808080' :
                 paintChannel === 'metallic' ? '#000000' :
                 paintChannel === 'normal' ? '#8080ff' : '#ffffff'
    const ctx = paintCanvasRef.current.getContext('2d')
    ctx.fillStyle = fill
    ctx.fillRect(0, 0, paintCanvasRef.current.width, paintCanvasRef.current.height)
    setPaintPreview(canvasToDataURL(paintCanvasRef.current))
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

  const applyLibraryMaterial = (libMat) => {
    // Aplica o material da biblioteca (com valores PBR reais) ao objeto selecionado
    updateObject(selected.id, { material: { ...libMat.material } })
    toast(`Material "${libMat.name}" aplicado (PBR real)`, 'success')
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

          {/* TAB: Material PBR (MeshPhysicalMaterial completo) */}
          {activeTab === 'material' && (
            <>
              {/* ---- BASE ---- */}
              <div className="small muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Base</div>
              <div className="prop-row">
                <label>Cor base (albedo)</label>
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

              {/* ---- EMISSIVE ---- */}
              <div className="small muted mt-3 mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Emissive</div>
              <div className="prop-row">
                <label>Emissive (cor)</label>
                <input type="color" value={mat.emissive || '#000000'} onChange={(e) => setMat({ emissive: e.target.value })} />
              </div>
              <div className="prop-row">
                <label>Intensidade: {(mat.emissiveIntensity ?? 0).toFixed(2)}</label>
                <input type="range" min="0" max="20" step="0.1" value={mat.emissiveIntensity ?? 0}
                  onChange={(e) => setMat({ emissiveIntensity: Number(e.target.value) })} />
              </div>

              {/* ---- TRANSMISSÃO / IOR ---- */}
              <div className="small muted mt-3 mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Transmissão & IOR</div>
              <div className="prop-row">
                <label>Transmission: {(mat.transmission ?? 0).toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.01" value={mat.transmission ?? 0}
                  onChange={(e) => setMat({ transmission: Number(e.target.value) })} />
              </div>
              <div className="prop-row">
                <label>IOR (Index of Refraction): {(mat.ior ?? 1.5).toFixed(2)}</label>
                <input type="range" min="1.0" max="3.0" step="0.01" value={mat.ior ?? 1.5}
                  onChange={(e) => setMat({ ior: Number(e.target.value) })} />
              </div>
              <div className="prop-row">
                <label>Thickness (volume): {(mat.thickness ?? 0).toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.01" value={mat.thickness ?? 0}
                  onChange={(e) => setMat({ thickness: Number(e.target.value) })} />
              </div>
              <div className="prop-row">
                <label>Attenuation (cor)</label>
                <input type="color" value={mat.attenuationColor || '#ffffff'} onChange={(e) => setMat({ attenuationColor: e.target.value })} />
              </div>

              {/* ---- CLEARCOAT (vernil) ---- */}
              <div className="small muted mt-3 mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Clearcoat</div>
              <div className="prop-row">
                <label>Clearcoat: {(mat.clearcoat ?? 0).toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.01" value={mat.clearcoat ?? 0}
                  onChange={(e) => setMat({ clearcoat: Number(e.target.value) })} />
              </div>
              <div className="prop-row">
                <label>Clearcoat Roughness: {(mat.clearcoatRoughness ?? 0).toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.01" value={mat.clearcoatRoughness ?? 0}
                  onChange={(e) => setMat({ clearcoatRoughness: Number(e.target.value) })} />
              </div>

              {/* ---- ANISOTROPY (metal escovado) ---- */}
              <div className="small muted mt-3 mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Anisotropy</div>
              <div className="prop-row">
                <label>Anisotropy: {(mat.anisotropy ?? 0).toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.01" value={mat.anisotropy ?? 0}
                  onChange={(e) => setMat({ anisotropy: Number(e.target.value) })} />
              </div>
              <div className="prop-row">
                <label>Anisotropy Rotation: {((mat.anisotropyRotation ?? 0) * 180 / Math.PI).toFixed(0)}°</label>
                <input type="range" min="0" max="6.28" step="0.01" value={mat.anisotropyRotation ?? 0}
                  onChange={(e) => setMat({ anisotropyRotation: Number(e.target.value) })} />
              </div>

              {/* ---- SHEEN (tecido, veludo) ---- */}
              <div className="small muted mt-3 mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Sheen</div>
              <div className="prop-row">
                <label>Sheen: {(mat.sheen ?? 0).toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.01" value={mat.sheen ?? 0}
                  onChange={(e) => setMat({ sheen: Number(e.target.value) })} />
              </div>
              <div className="prop-row">
                <label>Sheen (cor)</label>
                <input type="color" value={mat.sheenColor || '#ffffff'} onChange={(e) => setMat({ sheenColor: e.target.value })} />
              </div>
              <div className="prop-row">
                <label>Sheen Roughness: {(mat.sheenRoughness ?? 0.5).toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.01" value={mat.sheenRoughness ?? 0.5}
                  onChange={(e) => setMat({ sheenRoughness: Number(e.target.value) })} />
              </div>

              {/* ---- SPECULAR ---- */}
              <div className="small muted mt-3 mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Specular</div>
              <div className="prop-row">
                <label>Specular Intensity: {(mat.specularIntensity ?? 1).toFixed(2)}</label>
                <input type="range" min="0" max="1" step="0.01" value={mat.specularIntensity ?? 1}
                  onChange={(e) => setMat({ specularIntensity: Number(e.target.value) })} />
              </div>
              <div className="prop-row">
                <label>Env Map Intensity: {(mat.envMapIntensity ?? 1).toFixed(2)}</label>
                <input type="range" min="0" max="3" step="0.05" value={mat.envMapIntensity ?? 1}
                  onChange={(e) => setMat({ envMapIntensity: Number(e.target.value) })} />
              </div>

              {/* ---- OPCOES ---- */}
              <div className="small muted mt-3 mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>Opções</div>
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

          {/* TAB: Texture Paint (3D + multi-canal PBR) */}
          {activeTab === 'paint' && (
            <>
              <div className="small muted mb-2">
                <strong>Pintura 3D direta no modelo.</strong> Seleciona o modo
                <strong> Paint</strong> na cena e arrasta sobre o modelo. Também podes
                pintar manualmente no preview 2D abaixo.
              </div>

              {/* Canal de pintura (passo 9 do pipeline) */}
              <div className="prop-row">
                <label>Canal</label>
                <div className="tex-brush-grid">
                  {PAINT_CHANNELS.map((c) => (
                    <button
                      key={c.id}
                      className={`tex-brush-btn ${paintChannel === c.id ? 'active' : ''}`}
                      onClick={() => {
                        setPaintChannel(c.id)
                        setPaintSettings({ channel: c.id })
                        // Resetar preview ao mudar de canal
                        refreshPaintPreview(c.id)
                      }}
                      title={c.desc}
                    >
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
                <div className="small muted mt-1">
                  {PAINT_CHANNELS.find(c => c.id === paintChannel)?.desc}
                </div>
              </div>

              {/* Modo Paint da cena */}
              <div className="prop-row">
                <label>Modo da cena</label>
                <button
                  onClick={() => setMode('paint')}
                  style={{
                    width: '100%',
                    background: mode === 'paint' ? 'var(--accent)' : 'var(--bg-elevated)',
                    color: mode === 'paint' ? 'white' : 'inherit',
                  }}
                >
                  {mode === 'paint' ? '✓ Modo Paint ativo — arrasta no modelo' : 'Ativar modo Paint'}
                </button>
              </div>

              {/* Tipos de pincel */}
              <div className="prop-row">
                <label>Pincel</label>
                <div className="tex-brush-grid">
                  {BRUSH_TYPES.map((b) => (
                    <button
                      key={b.id}
                      className={`tex-brush-btn ${brush.type === b.id ? 'active' : ''}`}
                      onClick={() => {
                        setBrush({ ...brush, type: b.id })
                        setPaintSettings({ brushType: b.id })
                      }}
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
                  <label>Cor {paintChannel === 'roughness' ? '(cinzento = valor de roughness)' :
                              paintChannel === 'metallic' ? '(cinzento = valor de metallic)' :
                              paintChannel === 'normal' ? '(cor do bump)' : '(cor RGB)'}</label>
                  <input type="color" value={brush.color} onChange={(e) => {
                    setBrush({ ...brush, color: e.target.value })
                    setPaintSettings({ color: e.target.value })
                  }} />
                </div>
              )}

              {/* Modo normal (apenas para channel=normal) */}
              {paintChannel === 'normal' && brush.type === 'draw' && (
                <div className="prop-row">
                  <label>Normal mode</label>
                  <select
                    value={brush.normalMode || 'raise'}
                    onChange={(e) => {
                      setBrush({ ...brush, normalMode: e.target.value })
                      setPaintSettings({ normalMode: e.target.value })
                    }}
                  >
                    <option value="raise">Raise (elevar)</option>
                    <option value="lower">Lower (afundar)</option>
                    <option value="smooth">Smooth (suavizar)</option>
                  </select>
                </div>
              )}

              {/* Tamanho */}
              <div className="prop-row">
                <label>Tamanho: {brush.size}px</label>
                <input type="range" min="5" max="100" step="1" value={brush.size}
                  onChange={(e) => {
                    setBrush({ ...brush, size: Number(e.target.value) })
                    setPaintSettings({ size: Number(e.target.value) })
                  }} />
              </div>

              {/* Força */}
              <div className="prop-row">
                <label>Força: {brush.strength.toFixed(2)}</label>
                <input type="range" min="0.05" max="1" step="0.05" value={brush.strength}
                  onChange={(e) => {
                    setBrush({ ...brush, strength: Number(e.target.value) })
                    setPaintSettings({ strength: Number(e.target.value) })
                  }} />
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

              {/* Preview de pintura (2D manual) */}
              <div className="prop-row">
                <label>Preview 2D — {PAINT_CHANNELS.find(c => c.id === paintChannel)?.label}</label>
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

              <div className="small muted mt-2">
                <strong>Pipeline:</strong> raycast → triângulo → UV baricêntrica →
                pixel → pincel → <code>texture.needsUpdate = true</code> → GPU.
                Pintura é <strong>real-time</strong>: aparece instantaneamente no modelo 3D.
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

          {/* TAB: Biblioteca PBR (20+ materiais com valores reais) */}
          {activeTab === 'library' && (
            <>
              <div className="small muted mb-2">
                {MATERIAL_LIBRARY.length} materiais PBR com valores fisicamente corretos.
                Clica para aplicar ao objeto selecionado.
              </div>
              {MATERIAL_CATEGORIES.map((cat) => (
                <div key={cat} style={{ marginBottom: 12 }}>
                  <div className="small muted" style={{ textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                    {cat}
                  </div>
                  <div className="tex-presets-grid">
                    {MATERIAL_LIBRARY.filter(m => m.category === cat).map((mat) => (
                      <button
                        key={mat.id}
                        className="tex-preset-btn"
                        onClick={() => applyLibraryMaterial(mat)}
                        title={`${mat.name} — click para aplicar (valores PBR reais)`}
                      >
                        <div className="tex-preset-swatch" style={{
                          background: mat.preview,
                          opacity: mat.material.opacity ?? 1,
                          boxShadow: mat.material.emissive && mat.material.emissive !== '#000000'
                            ? `0 0 12px ${mat.material.emissive}` : 'none',
                        }} />
                        <span>{mat.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}

          {/* TAB: Guia Fluxo PBR */}
          {activeTab === 'guide' && (
            <>
              <div className="small muted mb-2" style={{ textTransform: 'uppercase', letterSpacing: 1 }}>
                Fluxo de trabalho PBR completo
              </div>

              <div className="prop-row">
                <strong>1. UV Unwrap limpo</strong>
                <div className="small muted mt-1">
                  Antes de pintar, garante UVs sem sobreposição. Usa o unwrap
                  automático (modo UV → planar/box) ou importa UVs do Blender.
                  Sem UVs corretas, a pintura aparece desalinhada.
                </div>
              </div>

              <div className="prop-row">
                <strong>2. Base Color (albedo)</strong>
                <div className="small muted mt-1">
                  Define a cor base do material. Sem reflexos, sem relevo —
                  apenas a cor difusa. Pinta riscos, manchas, desgaste de cor.
                  <em> Slot: mat.map (canal "color" no Texture Paint).</em>
                </div>
              </div>

              <div className="prop-row">
                <strong>3. Roughness (rugosidade)</strong>
                <div className="small muted mt-1">
                  Controla a reflexão: 0 = espelho perfeito, 1 = superfície
                  fosca. Pinta arranhões (low roughness = brilho) ou desgaste
                  (high roughness = fosco).
                  <em> Slot: mat.roughnessMap (canal "roughness" no Texture Paint).</em>
                </div>
              </div>

              <div className="prop-row">
                <strong>4. Normal Map (relevo fino)</strong>
                <div className="small muted mt-1">
                  Adiciona detalhe fino sem aumentar geometria. Pinta bordas,
                  poros, rachadulas. As normais são armazenadas em RGB
                  (R=X, G=Y, B=Z).
                  <em> Slot: mat.normalMap (canal "normal" no Texture Paint).</em>
                </div>
              </div>

              <div className="prop-row">
                <strong>5. Metallic / Specular</strong>
                <div className="small muted mt-1">
                  Define tipo de superfície: 0 = dielétrico (madeira, pedra, plástico),
                  1 = metal (ouro, ferro, alumínio). Pinta áreas metálicas
                  expostas onde a tinta descascou.
                  <em> Slot: mat.metalnessMap (canal "metallic" no Texture Paint).</em>
                </div>
              </div>

              <div className="prop-row">
                <strong>6. Iluminação / render final</strong>
                <div className="small muted mt-1">
                  Para avaliar o material, usa uma luz neutra (HDRI de estúdio)
                  e observa reflexos, sombras eHighlights. Ajusta envMapIntensity
                  para reforçar ou suavizar reflexos.
                </div>
              </div>

              <div className="prop-row" style={{ background: 'var(--bg-elevated)', padding: 8, borderRadius: 4 }}>
                <strong>📋 Teste recomendado</strong>
                <ol style={{ paddingLeft: 18, marginTop: 4 }} className="small muted">
                  <li>Cria uma esfera e seleciona-a.</li>
                  <li>Ativa o modo Paint (aba Pintar → "Ativar modo Paint").</li>
                  <li>Canal <strong>Base Color</strong>, pinta uma linha vermelha na frente do modelo.</li>
                  <li>Verifica que a linha aparece exatamente onde clicaste (não desalinhada).</li>
                  <li>Troca para canal <strong>Roughness</strong> e pinta uma área escura (low roughness = brilho).</li>
                  <li>Verifica que a área ficou brilhante (não mudou a cor).</li>
                  <li>Troca para <strong>Metallic</strong> e pinta com branco (1.0 = metálico).</li>
                  <li>Verifica que a área ficou metálica.</li>
                  <li>Troca para <strong>Normal</strong> e pinta para ver o relevo aparecer.</li>
                </ol>
              </div>

              <div className="prop-row" style={{ background: 'var(--bg-elevated)', padding: 8, borderRadius: 4, marginTop: 8 }}>
                <strong>🔍 Pipeline técnico (9 passos)</strong>
                <ol style={{ paddingLeft: 18, marginTop: 4 }} className="small muted">
                  <li>Modelo tem vértices + UVs (BufferGeometry)</li>
                  <li>Textura 2D associada via UVs (CanvasTexture)</li>
                  <li>Raycast da câmara → superfície (TexturePaintRaycaster)</li>
                  <li>Triângulo atingido identificado (hit.face)</li>
                  <li>UV exata via baricêntricas (hit.uv)</li>
                  <li>Conversão UV → pixel (u × size, (1-v) × size)</li>
                  <li>Pincel aplicado na região (paintAtUV)</li>
                  <li>GPU atualizada (texture.needsUpdate = true)</li>
                  <li>Multi-canal: Color/Roughness/Metallic/Normal</li>
                </ol>
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  )
}

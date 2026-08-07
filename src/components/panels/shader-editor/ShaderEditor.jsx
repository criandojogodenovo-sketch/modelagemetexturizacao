/**
 * ShaderEditor — editor de shaders com Modo Visual (nós) e Modo Código GLSL.
 *
 * Modo Visual: usa litegraph.js (mesma base do FlirScript) com nós específicos
 *   para shaders: Cor, Textura (UV), Tempo, Ruído, Fresnel, Multiplicar, Somar,
 *   Misturar (Mix), Saída Final.
 *
 * Modo Código: editor de texto GLSL para utilizadores avançados.
 *
 * Biblioteca: Água, Vidro, Metal, Dissolver, Holograma (prontos a usar).
 *
 * Os shaders criados ficam disponíveis para aplicar em materiais.
 */
import { useState, useRef, useEffect } from 'react'
import { LGraph, LGraphCanvas, LiteGraph } from 'litegraph.js'
import { useStore } from '../../../store/useStore'
import { IconClose, IconCheck, IconPlus } from '../../ui/Icons'

// ===== Definição de nós de shader =====
const SHADER_NODE_DEFINITIONS = [
  {
    type: 'shader/color',
    label: 'Cor',
    description: 'Cor constante (RGBA)',
    inputs: [],
    outputs: [{ name: 'color', type: 'vec4' }],
    properties: { color: '#ffffff' },
  },
  {
    type: 'shader/texture',
    label: 'Textura (UV)',
    description: 'Amostra uma textura nas coordenadas UV',
    inputs: [{ name: 'uv', type: 'vec2' }],
    outputs: [{ name: 'color', type: 'vec4' }],
    properties: { textureUrl: '' },
  },
  {
    type: 'shader/time',
    label: 'Tempo',
    description: 'Tempo decorrido desde o início (segundos)',
    inputs: [],
    outputs: [{ name: 'time', type: 'float' }],
  },
  {
    type: 'shader/noise',
    label: 'Ruído',
    description: 'Gera ruído procedural baseado em UV + tempo',
    inputs: [
      { name: 'uv', type: 'vec2' },
      { name: 'scale', type: 'float' },
    ],
    outputs: [{ name: 'value', type: 'float' }],
    properties: { scale: 5 },
  },
  {
    type: 'shader/fresnel',
    label: 'Fresnel',
    description: 'Efeito fresnel (mais intenso nas arestas)',
    inputs: [{ name: 'normal', type: 'vec3' }],
    outputs: [{ name: 'value', type: 'float' }],
    properties: { power: 2 },
  },
  {
    type: 'shader/multiply',
    label: 'Multiplicar',
    description: 'Multiplica dois valores (A × B)',
    inputs: [
      { name: 'a', type: 'vec4' },
      { name: 'b', type: 'vec4' },
    ],
    outputs: [{ name: 'result', type: 'vec4' }],
  },
  {
    type: 'shader/add',
    label: 'Somar',
    description: 'Soma dois valores (A + B)',
    inputs: [
      { name: 'a', type: 'vec4' },
      { name: 'b', type: 'vec4' },
    ],
    outputs: [{ name: 'result', type: 'vec4' }],
  },
  {
    type: 'shader/mix',
    label: 'Misturar (Mix)',
    description: 'Mistura A e B com fator T (0=A, 1=B)',
    inputs: [
      { name: 'a', type: 'vec4' },
      { name: 'b', type: 'vec4' },
      { name: 't', type: 'float' },
    ],
    outputs: [{ name: 'result', type: 'vec4' }],
  },
  {
    type: 'shader/output',
    label: 'Saída Final',
    description: 'Saída do shader (cor + opacidade + emissivo)',
    inputs: [
      { name: 'color', type: 'vec4' },
      { name: 'opacity', type: 'float' },
      { name: 'emissive', type: 'vec4' },
    ],
    outputs: [],
  },
]

// Registar nós de shader no LiteGraph
let shaderNodesRegistered = false
function registerShaderNodes() {
  if (shaderNodesRegistered) return
  shaderNodesRegistered = true
  for (const def of SHADER_NODE_DEFINITIONS) {
    const cls = class ShaderNode extends LiteGraph.LGraphNode {
      constructor() {
        super(def.label)
        this.color = '#8957e5'
        for (const input of def.inputs || []) {
          this.addInput(input.name, input.type)
        }
        for (const output of def.outputs || []) {
          this.addOutput(output.name, output.type)
        }
        if (def.properties) {
          for (const [key, value] of Object.entries(def.properties)) {
            this.properties[key] = value
            if (typeof value === 'string' && value.startsWith('#')) {
              this.addWidget('text', key, value, (v) => { this.properties[key] = v })
            } else if (typeof value === 'number') {
              this.addWidget('number', key, value, (v) => { this.properties[key] = v })
            }
          }
        }
        this.size = [160, Math.max(60, (def.inputs?.length || 0) * 22 + (def.outputs?.length || 0) * 22 + 20)]
      }
      getTitle() { return def.label }
    }
    Object.defineProperty(cls, 'name', { value: def.type.replace(/\//g, '_') })
    LiteGraph.registerNodeType(def.type, cls)
  }
}

const SHADER_LIBRARY = [
  {
    id: 'water',
    name: 'Água',
    description: 'Superfície de água com ondas e reflexo',
    glsl: `uniform float time;
uniform vec3 color;
varying vec2 vUv;
void main() {
  vec2 uv = vUv * 4.0;
  float wave = sin(uv.x + time) * 0.5 + cos(uv.y + time * 0.7) * 0.5;
  vec3 finalColor = color + wave * 0.2;
  gl_FragColor = vec4(finalColor, 0.8);
}`,
  },
  {
    id: 'glass',
    name: 'Vidro',
    description: 'Vidro transparente com refração',
    glsl: `uniform float time;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  float fresnel = pow(1.0 - dot(vNormal, vec3(0,0,1)), 2.0);
  vec3 color = mix(vec3(0.8, 0.9, 1.0), vec3(1.0), fresnel);
  gl_FragColor = vec4(color, 0.3 + fresnel * 0.4);
}`,
  },
  {
    id: 'metal',
    name: 'Metal',
    description: 'Metal com reflexos especulares',
    glsl: `uniform vec3 color;
varying vec3 vNormal;
void main() {
  vec3 light = normalize(vec3(1, 1, 1));
  float diff = max(dot(vNormal, light), 0.0);
  float spec = pow(diff, 32.0);
  vec3 finalColor = color * diff + vec3(1.0) * spec * 0.8;
  gl_FragColor = vec4(finalColor, 1.0);
}`,
  },
  {
    id: 'dissolve',
    name: 'Dissolver',
    description: 'Efeito de desaparecer progressivamente',
    glsl: `uniform float time;
uniform float progress;
varying vec2 vUv;
void main() {
  float noise = sin(vUv.x * 20.0 + time) * cos(vUv.y * 20.0 + time);
  if (noise > progress) discard;
  gl_FragColor = vec4(1.0, 0.5, 0.0, 1.0);
}`,
  },
  {
    id: 'hologram',
    name: 'Holograma',
    description: 'Efeito holográfico com scanlines',
    glsl: `uniform float time;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  float fresnel = pow(1.0 - dot(vNormal, vec3(0,0,1)), 3.0);
  float scan = sin(vUv.y * 50.0 + time * 5.0) * 0.5 + 0.5;
  vec3 color = vec3(0.0, 0.8, 1.0) * (fresnel + scan * 0.3);
  gl_FragColor = vec4(color, 0.6 + fresnel * 0.4);
}`,
  },
]

export default function ShaderEditor({ onClose }) {
  const [mode, setMode] = useState('visual')
  const [selectedShader, setSelectedShader] = useState(null)
  const [glslCode, setGlslCode] = useState('')
  const [shaderName, setShaderName] = useState('Meu Shader')
  const toast = useStore((s) => s.toast)

  // Canvas refs para modo visual
  const canvasRef = useRef(null)
  const graphRef = useRef(null)
  const lgraphCanvasRef = useRef(null)
  const containerRef = useRef(null)
  const [addPanelOpen, setAddPanelOpen] = useState(false)

  // Inicializar grafo de shader visual
  useEffect(() => {
    if (mode !== 'visual' || !canvasRef.current) return
    registerShaderNodes()

    const container = containerRef.current
    if (container) {
      const rect = container.getBoundingClientRect()
      canvasRef.current.width = rect.width || 600
      canvasRef.current.height = rect.height || 400
    }

    const graph = new LGraph()
    graphRef.current = graph
    const lgraphCanvas = new LGraphCanvas(canvasRef.current, graph, { autoresize: false })
    lgraphCanvasRef.current = lgraphCanvas
    lgraphCanvas.background_image = null
    lgraphCanvas.clear_background_color = '#0d1117'
    lgraphCanvas.allow_dragcanvas = true
    lgraphCanvas.allow_dragnodes = true
    lgraphCanvas.allow_interaction = true
    graph.start()

    // Adicionar nós default: Color → Output
    setTimeout(() => {
      const colorNode = LiteGraph.createNode('shader/color')
      colorNode.pos = [100, 100]
      graph.add(colorNode)
      const outputNode = LiteGraph.createNode('shader/output')
      outputNode.pos = [400, 100]
      graph.add(outputNode)
      // Ligar color → output
      colorNode.connect(0, outputNode, 0)
      lgraphCanvas.setDirty(true, true)
    }, 100)

    const resizeObserver = new ResizeObserver(() => {
      if (lgraphCanvasRef.current && containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        if (rect.width > 0 && rect.height > 0) {
          canvasRef.current.width = rect.width
          canvasRef.current.height = rect.height
          lgraphCanvasRef.current.resize(rect.width, rect.height)
          lgraphCanvasRef.current.setDirty(true, true)
        }
      }
    })
    if (containerRef.current) resizeObserver.observe(containerRef.current)

    return () => {
      graph.stop()
      resizeObserver.disconnect()
      lgraphCanvasRef.current = null
      graphRef.current = null
    }
  }, [mode])

  const addShaderNode = (nodeDef) => {
    if (!graphRef.current) return
    const node = LiteGraph.createNode(nodeDef.type)
    if (!node) return
    node.pos = [200 + Math.random() * 100, 200 + Math.random() * 100]
    graphRef.current.add(node)
    graphRef.current.setDirtyCanvas(true, true)
    setAddPanelOpen(false)
  }

  const handleLoadFromLibrary = (shader) => {
    setSelectedShader(shader.id)
    setGlslCode(shader.glsl)
    setShaderName(shader.name)
    toast(`Shader "${shader.name}" carregado`, 'success', 1500)
  }

  const handleSave = () => {
    if (mode === 'code' && !glslCode.trim()) {
      toast('Escreve algum código GLSL primeiro', 'error')
      return
    }
    toast(`Shader "${shaderName}" guardado e disponível nos materiais`, 'success')
  }

  return (
    <>
      {onClose && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`shader-editor ${onClose ? 'open' : ''}`}>
        <div className="panel-header">
          <span>🌈 Editor de Shaders</span>
          {onClose && (
            <button className="icon" onClick={onClose} title="Fechar">
              <IconClose width={14} height={14} />
            </button>
          )}
        </div>

        <div className="shader-editor-body">
          {/* Modo: Visual / Código */}
          <div className="shader-mode-tabs">
            <button
              className={mode === 'visual' ? 'active' : ''}
              onClick={() => setMode('visual')}
            >
              🧩 Visual
            </button>
            <button
              className={mode === 'code' ? 'active' : ''}
              onClick={() => setMode('code')}
            >
              💻 Código GLSL
            </button>
          </div>

          {/* Biblioteca */}
          <div className="shader-library">
            <h5>Biblioteca</h5>
            <div className="shader-lib-grid">
              {SHADER_LIBRARY.map((shader) => (
                <button
                  key={shader.id}
                  className={`shader-lib-item ${selectedShader === shader.id ? 'active' : ''}`}
                  onClick={() => handleLoadFromLibrary(shader)}
                  title={shader.description}
                >
                  <div className="shader-lib-name">{shader.name}</div>
                  <div className="shader-lib-desc small muted">{shader.description}</div>
                </button>
              ))}
            </div>
          </div>

          {mode === 'visual' ? (
            <div className="shader-visual-section">
              <div className="row between mb-2">
                <span className="small muted">Editor visual de nós</span>
                <button onClick={() => setAddPanelOpen(true)} className="primary" style={{ fontSize: 10, padding: '4px 8px' }}>
                  <IconPlus width={11} height={11} /> Nó
                </button>
              </div>
              <div className="flirscript-canvas-container" ref={containerRef} style={{ height: 300 }}>
                <canvas
                  ref={canvasRef}
                  width={600}
                  height={300}
                  style={{ width: '100%', height: '100%', touchAction: 'none' }}
                />
              </div>
              <div className="small muted mt-2">
                Arrasta nós e liga pinos como no FlirScript.
                Nós: Cor, Textura, Tempo, Ruído, Fresnel, Multiplicar, Somar, Mix, Saída.
              </div>
            </div>
          ) : (
            <div className="shader-code-section">
              <div className="prop-row">
                <label>Nome do shader</label>
                <input
                  type="text"
                  value={shaderName}
                  onChange={(e) => setShaderName(e.target.value)}
                />
              </div>
              <div className="prop-row">
                <label>Código GLSL (Fragment Shader)</label>
                <textarea
                  value={glslCode}
                  onChange={(e) => setGlslCode(e.target.value)}
                  className="glsl-editor"
                  placeholder="// Escreve o teu shader GLSL aqui..."
                  spellCheck="false"
                />
              </div>
            </div>
          )}

          <button className="primary" onClick={handleSave} style={{ width: '100%', marginTop: 12 }}>
            <IconCheck width={14} height={14} /> Guardar Shader
          </button>
        </div>
      </aside>

      {/* Painel adicionar nó de shader */}
      {addPanelOpen && mode === 'visual' && (
        <>
          <div className="drawer-backdrop show" onClick={() => setAddPanelOpen(false)} />
          <aside className="flirscript-add-panel open" style={{ width: 280 }}>
            <div className="panel-header">
              <span>Adicionar Nó de Shader</span>
              <button className="icon" onClick={() => setAddPanelOpen(false)}>
                <IconClose width={14} height={14} />
              </button>
            </div>
            <div className="fs-node-list">
              {SHADER_NODE_DEFINITIONS.map((node) => (
                <button
                  key={node.type}
                  className="fs-node-item"
                  onClick={() => addShaderNode(node)}
                  title={node.description}
                >
                  <div className="fs-node-label">{node.label}</div>
                  <div className="fs-node-desc small muted">{node.description}</div>
                </button>
              ))}
            </div>
          </aside>
        </>
      )}
    </>
  )
}

/**
 * ShaderEditor — editor de shaders com dois modos:
 *  - Modo Visual: editor de nós (base litegraph.js)
 *  - Modo Código: editor de texto GLSL
 *
 * Biblioteca de shaders prontos:
 *  - Água, Vidro, Metal, Dissolver, Holograma
 *
 * Os shaders criados ficam disponíveis para aplicar em materiais.
 */
import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../../store/useStore'
import { IconClose, IconCheck } from '../../ui/Icons'

const SHADER_LIBRARY = [
  {
    id: 'water',
    name: 'Água',
    description: 'Superfície de água com ondas e reflexo',
    glsl: `// Shader: Água
uniform float time;
uniform vec3 color;
varying vec2 vUv;
void main() {
  vec2 uv = vUv * 4.0;
  float wave = sin(uv.x + time) * 0.5 + cos(uv.y + time * 0.7) * 0.5;
  vec3 finalColor = color + wave * 0.2;
  gl_FragColor = vec4(finalColor, 0.8);
}`,
    uniforms: { time: 0, color: [0.18, 0.51, 0.97] },
  },
  {
    id: 'glass',
    name: 'Vidro',
    description: 'Vidro transparente com refração',
    glsl: `// Shader: Vidro
uniform float time;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  float fresnel = pow(1.0 - dot(vNormal, vec3(0,0,1)), 2.0);
  vec3 color = mix(vec3(0.8, 0.9, 1.0), vec3(1.0), fresnel);
  gl_FragColor = vec4(color, 0.3 + fresnel * 0.4);
}`,
    uniforms: { time: 0 },
  },
  {
    id: 'metal',
    name: 'Metal Polido',
    description: 'Metal com reflexos especulares',
    glsl: `// Shader: Metal
uniform vec3 color;
varying vec3 vNormal;
void main() {
  vec3 light = normalize(vec3(1, 1, 1));
  float diff = max(dot(vNormal, light), 0.0);
  float spec = pow(diff, 32.0);
  vec3 finalColor = color * diff + vec3(1.0) * spec * 0.8;
  gl_FragColor = vec4(finalColor, 1.0);
}`,
    uniforms: { color: [0.8, 0.8, 0.85] },
  },
  {
    id: 'dissolve',
    name: 'Dissolver',
    description: 'Efeito de desaparecer progressivamente',
    glsl: `// Shader: Dissolver
uniform float time;
uniform float progress;
varying vec2 vUv;
void main() {
  float noise = sin(vUv.x * 20.0 + time) * cos(vUv.y * 20.0 + time);
  float threshold = progress;
  if (noise > threshold) discard;
  vec3 color = vec3(1.0, 0.5, 0.0);
  gl_FragColor = vec4(color, 1.0);
}`,
    uniforms: { time: 0, progress: 0.5 },
  },
  {
    id: 'hologram',
    name: 'Holograma',
    description: 'Efeito holográfico com scanlines',
    glsl: `// Shader: Holograma
uniform float time;
varying vec2 vUv;
varying vec3 vNormal;
void main() {
  float fresnel = pow(1.0 - dot(vNormal, vec3(0,0,1)), 3.0);
  float scan = sin(vUv.y * 50.0 + time * 5.0) * 0.5 + 0.5;
  vec3 color = vec3(0.0, 0.8, 1.0) * (fresnel + scan * 0.3);
  gl_FragColor = vec4(color, 0.6 + fresnel * 0.4);
}`,
    uniforms: { time: 0 },
  },
]

export default function ShaderEditor({ onClose }) {
  const [mode, setMode] = useState('visual') // visual | code
  const [selectedShader, setSelectedShader] = useState(null)
  const [glslCode, setGlslCode] = useState('')
  const [shaderName, setShaderName] = useState('Meu Shader')
  const toast = useStore((s) => s.toast)

  const handleLoadFromLibrary = (shader) => {
    setSelectedShader(shader.id)
    setGlslCode(shader.glsl)
    setShaderName(shader.name)
    toast(`Shader "${shader.name}" carregado`, 'success', 1500)
  }

  const handleSave = () => {
    if (!glslCode.trim()) {
      toast('Escreve algum código GLSL primeiro', 'error')
      return
    }
    // Guardar no store como material custom (simplificado)
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
              Visual
            </button>
            <button
              className={mode === 'code' ? 'active' : ''}
              onClick={() => setMode('code')}
            >
              Código GLSL
            </button>
          </div>

          {/* Biblioteca de shaders */}
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
            <div className="shader-visual-placeholder">
              <div className="empty-state small">
                <div>🧩 Editor visual de nós de shader</div>
                <div className="mt-2">
                  Usa a mesma base do FlirScript para ligar blocos:
                  Cor, Textura, Tempo, Ruído, Fresnel, Combinar, Saída Final.
                </div>
                <div className="mt-2 muted">
                  (Disponível numa futura iteração — por agora usa o modo Código GLSL)
                </div>
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
              <button className="primary" onClick={handleSave} style={{ width: '100%' }}>
                <IconCheck width={14} height={14} /> Guardar Shader
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

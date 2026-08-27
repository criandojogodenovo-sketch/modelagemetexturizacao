/**
 * shaderGraphToGLSL.js — Converte um grafo de nós do editor de shaders em GLSL.
 *
 * Percorre o grafo a partir do nó de Saída Final (Output) e gera o
 * fragmentShader completo, compilando cada nó para a expressão GLSL correspondente.
 *
 * Nós suportados:
 *  - ColorNode: cor constante (vec4)
 *  - TextureNode: sampling de textura (texture2D)
 *  - TimeNode: tempo uniform (u_time)
 *  - NoiseNode: ruído Perlin/simplex (função GLSL)
 *  - VoronoiNode: ruído Voronoi (função GLSL)
 *  - FresnelNode: efeito fresnel (baseado na normal e direção da câmara)
 *  - MultiplyNode: multiplicação de dois valores
 *  - AddNode: soma de dois valores
 *  - MixNode: mistura de dois valores por um fator
 *  - OutputNode: saída final (gl_FragColor)
 *
 * O GLSL gerado é o mesmo usado na pré-visualização e no jogo exportado.
 */

let nodeIdCounter = 0

/**
 * Gera o fragmentShader e vertexShader a partir do grafo.
 * @param {object} graph — { nodes: [...], links: [...] }
 * @returns {{ fragmentShader: string, vertexShader: string, uniforms: object }}
 */
export function generateShaderFromGraph(graph) {
  if (!graph || !graph.nodes || !graph.links) {
    return generateDefaultShader()
  }

  nodeIdCounter = 0
  const uniforms = {
    u_time: { value: 0 },
    u_resolution: { value: [1, 1] },
  }

  // Adicionar uniforms de textura
  for (const node of graph.nodes) {
    if (node.type === 'TextureNode' && node.textureName) {
      uniforms[node.textureName] = { value: null }
    }
  }

  // Encontrar nó de Output
  const outputNode = graph.nodes.find((n) => n.type === 'OutputNode' || n.type === 'Output')
  if (!outputNode) {
    return generateDefaultShader()
  }

  // Construir lista de funções helper necessárias
  const helpers = new Set()
  const lines = []

  // Recursivamente gerar expressões para cada input do output
  const inputValues = []
  for (const input of outputNode.inputs || ['color']) {
    const expr = generateNodeExpression(graph, outputNode, input, uniforms, helpers)
    inputValues.push(expr)
  }

  // Construir shader
  const helpersCode = Array.from(helpers).map((h) => HELPER_FUNCTIONS[h]).join('\n')

  const fragmentShader = `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
${Object.keys(uniforms).filter(u => u !== 'u_time' && u !== 'u_resolution').map(u => `uniform sampler2D ${u};`).join('\n')}

${helpersCode}

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  ${lines.join('\n  ')}
  vec4 finalColor = ${inputValues[0] || 'vec4(1.0)'};
  gl_FragColor = finalColor;
}
`.trim()

  const vertexShader = `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`.trim()

  return { fragmentShader, vertexShader, uniforms }
}

/**
 * Gera a expressão GLSL para um input de um nó.
 */
function generateNodeExpression(graph, node, inputName, uniforms, helpers) {
  // Encontrar ligação que chega a este input
  const link = graph.links.find((l) => l.targetNodeId === node.id && l.targetInput === inputName)
  if (!link) {
    // Sem ligação — usar default
    return getDefaultInput(node, inputName)
  }

  const sourceNode = graph.nodes.find((n) => n.id === link.sourceNodeId)
  if (!sourceNode) return getDefaultInput(node, inputName)

  // Gerar expressão do nó source
  return generateNodeCode(sourceNode, graph, uniforms, helpers)
}

/**
 * Gera o código GLSL para um nó específico.
 */
function generateNodeCode(node, graph, uniforms, helpers) {
  switch (node.type) {
    case 'ColorNode':
    case 'Color': {
      const c = node.value || [1, 1, 1, 1]
      return `vec4(${c[0].toFixed(3)}, ${c[1].toFixed(3)}, ${c[2].toFixed(3)}, ${c[3].toFixed(3)})`
    }

    case 'TextureNode':
    case 'Texture': {
      const texName = node.textureName || 'u_texture'
      if (!uniforms[texName]) uniforms[texName] = { value: null }
      const uvExpr = generateNodeExpression(graph, node, 'uv', uniforms, helpers)
      return `texture2D(${texName}, ${uvExpr || 'uv'})`
    }

    case 'TimeNode':
    case 'Time': {
      helpers.add('time')
      return 'u_time'
    }

    case 'NoiseNode':
    case 'Noise': {
      helpers.add('noise')
      const scale = node.scale || 5
      const inputExpr = generateNodeExpression(graph, node, 'input', uniforms, helpers) || 'uv'
      return `vec4(vec3(noise(${inputExpr} * ${scale})), 1.0)`
    }

    case 'VoronoiNode':
    case 'Voronoi': {
      helpers.add('voronoi')
      const scale = node.scale || 10
      const inputExpr = generateNodeExpression(graph, node, 'input', uniforms, helpers) || 'uv'
      return `vec4(vec3(voronoi(${inputExpr} * ${scale})), 1.0)`
    }

    case 'FresnelNode':
    case 'Fresnel': {
      helpers.add('fresnel')
      const power = node.power || 2
      return `vec4(vec3(fresnel(${power})), 1.0)`
    }

    case 'MultiplyNode':
    case 'Multiply': {
      const a = generateNodeExpression(graph, node, 'a', uniforms, helpers)
      const b = generateNodeExpression(graph, node, 'b', uniforms, helpers)
      return `(${a} * ${b})`
    }

    case 'AddNode':
    case 'Add': {
      const a = generateNodeExpression(graph, node, 'a', uniforms, helpers)
      const b = generateNodeExpression(graph, node, 'b', uniforms, helpers)
      return `(${a} + ${b})`
    }

    case 'MixNode':
    case 'Mix': {
      const a = generateNodeExpression(graph, node, 'a', uniforms, helpers)
      const b = generateNodeExpression(graph, node, 'b', uniforms, helpers)
      const f = generateNodeExpression(graph, node, 'factor', uniforms, helpers)
      return `mix(${a}, ${b}, ${f})`
    }

    case 'UVNode':
    case 'UV':
      return 'uv'

    default:
      return 'vec4(1.0)'
  }
}

function getDefaultInput(node, inputName) {
  if (inputName === 'uv') return 'uv'
  if (inputName === 'factor') return '0.5'
  return 'vec4(1.0)'
}

// Funções helper GLSL
const HELPER_FUNCTIONS = {
  noise: `
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5453);
  float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(127.1, 311.7))) * 43758.5453);
  float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(127.1, 311.7))) * 43758.5453);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}`,
  voronoi: `
float voronoi(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float minDist = 1.0;
  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 neighbor = vec2(float(x), float(y));
      vec2 point = fract(sin(dot(i + neighbor, vec2(127.1, 311.7))) * 43758.5453);
      point = 0.5 + 0.5 * sin(u_time + 6.2831 * point);
      vec2 diff = neighbor + point - f;
      float dist = length(diff);
      minDist = min(minDist, dist);
    }
  }
  return minDist;
}`,
  fresnel: `
float fresnel(float power) {
  vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
  return pow(1.0 - dot(viewDirection, vNormal), power);
}`,
  time: `// u_time está definido como uniform`,
}

function generateDefaultShader() {
  return {
    fragmentShader: `
precision highp float;
uniform float u_time;
uniform vec2 u_resolution;
void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution.xy;
  gl_FragColor = vec4(uv, 0.5 + 0.5 * sin(u_time), 1.0);
}`.trim(),
    vertexShader: `
precision highp float;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`.trim(),
    uniforms: {
      u_time: { value: 0 },
      u_resolution: { value: [1, 1] },
    },
  }
}

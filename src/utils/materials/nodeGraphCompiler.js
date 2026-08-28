/**
 * nodeGraphCompiler.js — compila node graphs de material para GLSL (e CPU bake).
 *
 * Sessão 20 / Parte C (estilo Blender/Unreal Visject).
 *
 * FLUXO:
 *   [Texture] → [Color Ramp] → [Map Range] → [Principled BSDF] → [Material Output]
 *
 * O grafo é avaliado topologicamente a partir do nó "Material Output".
 * Cada nó emite uma expressão GLSL tipada (float / vec2 / vec3). O resultado
 * alimenta os pontos de patch do MeshStandardMaterial:
 *   - Base Color   → diffuseColor.rgb
 *   - Roughness    → roughnessFactor
 *   - Metalness    → metalnessFactor
 *   - Emissive     → totalEmissiveRadiance
 *   - AO           → multiplica o diffuse (estilo ambient occlusion map)
 *   - Normal       → patch do chunk <normal_fragment_maps>
 *
 * COMPATIBILIDADE (C3):
 *  - Injeção via onBeforeCompile no MeshStandardMaterial → herda shadow
 *    mapping, tonemapping, fog e todas as luzes do pipeline standard.
 *  - BAKE para textura (CPU) → material.map comum → exportável em .glb /
 *    performativo em mobile (sem custo de shader).
 *
 * Também inclui um avaliador CPU espelhado (bake + preview).
 */

// ------------------------------------------------------------------ nós ----
export const NODE_DEFS = {
  materialOutput: {
    label: 'Material Output',
    category: 'output',
    headerColor: '#e5484d',
    inputs: [{ name: 'surface', type: 'surface' }],
    outputs: [],
  },
  principledBSDF: {
    label: 'Principled BSDF',
    category: 'output',
    headerColor: '#e5484d',
    inputs: [
      { name: 'baseColor', type: 'vec3' },
      { name: 'roughness', type: 'float' },
      { name: 'metalness', type: 'float' },
      { name: 'emissive', type: 'vec3' },
      { name: 'ao', type: 'float' },
      { name: 'normal', type: 'vec3' },
    ],
    outputs: [{ name: 'surface', type: 'surface' }],
    defaults: { baseColor: '#cccccc', roughness: 0.7, metalness: 0.0, emissive: '#000000', ao: 1.0 },
  },
  texture: {
    label: 'Texture',
    category: 'input',
    headerColor: '#2f81f7',
    inputs: [{ name: 'uv', type: 'vec2', optional: true }],
    outputs: [{ name: 'color', type: 'vec3' }, { name: 'value', type: 'float' }],
    defaults: { scale: 1.0, useMap: true, fallback: 'checker' },
    params: [
      { key: 'scale', label: 'Escala UV', type: 'range', min: 0.1, max: 8, step: 0.1 },
    ],
  },
  uv: {
    label: 'UV',
    category: 'input',
    headerColor: '#2f81f7',
    inputs: [],
    outputs: [{ name: 'uv', type: 'vec2' }],
    defaults: {},
  },
  colorNode: {
    label: 'Color',
    category: 'input',
    headerColor: '#2f81f7',
    inputs: [],
    outputs: [{ name: 'color', type: 'vec3' }],
    defaults: { color: '#ffffff' },
    params: [{ key: 'color', label: 'Cor', type: 'color' }],
  },
  value: {
    label: 'Value',
    category: 'input',
    headerColor: '#2f81f7',
    inputs: [],
    outputs: [{ name: 'value', type: 'float' }],
    defaults: { value: 0.5 },
    params: [{ key: 'value', label: 'Valor', type: 'range', min: 0, max: 1, step: 0.01 }],
  },
  noise: {
    label: 'Noise',
    category: 'procedural',
    headerColor: '#8957e5',
    inputs: [{ name: 'uv', type: 'vec2', optional: true }, { name: 'scale', type: 'float', optional: true }],
    outputs: [{ name: 'value', type: 'float' }],
    defaults: { scale: 4.0, octaves: 4 },
    params: [
      { key: 'scale', label: 'Escala', type: 'range', min: 0.5, max: 32, step: 0.5 },
      { key: 'octaves', label: 'Octaves (fbm)', type: 'range', min: 1, max: 6, step: 1 },
    ],
  },
  colorRamp: {
    label: 'Color Ramp',
    category: 'processing',
    headerColor: '#d63384',
    inputs: [{ name: 'factor', type: 'float' }],
    outputs: [{ name: 'color', type: 'vec3' }],
    defaults: { stops: [{ pos: 0, color: '#000000' }, { pos: 1, color: '#ffffff' }], interpolation: 'linear' },
  },
  mapRange: {
    label: 'Map Range',
    category: 'processing',
    headerColor: '#d63384',
    inputs: [{ name: 'value', type: 'float' }],
    outputs: [{ name: 'value', type: 'float' }],
    defaults: { fromMin: 0, fromMax: 1, toMin: 0, toMax: 1, clamp: true, smooth: false },
    params: [
      { key: 'fromMin', label: 'De (min)', type: 'number' },
      { key: 'fromMax', label: 'De (max)', type: 'number' },
      { key: 'toMin', label: 'Para (min)', type: 'number' },
      { key: 'toMax', label: 'Para (max)', type: 'number' },
      { key: 'clamp', label: 'Clamp', type: 'checkbox' },
      { key: 'smooth', label: 'Suavização', type: 'checkbox' },
    ],
  },
  mix: {
    label: 'Mix',
    category: 'processing',
    headerColor: '#d63384',
    inputs: [
      { name: 'a', type: 'vec3' }, { name: 'b', type: 'vec3' },
      { name: 'factor', type: 'float' },
    ],
    outputs: [{ name: 'result', type: 'vec3' }],
    defaults: { factor: 0.5 },
  },
  add: {
    label: 'Add',
    category: 'processing',
    headerColor: '#d63384',
    inputs: [{ name: 'a', type: 'vec3' }, { name: 'b', type: 'vec3' }],
    outputs: [{ name: 'result', type: 'vec3' }],
    defaults: {},
  },
  multiply: {
    label: 'Multiply',
    category: 'processing',
    headerColor: '#d63384',
    inputs: [{ name: 'a', type: 'vec3' }, { name: 'b', type: 'vec3' }],
    outputs: [{ name: 'result', type: 'vec3' }],
    defaults: {},
  },
  ambientOcclusion: {
    label: 'Ambient Occlusion',
    category: 'processing',
    headerColor: '#d63384',
    inputs: [{ name: 'color', type: 'vec3' }, { name: 'ao', type: 'float', optional: true }],
    outputs: [{ name: 'color', type: 'vec3' }],
    defaults: { strength: 1.0 },
    params: [{ key: 'strength', label: 'Força', type: 'range', min: 0, max: 2, step: 0.05 }],
  },
  normalMap: {
    label: 'Normal Map',
    category: 'vector',
    headerColor: '#2a9d8f',
    inputs: [{ name: 'color', type: 'vec3', optional: true }],
    outputs: [{ name: 'normal', type: 'vec3' }],
    defaults: { strength: 1.0 },
    params: [{ key: 'strength', label: 'Força', type: 'range', min: 0, max: 3, step: 0.05 }],
  },
  emissiveNode: {
    label: 'Emissive',
    category: 'output',
    headerColor: '#fd7e14',
    inputs: [{ name: 'color', type: 'vec3' }, { name: 'intensity', type: 'float', optional: true }],
    outputs: [{ name: 'emissive', type: 'vec3' }],
    defaults: { intensity: 1.0 },
    params: [{ key: 'intensity', label: 'Intensidade', type: 'range', min: 0, max: 8, step: 0.1 }],
  },
}

// ------------------------------------------------------------- utilidades ---
function hexToVec3(hex) {
  const c = parseInt(hex.replace('#', ''), 16)
  return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255]
}
const glslVec3 = (v) => `vec3(${v[0].toFixed(4)}, ${v[1].toFixed(4)}, ${v[2].toFixed(4)})`
/** Formata número JS para literal FLOAT GLSL (evita 'max(0.001, 1)' → erro de overload) */
const ff = (x) => {
  const n = Number(x) || 0
  return Number.isInteger(n) ? n.toFixed(1) : String(n)
}

/** Estrutura de indexação do grafo */
function indexGraph(graph) {
  const nodesById = new Map()
  for (const n of graph.nodes || []) nodesById.set(n.id, n)
  // edge key: `${toNodeId}:${toSocket}` → { fromNode, fromSocket }
  const edgeByInput = new Map()
  for (const e of graph.edges || []) {
    edgeByInput.set(`${e.to.node}:${e.to.socket}`, e)
  }
  return { nodesById, edgeByInput }
}

/** Encontra o caminho de entrada ligado a (nodeId, inputName); null se não ligado */
function inputSource(graph, idx, nodeId, inputName) {
  const e = idx.edgeByInput.get(`${nodeId}:${inputName}`)
  if (!e) return null
  return { node: idx.nodesById.get(e.from.node), socket: e.from.socket, edge: e }
}

// ------------------------------------------------------------------ GLSL ---
/**
 * Compila o grafo para GLSL. Retorna:
 *  { ok, error, glsl, uniformsNeeded: {map:boolean} }
 *  glsl = { decl: string (funções+uniforms), apply: string (aplicação no main) }
 */
export function compileNodeGraph(graph) {
  if (!graph || !graph.nodes || !graph.edges) return { ok: false, error: 'Grafo vazio' }
  const idx = indexGraph(graph)
  const outputNode = (graph.nodes || []).find((n) => n.type === 'materialOutput')
  if (!outputNode) return { ok: false, error: 'Falta o nó Material Output' }
  const surfaceEdge = idx.edgeByInput.get(`${outputNode.id}:surface`)
  if (!surfaceEdge) return { ok: false, error: 'Material Output sem superfície ligada' }
  const bsdfNode = idx.nodesById.get(surfaceEdge.from.node)
  if (!bsdfNode || bsdfNode.type !== 'principledBSDF') {
    return { ok: false, error: 'Liga um Principled BSDF ao Material Output' }
  }

  const lines = []      // linhas GLSL no corpo da função flirNodeEval
  const uniforms = []   // declarações de uniforms
  let varCount = 0
  const cache = new Map() // `${nodeId}:${socket}` → expressão GLSL
  let needsMap = false

  function fresh() { return `nv${varCount++}` }

  // Emite o código de um nó e devolve a expressão do socket pedido
  function emit(node, socket) {
    const key = `${node.id}:${socket}`
    if (cache.has(key)) return cache.get(key)
    const def = NODE_DEFS[node.type]
    if (!def) return 'vec3(0.0)'
    const p = { ...def.defaults, ...(node.params || {}) }

    switch (node.type) {
      case 'uv': {
        const expr = 'flirUV()'
        cache.set(key, expr)
        return expr
      }
      case 'value': {
        const expr = ff(+p.value ?? 0.5)
        cache.set(key, expr)
        return expr
      }
      case 'colorNode': {
        const expr = glslVec3(hexToVec3(p.color || '#ffffff'))
        cache.set(key, expr)
        return expr
      }
      case 'texture': {
        needsMap = true
        const uvSrc = inputSource(graph, idx, node.id, 'uv')
        const uvExpr = uvSrc ? emit(uvSrc.node, uvSrc.socket) : 'flirUV()'
        const t = fresh()
        const s = fresh()
        lines.push(`  vec4 ${t} = flirSampleMap(${uvExpr} / max(0.001, ${ff(+p.scale || 1)}));`)
        if (socket === 'value') {
          const v = fresh()
          lines.push(`  float ${v} = dot(${t}.rgb, vec3(0.299, 0.587, 0.114));`)
          cache.set(key, v)
          return v
        }
        const c = fresh()
        lines.push(`  vec3 ${c} = ${t}.rgb;`)
        cache.set(key, c)
        return c
      }
      case 'noise': {
        const uvSrc = inputSource(graph, idx, node.id, 'uv')
        const scaleSrc = inputSource(graph, idx, node.id, 'scale')
        const uvExpr = uvSrc ? emit(uvSrc.node, uvSrc.socket) : 'flirUV()'
        const scaleExpr = scaleSrc ? emit(scaleSrc.node, scaleSrc.socket) : ff(+p.scale || 4)
        const v = fresh()
        lines.push(`  float ${v} = flirFbm(${uvExpr} * ${scaleExpr}, ${Math.round(+p.octaves || 4)});`)
        cache.set(key, v)
        return v
      }
      case 'mapRange': {
        const valSrc = inputSource(graph, idx, node.id, 'value')
        const inExpr = valSrc ? emit(valSrc.node, valSrc.socket) : '0.0'
        const v = fresh()
        const fm = +p.fromMin || 0, fM = +p.fromMax ?? 1, tm = +p.toMin || 0, tM = +p.toMax ?? 1
        let core = `((${inExpr} - ${fm.toFixed(4)}) / max(0.0001, ${(fM - fm).toFixed(4)}))`
        if (p.smooth) core = `flirSmoothstep01(${core})`
        let expr = `${tm.toFixed(4)} + (${core}) * ${(tM - tm).toFixed(4)}`
        if (p.clamp) expr = `clamp(${expr}, ${Math.min(tm, tM).toFixed(4)}, ${Math.max(tm, tM).toFixed(4)})`
        lines.push(`  float ${v} = ${expr};`)
        cache.set(key, v)
        return v
      }
      case 'colorRamp': {
        const fSrc = inputSource(graph, idx, node.id, 'factor')
        const fExpr = fSrc ? emit(fSrc.node, fSrc.socket) : '0.0'
        const stops = (p.stops && p.stops.length >= 2) ? p.stops : [{ pos: 0, color: '#000000' }, { pos: 1, color: '#ffffff' }]
        const sid = node.id.replace(/[^a-zA-Z0-9]/g, '')
        const t = fresh()
        const c = fresh()
        const N = stops.length
        lines.push(`  float ${t} = clamp(${fExpr}, 0.0, 1.0);`)
        // GLSL ES 1.00 não tem construtores de array — atribuir elemento a elemento
        lines.push(`  vec3 flirRampCols${sid}[8];`)
        lines.push(`  float flirRampPos${sid}[8];`)
        stops.forEach((s, i) => {
          const col = glslVec3(hexToVec3(s.color))
          lines.push(`  flirRampCols${sid}[${i}] = ${col};`)
          lines.push(`  flirRampPos${sid}[${i}] = ${(+s.pos).toFixed(4)};`)
        })
        lines.push(`  vec3 ${c} = flirRamp(${t}, flirRampPos${sid}, flirRampCols${sid}, ${N});`)
        cache.set(key, c)
        return c
      }
      case 'mix': {
        const aSrc = inputSource(graph, idx, node.id, 'a')
        const bSrc = inputSource(graph, idx, node.id, 'b')
        const fSrc = inputSource(graph, idx, node.id, 'factor')
        const a = aSrc ? emit(aSrc.node, aSrc.socket) : glslVec3(hexToVec3('#ffffff'))
        const b = bSrc ? emit(bSrc.node, bSrc.socket) : glslVec3(hexToVec3('#000000'))
        const f = fSrc ? emit(fSrc.node, fSrc.socket) : ff(+p.factor ?? 0.5)
        const v = fresh()
        lines.push(`  vec3 ${v} = mix(${a}, ${b}, clamp(${f}, 0.0, 1.0));`)
        cache.set(key, v)
        return v
      }
      case 'add': {
        const aSrc = inputSource(graph, idx, node.id, 'a')
        const bSrc = inputSource(graph, idx, node.id, 'b')
        const a = aSrc ? emit(aSrc.node, aSrc.socket) : 'vec3(0.0)'
        const b = bSrc ? emit(bSrc.node, bSrc.socket) : 'vec3(0.0)'
        const v = fresh()
        lines.push(`  vec3 ${v} = ${a} + ${b};`)
        cache.set(key, v)
        return v
      }
      case 'multiply': {
        const aSrc = inputSource(graph, idx, node.id, 'a')
        const bSrc = inputSource(graph, idx, node.id, 'b')
        const a = aSrc ? emit(aSrc.node, aSrc.socket) : 'vec3(1.0)'
        const b = bSrc ? emit(bSrc.node, bSrc.socket) : 'vec3(1.0)'
        const v = fresh()
        lines.push(`  vec3 ${v} = ${a} * ${b};`)
        cache.set(key, v)
        return v
      }
      case 'ambientOcclusion': {
        const cSrc = inputSource(graph, idx, node.id, 'color')
        const aoSrc = inputSource(graph, idx, node.id, 'ao')
        const c = cSrc ? emit(cSrc.node, cSrc.socket) : 'vec3(1.0)'
        const ao = aoSrc ? emit(aoSrc.node, aoSrc.socket) : '1.0'
        const v = fresh()
        lines.push(`  vec3 ${v} = ${c} * mix(1.0, clamp(${ao}, 0.0, 1.0), ${(+p.strength ?? 1).toFixed(3)});`)
        cache.set(key, v)
        return v
      }
      case 'normalMap': {
        // Normal a partir da cor (XYZ→normal tangente) com força
        const cSrc = inputSource(graph, idx, node.id, 'color')
        const c = cSrc ? emit(cSrc.node, cSrc.socket) : 'vec3(0.5, 0.5, 1.0)'
        const v = fresh()
        lines.push(`  vec3 ${v} = normalize(mix(vec3(0.5, 0.5, 1.0), ${c} * 2.0 - 1.0, ${(+p.strength ?? 1).toFixed(3)}));`)
        cache.set(key, v)
        return v
      }
      case 'emissiveNode': {
        const cSrc = inputSource(graph, idx, node.id, 'color')
        const iSrc = inputSource(graph, idx, node.id, 'intensity')
        const c = cSrc ? emit(cSrc.node, cSrc.socket) : 'vec3(0.0)'
        const i = iSrc ? emit(iSrc.node, iSrc.socket) : ff(+p.intensity ?? 1)
        const v = fresh()
        lines.push(`  vec3 ${v} = ${c} * ${i};`)
        cache.set(key, v)
        return v
      }
      default:
        return 'vec3(0.0)'
    }
  }

  // Entradas do BSDF
  function inputOr(node, socketName, fallbackExpr, kind) {
    const src = inputSource(graph, idx, node.id, socketName)
    if (src) {
      const emitted = emit(src.node, src.socket)
      return emitted
    }
    const def = NODE_DEFS[node.type]
    const d = { ...def.defaults, ...(node.params || {}) }
    if (kind === 'vec3' && socketName === 'baseColor') return glslVec3(hexToVec3(d.baseColor || '#cccccc'))
    if (kind === 'vec3' && socketName === 'emissive') return glslVec3(hexToVec3(d.emissive || '#000000'))
    if (kind === 'float') return ff(+d[socketName] ?? 0)
    return fallbackExpr
  }

  const baseColorExpr = inputOr(bsdfNode, 'baseColor', 'vec3(0.8)', 'vec3')
  const roughnessExpr = inputOr(bsdfNode, 'roughness', '0.7', 'float')
  const metalnessExpr = inputOr(bsdfNode, 'metalness', '0.0', 'float')
  const emissiveSrc = inputSource(graph, idx, bsdfNode.id, 'emissive')
  const emissiveExpr = emissiveSrc ? inputOr(bsdfNode, 'emissive', 'vec3(0.0)', 'vec3') : 'vec3(0.0)'
  const aoSrc = inputSource(graph, idx, bsdfNode.id, 'ao')
  const aoExpr = aoSrc ? inputOr(bsdfNode, 'ao', '1.0', 'float') : '1.0'
  const normalSrc = inputSource(graph, idx, bsdfNode.id, 'normal')

  const out = {
    baseColor: fresh(), roughness: fresh(), metalness: fresh(),
    emissive: fresh(), ao: fresh(), normal: fresh(),
  }
  lines.push(`  vec3 ${out.baseColor} = ${baseColorExpr} * mix(1.0, clamp(${aoExpr}, 0.0, 1.0), 0.5);`)
  lines.push(`  float ${out.roughness} = clamp(${roughnessExpr}, 0.0, 1.0);`)
  lines.push(`  float ${out.metalness} = clamp(${metalnessExpr}, 0.0, 1.0);`)
  lines.push(`  vec3 ${out.emissive} = ${emissiveExpr};`)
  lines.push(`  float ${out.ao} = clamp(${aoExpr}, 0.0, 1.0);`)
  lines.push(`  vec3 ${out.normal} = ${normalSrc ? inputOr(bsdfNode, 'normal', 'vec3(0.5,0.5,1.0)', 'vec3') : 'vec3(0.5, 0.5, 1.0)'};`)

  const decl = `
// ==== Flir Node Graph (S20/C3) ====
uniform sampler2D uFlirNodeMap;
uniform float uFlirNodeHasMap;
varying vec2 vFlirUV;
vec2 flirUV() { return vFlirUV; }
vec4 flirSampleMap(vec2 uvv) {
  if (uFlirNodeHasMap > 0.5) return texture2D(uFlirNodeMap, fract(uvv));
  // fallback: checker procedural
  vec2 g = floor(uvv * 8.0);
  float c = mod(g.x + g.y, 2.0);
  return vec4(vec3(0.75 + c * 0.2), 1.0);
}
float flirHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float flirNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(flirHash(i), flirHash(i + vec2(1.0, 0.0)), u.x),
             mix(flirHash(i + vec2(0.0, 1.0)), flirHash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float flirFbm(vec2 p, int oct) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 6; i++) {
    if (i >= oct) break;
    v += a * flirNoise(p);
    p = p * 2.03 + vec2(11.7, 5.3);
    a *= 0.5;
  }
  return v;
}
float flirSmoothstep01(float x) { return x * x * (3.0 - 2.0 * x); }
vec3 flirRamp(float t, float poss[8], vec3 cols[8], int n) {
  // ramp genérico: interpolação linear entre stops (máx 8)
  if (t <= poss[0]) return cols[0];
  for (int i = 1; i < 8; i++) {
    if (i >= n) break;
    if (t <= poss[i]) {
      float f = (t - poss[i - 1]) / max(0.0001, poss[i] - poss[i - 1]);
      return mix(cols[i - 1], cols[i], clamp(f, 0.0, 1.0));
    }
  }
  return cols[n - 1];
}
struct FlirNodeResult {
  vec3 baseColor;
  float roughness;
  float metalness;
  vec3 emissive;
  float ao;
  vec3 normal;
};
FlirNodeResult flirNodeEval() {
${lines.join('\n')}
  FlirNodeResult flirRes = FlirNodeResult(${out.baseColor}, ${out.roughness}, ${out.metalness}, ${out.emissive}, ${out.ao}, ${out.normal});
  return flirRes;
}
// ==== fim Flir Node Graph ====`

  // Injeções SEPARADAS nos chunks corretos do fragment shader do three.js:
  //  - color_fragment:      diffuseColor (existe neste ponto)
  //  - roughnessmap_fragment: roughnessFactor (declarado AQUI, não antes!)
  //  - metalnessmap_fragment: metalnessFactor
  //  - emissivemap_fragment:  totalEmissiveRadiance
  // (Injetar tudo após color_fragment dava 'roughnessFactor undeclared'.)
  const apply = `
  FlirNodeResult flirRes = flirNodeEval();
  diffuseColor.rgb *= flirRes.baseColor;
`
  const applyRoughness = `  roughnessFactor = flirRes.roughness;`
  const applyMetalness = `  metalnessFactor = flirRes.metalness;`
  const applyEmissive = `  totalEmissiveRadiance += flirRes.emissive;`

  return { ok: true, glsl: { decl, apply, applyRoughness, applyMetalness, applyEmissive }, needsMap, resultVars: out }
}

/**
 * Aplica o node graph a um THREE.MeshStandardMaterial via onBeforeCompile.
 * O material mantém sombras/luzes padrão (herda todo o pipeline standard).
 */
export function applyNodeGraphToMaterial(material, graph, mapTexture) {
  const compiled = compileNodeGraph(graph)
  if (!compiled.ok) return compiled
  const uniforms = {
    uFlirNodeMap: { value: mapTexture || null },
    uFlirNodeHasMap: { value: mapTexture ? 1 : 0 },
  }
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uFlirNodeMap = uniforms.uFlirNodeMap
    shader.uniforms.uFlirNodeHasMap = uniforms.uFlirNodeHasMap
    // Fragment: decl + aplicações nos chunks corretos (ver compileNodeGraph)
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${compiled.glsl.decl}`)
      .replace('#include <color_fragment>', `#include <color_fragment>\n${compiled.glsl.apply}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>\n${compiled.glsl.applyRoughness}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>\n${compiled.glsl.applyMetalness}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\n${compiled.glsl.applyEmissive}`)
    // Vertex: passar UV como varying própria (independente de USE_UV)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFlirUV;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\n\tvFlirUV = uv;')
  }
  material.customProgramCacheKey = () => `flir-node-graph-${graph.nodes.length}-${graph.edges.length}-${(graph._rev || 0)}`
  material.needsUpdate = true
  return { ok: true }
}

// ------------------------------------------------------------- CPU/bake ---
// Avaliador espelhado em JS (para bake de texturas — performance mobile)

function hash2(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453
  return s - Math.floor(s)
}
function noise2(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const a = hash2(ix, iy), b = hash2(ix + 1, iy)
  const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1)
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy
}
function fbm(x, y, oct) {
  let v = 0, a = 0.5, px = x, py = y
  for (let i = 0; i < oct; i++) { v += a * noise2(px, py); px = px * 2.03 + 11.7; py = py * 2.03 + 5.3; a *= 0.5 }
  return v
}
function rampColor(t, stops) {
  if (!stops || stops.length === 0) return [0, 0, 0]
  if (t <= stops[0].pos) return hexToVec3(stops[0].color)
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i].pos) {
      const f = (t - stops[i - 1].pos) / Math.max(0.0001, stops[i].pos - stops[i - 1].pos)
      const a = hexToVec3(stops[i - 1].color), b = hexToVec3(stops[i].color)
      return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
    }
  }
  return hexToVec3(stops[stops.length - 1].color)
}
function sampleChecker(u, v) {
  const gx = Math.floor(u * 8), gy = Math.floor(v * 8)
  const c = (gx + gy) % 2 === 0 ? 0.95 : 0.75
  return [c, c, c]
}

/** Avalia o grafo para um UV. Retorna { color, roughness, metalness, emissive, ao, normal } */
export function evaluateGraphCPU(graph, u, v, sampleMapFn) {
  const idx = indexGraph(graph)
  const cache = new Map()
  function evalSocket(node, socket) {
    const key = `${node.id}:${socket}`
    if (cache.has(key)) return cache.get(key)
    const def = NODE_DEFS[node.type]
    const p = { ...def.defaults, ...(node.params || {}) }
    let result
    switch (node.type) {
      case 'uv': result = [u, v]; break
      case 'value': result = +p.value || 0; break
      case 'colorNode': result = hexToVec3(p.color || '#ffffff'); break
      case 'texture': {
        const uvSrc = inputSource(graph, idx, node.id, 'uv')
        const [uu, vv] = uvSrc ? evalSocket(uvSrc.node, uvSrc.socket) : [u, v]
        const s = Math.max(0.001, +p.scale || 1)
        const tu = (uu / s) % 1, tv = (vv / s) % 1
        result = sampleMapFn ? sampleMapFn(tu, tv) : sampleChecker(tu, tv)
        if (socket === 'value') result = result[0] * 0.299 + result[1] * 0.587 + result[2] * 0.114
        break
      }
      case 'noise': {
        const uvSrc = inputSource(graph, idx, node.id, 'uv')
        const [uu, vv] = uvSrc ? evalSocket(uvSrc.node, uvSrc.socket) : [u, v]
        result = fbm(uu * (+p.scale || 4), vv * (+p.scale || 4), Math.round(+p.octaves || 4))
        break
      }
      case 'mapRange': {
        const vSrc = inputSource(graph, idx, node.id, 'value')
        const input = vSrc ? evalSocket(vSrc.node, vSrc.socket) : 0
        const fm = +p.fromMin || 0, fM = +p.fromMax ?? 1, tm = +p.toMin || 0, tM = +p.toMax ?? 1
        let x = (input - fm) / Math.max(0.0001, fM - fm)
        if (p.smooth) x = x * x * (3 - 2 * x)
        let r = tm + x * (tM - tm)
        if (p.clamp) r = Math.min(Math.max(r, Math.min(tm, tM)), Math.max(tm, tM))
        result = r
        break
      }
      case 'colorRamp': {
        const fSrc = inputSource(graph, idx, node.id, 'factor')
        const f = fSrc ? evalSocket(fSrc.node, fSrc.socket) : 0
        result = rampColor(Math.min(1, Math.max(0, f)), p.stops)
        break
      }
      case 'mix': {
        const aSrc = inputSource(graph, idx, node.id, 'a')
        const bSrc = inputSource(graph, idx, node.id, 'b')
        const fSrc = inputSource(graph, idx, node.id, 'factor')
        const a = aSrc ? evalSocket(aSrc.node, aSrc.socket) : [1, 1, 1]
        const b = bSrc ? evalSocket(bSrc.node, bSrc.socket) : [0, 0, 0]
        const f = Math.min(1, Math.max(0, fSrc ? evalSocket(fSrc.node, fSrc.socket) : (+p.factor ?? 0.5)))
        result = [0, 1, 2].map((i) => (Array.isArray(a) ? a[i] : a) * (1 - f) + (Array.isArray(b) ? b[i] : b) * f)
        break
      }
      case 'add': {
        const aSrc = inputSource(graph, idx, node.id, 'a')
        const bSrc = inputSource(graph, idx, node.id, 'b')
        const a = aSrc ? evalSocket(aSrc.node, aSrc.socket) : 0
        const b = bSrc ? evalSocket(bSrc.node, bSrc.socket) : 0
        result = [0, 1, 2].map((i) => (Array.isArray(a) ? a[i] : a) + (Array.isArray(b) ? b[i] : b))
        break
      }
      case 'multiply': {
        const aSrc = inputSource(graph, idx, node.id, 'a')
        const bSrc = inputSource(graph, idx, node.id, 'b')
        const a = aSrc ? evalSocket(aSrc.node, aSrc.socket) : 1
        const b = bSrc ? evalSocket(bSrc.node, bSrc.socket) : 1
        result = [0, 1, 2].map((i) => (Array.isArray(a) ? a[i] : a) * (Array.isArray(b) ? b[i] : b))
        break
      }
      case 'ambientOcclusion': {
        const cSrc = inputSource(graph, idx, node.id, 'color')
        const aoSrc = inputSource(graph, idx, node.id, 'ao')
        const c = cSrc ? evalSocket(cSrc.node, cSrc.socket) : [1, 1, 1]
        const ao = aoSrc ? evalSocket(aoSrc.node, aoSrc.socket) : 1
        const st = +p.strength ?? 1
        result = [0, 1, 2].map((i) => (Array.isArray(c) ? c[i] : c) * (1 - st + Math.min(1, Math.max(0, ao)) * st))
        break
      }
      default: result = [0, 0, 0]
    }
    cache.set(key, result)
    return result
  }

  // BSDF
  const outputNode = (graph.nodes || []).find((n) => n.type === 'materialOutput')
  const surfaceEdge = idx.edgeByInput.get(`${outputNode?.id}:surface`)
  const bsdfNode = surfaceEdge ? idx.nodesById.get(surfaceEdge.from.node) : null
  if (!bsdfNode) return null
  const def = NODE_DEFS[bsdfNode.type]
  const p = { ...def.defaults, ...(bsdfNode.params || {}) }
  const get = (name, fallback) => {
    const src = inputSource(graph, idx, bsdfNode.id, name)
    return src ? evalSocket(src.node, src.socket) : fallback
  }
  const baseColor = get('baseColor', hexToVec3(p.baseColor || '#cccccc'))
  const ao = get('ao', 1)
  const aoF = Array.isArray(ao) ? ao[0] : ao
  return {
    color: [0, 1, 2].map((i) => (Array.isArray(baseColor) ? baseColor[i] : baseColor) * (1 - 0.5 + Math.min(1, Math.max(0, aoF)) * 0.5)),
    roughness: clamp01(get('roughness', +p.roughness ?? 0.7)),
    metalness: clamp01(get('metalness', +p.metalness ?? 0)),
    emissive: get('emissive', hexToVec3(p.emissive || '#000000')),
    ao: aoF,
  }
}
function clamp01(x) { return Math.min(1, Math.max(0, Array.isArray(x) ? x[0] : x)) }

/**
 * BAKE: avalia o grafo por pixel e produz dataURLs de textura (color map,
 * roughness map, metalness map). Para performance mobile / export glb.
 */
export function bakeNodeGraph(graph, resolution = 256, sampleMapFn = null) {
  const size = Math.min(1024, Math.max(32, resolution))
  const colorCanvas = document.createElement('canvas')
  colorCanvas.width = colorCanvas.height = size
  const ctx = colorCanvas.getContext('2d')
  const img = ctx.createImageData(size, size)

  // Roughness/metalness maps (escalas de cinza)
  const roughCanvas = document.createElement('canvas')
  roughCanvas.width = roughCanvas.height = size
  const rctx = roughCanvas.getContext('2d')
  const rimg = rctx.createImageData(size, size)
  const metalCanvas = document.createElement('canvas')
  metalCanvas.width = metalCanvas.height = size
  const mctx = metalCanvas.getContext('2d')
  const mimg = mctx.createImageData(size, size)

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size, v = y / size
      const r = evaluateGraphCPU(graph, u, 1 - v, sampleMapFn)
      const i = (y * size + x) * 4
      if (r) {
        img.data[i] = Math.round(Math.min(1, Math.max(0, r.color[0])) * 255)
        img.data[i + 1] = Math.round(Math.min(1, Math.max(0, r.color[1])) * 255)
        img.data[i + 2] = Math.round(Math.min(1, Math.max(0, r.color[2])) * 255)
        img.data[i + 3] = 255
        const rv = Math.round(r.roughness * 255)
        rimg.data[i] = rimg.data[i + 1] = rimg.data[i + 2] = rv
        rimg.data[i + 3] = 255
        const mv = Math.round(r.metalness * 255)
        mimg.data[i] = mimg.data[i + 1] = mimg.data[i + 2] = mv
        mimg.data[i + 3] = 255
      }
    }
  }
  ctx.putImageData(img, 0, 0)
  rctx.putImageData(rimg, 0, 0)
  mctx.putImageData(mimg, 0, 0)
  return {
    colorMap: colorCanvas.toDataURL('image/png'),
    roughnessMap: roughCanvas.toDataURL('image/png'),
    metalnessMap: metalCanvas.toDataURL('image/png'),
  }
}

/** Grafo por defeito: Texture → ColorRamp → Principled → Output */
export function createDefaultGraph() {
  const texId = `n${Date.now()}a`
  const rampId = `n${Date.now()}b`
  const bsdfId = `n${Date.now()}c`
  const outId = `n${Date.now()}d`
  return {
    _rev: 1,
    nodes: [
      { id: texId, type: 'texture', x: 40, y: 120, params: { scale: 1, useMap: true } },
      { id: rampId, type: 'colorRamp', x: 300, y: 120, params: { stops: [{ pos: 0, color: '#1a1a2e' }, { pos: 0.5, color: '#e94560' }, { pos: 1, color: '#f9ed69' }] } },
      { id: bsdfId, type: 'principledBSDF', x: 560, y: 100, params: {} },
      { id: outId, type: 'materialOutput', x: 820, y: 120, params: {} },
    ],
    edges: [
      { from: { node: texId, socket: 'value' }, to: { node: rampId, socket: 'factor' } },
      { from: { node: rampId, socket: 'color' }, to: { node: bsdfId, socket: 'baseColor' } },
      { from: { node: bsdfId, socket: 'surface' }, to: { node: outId, socket: 'surface' } },
    ],
  }
}

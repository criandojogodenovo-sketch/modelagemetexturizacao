/**
 * taxonomy.js — definição central de todos os Conects disponíveis.
 *
 * Em FlirScript engine, um "Conect" é a unidade base de cena (similar a
 * "node" na Godot ou "GameObject" na Unity). Cada Conect tem um tipo
 * (RigidObject, VisualObject, etc.) com propriedades específicas.
 *
 * Esta taxonomy alimenta:
 *  - A janela de Conects (lista + categorias + pesquisa)
 *  - O painel de propriedades dinâmico (cada tipo tem campos diferentes)
 *  - O runtime (cada tipo sabe como instanciar-se e atualizar-se)
 *
 * Estrutura de cada Conect:
 *  {
 *    type: 'RigidObject',         // identificador único
 *    label: 'Rigid Object',       // nome visível
 *    category: 'physics',         // categoria para agrupar
 *    icon: 'package',                  // emoji ou ícone
 *    description: '...',          // descrição curta
 *    defaults: { ... },           // propriedades predefinidas
 *    properties: [ ... ],         // esquema de propriedades para o painel
 *    hasPhysics: true,            // participa no mundo de física?
 *    hasVisual: true,             // tem malha visível?
 *    flirScriptable: true,        // pode ter script FlirScript?
 *  }
 *
 * Categorias: physics, visual, camera_audio, environment, ui, gameplay, organization
 */

export const CONECT_CATEGORIES = [
  { id: 'physics', label: 'Física', icon: 'settings', color: '#f4a261' },
  { id: 'visual', label: 'Visual', icon: 'palette', color: '#2a9d8f' },
  { id: 'camera_audio', label: 'Câmara e Áudio', icon: 'camera', color: '#2f81f7' },
  { id: 'environment', label: 'Ambiente', icon: 'globe', color: '#3fb950' },
  { id: 'realism', label: 'Realismo (Pós-Process)', icon: 'sparkles', color: '#ec4899' },
  { id: 'ui', label: 'Interface (UI)', icon: 'smartphone', color: '#8957e5' },
  { id: 'gameplay', label: 'Gameplay', icon: 'target', color: '#d29922' },
  { id: 'organization', label: 'Organização', icon: 'folder', color: '#6e7681' },
]

// Helper para gerar esquema de propriedade
const prop = (key, label, type, defaultValue, extra = {}) => ({
  key, label, type, default: defaultValue, ...extra,
})

// Helper para gerar propriedades de colisor independente (Sistema 1)
// Adicionado a todos os Conects com hasPhysics: true
const colliderProps = () => [
  prop('colliderShape', 'Forma do Colisor', 'select', 'model', {
    options: ['model', 'box', 'sphere', 'capsule'],
    descriptions: {
      model: 'Usar forma do modelo (automático)',
      box: 'Caixa',
      sphere: 'Esfera',
      capsule: 'Cápsula',
    },
  }),
  prop('colliderSize', 'Tamanho do Colisor (X,Y,Z)', 'vec3', [1, 1, 1]),
  prop('colliderOffset', 'Offset do Colisor (X,Y,Z)', 'vec3', [0, 0, 0]),
  prop('colliderRadius', 'Raio (esfera/cápsula)', 'number', 0.5, { min: 0.05, max: 10, step: 0.05 }),
  prop('colliderHeight', 'Altura (cápsula)', 'number', 1.5, { min: 0.1, max: 10, step: 0.1 }),
]

export const CONECT_TAXONOMY = [
  // ============ FÍSICA ============
  {
    type: 'RigidObject',
    label: 'Rigid Object',
    category: 'physics',
    icon: 'package',
    description: 'Corpo com física real: gravidade, massa, atrito, ressalto',
    hasPhysics: true,
    hasVisual: true,
    flirScriptable: true,
    defaults: {
      mass: 1,
      friction: 0.3,
      restitution: 0.4,
      linearDamping: 0.01,
      angularDamping: 0.01,
      fixedRotation: false,
      sourceObjectId: null,
    },
    properties: [
      prop('mass', 'Massa', 'number', 1, { min: 0, max: 100, step: 0.1 }),
      prop('friction', 'Atrito', 'number', 0.3, { min: 0, max: 1, step: 0.05 }),
      prop('restitution', 'Ressalto', 'number', 0.4, { min: 0, max: 1, step: 0.05 }),
      prop('linearDamping', 'Amortecimento linear', 'number', 0.01, { min: 0, max: 1, step: 0.01 }),
      prop('angularDamping', 'Amortecimento angular', 'number', 0.01, { min: 0, max: 1, step: 0.01 }),
      prop('fixedRotation', 'Fixar rotação', 'boolean', false),
      prop('sourceObjectId', 'Modelo do catálogo', 'objectRef', null),
    ],
  },
  {
    type: 'StaticObject',
    label: 'Static Object',
    category: 'physics',
    icon: 'square',
    description: 'Não se move, colisão fixa (chão, paredes, obstáculos)',
    hasPhysics: true,
    hasVisual: true,
    flirScriptable: true,
    defaults: {
      mass: 0,
      friction: 0.6,
      restitution: 0.1,
      sourceObjectId: null,
    },
    properties: [
      prop('friction', 'Atrito', 'number', 0.6, { min: 0, max: 1, step: 0.05 }),
      prop('restitution', 'Ressalto', 'number', 0.1, { min: 0, max: 1, step: 0.05 }),
      prop('sourceObjectId', 'Modelo do catálogo', 'objectRef', null),
    ],
  },
  {
    type: 'StopObject',
    label: 'Stop Object (Kinematic)',
    category: 'physics',
    icon: 'octagon',
    description: 'Não reage à física mas pode ser movido por FlirScript (plataformas, portas)',
    hasPhysics: true,
    hasVisual: true,
    flirScriptable: true,
    defaults: {
      friction: 0.4,
      restitution: 0.2,
      sourceObjectId: null,
    },
    properties: [
      prop('friction', 'Atrito', 'number', 0.4, { min: 0, max: 1, step: 0.05 }),
      prop('restitution', 'Ressalto', 'number', 0.2, { min: 0, max: 1, step: 0.05 }),
      prop('sourceObjectId', 'Modelo do catálogo', 'objectRef', null),
    ],
  },
  {
    type: 'PersonalObject',
    label: 'Personal Object (Jogador)',
    category: 'physics',
    icon: 'user',
    description: 'Controlador de personagem/jogador com deteção de chão, andar e saltar',
    hasPhysics: true,
    hasVisual: true,
    flirScriptable: true,
    defaults: {
      mass: 1,
      moveSpeed: 5,
      jumpForce: 8,
      canJump: true,
      grounded: false,
      fixedRotation: true,
      sourceObjectId: null, // referência a um objeto do catálogo (com esqueleto/animações)
      // FASE 9: Plataforma 3D
      coyoteTime: 0.15, // segundos para ainda saltar após sair de plataforma
      maxJumps: 1, // 1 = salto normal, 2 = salto duplo, etc.
      // Estado interno (não editável)
      _coyoteTimer: 0,
      _jumpsUsed: 0,
    },
    properties: [
      prop('moveSpeed', 'Velocidade de movimento', 'number', 5, { min: 0.5, max: 20, step: 0.5 }),
      prop('jumpForce', 'Força de salto', 'number', 8, { min: 1, max: 20, step: 0.5 }),
      prop('canJump', 'Pode saltar', 'boolean', true),
      prop('fixedRotation', 'Fixar rotação', 'boolean', true),
      prop('sourceObjectId', 'Modelo do catálogo (com esqueleto)', 'objectRef', null),
      prop('coyoteTime', 'Coyote time (seg)', 'number', 0.15, { min: 0, max: 1, step: 0.05 }),
      prop('maxJumps', 'Máx. saltos (1=normal, 2=duplo)', 'number', 1, { min: 1, max: 5, step: 1 }),
    ],
  },
  {
    type: 'NpcObject',
    label: 'NPC Object (IA)',
    category: 'physics',
    icon: 'bot',
    description: 'Personagem controlado por IA: parado, patrulhar, perseguir, fugir',
    hasPhysics: true,
    hasVisual: true,
    flirScriptable: true,
    defaults: {
      mass: 1,
      moveSpeed: 3,
      behavior: 'idle', // idle | patrol | chase | flee
      detectionRadius: 8,
      loseSightRadius: 12,
      patrolPath: null, // instanceId de PathObject
      patrolIndex: 0,
      health: 100,
      fixedRotation: true,
      sourceObjectId: null, // referência a um objeto do catálogo (com esqueleto/animações)
    },
    properties: [
      prop('moveSpeed', 'Velocidade', 'number', 3, { min: 0.5, max: 20, step: 0.5 }),
      prop('behavior', 'Comportamento', 'select', 'idle', { options: ['idle', 'patrol', 'chase', 'flee'] }),
      prop('detectionRadius', 'Raio de deteção', 'number', 8, { min: 1, max: 50, step: 1 }),
      prop('loseSightRadius', 'Raio de perda de vista', 'number', 12, { min: 2, max: 60, step: 1 }),
      prop('patrolPath', 'Path de patrulha', 'objectRef', null),
      prop('health', 'Vida', 'number', 100, { min: 0, max: 1000, step: 10 }),
      prop('fixedRotation', 'Fixar rotação', 'boolean', true),
      prop('sourceObjectId', 'Modelo do catálogo (com esqueleto)', 'objectRef', null),
    ],
  },
  {
    type: 'TriggerObject',
    label: 'Trigger Object',
    category: 'physics',
    icon: 'target',
    description: 'Zona que deteta entrada/saída sem colisão física (liga a eventos FlirScript)',
    hasPhysics: true,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      size: [2, 2, 2],
      isTrigger: true,
    },
    properties: [
      prop('size', 'Tamanho (X,Y,Z)', 'vec3', [2, 2, 2]),
    ],
  },
  {
    type: 'JointObject',
    label: 'Joint Object',
    category: 'physics',
    icon: 'link-2',
    description: 'Junta/articulação entre dois objetos (dobradiças, correntes, molas)',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      jointType: 'hinge', // hinge | ball | spring | fixed
      targetA: null,
      targetB: null,
      stiffness: 100,
      damping: 5,
    },
    properties: [
      prop('jointType', 'Tipo de junta', 'select', 'hinge', { options: ['hinge', 'ball', 'spring', 'fixed'] }),
      prop('targetA', 'Objeto A', 'objectRef', null),
      prop('targetB', 'Objeto B', 'objectRef', null),
      prop('stiffness', 'Rigidez', 'number', 100, { min: 1, max: 1000, step: 10 }),
      prop('damping', 'Amortecimento', 'number', 5, { min: 0, max: 100, step: 1 }),
    ],
  },

  // ============ VISUAL ============
  {
    type: 'VisualObject',
    label: 'Visual Object',
    category: 'visual',
    icon: 'palette',
    description: 'Malha 3D visível (usa modelos criados no Modo Modelagem)',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: true,
    defaults: {
      sourceObjectId: null, // referência a um objeto do catálogo
    },
    properties: [
      prop('sourceObjectId', 'Modelo do catálogo', 'objectRef', null),
    ],
  },
  {
    type: 'LuminousObject',
    label: 'Luminous Object (Luz)',
    category: 'visual',
    icon: 'lightbulb',
    description: 'Fonte de luz: pontual, direcional ou foco, com cor e intensidade',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      lightType: 'point', // point | directional | spot
      color: '#ffffff',
      intensity: 1.5,
      distance: 10,
      castShadow: true,
    },
    properties: [
      prop('lightType', 'Tipo de luz', 'select', 'point', { options: ['point', 'directional', 'spot'] }),
      prop('color', 'Cor', 'color', '#ffffff'),
      prop('intensity', 'Intensidade', 'number', 1.5, { min: 0, max: 10, step: 0.1 }),
      prop('distance', 'Distância', 'number', 10, { min: 0, max: 100, step: 1 }),
      prop('castShadow', 'Projeta sombras', 'boolean', true),
    ],
  },
  {
    type: 'SunObject',
    label: 'Sun Object (Sol)',
    category: 'visual',
    icon: 'sun',
    description: 'Luz direcional que simula o sol — sombras paralelas, temperatura de cor (Kelvin)',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      color: '#ffffff',
      intensity: 2.0,
      elevation: 45,       // graus (0=horizonte, 90=zénite)
      azimuth: 180,        // graus (0=norte, 180=sul)
      temperature: 6500,   // Kelvin (6500=neutro, 3000=quente, 10000=frio)
      castShadow: true,
    },
    properties: [
      prop('intensity', 'Intensidade', 'number', 2.0, { min: 0, max: 10, step: 0.1 }),
      prop('temperature', 'Temperatura (K)', 'number', 6500, { min: 1000, max: 20000, step: 100 }),
      prop('elevation', 'Elevação (graus)', 'number', 45, { min: 0, max: 90, step: 1 }),
      prop('azimuth', 'Azimute (graus)', 'number', 180, { min: 0, max: 360, step: 1 }),
      prop('castShadow', 'Projeta sombras', 'boolean', true),
    ],
  },
  {
    type: 'PointObject',
    label: 'Point Object (Luz Pontual)',
    category: 'visual',
    icon: 'circle-dot',
    description: 'Luz pontual — emite em todas as direções, com alcance e atenuação',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      color: '#ffffff',
      intensity: 2.0,
      distance: 15,
      decay: 2,            // atenuação física (0=sem decay, 2=realista)
      castShadow: true,
    },
    properties: [
      prop('color', 'Cor', 'color', '#ffffff'),
      prop('intensity', 'Intensidade', 'number', 2.0, { min: 0, max: 20, step: 0.1 }),
      prop('distance', 'Alcance', 'number', 15, { min: 0, max: 100, step: 1 }),
      prop('decay', 'Atenuação', 'number', 2, { min: 0, max: 4, step: 0.1 }),
      prop('castShadow', 'Projeta sombras', 'boolean', true),
    ],
  },
  {
    type: 'SpotObject',
    label: 'Spot Object (Holofote)',
    category: 'visual',
    icon: 'flashlight',
    description: 'Holofote — cone de luz com ângulo e suavidade de borda configuráveis',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      color: '#ffffff',
      intensity: 5.0,
      distance: 20,
      angle: 45,           // graus (abertura do cone)
      penumbra: 0.3,       // 0=borda dura, 1=borda suave
      decay: 2,
      castShadow: true,
    },
    properties: [
      prop('color', 'Cor', 'color', '#ffffff'),
      prop('intensity', 'Intensidade', 'number', 5.0, { min: 0, max: 50, step: 0.5 }),
      prop('distance', 'Alcance', 'number', 20, { min: 0, max: 100, step: 1 }),
      prop('angle', 'Ângulo (graus)', 'number', 45, { min: 5, max: 90, step: 1 }),
      prop('penumbra', 'Suavidade borda', 'number', 0.3, { min: 0, max: 1, step: 0.05 }),
      prop('decay', 'Atenuação', 'number', 2, { min: 0, max: 4, step: 0.1 }),
      prop('castShadow', 'Projeta sombras', 'boolean', true),
    ],
  },
  {
    type: 'AreaObject',
    label: 'Area Object (Luz de Área)',
    category: 'visual',
    icon: '▭',
    description: 'Luz de área retangular — suave e realista (janelas, painéis). Mais pesada que point.',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      color: '#ffffff',
      intensity: 5.0,
      width: 2,
      height: 2,
    },
    properties: [
      prop('color', 'Cor', 'color', '#ffffff'),
      prop('intensity', 'Intensidade', 'number', 5.0, { min: 0, max: 50, step: 0.5 }),
      prop('width', 'Largura', 'number', 2, { min: 0.1, max: 20, step: 0.1 }),
      prop('height', 'Altura', 'number', 2, { min: 0.1, max: 20, step: 0.1 }),
    ],
  },
  {
    type: 'AmbientObject',
    label: 'Ambient Object (Ambiente)',
    category: 'visual',
    icon: 'wind',
    description: 'Luz ambiente uniforme — preenche sombras sem criar novas. Sem direção.',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      color: '#ffffff',
      intensity: 0.5,
      groundColor: '#1a1a2e',  // cor do bounce do chão
    },
    properties: [
      prop('color', 'Cor (céu)', 'color', '#ffffff'),
      prop('groundColor', 'Cor (chão)', 'color', '#1a1a2e'),
      prop('intensity', 'Intensidade', 'number', 0.5, { min: 0, max: 5, step: 0.05 }),
    ],
  },
  {
    type: 'ReflectObject',
    label: 'Reflect Object (Sonda)',
    category: 'visual',
    icon: 'git-branch',
    description: 'Sonda de reflexo/ambiente para materiais realistas',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: false,
    defaults: {
      resolution: 256,
      intensity: 1,
    },
    properties: [
      prop('resolution', 'Resolução', 'number', 256, { min: 64, max: 1024, step: 64 }),
      prop('intensity', 'Intensidade', 'number', 1, { min: 0, max: 5, step: 0.1 }),
    ],
  },
  {
    type: 'ParticleObject',
    label: 'Particle Object',
    category: 'visual',
    icon: 'sparkles',
    description: 'Sistema de partículas (fumo, fogo, faíscas, chuva)',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: true,
    defaults: {
      maxParticles: 100,
      emissionRate: 10,
      particleLife: 2,
      particleSize: 0.1,
      particleSpeed: 1,
      color: '#ffaa44',
      spread: 1,
      gravity: 0,
    },
    properties: [
      prop('maxParticles', 'Máx. partículas', 'number', 100, { min: 1, max: 1000, step: 10 }),
      prop('emissionRate', 'Emissão/seg', 'number', 10, { min: 1, max: 100, step: 1 }),
      prop('particleLife', 'Vida (s)', 'number', 2, { min: 0.1, max: 10, step: 0.1 }),
      prop('particleSize', 'Tamanho', 'number', 0.1, { min: 0.01, max: 2, step: 0.01 }),
      prop('particleSpeed', 'Velocidade', 'number', 1, { min: 0, max: 10, step: 0.1 }),
      prop('color', 'Cor', 'color', '#ffaa44'),
      prop('spread', 'Dispersão', 'number', 1, { min: 0, max: 5, step: 0.1 }),
      prop('gravity', 'Gravidade', 'number', 0, { min: -5, max: 5, step: 0.1 }),
    ],
  },
  {
    type: 'TrailObject',
    label: 'Trail Object (Rasto)',
    category: 'visual',
    icon: 'zap',
    description: 'Rasto visual atrás de um objeto em movimento',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: true,
    defaults: {
      length: 30,
      width: 0.2,
      color: '#2f81f7',
      fade: true,
      followTarget: null,
    },
    properties: [
      prop('length', 'Comprimento', 'number', 30, { min: 5, max: 100, step: 5 }),
      prop('width', 'Largura', 'number', 0.2, { min: 0.01, max: 2, step: 0.01 }),
      prop('color', 'Cor', 'color', '#2f81f7'),
      prop('fade', 'Desvanecer', 'boolean', true),
      prop('followTarget', 'Seguir objeto', 'objectRef', null),
    ],
  },

  // ============ CÂMARA E ÁUDIO ============
  {
    type: 'ViewObject',
    label: 'View Object (Câmara)',
    category: 'camera_audio',
    icon: 'camera',
    description: 'Câmara de jogo — aparece como objeto na cena, selecionável e movível',
    hasPhysics: false,
    hasVisual: true, // agora aparece como gizmo no editor
    flirScriptable: true,
    defaults: {
      cameraType: 'perspective',
      fov: 60,
      orthoSize: 5,
      near: 0.1,
      far: 200,
      followTarget: null,
      followMode: 'none',
      followDistance: 6,
      followHeight: 3,
      eyeHeight: 1.6,
      isActive: true,
      cameraRole: 'primary', // primary | secondary | player
      // Fase 5 — Câmaras Cinemáticas
      lensType: 'normal', // wide | normal | telephoto | custom
      dofEnabled: false,
      dofFocusDistance: 10,
      dofFocusRange: 5,
      dofIntensity: 0.5,
      smartFocus: false, // SmartCamera: boost quality de objetos visíveis
    },
    properties: [
      prop('cameraRole', 'Papel da câmara', 'select', 'primary', { options: ['primary', 'secondary', 'player'] }),
      prop('isActive', 'Câmara ativa', 'boolean', true),
      prop('cameraType', 'Tipo', 'select', 'perspective', { options: ['perspective', 'orthographic'] }),
      prop('fov', 'FOV (campo de visão)', 'number', 60, { min: 20, max: 120, step: 1 }),
      prop('orthoSize', 'Tamanho ortográfico', 'number', 5, { min: 1, max: 30, step: 0.5 }),
      prop('near', 'Near (plano próximo)', 'number', 0.1, { min: 0.01, max: 5, step: 0.1 }),
      prop('far', 'Far (plano longe)', 'number', 200, { min: 10, max: 1000, step: 10 }),
      prop('followTarget', 'Seguir objeto', 'objectRef', null),
      prop('followMode', 'Modo de seguir', 'select', 'none', { options: ['none', 'first', 'third', 'top', 'side'] }),
      prop('followDistance', 'Distância (3rd/side)', 'number', 6, { min: 1, max: 30, step: 0.5 }),
      prop('followHeight', 'Altura (3rd/side)', 'number', 3, { min: 0, max: 20, step: 0.5 }),
      prop('eyeHeight', 'Altura dos olhos (1st)', 'number', 1.6, { min: 0.5, max: 3, step: 0.1 }),
      // Fase 5 — Câmaras Cinemáticas
      prop('lensType', 'Lente', 'select', 'normal', { options: ['wide', 'normal', 'telephoto', 'custom'] }),
      prop('dofEnabled', 'Profundidade de Campo (DOF)', 'boolean', false),
      prop('dofFocusDistance', 'DOF: Distância de foco', 'number', 10, { min: 1, max: 100, step: 1 }),
      prop('dofFocusRange', 'DOF: Gama de foco', 'number', 5, { min: 1, max: 50, step: 1 }),
      prop('dofIntensity', 'DOF: Intensidade', 'number', 0.5, { min: 0, max: 1, step: 0.1 }),
      prop('smartFocus', 'SmartCamera (qualidade só em visíveis)', 'boolean', false),
    ],
  },
  // FASE 8: Zona de toque para rodar câmara (FPS/BR-style)
  {
    type: 'CameraTouchZone',
    label: 'Camera Touch Zone (Rodar Câmara)',
    category: 'ui',
    icon: 'mouse-pointer-2',
    description: 'Zona do ecrã para arrastar e rodar a câmara (pitch/yaw). Independente do joystick. Estilo COD Mobile/Fortnite.',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      // Zona do ecrã (em % do ecrã): default = metade direita
      zone: { x: 50, y: 0, w: 50, h: 100 },
      sensitivity: 1.0,
      invertY: false,
      // Limites de pitch (radianos)
      minPitch: -1.4, // ~-80°
      maxPitch: 1.4,  // ~+80°
    },
    properties: [
      prop('sensitivity', 'Sensibilidade', 'number', 1.0, { min: 0.1, max: 5, step: 0.1 }),
      prop('invertY', 'Inverter Y', 'boolean', false),
      prop('minPitch', 'Pitch mínimo (rad)', 'number', -1.4, { min: -3.14, max: 0, step: 0.05 }),
      prop('maxPitch', 'Pitch máximo (rad)', 'number', 1.4, { min: 0, max: 3.14, step: 0.05 }),
    ],
  },
  {
    type: 'SoundObject',
    label: 'Sound Object (Som)',
    category: 'camera_audio',
    icon: 'volume-2',
    description: 'Fonte de som/música com volume, loop e autoplay',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      url: '',
      volume: 1,
      loop: false,
      autoplay: false,
      isMusic: false, // música de fundo (fade in/out ao mudar de cena)
      spatial: false, // som 3D posicional
      maxDistance: 20,
    },
    properties: [
      prop('url', 'URL do som', 'text', ''),
      prop('volume', 'Volume', 'number', 1, { min: 0, max: 1, step: 0.05 }),
      prop('loop', 'Repetir', 'boolean', false),
      prop('autoplay', 'Tocar automaticamente', 'boolean', false),
      prop('isMusic', 'Música de fundo', 'boolean', false),
      prop('spatial', 'Som 3D', 'boolean', false),
      prop('maxDistance', 'Distância máx', 'number', 20, { min: 1, max: 100, step: 1 }),
    ],
  },

  // ============ AMBIENTE ============
  {
    type: 'SkyObject',
    label: 'Sky Object (Céu)',
    category: 'environment',
    icon: 'cloud',
    description: 'Céu/ambiente (cor, gradiente, HDRI ou céu procedural com sol)',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: false,
    defaults: {
      skyType: 'gradient', // solid | gradient | hdri | procedural
      topColor: '#1a4d8f',
      bottomColor: '#aac4e8',
      solidColor: '#87ceeb',
      hdriUrl: null,
      // Céu procedural (THREE.Sky)
      sunElevation: 25,     // graus (0=horizonte, 90=zénite)
      sunAzimuth: 180,      // graus (0=norte, 90=este, 180=sul)
      rayleigh: 1,          // espalhamento atmosférico (azul do céu)
      turbidity: 10,        // quantidade de partículas (amarelado)
      mieCoefficient: 0.005,// espalhamento Mie (brilho do sol)
      starsEnabled: false,
    },
    properties: [
      prop('skyType', 'Tipo', 'select', 'gradient', { options: ['solid', 'gradient', 'hdri', 'procedural'] }),
      prop('solidColor', 'Cor sólida', 'color', '#87ceeb'),
      prop('topColor', 'Cor superior', 'color', '#1a4d8f'),
      prop('bottomColor', 'Cor inferior', 'color', '#aac4e8'),
      prop('hdriUrl', 'URL HDRI', 'text', ''),
      prop('sunElevation', 'Sol: Elevação (graus)', 'number', 25, { min: 0, max: 90, step: 1 }),
      prop('sunAzimuth', 'Sol: Azimute (graus)', 'number', 180, { min: 0, max: 360, step: 1 }),
      prop('rayleigh', 'Rayleigh (azul)', 'number', 1, { min: 0, max: 10, step: 0.1 }),
      prop('turbidity', 'Turbidez', 'number', 10, { min: 0, max: 30, step: 0.5 }),
      prop('mieCoefficient', 'Mie (brilho sol)', 'number', 0.005, { min: 0, max: 0.1, step: 0.001 }),
      prop('starsEnabled', 'Estrelas (à noite)', 'boolean', false),
    ],
  },
  {
    type: 'TerrainObject',
    label: 'Terrain Object (Terreno)',
    category: 'environment',
    icon: 'mountain',
    description: 'Terreno com altura editável (heightmap básico)',
    hasPhysics: true,
    hasVisual: true,
    flirScriptable: false,
    defaults: {
      width: 50,
      depth: 50,
      segments: 64,
      heightScale: 5,
      heightmapSeed: 12345,
    },
    properties: [
      prop('width', 'Largura', 'number', 50, { min: 5, max: 200, step: 5 }),
      prop('depth', 'Profundidade', 'number', 50, { min: 5, max: 200, step: 5 }),
      prop('segments', 'Segmentos', 'number', 64, { min: 8, max: 128, step: 8 }),
      prop('heightScale', 'Escala de altura', 'number', 5, { min: 0, max: 20, step: 0.5 }),
      prop('heightmapSeed', 'Seed', 'number', 12345, { min: 1, max: 99999, step: 1 }),
    ],
  },
  {
    type: 'WaterObject',
    label: 'Water Object (Água)',
    category: 'environment',
    icon: 'waves',
    description: 'Água profissional com ondas Gerstner, espuma, profundidade e lago/rio',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: false,
    defaults: {
      size: [20, 20],
      color: '#2f81f7',
      deepColor: '#0a3d5c',
      opacity: 0.85,
      waveHeight: 0.2,
      waveSpeed: 0.5,
      waterMode: 'lake', // lake | river
      flowDirection: 0, // 0..360 graus (apenas rio)
      foamEnabled: true,
      foamThreshold: 0.7,
      // Profundidade variável
      depthGradient: true,
    },
    properties: [
      prop('size', 'Tamanho (X,Z)', 'vec2', [20, 20]),
      prop('color', 'Cor superficial', 'color', '#2f81f7'),
      prop('deepColor', 'Cor profunda', 'color', '#0a3d5c'),
      prop('opacity', 'Opacidade', 'number', 0.85, { min: 0, max: 1, step: 0.05 }),
      prop('waveHeight', 'Altura das ondas', 'number', 0.2, { min: 0, max: 1, step: 0.05 }),
      prop('waveSpeed', 'Velocidade', 'number', 0.5, { min: 0, max: 5, step: 0.1 }),
      prop('waterMode', 'Modo', 'select', 'lake', { options: ['lake', 'river'] }),
      prop('flowDirection', 'Direção fluxo (graus)', 'number', 0, { min: 0, max: 360, step: 15 }),
      prop('foamEnabled', 'Espuma', 'select', 'true', { options: ['true', 'false'] }),
      prop('foamThreshold', 'Limiar espuma', 'number', 0.7, { min: 0, max: 1, step: 0.05 }),
      prop('depthGradient', 'Gradiente profundidade', 'select', 'true', { options: ['true', 'false'] }),
    ],
  },
  {
    type: 'FogObject',
    label: 'Fog Object (Névoa)',
    category: 'environment',
    icon: 'wind',
    description: 'Névoa com distância e cor ajustáveis',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: false,
    defaults: {
      fogType: 'linear', // linear | exponential
      color: '#a0a0a0',
      near: 5,
      far: 50,
      density: 0.02,
    },
    properties: [
      prop('fogType', 'Tipo', 'select', 'linear', { options: ['linear', 'exponential'] }),
      prop('color', 'Cor', 'color', '#a0a0a0'),
      prop('near', 'Início', 'number', 5, { min: 0, max: 100, step: 1 }),
      prop('far', 'Fim', 'number', 50, { min: 1, max: 200, step: 1 }),
      prop('density', 'Densidade', 'number', 0.02, { min: 0, max: 0.5, step: 0.01 }),
    ],
  },

  // ============ INTERFACE (UI) ============
  {
    type: 'ButtonObject',
    label: 'Button Object',
    category: 'ui',
    icon: 'mouse-pointer-2',
    description: 'Botão na tela, liga-se a eventos do FlirScript',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      label: 'Botão',
      position: [10, 10], // x, y em % do ecrã
      size: [120, 50],
      color: '#2f81f7',
      textColor: '#ffffff',
      fontSize: 14,
    },
    properties: [
      prop('label', 'Texto', 'text', 'Botão'),
      prop('position', 'Posição (X,Y %)', 'vec2', [10, 10]),
      prop('size', 'Tamanho (W,H)', 'vec2', [120, 50]),
      prop('color', 'Cor de fundo', 'color', '#2f81f7'),
      prop('textColor', 'Cor do texto', 'color', '#ffffff'),
      prop('fontSize', 'Tamanho do texto', 'number', 14, { min: 8, max: 32, step: 1 }),
    ],
  },
  {
    type: 'JoystickObject',
    label: 'Joystick Object',
    category: 'ui',
    icon: 'joystick',
    description: 'Joystick virtual para controlo de movimento no mobile',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      side: 'left', // left | right
      size: 120,
      color: '#2f81f7',
      deadzone: 0.1,
      targetPersonal: null, // instanceId do PersonalObject a controlar
    },
    properties: [
      prop('side', 'Lado', 'select', 'left', { options: ['left', 'right'] }),
      prop('size', 'Tamanho', 'number', 120, { min: 60, max: 240, step: 10 }),
      prop('color', 'Cor', 'color', '#2f81f7'),
      prop('deadzone', 'Zona morta', 'number', 0.1, { min: 0, max: 0.5, step: 0.05 }),
      prop('targetPersonal', 'Controlar jogador', 'objectRef', null),
    ],
  },
  {
    type: 'TextObject',
    label: 'Text Object',
    category: 'ui',
    icon: 'type',
    description: 'Texto na tela (pontuação, vida, mensagens)',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      text: 'Texto',
      position: [50, 5],
      color: '#ffffff',
      fontSize: 18,
      align: 'center',
    },
    properties: [
      prop('text', 'Conteúdo', 'text', 'Texto'),
      prop('position', 'Posição (X,Y %)', 'vec2', [50, 5]),
      prop('color', 'Cor', 'color', '#ffffff'),
      prop('fontSize', 'Tamanho', 'number', 18, { min: 8, max: 64, step: 1 }),
      prop('align', 'Alinhamento', 'select', 'center', { options: ['left', 'center', 'right'] }),
    ],
  },
  {
    type: 'ImageObject',
    label: 'Image Object',
    category: 'ui',
    icon: 'image',
    description: 'Imagem/ícone na tela',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      url: '',
      position: [50, 50],
      size: [100, 100],
    },
    properties: [
      prop('url', 'URL da imagem', 'text', ''),
      prop('position', 'Posição (X,Y %)', 'vec2', [50, 50]),
      prop('size', 'Tamanho (W,H)', 'vec2', [100, 100]),
    ],
  },
  {
    type: 'PanelObject',
    label: 'Panel Object',
    category: 'ui',
    icon: '▬',
    description: 'Painel de fundo para agrupar elementos de UI',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: false,
    defaults: {
      position: [10, 10],
      size: [200, 100],
      color: '#1c2128',
      opacity: 0.8,
    },
    properties: [
      prop('position', 'Posição (X,Y %)', 'vec2', [10, 10]),
      prop('size', 'Tamanho (W,H)', 'vec2', [200, 100]),
      prop('color', 'Cor', 'color', '#1c2128'),
      prop('opacity', 'Opacidade', 'number', 0.8, { min: 0, max: 1, step: 0.05 }),
    ],
  },

  // ============ GAMEPLAY ============
  {
    type: 'SpawnObject',
    label: 'Spawn Object',
    category: 'gameplay',
    icon: 'map-pin',
    description: 'Ponto de criação de objetos/inimigos em tempo de jogo',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      objectToSpawn: null, // sourceObjectId
      interval: 2,
      maxAlive: 5,
      autoStart: false,
    },
    properties: [
      prop('objectToSpawn', 'Objeto a criar', 'objectRef', null),
      prop('interval', 'Intervalo (s)', 'number', 2, { min: 0.1, max: 60, step: 0.1 }),
      prop('maxAlive', 'Máx. vivos', 'number', 5, { min: 1, max: 50, step: 1 }),
      prop('autoStart', 'Iniciar automaticamente', 'boolean', false),
    ],
  },
  {
    type: 'NavigatorObject',
    label: 'Navigator Object (Portal)',
    category: 'gameplay',
    icon: 'spline',
    description: 'Portal/passagem entre cenas — transporta o jogador para outra cena ao contacto',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: true,
    defaults: {
      targetSceneId: null,     // cena de destino
      transitionType: 'fade',  // fade | instant
      transitionDuration: 0.5, // segundos
      spawnPosition: [0, 1, 0], // posição de spawn na cena de destino
      preserveVelocity: false,
      triggerRadius: 2,        // raio de ativação
    },
    properties: [
      prop('transitionType', 'Transição', 'select', 'fade', { options: ['fade', 'instant'] }),
      prop('transitionDuration', 'Duração (s)', 'number', 0.5, { min: 0, max: 5, step: 0.1 }),
      prop('triggerRadius', 'Raio de ativação', 'number', 2, { min: 0.5, max: 20, step: 0.5 }),
      prop('spawnPosition', 'Posição de spawn', 'vec3', [0, 1, 0]),
      prop('preserveVelocity', 'Manter velocidade', 'boolean', false),
    ],
  },
  {
    type: 'CheckpointObject',
    label: 'Checkpoint Object',
    category: 'gameplay',
    icon: 'flag',
    description: 'Ponto de recomeço/progresso guardado',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: true,
    defaults: {
      checkpointId: 0,
      isStart: false,
    },
    properties: [
      prop('checkpointId', 'ID do checkpoint', 'number', 0, { min: 0, max: 99, step: 1 }),
      prop('isStart', 'É ponto inicial', 'boolean', false),
    ],
  },
  {
    type: 'TimerObject',
    label: 'Timer Object',
    category: 'gameplay',
    icon: 'timer',
    description: 'Temporizador de jogo, liga-se a eventos do FlirScript',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      duration: 5,
      autoStart: false,
      loop: false,
    },
    properties: [
      prop('duration', 'Duração (s)', 'number', 5, { min: 0.1, max: 600, step: 0.1 }),
      prop('autoStart', 'Iniciar automaticamente', 'boolean', false),
      prop('loop', 'Repetir', 'boolean', false),
    ],
  },
  {
    type: 'PathObject',
    label: 'Path Object (Waypoints)',
    category: 'gameplay',
    icon: 'route',
    description: 'Caminho/waypoints para movimento guiado ou IA simples',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: true,
    defaults: {
      points: [[0, 0.5, 0], [5, 0.5, 0], [5, 0.5, 5], [0, 0.5, 5]],
      loop: true,
      speed: 2,
      target: null, // instanceId a mover pelo path
    },
    properties: [
      prop('loop', 'Cíclico', 'boolean', true),
      prop('speed', 'Velocidade', 'number', 2, { min: 0.1, max: 20, step: 0.1 }),
      prop('target', 'Objeto a mover', 'objectRef', null),
    ],
  },

  // ============ SISTEMA 2: ARMAS E COMBATE ============
  {
    type: 'WeaponObject',
    label: 'Weapon Object',
    category: 'gameplay',
    icon: 'sword',
    description: 'Arma equipável — dispara raycast ou projétil, com munição e recarga',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: true,
    defaults: {
      damage: 25,
      fireRate: 0.3,        // segundos entre tiros
      range: 50,            // alcance do raycast
      fireType: 'raycast',  // raycast | projectile
      maxAmmo: 30,
      reloadTime: 2,        // segundos
      equipped: false,
      showCrosshair: true,
    },
    properties: [
      prop('damage', 'Dano', 'number', 25, { min: 1, max: 500, step: 1 }),
      prop('fireRate', 'Cadência (s)', 'number', 0.3, { min: 0.05, max: 5, step: 0.05 }),
      prop('range', 'Alcance', 'number', 50, { min: 1, max: 200, step: 1 }),
      prop('fireType', 'Tipo de disparo', 'select', 'raycast', { options: ['raycast', 'projectile'] }),
      prop('maxAmmo', 'Munição máxima', 'number', 30, { min: 1, max: 999, step: 1 }),
      prop('reloadTime', 'Tempo recarga (s)', 'number', 2, { min: 0.5, max: 10, step: 0.5 }),
      prop('showCrosshair', 'Mira no ecrã', 'boolean', true),
    ],
  },

  // ============ SISTEMA 3: INVENTÁRIO ============
  {
    type: 'ItemObject',
    label: 'Item Object',
    category: 'gameplay',
    icon: 'gift',
    description: 'Item apanhável no mundo — adiciona ao inventário ao tocar',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: true,
    defaults: {
      itemName: 'Item',
      itemType: 'generic',    // generic | weapon | consumable | material
      quantity: 1,
      icon: 'package',
      pickupRadius: 2,
      autoPickup: true,
    },
    properties: [
      prop('itemName', 'Nome do item', 'text', 'Item'),
      prop('itemType', 'Tipo', 'select', 'generic', { options: ['generic', 'weapon', 'consumable', 'material'] }),
      prop('quantity', 'Quantidade', 'number', 1, { min: 1, max: 999, step: 1 }),
      prop('icon', 'Ícone', 'text', 'cube'),
      prop('pickupRadius', 'Raio de apanha', 'number', 2, { min: 0.5, max: 10, step: 0.5 }),
      prop('autoPickup', 'Apanhar automático', 'boolean', true),
    ],
  },

  // ============ SISTEMA: ANIMATION BOOST ============
  {
    type: 'AnimationBoostObject',
    label: 'Animation Boost',
    category: 'gameplay',
    icon: 'zap',
    description: 'Melhora a qualidade/suavidade da animação (interpolação + blending)',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      blendTime: 0.3,
      interpolationQuality: 'high',
    },
    properties: [
      prop('blendTime', 'Tempo de blending (s)', 'number', 0.3, { min: 0.05, max: 2, step: 0.05 }),
      prop('interpolationQuality', 'Qualidade interpolação', 'select', 'high', { options: ['low', 'medium', 'high'] }),
    ],
  },

  // ============ SISTEMA: GAME STATE ============
  {
    type: 'GameStateObject',
    label: 'Game State Object',
    category: 'gameplay',
    icon: 'gamepad-2',
    description: 'Gere o estado global do jogo (Menu, A Jogar, Pausado, Game Over)',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      currentState: 'menu',
    },
    properties: [
      prop('currentState', 'Estado inicial', 'select', 'menu', { options: ['menu', 'playing', 'paused', 'gameover', 'custom'] }),
    ],
  },

  // ============ SISTEMA: PREFAB ============
  {
    type: 'PrefabObject',
    label: 'Prefab Object (Pacote)',
    category: 'organization',
    icon: 'package',
    description: 'Pacote reutilizável de Conects — arrastar para a cena cria uma instância',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: false,
    defaults: {
      prefabData: null, // array de conects serializados
      sourcePrefabId: null, // se é instância, ID do prefab original
    },
    properties: [
      prop('prefabData', 'Dados do prefab', 'text', ''),
    ],
  },

  // ============ FASE 9: ROGUELIKE ============
  {
    type: 'RoguelikeGenerator',
    label: 'Roguelike Generator (Salas por Seed)',
    category: 'organization',
    icon: 'dice-5',
    description: 'Gera nível/salas baseado em seed. Reutiliza PrefabObjects para salas modulares. Reinicia em cada "run".',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: true,
    defaults: {
      seed: 12345,
      roomCount: 5,
      gridSize: 12, // tamanho de cada sala em unidades
      // Prefabs de salas modulares que se encaixam (ID de PrefabObject)
      roomPrefabs: [], // array de sourcePrefabId
      corridorPrefab: null, // prefab do corredor entre salas
      // Estado interno da run atual
      _currentRun: 0,
      _generatedRooms: 0,
    },
    properties: [
      prop('seed', 'Seed', 'number', 12345, { min: 1, max: 99999, step: 1 }),
      prop('roomCount', 'Nº de salas', 'number', 5, { min: 1, max: 20, step: 1 }),
      prop('gridSize', 'Tamanho sala (unidades)', 'number', 12, { min: 4, max: 40, step: 1 }),
    ],
  },

  // ============ ORGANIZAÇÃO ============
  {
    type: 'GroupObject',
    label: 'Group Object',
    category: 'organization',
    icon: 'folder',
    description: 'Agrupa outros Conects sem corpo físico nem visual próprio (pasta/pai)',
    hasPhysics: false,
    hasVisual: false,
    flirScriptable: false,
    defaults: {
      children: [], // array de instanceIds
    },
    properties: [
      prop('children', 'Filhos', 'text', ''),
    ],
  },
  {
    type: 'ReferenceObject',
    label: 'Reference Object (Referência)',
    category: 'organization',
    icon: 'link-2',
    description: 'Mostra o conteúdo de outra cena sem duplicar dados. Editar o original atualiza aqui.',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: false,
    defaults: {
      targetSceneId: null,  // cena referenciada
    },
    properties: [
      prop('targetSceneId', 'Cena referenciada', 'text', ''),
    ],
  },

  // ============ REALISMO (Pós-Processamento) ============
  // Conects que activam efeitos de realismo avançado na cena.
  // Cada um tem um gizmo visual no editor + efeito real no runtime.

  {
    type: 'GIProbeObject',
    label: 'GI Probe (Iluminação Global)',
    category: 'realism',
    icon: 'sparkles',
    description: 'Iluminação global em tempo real — luz indirecta, color bleeding, bounce light',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: false,
    defaults: {
      intensity: 1.0,
      bounceCount: 2,
      resolution: 128,
      fadeDistance: 50,
      bias: 0.1,
    },
    properties: [
      prop('intensity', 'Intensidade', 'number', 1.0, { min: 0, max: 4, step: 0.1 }),
      prop('bounceCount', 'Bounces de luz', 'select', 2, { options: [1, 2, 3, 4] }),
      prop('resolution', 'Resolução octree', 'select', 128, { options: [64, 128, 256, 512] }),
      prop('fadeDistance', 'Distância de fade', 'number', 50, { min: 5, max: 200, step: 5 }),
      prop('bias', 'Bias (anti-acne)', 'number', 0.1, { min: 0, max: 1, step: 0.01 }),
    ],
  },
  {
    type: 'SSRObject',
    label: 'SSR (Screen Space Reflections)',
    category: 'realism',
    icon: 'mirror',
    description: 'Reflexos em tempo real baseados no ecrã — para superfícies polidas, água, metal',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: false,
    defaults: {
      intensity: 0.8,
      maxDistance: 50,
      roughnessFade: 0.5,
      thickness: 0.5,
      blend: 0.9,
    },
    properties: [
      prop('intensity', 'Intensidade', 'number', 0.8, { min: 0, max: 2, step: 0.05 }),
      prop('maxDistance', 'Distância máxima', 'number', 50, { min: 5, max: 200, step: 5 }),
      prop('roughnessFade', 'Fade por rugosidade', 'number', 0.5, { min: 0, max: 1, step: 0.05 }),
      prop('thickness', 'Espessura do ray', 'number', 0.5, { min: 0.01, max: 5, step: 0.05 }),
      prop('blend', 'Blend com cena', 'number', 0.9, { min: 0, max: 1, step: 0.05 }),
    ],
  },
  {
    type: 'VolumetricFogObject',
    label: 'Volumetric Fog (Fog 3D)',
    category: 'realism',
    icon: 'cloud',
    description: 'Fog volumétrico com god rays, scattering, anisotropia — para atmosfera cinematográfica',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: false,
    defaults: {
      density: 0.02,
      scattering: 0.5,
      anisotropy: 0.6,
      attenuationDistance: 30,
      godRays: true,
      color: '#a0c4ff',
    },
    properties: [
      prop('density', 'Densidade', 'number', 0.02, { min: 0, max: 0.5, step: 0.005 }),
      prop('scattering', 'Scattering', 'number', 0.5, { min: 0, max: 2, step: 0.05 }),
      prop('anisotropy', 'Anisotropia (god rays)', 'number', 0.6, { min: -1, max: 1, step: 0.05 }),
      prop('attenuationDistance', 'Distância atenuação', 'number', 30, { min: 5, max: 200, step: 5 }),
      prop('godRays', 'God Rays activos', 'boolean', true),
      prop('color', 'Cor do fog', 'color', '#a0c4ff'),
    ],
  },
  {
    type: 'SSSObject',
    label: 'Subsurface Scattering',
    category: 'realism',
    icon: 'droplet',
    description: 'Subsurface scattering para pele, cera, jade — luz atravessa o material',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: false,
    defaults: {
      intensity: 1.0,
      scatterColor: '#ffb088',
      scatterDistance: 0.1,
      power: 4.0,
      thicknessMap: null,
    },
    properties: [
      prop('intensity', 'Intensidade', 'number', 1.0, { min: 0, max: 3, step: 0.05 }),
      prop('scatterColor', 'Cor interior', 'color', '#ffb088'),
      prop('scatterDistance', 'Distância de scatter', 'number', 0.1, { min: 0.01, max: 1, step: 0.01 }),
      prop('power', 'Power (curva)', 'number', 4.0, { min: 1, max: 16, step: 0.5 }),
    ],
  },
  {
    type: 'BloomObject',
    label: 'Bloom (HDR Glow)',
    category: 'realism',
    icon: 'sun',
    description: 'Bloom HDR — brilho em torno de fontes de luz, superfícies emissivas',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: false,
    defaults: {
      intensity: 1.0,
      threshold: 0.8,
      radius: 0.4,
      mipmapBlur: true,
    },
    properties: [
      prop('intensity', 'Intensidade', 'number', 1.0, { min: 0, max: 4, step: 0.05 }),
      prop('threshold', 'Threshold (luminância)', 'number', 0.8, { min: 0, max: 2, step: 0.05 }),
      prop('radius', 'Raio do blur', 'number', 0.4, { min: 0, max: 2, step: 0.05 }),
      prop('mipmapBlur', 'Mipmap blur (suave)', 'boolean', true),
    ],
  },
  {
    type: 'DOFObject',
    label: 'Depth of Field (Profundidade)',
    category: 'realism',
    icon: 'camera',
    description: 'Depth of Field cinematográfico — fundo fora de foco',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: false,
    defaults: {
      focusDistance: 10,
      focusRange: 5,
      bokeh: 0.02,
      aperture: 0.0008,
    },
    properties: [
      prop('focusDistance', 'Distância de foco', 'number', 10, { min: 0.5, max: 100, step: 0.5 }),
      prop('focusRange', 'Gama de foco', 'number', 5, { min: 0.1, max: 50, step: 0.5 }),
      prop('bokeh', 'Bokeh size', 'number', 0.02, { min: 0, max: 0.2, step: 0.005 }),
      prop('aperture', 'Aperture (f-stop)', 'number', 0.0008, { min: 0, max: 0.01, step: 0.0001 }),
    ],
  },

  // ============ MARCADORES / MODIFICADORES DE PONTO ============
  // Para marcar pontos específicos num modelo (ex: ponta de espada,
  // boca de personagem, ponto de fixação de capa).

  {
    type: 'EmptyObject',
    label: 'Empty (Ponto Vazio)',
    category: 'organization',
    icon: 'target',
    description: 'Ponto de referência vazio — para ancorar outros objetos, marcar posições',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: false,
    defaults: {},
    properties: [],
  },
  {
    type: 'ArrowMarker',
    label: 'Arrow Marker (Seta Direccional)',
    category: 'organization',
    icon: 'arrow-up',
    description: 'Seta 3D para indicar direcção — útil para fluxo, orientação, modify points',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: false,
    defaults: {
      direction: [0, 1, 0],
      length: 1.5,
      color: '#fbbf24',
    },
    properties: [
      prop('direction', 'Direcção (X,Y,Z)', 'vec3', [0, 1, 0]),
      prop('length', 'Comprimento', 'number', 1.5, { min: 0.1, max: 10, step: 0.1 }),
      prop('color', 'Cor', 'color', '#fbbf24'),
    ],
  },
  {
    type: 'PointMarker',
    label: 'Point Marker (Ponto de Marcação)',
    category: 'organization',
    icon: 'target',
    description: 'Ponto exacto num modelo — para fixação de acessórios, sockets, attach points',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: false,
    defaults: {
      size: 0.3,
      color: '#10b981',
      label: '',
      attachBone: null,
    },
    properties: [
      prop('size', 'Tamanho', 'number', 0.3, { min: 0.05, max: 2, step: 0.05 }),
      prop('color', 'Cor', 'color', '#10b981'),
      prop('label', 'Etiqueta', 'text', ''),
      prop('attachBone', 'Osso pai (rigging)', 'text', ''),
    ],
  },

  // ============ ÁGUA SUPER-REALISTA ============
  {
    type: 'RealWaterObject',
    label: 'Real Water (Água Ultra-Realista)',
    category: 'environment',
    icon: 'waves',
    description: 'Água com fluxo, refração, reflexão SSR, espuma, ondas Gerstner, profundidade',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: false,
    defaults: {
      size: [50, 50],
      segments: 128,
      color: '#1e90ff',
      deepColor: '#0a3d5c',
      clarity: 0.85,
      refraction: 0.4,
      reflection: 0.6,
      flowSpeed: 0.5,
      waveHeight: 0.3,
      waveFrequency: 1.0,
      foamThreshold: 0.7,
      foamColor: '#ffffff',
      sunDirection: [0.5, 0.8, 0.3],
      sunShininess: 80,
      fresnelPower: 5.0,
      ior: 1.333,
      // Fase 4 — High Realism
      windDirection: [1.0, 0.0],
      windStrength: 0.3,
      dynamicFoam: true,
      foamIntensity: 0.8,
      depthGradient: true,
    },
    properties: [
      prop('size', 'Tamanho (X,Z)', 'vec2', [50, 50]),
      prop('segments', 'Resolução', 'select', 128, { options: [32, 64, 128, 256] }),
      prop('color', 'Cor superfície', 'color', '#1e90ff'),
      prop('deepColor', 'Cor profundo', 'color', '#0a3d5c'),
      prop('clarity', 'Clareza (transparência)', 'number', 0.85, { min: 0, max: 1, step: 0.05 }),
      prop('refraction', 'Refração', 'number', 0.4, { min: 0, max: 1, step: 0.05 }),
      prop('reflection', 'Reflexão', 'number', 0.6, { min: 0, max: 1, step: 0.05 }),
      prop('flowSpeed', 'Velocidade do fluxo', 'number', 0.5, { min: 0, max: 3, step: 0.05 }),
      prop('waveHeight', 'Altura das ondas', 'number', 0.3, { min: 0, max: 2, step: 0.05 }),
      prop('waveFrequency', 'Frequência das ondas', 'number', 1.0, { min: 0.1, max: 5, step: 0.1 }),
      prop('foamThreshold', 'Threshold de espuma', 'number', 0.7, { min: 0, max: 1, step: 0.05 }),
      prop('foamColor', 'Cor da espuma', 'color', '#ffffff'),
      prop('fresnelPower', 'Poder Fresnel', 'number', 5.0, { min: 1, max: 10, step: 0.5 }),
      prop('ior', 'IOR (índice refracção)', 'number', 1.333, { min: 1.0, max: 2.5, step: 0.01 }),
      // Fase 4 — High Realism
      prop('windStrength', 'Vento: Força', 'number', 0.3, { min: 0, max: 1, step: 0.05 }),
      prop('dynamicFoam', 'Espuma dinâmica', 'boolean', true),
      prop('foamIntensity', 'Intensidade da espuma', 'number', 0.8, { min: 0, max: 1.5, step: 0.1 }),
      prop('depthGradient', 'Gradiente de profundidade', 'boolean', true),
    ],
  },
  // Fase 8 — Sistema de Diálogos
  {
    type: 'DialogueObject',
    label: 'Dialogue Object (Diálogo NPC)',
    category: 'gameplay',
    icon: 'message-circle',
    description: 'Sistema de diálogo com árvore de nós e escolhas. Usar startDialogue() no FlirCode.',
    hasPhysics: false,
    hasVisual: true,
    flirScriptable: true,
    defaults: {
      npcName: 'NPC',
      triggerRadius: 3,
      autoStart: false,
      dialogueTree: null, // JSON da árvore de diálogo (null = criar no editor)
    },
    properties: [
      prop('npcName', 'Nome do NPC', 'text', 'NPC'),
      prop('triggerRadius', 'Raio de ativação', 'number', 3, { min: 1, max: 20, step: 0.5 }),
      prop('autoStart', 'Iniciar automaticamente ao aproximar', 'boolean', false),
    ],
  },
]

// Helpers
export function findConectDefinition(type) {
  return CONECT_TAXONOMY.find((c) => c.type === type)
}

export function conectsByCategory(category) {
  return CONECT_TAXONOMY.filter((c) => c.category === category)
}

// Sistema 1: injetar propriedades de colisor independente em todos os Conects
// com hasPhysics: true. Garante que qualquer Conect de física tem as
// propriedades colliderShape, colliderSize, colliderOffset, etc.
CONECT_TAXONOMY.forEach((conect) => {
  if (conect.hasPhysics) {
    conect.properties = [...conect.properties, ...colliderProps()]
    conect.defaults = {
      ...conect.defaults,
      colliderShape: 'model',
      colliderSize: [1, 1, 1],
      colliderOffset: [0, 0, 0],
      colliderRadius: 0.5,
      colliderHeight: 1.5,
    }
  }
})

// Cria uma instância com valores predefinidos sensatos
export function createConectInstance(type, position = [0, 0.5, 0]) {
  const def = findConectDefinition(type)
  if (!def) throw new Error(`Conect desconhecido: ${type}`)
  // ViewObject tem posição default diferente — deve estar afastada para ver a cena
  if (type === 'ViewObject') {
    position = [5, 4, 6]
  }
  const defaults = {}
  for (const propDef of def.properties) {
    defaults[propDef.key] = JSON.parse(JSON.stringify(propDef.default))
  }
  return {
    instanceId: `conect_${Math.random().toString(36).slice(2, 10)}`,
    type,
    name: `${def.label}`,
    position: [...position],
    rotation: type === 'ViewObject' ? [-0.5, 0.7, 0] : [0, 0, 0],
    scale: [1, 1, 1],
    visible: def.hasVisual !== false,
    flirScript: null, // grafo FlirScript opcional
    ...defaults,
    ...def.defaults, // garantir que defaults da taxonomy também ficam
  }
}

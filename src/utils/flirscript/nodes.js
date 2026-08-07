/**
 * nodes.js — definição de todos os nós FlirScript disponíveis.
 *
 * Cada nó é registado no LiteGraph com um tipo (path) único, entradas (inputs)
 * e saídas (outputs). Os nós executam lógica no método `onExecute`.
 *
 * Categorias:
 *  - Eventos: BeginPlay, Tick, OnCollision, OnTouch, OnEnterZone, OnExitZone
 *  - Ações: Move, Rotate, PlayAnimation, PlaySound, Destroy, Spawn, ChangeScene, SetVisible
 *  - Lógica: Branch, Compare, Math (+, -, *, /), Loop, Delay
 *  - Variáveis: GetVar, SetVar, GetHealth, SetHealth, GetScore, SetScore, GetSpeed, SetSpeed
 *  - Input: OnTouchScreen, OnSwipe, VirtualButton
 *
 * Nota: os nós são declarados como classes que herdam de LGraphNode.
 * O runtime (executor.js) percorre o grafo a partir dos nós de Evento.
 */

// Vamos importar LiteGraph dinamicamente onde necessário.
// Aqui apenas exportamos os metadados e o registo.

export const NODE_CATEGORIES = [
  { id: 'events', label: 'Eventos', icon: '⚡', color: '#f4a261' },
  { id: 'actions', label: 'Ações', icon: '🎬', color: '#2a9d8f' },
  { id: 'logic', label: 'Lógica', icon: '🔀', color: '#8957e5' },
  { id: 'variables', label: 'Variáveis', icon: '📦', color: '#2f81f7' },
  { id: 'input', label: 'Input', icon: '👆', color: '#e63946' },
]

// Metadados de todos os nós (para mostrar no painel "adicionar nó")
// Cada entrada tem: type (path LiteGraph), label, category, description, inputs, outputs
export const NODE_DEFINITIONS = [
  // ===== Eventos =====
  {
    type: 'event/beginPlay',
    label: 'Início do Jogo',
    category: 'events',
    description: 'Dispara uma vez quando o jogo começa (BeginPlay)',
    inputs: [],
    outputs: [{ name: 'exec', type: 'exec' }],
    isEvent: true,
  },
  {
    type: 'event/tick',
    label: 'A cada frame',
    category: 'events',
    description: 'Dispara a cada frame (Tick) — usado para lógica contínua',
    inputs: [],
    outputs: [
      { name: 'exec', type: 'exec' },
      { name: 'deltaTime', type: 'number' },
    ],
    isEvent: true,
  },
  {
    type: 'event/onCollision',
    label: 'Ao colidir',
    category: 'events',
    description: 'Dispara quando este objeto colide com outro',
    inputs: [],
    outputs: [
      { name: 'exec', type: 'exec' },
      { name: 'other', type: 'object' },
    ],
    isEvent: true,
  },
  {
    type: 'event/onTouch',
    label: 'Ao tocar no objeto',
    category: 'events',
    description: 'Dispara quando o utilizador toca/clica neste objeto',
    inputs: [],
    outputs: [{ name: 'exec', type: 'exec' }],
    isEvent: true,
  },
  {
    type: 'event/onEnterZone',
    label: 'Ao entrar na zona',
    category: 'events',
    description: 'Dispara quando um objeto entra numa zona/trigger',
    inputs: [],
    outputs: [
      { name: 'exec', type: 'exec' },
      { name: 'other', type: 'object' },
    ],
    isEvent: true,
  },
  {
    type: 'event/onExitZone',
    label: 'Ao sair da zona',
    category: 'events',
    description: 'Dispara quando um objeto sai de uma zona/trigger',
    inputs: [],
    outputs: [
      { name: 'exec', type: 'exec' },
      { name: 'other', type: 'object' },
    ],
    isEvent: true,
  },

  // ===== Ações =====
  {
    type: 'action/move',
    label: 'Mover objeto',
    category: 'actions',
    description: 'Move o objeto numa direção com velocidade',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'direction', type: 'vec3', default: [0, 0, 1] },
      { name: 'speed', type: 'number', default: 1 },
    ],
    outputs: [{ name: 'exec', type: 'exec' }],
  },
  {
    type: 'action/rotate',
    label: 'Rodar objeto',
    category: 'actions',
    description: 'Roda o objeto nos eixos X/Y/Z',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'rotation', type: 'vec3', default: [0, 90, 0] },
    ],
    outputs: [{ name: 'exec', type: 'exec' }],
  },
  {
    type: 'action/playAnimation',
    label: 'Tocar animação',
    category: 'actions',
    description: 'Toca um clip de animação criado na app',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'clip', type: 'string', default: 'idle' },
    ],
    outputs: [{ name: 'exec', type: 'exec' }],
  },
  {
    type: 'action/playSound',
    label: 'Tocar som',
    category: 'actions',
    description: 'Toca um som (URL ou nome do ficheiro)',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'sound', type: 'string', default: 'som.mp3' },
    ],
    outputs: [{ name: 'exec', type: 'exec' }],
  },
  {
    type: 'action/destroy',
    label: 'Destruir objeto',
    category: 'actions',
    description: 'Remove este objeto da cena',
    inputs: [{ name: 'exec', type: 'exec' }],
    outputs: [{ name: 'exec', type: 'exec' }],
  },
  {
    type: 'action/spawn',
    label: 'Criar objeto (spawn)',
    category: 'actions',
    description: 'Cria uma nova instância de um objeto do catálogo',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'objectName', type: 'string', default: 'Cubo' },
      { name: 'position', type: 'vec3', default: [0, 0.5, 0] },
    ],
    outputs: [{ name: 'exec', type: 'exec' }],
  },
  {
    type: 'action/changeScene',
    label: 'Mudar de cena',
    category: 'actions',
    description: 'Muda para outra cena/nível do projeto',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'sceneName', type: 'string', default: 'Nível 2' },
    ],
    outputs: [{ name: 'exec', type: 'exec' }],
  },
  {
    type: 'action/setVisible',
    label: 'Mostrar/Esconder',
    category: 'actions',
    description: 'Mostra ou esconde o objeto',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'visible', type: 'boolean', default: true },
    ],
    outputs: [{ name: 'exec', type: 'exec' }],
  },

  // ===== Lógica =====
  {
    type: 'logic/branch',
    label: 'Se/Senão (Branch)',
    category: 'logic',
    description: 'Ramifica o fluxo consoante uma condição booleana',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'condition', type: 'boolean', default: false },
    ],
    outputs: [
      { name: 'true', type: 'exec' },
      { name: 'false', type: 'exec' },
    ],
  },
  {
    type: 'logic/compare',
    label: 'Comparar valores',
    category: 'logic',
    description: 'Compara dois valores (maior, menor, igual, diferente)',
    inputs: [
      { name: 'a', type: 'number', default: 0 },
      { name: 'b', type: 'number', default: 0 },
    ],
    outputs: [{ name: 'result', type: 'boolean' }],
    properties: { operator: '>' },
  },
  {
    type: 'logic/math',
    label: 'Operação matemática',
    category: 'logic',
    description: 'Soma, subtrai, multiplica ou divide dois números',
    inputs: [
      { name: 'a', type: 'number', default: 0 },
      { name: 'b', type: 'number', default: 0 },
    ],
    outputs: [{ name: 'result', type: 'number' }],
    properties: { operator: '+' },
  },
  {
    type: 'logic/loop',
    label: 'Ciclo (loop)',
    category: 'logic',
    description: 'Repete N vezes (máximo 1000 para evitar loops infinitos)',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'count', type: 'number', default: 5 },
    ],
    outputs: [
      { name: 'loop', type: 'exec' },
      { name: 'index', type: 'number' },
      { name: 'done', type: 'exec' },
    ],
  },
  {
    type: 'logic/delay',
    label: 'Espera (delay)',
    category: 'logic',
    description: 'Espera N segundos antes de continuar',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'seconds', type: 'number', default: 1 },
    ],
    outputs: [{ name: 'exec', type: 'exec' }],
  },

  // ===== Variáveis =====
  {
    type: 'var/getVar',
    label: 'Ler variável',
    category: 'variables',
    description: 'Lê o valor de uma variável (do objeto ou global)',
    inputs: [],
    outputs: [{ name: 'value', type: 'any' }],
    properties: { varName: 'minhaVar', scope: 'object' }, // 'object' | 'global'
  },
  {
    type: 'var/setVar',
    label: 'Escrever variável',
    category: 'variables',
    description: 'Define o valor de uma variável (do objeto ou global)',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'value', type: 'any', default: 0 },
    ],
    outputs: [{ name: 'exec', type: 'exec' }],
    properties: { varName: 'minhaVar', scope: 'object' },
  },
  {
    type: 'var/getHealth',
    label: 'Ler vida (health)',
    category: 'variables',
    description: 'Lê a vida atual do objeto',
    inputs: [],
    outputs: [{ name: 'health', type: 'number' }],
  },
  {
    type: 'var/setHealth',
    label: 'Definir vida',
    category: 'variables',
    description: 'Define a vida do objeto (com mínimo 0)',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'health', type: 'number', default: 100 },
    ],
    outputs: [{ name: 'exec', type: 'exec' }],
  },
  {
    type: 'var/getScore',
    label: 'Ler pontuação',
    category: 'variables',
    description: 'Lê a pontuação global do jogo',
    inputs: [],
    outputs: [{ name: 'score', type: 'number' }],
  },
  {
    type: 'var/setScore',
    label: 'Definir pontuação',
    category: 'variables',
    description: 'Define a pontuação global do jogo',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'score', type: 'number', default: 0 },
    ],
    outputs: [{ name: 'exec', type: 'exec' }],
  },
  {
    type: 'var/getSpeed',
    label: 'Ler velocidade',
    category: 'variables',
    description: 'Lê a velocidade atual do objeto',
    inputs: [],
    outputs: [{ name: 'speed', type: 'number' }],
  },
  {
    type: 'var/setSpeed',
    label: 'Definir velocidade',
    category: 'variables',
    description: 'Define a velocidade do objeto',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'speed', type: 'number', default: 1 },
    ],
    outputs: [{ name: 'exec', type: 'exec' }],
  },

  // ===== Input =====
  {
    type: 'input/onTouchScreen',
    label: 'Toque na tela',
    category: 'input',
    description: 'Dispara quando o utilizador toca na tela (devolve X/Y)',
    inputs: [],
    outputs: [
      { name: 'exec', type: 'exec' },
      { name: 'x', type: 'number' },
      { name: 'y', type: 'number' },
    ],
    isEvent: true,
  },
  {
    type: 'input/onSwipe',
    label: 'Swipe (deslizar)',
    category: 'input',
    description: 'Dispara quando o utilizador faz swipe (devolve direção)',
    inputs: [],
    outputs: [
      { name: 'exec', type: 'exec' },
      { name: 'direction', type: 'string' }, // 'up' | 'down' | 'left' | 'right'
    ],
    isEvent: true,
  },
  {
    type: 'input/virtualButton',
    label: 'Botão virtual',
    category: 'input',
    description: 'Botão virtual configurável (joystick ou ação)',
    inputs: [],
    outputs: [
      { name: 'onPress', type: 'exec' },
      { name: 'onRelease', type: 'exec' },
      { name: 'isPressed', type: 'boolean' },
    ],
    properties: { label: 'Ação', buttonId: 'action1' },
  },

  // ===== Constantes / utilitários =====
  {
    type: 'const/number',
    label: 'Número',
    category: 'variables',
    description: 'Constante numérica',
    inputs: [],
    outputs: [{ name: 'value', type: 'number' }],
    properties: { value: 1 },
  },
  {
    type: 'const/string',
    label: 'Texto',
    category: 'variables',
    description: 'Constante de texto',
    inputs: [],
    outputs: [{ name: 'value', type: 'string' }],
    properties: { value: 'olá' },
  },
  {
    type: 'const/boolean',
    label: 'Verdadeiro/Falso',
    category: 'variables',
    description: 'Constante booleana',
    inputs: [],
    outputs: [{ name: 'value', type: 'boolean' }],
    properties: { value: true },
  },
  {
    type: 'const/vec3',
    label: 'Vetor 3D',
    category: 'variables',
    description: 'Constante vetorial (X, Y, Z)',
    inputs: [],
    outputs: [{ name: 'value', type: 'vec3' }],
    properties: { value: [0, 0, 0] },
  },

  // ===== Debug =====
  {
    type: 'debug/print',
    label: 'Imprimir / Log',
    category: 'variables',
    description: 'Imprime uma mensagem na Consola de Debug durante o jogo',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'message', type: 'any', default: 'Olá mundo' },
    ],
    outputs: [{ name: 'exec', type: 'exec' }],
  },
  {
    type: 'debug/warning',
    label: 'Aviso (Warning)',
    category: 'variables',
    description: 'Imprime um aviso na Consola de Debug',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'message', type: 'any', default: 'Atenção!' },
    ],
    outputs: [{ name: 'exec', type: 'exec' }],
  },
  {
    type: 'debug/error',
    label: 'Erro',
    category: 'variables',
    description: 'Imprime um erro na Consola de Debug',
    inputs: [
      { name: 'exec', type: 'exec' },
      { name: 'message', type: 'any', default: 'Erro!' },
    ],
    outputs: [{ name: 'exec', type: 'exec' }],
  },
]

// Helper: procura a definição de um nó pelo seu tipo
export function findNodeDefinition(type) {
  return NODE_DEFINITIONS.find((n) => n.type === type)
}

// Helper: lista todas as definições de uma categoria
export function nodesByCategory(category) {
  return NODE_DEFINITIONS.filter((n) => n.category === category)
}

/**
 * executor.js — runtime do FlirScript.
 *
 * Executa um grafo de nós para um objeto da cena, tratando:
 *  - Eventos (BeginPlay, Tick, OnCollision, OnTouch, etc.)
 *  - Fluxo exec (pinos de execução ligados por fios)
 *  - Avaliação de dados (pinos de dados: number, string, boolean, vec3)
 *  - Variáveis (por objeto e globais)
 *  - Ações (mover, rodar, destruir, spawn, mudar de cena, etc.)
 *  - Lógica (branch, loop com limite, delay, compare, math)
 *  - Input (toque, swipe, botões virtuais)
 *
 * API exposta:
 *  - createRuntime(graphData)           — cria instância de runtime a partir do grafo serializado
 *  - runtime.triggerEvent(eventName, payload)  — dispara um evento (beginPlay, tick, onTouch, etc.)
 *  - runtime.update(deltaTime)          — chama a cada frame (trata delays, loops, ticks)
 *  - runtime.dispose()                  — limpa o runtime
 *  - validateGraph(graphData)           — valida o grafo antes de executar (devolve lista de erros)
 *
 * Contexto de execução (gameContext):
 *  - objects: instâncias de objetos da cena (com refs aos meshes THREE)
 *  - getVar/setVar: acesso a variáveis
 *  - spawnObject, changeScene, destroyObject: ações que afetam a cena
 *  - playSound, playAnimation: ações de áudio/anim
 */
import { LiteGraph } from 'litegraph.js'
import { registerFlirScriptNodes } from './register'
import { findNodeDefinition } from './nodes'

// Regista nós uma vez
registerFlirScriptNodes()

const MAX_LOOP_ITERATIONS = 1000
const MAX_DELAY_SECONDS = 60

// ============ Validação ============
// Verifica se o grafo é válido antes de executar.
// Devolve array de erros (vazio se OK).
export function validateGraph(graphData) {
  const errors = []
  if (!graphData || !graphData.nodes) return [{ message: 'Grafo vazio' }]

  const nodes = graphData.nodes
  const links = graphData.links || []

  // Verifica se há pelo menos um nó de evento
  const hasEvent = nodes.some((n) => {
    const def = findNodeDefinition(n.type)
    return def?.isEvent
  })
  if (!hasEvent && nodes.length > 0) {
    errors.push({ message: 'O grafo precisa de pelo menos um nó de Evento (BeginPlay, Tick, etc.)' })
  }

  // Verifica se há nós com tipo desconhecido
  for (const node of nodes) {
    const def = findNodeDefinition(node.type)
    if (!def) {
      errors.push({ nodeId: node.id, message: `Tipo de nó desconhecido: ${node.type}` })
    }
  }

  // Verifica ligações: cada link deve ter origem_id, origin_slot, target_id, target_slot válidos
  for (const link of links) {
    if (!Array.isArray(link) || link.length < 5) {
      errors.push({ message: 'Ligação mal formada' })
      continue
    }
    const [id, originId, originSlot, targetId, targetSlot] = link
    const originNode = nodes.find((n) => n.id === originId)
    const targetNode = nodes.find((n) => n.id === targetId)
    if (!originNode || !targetNode) {
      errors.push({ message: `Ligação ${id} referencia nó inexistente` })
    }
  }

  // Verifica se há loops infinitos potenciais (nós logic/loop sem count limit)
  // — não é trivial detetar, mas podemos avisar sobre loops sem nó de saída

  return errors
}

// ============ Runtime ============
export function createFlirScriptRuntime(graphData, gameContext) {
  // Cria um LGraph a partir dos dados serializados
  const graph = new LiteGraph.LGraph()
  graph.configure(graphData)

  // Variáveis persistidas durante a execução
  const variables = {
    object: {},
    global: gameContext.globalVars || {},
  }

  // Estado de delays pendentes
  const pendingDelays = []

  // Estado de loops ativos (não persistente entre triggers)
  // Para simplicidade, loops são executados síncronos mas com limite.

  const runtime = {
    graph,
    gameContext,

    // Dispara um evento: encontra todos os nós do tipo correspondente e executa
    triggerEvent(eventName, payload = {}) {
      const eventNodeTypes = {
        beginPlay: 'event/beginPlay',
        tick: 'event/tick',
        onCollision: 'event/onCollision',
        onTouch: 'event/onTouch',
        onEnterZone: 'event/onEnterZone',
        onExitZone: 'event/onExitZone',
        onTouchScreen: 'input/onTouchScreen',
        onSwipe: 'input/onSwipe',
      }
      const nodeType = eventNodeTypes[eventName]
      if (!nodeType) return

      // Encontrar todos os nós desse tipo
      const eventNodes = graph.nodes.filter((n) => n.type === nodeType)
      for (const node of eventNodes) {
        // Para eventos Tick, definir o output deltaTime
        if (eventName === 'tick' && node.outputs?.[1]) {
          node.setOutputData(1, payload.deltaTime || 0.016)
        }
        if (eventName === 'onCollision' && node.outputs?.[1]) {
          node.setOutputData(1, payload.other || null)
        }
        if (eventName === 'onTouchScreen' && node.outputs?.[1]) {
          node.setOutputData(1, payload.x || 0)
          node.setOutputData(2, payload.y || 0)
        }
        if (eventName === 'onSwipe' && node.outputs?.[1]) {
          node.setOutputData(1, payload.direction || 'up')
        }
        // Trigger o output exec[0]
        if (node.outputs?.[0]) {
          executeFromNode(node, 0, payload)
        }
      }
    },

    // Chamado a cada frame: processa delays pendentes e dispara Tick
    update(deltaTime) {
      // Processar delays
      const now = performance.now()
      for (let i = pendingDelays.length - 1; i >= 0; i--) {
        const d = pendingDelays[i]
        if (now >= d.fireAt) {
          pendingDelays.splice(i, 1)
          if (d.node && d.node.outputs?.[0]) {
            executeFromNode(d.node, 0, {})
          }
        }
      }
    },

    dispose() {
      pendingDelays.length = 0
      graph.clear()
    },
  }

  // ============ Função interna: executar a partir de um nó ============
  function executeFromNode(node, outputSlot, payload) {
    if (!node) return

    const def = findNodeDefinition(node.type)
    if (!def) return

    // Ler dados dos inputs (recursivamente se vierem de outro nó)
    const readInput = (slot) => {
      const inputData = node.getInputData(slot)
      if (inputData !== undefined && inputData !== null) {
        return inputData
      }
      // Fallback para o valor padrão
      const inputDef = def.inputs?.[slot]
      return inputDef?.default
    }

    // Executar lógica consoante o tipo de nó
    switch (node.type) {
      // ===== Eventos ===== (nada a fazer aqui — já foram triggered)
      case 'event/beginPlay':
      case 'event/tick':
      case 'event/onCollision':
      case 'event/onTouch':
      case 'event/onEnterZone':
      case 'event/onExitZone':
      case 'input/onTouchScreen':
      case 'input/onSwipe':
        propagateExec(node, 0, payload)
        break

      // ===== Ações =====
      case 'action/move': {
        const direction = readInput(1) || [0, 0, 1]
        const speed = readInput(2) ?? 1
        gameContext.moveObject?.(node._instanceId, direction, speed)
        propagateExec(node, 0, payload)
        break
      }
      case 'action/rotate': {
        const rotation = readInput(1) || [0, 90, 0]
        gameContext.rotateObject?.(node._instanceId, rotation)
        propagateExec(node, 0, payload)
        break
      }
      case 'action/playAnimation': {
        const clip = readInput(1) || 'idle'
        gameContext.playAnimation?.(node._instanceId, clip)
        propagateExec(node, 0, payload)
        break
      }
      case 'action/playSound': {
        const sound = readInput(1) || ''
        gameContext.playSound?.(sound)
        propagateExec(node, 0, payload)
        break
      }
      case 'action/destroy': {
        gameContext.destroyObject?.(node._instanceId)
        propagateExec(node, 0, payload)
        break
      }
      case 'action/spawn': {
        const objectName = readInput(1) || 'Cubo'
        const position = readInput(2) || [0, 0.5, 0]
        gameContext.spawnObject?.(objectName, position)
        propagateExec(node, 0, payload)
        break
      }
      case 'action/changeScene': {
        const sceneName = readInput(1) || 'Nível 2'
        gameContext.changeScene?.(sceneName)
        propagateExec(node, 0, payload)
        break
      }
      case 'action/setVisible': {
        const visible = readInput(1) ?? true
        gameContext.setVisible?.(node._instanceId, visible)
        propagateExec(node, 0, payload)
        break
      }

      // ===== Lógica =====
      case 'logic/branch': {
        const condition = readInput(1) ?? false
        propagateExec(node, condition ? 0 : 1, payload)
        break
      }
      case 'logic/compare': {
        const a = readInput(0) ?? 0
        const b = readInput(1) ?? 0
        const op = node.properties.operator || '>'
        let result = false
        switch (op) {
          case '>': result = a > b; break
          case '<': result = a < b; break
          case '==': result = a === b; break
          case '!=': result = a !== b; break
          case '>=': result = a >= b; break
          case '<=': result = a <= b; break
        }
        node.setOutputData(0, result)
        break
      }
      case 'logic/math': {
        const a = readInput(0) ?? 0
        const b = readInput(1) ?? 0
        const op = node.properties.operator || '+'
        let result = 0
        switch (op) {
          case '+': result = a + b; break
          case '-': result = a - b; break
          case '*': result = a * b; break
          case '/': result = b !== 0 ? a / b : 0; break
        }
        node.setOutputData(0, result)
        break
      }
      case 'logic/loop': {
        const count = Math.min(MAX_LOOP_ITERATIONS, readInput(1) ?? 5)
        // Executa o output 'loop' N vezes, depois 'done'
        for (let i = 0; i < count; i++) {
          if (node.outputs?.[1]) node.setOutputData(1, i)
          propagateExec(node, 0, { ...payload, loopIndex: i })
        }
        propagateExec(node, 2, payload)
        break
      }
      case 'logic/delay': {
        const seconds = Math.min(MAX_DELAY_SECONDS, readInput(1) ?? 1)
        pendingDelays.push({
          node,
          fireAt: performance.now() + seconds * 1000,
        })
        // Não propaga exec agora — será feito no update()
        break
      }

      // ===== Variáveis =====
      case 'var/getVar': {
        const varName = node.properties.varName || 'minhaVar'
        const scope = node.properties.scope || 'object'
        const value = variables[scope][varName]
        node.setOutputData(0, value)
        break
      }
      case 'var/setVar': {
        const varName = node.properties.varName || 'minhaVar'
        const scope = node.properties.scope || 'object'
        const value = readInput(1)
        variables[scope][varName] = value
        propagateExec(node, 0, payload)
        break
      }
      case 'var/getHealth': {
        node.setOutputData(0, variables.object._health ?? 100)
        break
      }
      case 'var/setHealth': {
        const health = Math.max(0, readInput(1) ?? 100)
        variables.object._health = health
        propagateExec(node, 0, payload)
        break
      }
      case 'var/getScore': {
        node.setOutputData(0, variables.global._score ?? 0)
        break
      }
      case 'var/setScore': {
        const score = readInput(1) ?? 0
        variables.global._score = score
        propagateExec(node, 0, payload)
        break
      }
      case 'var/getSpeed': {
        node.setOutputData(0, variables.object._speed ?? 1)
        break
      }
      case 'var/setSpeed': {
        const speed = readInput(1) ?? 1
        variables.object._speed = speed
        propagateExec(node, 0, payload)
        break
      }

      // ===== Constantes =====
      case 'const/number': {
        node.setOutputData(0, node.properties.value ?? 0)
        break
      }
      case 'const/string': {
        node.setOutputData(0, node.properties.value ?? '')
        break
      }
      case 'const/boolean': {
        node.setOutputData(0, node.properties.value ?? false)
        break
      }
      case 'const/vec3': {
        const v = node.properties.value || [0, 0, 0]
        node.setOutputData(0, [v[0], v[1], v[2]])
        break
      }

      default:
        // Nó desconhecido — apenas propaga exec
        propagateExec(node, 0, payload)
    }
  }

  // Propaga o sinal exec para o nó ligado ao outputSlot do node
  function propagateExec(node, outputSlot, payload) {
    const links = graph.links
    if (!links) return
    // Encontrar o link que sai deste nó/outputSlot
    const outputLink = node.outputs?.[outputSlot]?.links
    if (!outputLink || outputLink.length === 0) return
    for (const linkId of outputLink) {
      const link = links.get(linkId)
      if (!link) continue
      const [targetNode, targetSlot] = [link.target_id, link.target_slot]
      const target = graph.getNodeById(targetNode)
      if (target) {
        executeFromNode(target, targetSlot, payload)
      }
    }
  }

  return runtime
}

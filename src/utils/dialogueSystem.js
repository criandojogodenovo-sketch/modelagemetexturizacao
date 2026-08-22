/**
 * dialogueSystem.js — Sistema de diálogos para Flir Engine.
 *
 * Fase 8 — Gerador de Diálogos.
 *
 * Permite criar árvores de diálogo com nós e escolhas.
 * Cada árvore tem nós de texto + escolhas que levam a outros nós.
 *
 * Estrutura de uma árvore de diálogo:
 * {
 *   id: 'dlg_001',
 *   npcName: 'Mercador',
 *   nodes: [
 *     {
 *       id: 'node_start',
 *       text: 'Olá, viajante! Posso ajudar?',
 *       choices: [
 *         { id: 'c1', text: 'Quero comprar algo', nextNodeId: 'node_shop', action: 'openShop' },
 *         { id: 'c2', text: 'Tens informações?', nextNodeId: 'node_info' },
 *         { id: 'c3', text: 'Adeus', nextNodeId: null, action: 'endDialogue' },
 *       ],
 *     },
 *     { id: 'node_shop', text: 'Aqui está a minha mercadoria.', choices: [...] },
 *     { id: 'node_info', text: 'O rei está procura heróis...', choices: [...] },
 *   ],
 *   startNodeId: 'node_start',
 * }
 *
 * API:
 *  - createDialogueTree(npcName) → tree
 *  - startDialogue(treeId, gameContext) → começa diálogo
 *  - chooseOption(choiceId) → processa escolha
 *  - getCurrentNode() → nó atual
 *  - endDialogue() → termina diálogo
 *
 * FlirCode integration:
 *  - gameContext.startDialogue('npcId')
 *  - onDialogueChoice(choiceId, action)
 *  - onDialogueEnd()
 */

let _dialogueTrees = new Map()
let _activeDialogue = null
let _listeners = new Set()

/**
 * Cria uma nova árvore de diálogo vazia.
 * @param {string} npcName — Nome do NPC
 * @returns {object} — árvore de diálogo
 */
export function createDialogueTree(npcName = 'NPC') {
  const tree = {
    id: `dlg_${Math.random().toString(36).slice(2, 10)}`,
    npcName,
    nodes: [],
    startNodeId: null,
  }
  // Adicionar nó inicial
  const startNode = {
    id: 'node_start',
    text: `Olá! Sou ${npcName}.`,
    choices: [
      { id: 'c_end', text: 'Adeus', nextNodeId: null, action: 'endDialogue' },
    ],
  }
  tree.nodes.push(startNode)
  tree.startNodeId = 'node_start'
  _dialogueTrees.set(tree.id, tree)
  return tree
}

/**
 * Adiciona um nó a uma árvore de diálogo.
 * @param {string} treeId — ID da árvore
 * @param {object} node — { id, text, choices: [{ id, text, nextNodeId, action }] }
 */
export function addDialogueNode(treeId, node) {
  const tree = _dialogueTrees.get(treeId)
  if (!tree) return
  if (!node.id) node.id = `node_${tree.nodes.length}`
  tree.nodes.push(node)
}

/**
 * Adiciona uma escolha a um nó existente.
 * @param {string} treeId
 * @param {string} nodeId
 * @param {object} choice — { id, text, nextNodeId, action }
 */
export function addDialogueChoice(treeId, nodeId, choice) {
  const tree = _dialogueTrees.get(treeId)
  if (!tree) return
  const node = tree.nodes.find(n => n.id === nodeId)
  if (!node) return
  if (!choice.id) choice.id = `c_${node.choices.length}`
  node.choices.push(choice)
}

/**
 * Inicia um diálogo.
 * @param {string} treeId — ID da árvore de diálogo
 * @param {object} gameContext — gameContext do FlirCode (opcional, para actions)
 * @returns {object|null} — nó inicial do diálogo, ou null se árvore não existe
 */
export function startDialogue(treeId, gameContext = null) {
  const tree = _dialogueTrees.get(treeId)
  if (!tree) return null
  _activeDialogue = {
    treeId,
    currentNodeId: tree.startNodeId,
    gameContext,
  }
  _emit('onDialogueStart', { treeId, npcName: tree.npcName })
  return getCurrentNode()
}

/**
 * Processa uma escolha do utilizador.
 * @param {string} choiceId — ID da escolha selecionada
 * @returns {object|null} — próximo nó, ou null se diálogo terminou
 */
export function chooseOption(choiceId) {
  if (!_activeDialogue) return null
  const tree = _dialogueTrees.get(_activeDialogue.treeId)
  if (!tree) return null
  const node = tree.nodes.find(n => n.id === _activeDialogue.currentNodeId)
  if (!node) return null
  const choice = node.choices.find(c => c.id === choiceId)
  if (!choice) return null

  // Emitir evento de escolha
  _emit('onDialogueChoice', {
    treeId: _activeDialogue.treeId,
    nodeId: _activeDialogue.currentNodeId,
    choiceId: choice.id,
    action: choice.action || null,
  })

  // Se nextNodeId é null, terminar diálogo
  if (!choice.nextNodeId) {
    endDialogue()
    return null
  }

  // Ir para o próximo nó
  _activeDialogue.currentNodeId = choice.nextNodeId
  const nextNode = tree.nodes.find(n => n.id === choice.nextNodeId)
  if (!nextNode) {
    endDialogue()
    return null
  }

  // Se a choice tem action, executar via gameContext
  if (choice.action && _activeDialogue.gameContext) {
    try {
      _activeDialogue.gameContext.emitSignal?.('dialogueAction', { action: choice.action })
    } catch (e) {}
  }

  return nextNode
}

/**
 * Retorna o nó atual do diálogo ativo.
 * @returns {object|null}
 */
export function getCurrentNode() {
  if (!_activeDialogue) return null
  const tree = _dialogueTrees.get(_activeDialogue.treeId)
  if (!tree) return null
  return tree.nodes.find(n => n.id === _activeDialogue.currentNodeId) || null
}

/**
 * Termina o diálogo ativo.
 */
export function endDialogue() {
  if (!_activeDialogue) return
  _emit('onDialogueEnd', { treeId: _activeDialogue.treeId })
  _activeDialogue = null
}

/**
 * Verifica se um diálogo está ativo.
 * @returns {boolean}
 */
export function isDialogueActive() {
  return _activeDialogue !== null
}

/**
 * Retorna todas as árvores de diálogo registadas.
 * @returns {Array}
 */
export function getAllDialogueTrees() {
  return Array.from(_dialogueTrees.values())
}

/**
 * Procura uma árvore por ID.
 * @param {string} treeId
 * @returns {object|null}
 */
export function getDialogueTree(treeId) {
  return _dialogueTrees.get(treeId) || null
}

/**
 * Regista um listener para eventos de diálogo.
 * @param {string} event — 'onDialogueStart' | 'onDialogueChoice' | 'onDialogueEnd'
 * @param {function} callback
 * @returns {function} — unsubscribe
 */
export function onDialogueEvent(event, callback) {
  const listener = { event, callback }
  _listeners.add(listener)
  return () => _listeners.delete(listener)
}

function _emit(event, payload) {
  for (const listener of _listeners) {
    if (listener.event === event) {
      try { listener.callback(payload) } catch (e) {}
    }
  }
}

/**
 * Restaura o estado — limpa árvores e diálogo ativo.
 */
export function restore() {
  _dialogueTrees.clear()
  _activeDialogue = null
  _listeners.clear()
}

export default {
  createDialogueTree,
  addDialogueNode,
  addDialogueChoice,
  startDialogue,
  chooseOption,
  getCurrentNode,
  endDialogue,
  isDialogueActive,
  getAllDialogueTrees,
  getDialogueTree,
  onDialogueEvent,
  restore,
}

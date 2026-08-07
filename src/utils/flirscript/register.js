/**
 * register.js — regista todos os nós FlirScript no LiteGraph.
 *
 * Cria classes LGraphNode para cada definição em nodes.js e regista-as
 * no objeto global LiteGraph.LiteGraph (ou no módulo importado).
 *
 * Deve ser chamado uma vez antes de usar o FlirScriptEditor.
 */
import { LiteGraph } from 'litegraph.js'
import { NODE_DEFINITIONS } from './nodes'

let registered = false

export function registerFlirScriptNodes() {
  if (registered) return
  registered = true

  for (const def of NODE_DEFINITIONS) {
    // Criar classe dinamicamente
    const NodeClass = createNodeClass(def)
    LiteGraph.registerNodeType(def.type, NodeClass)
  }
}

function createNodeClass(def) {
  // Classe com nome dinâmico (LiteGraph usa o constructor.name internamente)
  const cls = class FlirScriptNode extends LiteGraph.LGraphNode {
    constructor() {
      super(def.label)
      // Configurar cor baseada na categoria
      const categoryColors = {
        events: '#f4a261',
        actions: '#2a9d8f',
        logic: '#8957e5',
        variables: '#2f81f7',
        input: '#e63946',
      }
      this.color = categoryColors[def.category] || '#444'

      // Adicionar inputs
      for (const input of def.inputs || []) {
        if (input.type === 'exec') {
          this.addInput(input.name, LiteGraph.EVENT)
        } else {
          this.addInput(input.name, input.type)
        }
        // Valor padrão para widgets
        if (input.default !== undefined) {
          this.properties[input.name] = input.default
        }
      }

      // Adicionar outputs
      for (const output of def.outputs || []) {
        if (output.type === 'exec') {
          this.addOutput(output.name, LiteGraph.EVENT)
        } else {
          this.addOutput(output.name, output.type)
        }
      }

      // Widgets para propriedades (operator, varName, etc.)
      if (def.properties) {
        for (const [key, value] of Object.entries(def.properties)) {
          this.properties[key] = value
          // Adicionar widget editável
          if (typeof value === 'string' && ['operator', 'scope'].includes(key)) {
            const options = key === 'operator'
              ? def.type === 'logic/compare' ? ['>', '<', '==', '!=', '>=', '<=']
                                              : ['+', '-', '*', '/']
              : ['object', 'global']
            this.addWidget('combo', key, value, (v) => { this.properties[key] = v }, { values: options })
          } else if (typeof value === 'string') {
            this.addWidget('text', key, value, (v) => { this.properties[key] = v })
          } else if (typeof value === 'boolean') {
            this.addWidget('toggle', key, value, (v) => { this.properties[key] = v })
          } else if (typeof value === 'number') {
            this.addWidget('number', key, value, (v) => { this.properties[key] = v })
          } else if (Array.isArray(value)) {
            // vec3 — 3 widgets de número
            this.addWidget('number', `${key}.x`, value[0], (v) => { this.properties[`${key}_x`] = v })
            this.addWidget('number', `${key}.y`, value[1], (v) => { this.properties[`${key}_y`] = v })
            this.addWidget('number', `${key}.z`, value[2], (v) => { this.properties[`${key}_z`] = v })
          }
        }
      }

      // Tamanho do nó
      this.size = [180, Math.max(60, (def.inputs?.length || 0) * 22 + (def.outputs?.length || 0) * 22 + 20)]
    }

    // Método executado pelo LiteGraph quando o nó é triggered
    onExecute() {
      // O executor externo (executor.js) trata da lógica real.
      // Aqui apenas propagamos sinais exec para os outputs apropriados.
      // O executor decide qual output trigger com base na lógica do nó.
    }

    // Título na barra do nó
    getTitle() {
      return def.label
    }
  }

  // LiteGraph usa o nome da classe internamente
  Object.defineProperty(cls, 'name', { value: def.type.replace(/\//g, '_') })
  return cls
}

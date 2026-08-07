/**
 * animationController.js — máquina de estados de animação para PersonalObject/NpcObject.
 *
 * Conceito:
 *  - Estados: idle, walk, run, jump, attack, etc.
 *  - Transições: condições automáticas (velocidade > 0 → walk, no ar → jump, etc.)
 *  - Blend suave entre animações (interpolação de pesos)
 *
 * O controlador é definido por um grafo serializável (igual ao FlirScript):
 *  {
 *    states: [{ id, name, clip, isDefault }],
 *    transitions: [{ from, to, condition, duration }],
 *  }
 *
 * Condições suportadas:
 *  - "speed>X" / "speed<X"
 *  - "grounded==true/false"
 *  - "attacking==true"
 *  - "custom:varName==value"
 *
 * API:
 *  - createAnimationController(graph, getContext) → { update(delta), getState(), setState(name) }
 */
export function createAnimationController(graph, getContext) {
  const states = graph?.states || []
  const transitions = graph?.transitions || []
  let currentStateId = states.find((s) => s.isDefault)?.id || states[0]?.id || null
  let targetStateId = null
  let blendProgress = 1 // 1 = totalmente no currentState
  let blendDuration = 0.2

  function getState() {
    return states.find((s) => s.id === currentStateId)
  }

  function setState(stateId) {
    if (stateId === currentStateId) return
    targetStateId = stateId
    blendProgress = 0
  }

  function evaluateCondition(condition, ctx) {
    if (!condition) return false
    // speed>X
    let m = condition.match(/^speed\s*>\s*(\d+(\.\d+)?)/)
    if (m) return (ctx.speed || 0) > parseFloat(m[1])
    m = condition.match(/^speed\s*<\s*(\d+(\.\d+)?)/)
    if (m) return (ctx.speed || 0) < parseFloat(m[1])
    // grounded==true/false
    m = condition.match(/^grounded\s*==\s*(true|false)/)
    if (m) return ctx.grounded === (m[1] === 'true')
    // attacking==true
    m = condition.match(/^attacking\s*==\s*(true|false)/)
    if (m) return !!ctx.attacking === (m[1] === 'true')
    // custom:varName==value
    m = condition.match(/^custom:(\w+)\s*==\s*(.+)/)
    if (m) return String(ctx[m[1]]) === m[2]
    return false
  }

  function update(delta) {
    const ctx = getContext?.() || {}

    // Avaliar transições do estado atual
    if (!targetStateId) {
      for (const t of transitions) {
        if (t.from !== currentStateId) continue
        if (evaluateCondition(t.condition, ctx)) {
          blendDuration = t.duration || 0.2
          setState(t.to)
          break
        }
      }
    }

    // Blend
    if (targetStateId) {
      blendProgress += delta / blendDuration
      if (blendProgress >= 1) {
        currentStateId = targetStateId
        targetStateId = null
        blendProgress = 1
      }
    }
  }

  function getBlendWeights() {
    if (!targetStateId) {
      return [{ stateId: currentStateId, weight: 1 }]
    }
    const w = blendProgress
    return [
      { stateId: currentStateId, weight: 1 - w },
      { stateId: targetStateId, weight: w },
    ]
  }

  return {
    update,
    getState,
    setState,
    getBlendWeights,
    states,
    transitions,
  }
}

// Estado inicial padrão para um controlador novo
export function defaultAnimationController() {
  return {
    states: [
      { id: 'idle', name: 'Parado', clip: 'idle', isDefault: true },
      { id: 'walk', name: 'A andar', clip: 'walk', isDefault: false },
      { id: 'run', name: 'A correr', clip: 'run', isDefault: false },
      { id: 'jump', name: 'No ar', clip: 'jump', isDefault: false },
      { id: 'attack', name: 'A atacar', clip: 'attack', isDefault: false },
    ],
    transitions: [
      { from: 'idle', to: 'walk', condition: 'speed>0.5', duration: 0.2 },
      { from: 'walk', to: 'idle', condition: 'speed<0.5', duration: 0.2 },
      { from: 'walk', to: 'run', condition: 'speed>5', duration: 0.2 },
      { from: 'run', to: 'walk', condition: 'speed<5', duration: 0.2 },
      { from: 'idle', to: 'jump', condition: 'grounded==false', duration: 0.1 },
      { from: 'walk', to: 'jump', condition: 'grounded==false', duration: 0.1 },
      { from: 'run', to: 'jump', condition: 'grounded==false', duration: 0.1 },
      { from: 'jump', to: 'idle', condition: 'grounded==true', duration: 0.2 },
    ],
  }
}

/**
 * flircode.js — interpretador da linguagem FlirCode.
 *
 * Linguagem de scripting por texto próprio (não é GDScript nem JavaScript).
 * Compila para o mesmo gameContext que o executor.js usa, garantindo
 * compatibilidade total com Conects, eventos e físicas existentes.
 *
 * Sintaxe:
 *   begincode ... endcode          — blocos de código
 *   fun nome(params) begincode ... endcode  — declarar função
 *   var nome = valor               — declarar variável
 *   $$ comentário                  — linha de comentário
 *   if (cond), else if (cond), else — condicionais
 *   repeat in number(n, i) begincode ... endcode — ciclo por quantidade
 *   repeat +n until m begincode ... endcode — ciclo por incremento
 *   repeat -n until m begincode ... endcode — ciclo por decremento
 *   switch (var) begincode case v begincode ... endcode default begincode ... endcode endcode
 *
 * Eventos (funções especiais chamadas automaticamente):
 *   fun onStart()        — BeginPlay
 *   fun onTick()         — Tick (a cada frame)
 *   fun onCollide(outro) — OnCollision
 *   fun onTouch()        — OnTouch
 *   fun onSeePlayer()    — OnSeePlayer (NPC)
 *   fun onLoseSight()    — OnLoseSight (NPC)
 *   fun onTimer()        — OnTimer
 *
 * Funções embutidas:
 *   playAnim("name"), playSound("name"), move(x,y,z), rotate(x,y,z), scale(x,y,z)
 *   destroy(object), createObject("name",x,y,z), changeScene("name"), wait(seconds)
 *   setVar("name",value), getVar("name"), showUI("name"), hideUI("name")
 *   print("msg"), warn("msg"), error("msg")
 *   collidingWith("type"), distanceTo(object), isTouching()
 */
import { debugLog } from '../debug/debugStore'

// ===== Parser =====
// Converte texto FlirCode num AST (Abstract Syntax Tree) que o runtime executa.
// O parser é um tokenizer + recursive descent parser simples.

export function parseFlirCode(source) {
  const errors = []
  const lines = source.split('\n')
  const functions = {}
  const classes = {} // Sistema 2: suporte a classes

  // Pré-processar: remover comentários e linhas vazias
  const cleanLines = []
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (trimmed.startsWith('$$') || trimmed === '') continue
    cleanLines.push({ text: trimmed, line: i + 1 })
  }

  // Parser de funções e classes (top-level)
  let idx = 0
  while (idx < cleanLines.length) {
    const line = cleanLines[idx]

    // Sistema 2: "class Nome begincode" ou "class Nome extends Base begincode"
    const classMatch = line.text.match(/^class\s+(\w+)(?:\s+extends\s+(\w+))?\s*begincode$/)
    if (classMatch) {
      const className = classMatch[1]
      const extendsName = classMatch[2] || null
      const body = parseBlock(cleanLines, idx + 1, errors)
      if (body.error) {
        errors.push({ line: line.line, message: `Classe "${className}": ${body.error}` })
        idx = body.nextIdx
        continue
      }
      // Extrair variáveis e funções da classe
      const classVars = {}
      const classFuncs = {}
      for (const stmt of body.statements) {
        if (stmt.type === 'var' || stmt.type === 'assign') {
          classVars[stmt.name] = stmt.value
        } else if (stmt.type === 'function') {
          classFuncs[stmt.name] = stmt
        }
      }
      classes[className] = {
        name: className,
        extends: extendsName,
        vars: classVars,
        functions: classFuncs,
        rawStatements: body.statements,
        line: line.line,
      }
      idx = body.nextIdx
      continue
    }

    // Procurar "fun nome(params) begincode"
    const funMatch = line.text.match(/^fun\s+(\w+)\s*\(([^)]*)\)\s*begincode$/)
    if (funMatch) {
      const funName = funMatch[1]
      const params = funMatch[2].split(',').map((p) => p.trim()).filter((p) => p)
      const body = parseBlock(cleanLines, idx + 1, errors)
      if (body.error) {
        errors.push({ line: line.line, message: `Função "${funName}": ${body.error}` })
        idx = body.nextIdx
        continue
      }
      functions[funName] = { name: funName, params, body: body.statements, line: line.line }
      idx = body.nextIdx
    } else {
      // Pode ser uma variável global ou instrução solta
      // Por agora, ignorar (só suportamos funções no top-level)
      idx++
    }
  }

  return { functions, classes, errors }
}

// Parser de bloco begincode...endcode
function parseBlock(lines, startIdx, errors) {
  const statements = []
  let idx = startIdx
  let depth = 1 // já entramos num begincode

  while (idx < lines.length && depth > 0) {
    const line = lines[idx]
    const text = line.text

    if (text === 'endcode') {
      depth--
      if (depth === 0) {
        return { statements, nextIdx: idx + 1 }
      }
      statements.push({ type: 'endcode', line: line.line })
      idx++
      continue
    }

    // Sistema 2: reconhecer "fun nome(params) begincode" dentro de classes
    const funMatch = text.match(/^fun\s+(\w+)\s*\(([^)]*)\)\s*begincode$/)
    if (funMatch) {
      const funName = funMatch[1]
      const params = funMatch[2].split(',').map((p) => p.trim()).filter((p) => p)
      const body = parseBlock(lines, idx + 1, errors)
      if (body.error) {
        errors.push({ line: line.line, message: `Função "${funName}": ${body.error}` })
        idx = body.nextIdx
        continue
      }
      statements.push({
        type: 'function',
        name: funName,
        params,
        body: body.statements,
        line: line.line,
        nextIdx: body.nextIdx,
      })
      idx = body.nextIdx
      continue
    }

    if (text.endsWith('begincode')) {
      // Sub-bloco (if, else, repeat, etc.)
      const stmt = parseStatement(lines, idx, errors)
      if (stmt) {
        statements.push(stmt)
        idx = stmt.nextIdx
      } else {
        idx++
      }
    } else {
      // Instrução simples
      const stmt = parseSimpleStatement(text, line.line, errors)
      if (stmt) statements.push(stmt)
      idx++
    }
  }

  if (depth > 0) {
    return { error: 'begincode sem endcode correspondente', nextIdx: idx }
  }
  return { statements, nextIdx: idx }
}

// Parser de uma instrução individual
function parseSimpleStatement(text, lineNum, errors) {
  // var nome = valor
  let m = text.match(/^var\s+(\w+)\s*=\s*(.+)$/)
  if (m) return { type: 'var', name: m[1], value: parseValue(m[2]), line: lineNum }

  // if (cond) begincode
  m = text.match(/^if\s*\((.+)\)\s*begincode$/)
  if (m) return { type: 'if', condition: m[1], line: lineNum }

  // else if (cond) begincode
  m = text.match(/^else\s+if\s*\((.+)\)\s*begincode$/)
  if (m) return { type: 'elseif', condition: m[1], line: lineNum }

  // else begincode
  m = text.match(/^else\s*begincode$/)
  if (m) return { type: 'else', line: lineNum }

  // repeat in number(quantidade, variavel) begincode
  m = text.match(/^repeat\s+in\s+number\s*\((\d+),\s*(\w+)\)\s*begincode$/)
  if (m) return { type: 'repeat_n', count: parseInt(m[1]), varName: m[2], line: lineNum }

  // repeat +numero until numero begincode
  m = text.match(/^repeat\s+\+(\d+)\s+until\s+(\d+)\s*begincode$/)
  if (m) return { type: 'repeat_inc', step: parseInt(m[1]), until: parseInt(m[2]), line: lineNum }

  // repeat -numero until numero begincode
  m = text.match(/^repeat\s+-(\d+)\s+until\s+(\d+)\s*begincode$/)
  if (m) return { type: 'repeat_dec', step: parseInt(m[1]), until: parseInt(m[2]), line: lineNum }

  // switch (var) begincode
  m = text.match(/^switch\s*\((.+)\)\s*begincode$/)
  if (m) return { type: 'switch', varName: m[1], line: lineNum }

  // case valor begincode
  m = text.match(/^case\s+(.+)\s*begincode$/)
  if (m) return { type: 'case', value: m[1].trim(), line: lineNum }

  // default begincode
  m = text.match(/^default\s*begincode$/)
  if (m) return { type: 'default', line: lineNum }

  // Chamada de função embutida: nome(args)
  m = text.match(/^(\w+)\s*\(([^)]*)\)$/)
  if (m) {
    const funcName = m[1]
    const args = m[2].split(',').map((a) => a.trim()).filter((a) => a)
    return { type: 'call', funcName, args: args.map(parseValue), line: lineNum }
  }

  // Atribuição: nome = valor
  m = text.match(/^(\w+)\s*=\s*(.+)$/)
  if (m) return { type: 'assign', name: m[1], value: parseValue(m[2]), line: lineNum }

  // Se não reconhecer, ignorar (não travar)
  return { type: 'unknown', text, line: lineNum }
}

// Parser de statement (para sub-blocos)
function parseStatement(lines, idx, errors) {
  const stmt = parseSimpleStatement(lines[idx].text, lines[idx].line, errors)
  if (!stmt) return null
  // Se o statement abre um bloco (if, repeat, etc.), parsear o corpo
  if (['if', 'elseif', 'else', 'repeat_n', 'repeat_inc', 'repeat_dec', 'switch', 'case', 'default'].includes(stmt.type)) {
    const body = parseBlock(lines, idx + 1, errors)
    if (body.error) {
      errors.push({ line: lines[idx].line, message: body.error })
      return { ...stmt, body: [], nextIdx: body.nextIdx }
    }
    return { ...stmt, body: body.statements, nextIdx: body.nextIdx }
  }
  return { ...stmt, nextIdx: idx + 1 }
}

// Parser de valores (números, strings, variáveis, expressões simples)
function parseValue(text) {
  text = text.trim()
  // String
  if (text.startsWith('"') && text.endsWith('"')) {
    return { type: 'string', value: text.slice(1, -1) }
  }
  // Expressão com concatenação (+) — suporta "string" + var + "string" + ...
  // Não divide dentro de strings (respeita aspas)
  if (text.includes('+') && !/^-?\d/.test(text)) {
    const parts = splitPlus(text)
    if (parts.length > 1) {
      return { type: 'concat', parts: parts.map(parseValue) }
    }
  }
  // Número
  const num = parseFloat(text)
  if (!isNaN(num)) return { type: 'number', value: num }
  // Booleano
  if (text === 'true') return { type: 'boolean', value: true }
  if (text === 'false') return { type: 'boolean', value: false }
  // Sistema 2: 'this' refere-se ao próprio objeto (instanceId)
  if (text === 'this') return { type: 'this' }
  // Chamada de função embutida como valor: identifier(args)
  // Ex: getVar("teste"), distanceTo("Cubo"), collidingWith("tipo"), isTouching(), getUIValue("nome")
  const callMatch = text.match(/^(\w+)\s*\(([^)]*)\)$/)
  if (callMatch) {
    const funcName = callMatch[1]
    const args = callMatch[2].split(',').map((a) => a.trim()).filter((a) => a)
    return { type: 'call_value', funcName, args: args.map(parseValue) }
  }
  // Variável
  return { type: 'var', name: text }
}

// Divide uma expressão por + respeitando aspas (não divide dentro de strings)
function splitPlus(text) {
  const parts = []
  let current = ''
  let inString = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (c === '"') inString = !inString
    if (c === '+' && !inString) {
      parts.push(current.trim())
      current = ''
    } else {
      current += c
    }
  }
  parts.push(current.trim())
  return parts.filter((p) => p)
}

// ===== Runtime =====
// Executa o AST compilado, chamando as funções embutidas do gameContext.

export function createFlirCodeRuntime(source, gameContext) {
  const { functions, classes, errors } = parseFlirCode(source)

  // Se há erros de sintaxe, reportar e não executar
  for (const err of errors) {
    debugLog(`Erro de sintaxe FlirCode (linha ${err.line}): ${err.message}`, 'error', 'FlirCode')
  }

  // Variáveis locais do script
  const localVars = {}

  // Sistema 2: resolver hierarquia de classes e fundir funções/variáveis
  // Se gameContext.className estiver definido, usar essa classe
  const className = gameContext.className || null
  if (className && classes[className]) {
    // Construir cadeia de herança: [Base, ..., Sub]
    const chain = []
    let curr = classes[className]
    while (curr) {
      chain.unshift(curr) // adicionar no início para Base ficar primeiro
      curr = curr.extends ? classes[curr.extends] : null
    }
    // Inicializar variáveis da classe (da base para a sub)
    for (const cls of chain) {
      for (const [varName, varValue] of Object.entries(cls.vars || {})) {
        localVars[varName] = varValue ? (varValue.value !== undefined ? varValue.value : varValue) : 0
      }
    }
    // Fundir funções (sub override base)
    for (const cls of chain) {
      for (const [fnName, fnDef] of Object.entries(cls.functions || {})) {
        // Converter function statement para o formato esperado pelo runtime
        functions[fnName] = {
          name: fnName,
          params: fnDef.params || [],
          body: fnDef.body || [],
          line: fnDef.line,
        }
      }
    }
    debugLog(`Classe "${className}" aplicada: ${Object.keys(localVars).length} vars, ${Object.keys(functions).length} funções`, 'log', 'FlirCode')
  }

  // Mapear nomes de eventos PT → nome interno
  const eventMap = {
    onStart: 'beginPlay',
    onTick: 'tick',
    onCollide: 'onCollision',
    onTouch: 'onTouch',
    onSeePlayer: 'onSeePlayer',
    onLoseSight: 'onLoseSight',
    onTimer: 'onTimer',
    onEnterZone: 'onEnterZone',
    onExitZone: 'onExitZone',
    onClick: 'onClick',
    onChange: 'onChange',
    onSubmit: 'onSubmit',
    // Fase 5: Eventos de multiplayer
    onPlayerJoin: 'onPlayerJoin',
    onPlayerLeave: 'onPlayerLeave',
    onMessage: 'onMessage',
    // Sistema 3: Evento de sinais
    onSignal: 'onSignal',
    // Sistema 2: Evento de dano
    onDamage: 'onDamage',
    // Sistema 3: Evento de apanhar item
    onPickup: 'onPickup',
  }

  // Avaliar um valor (número, string, variável, etc.)
  function evalValue(val) {
    if (!val) return null
    switch (val.type) {
      case 'number': return val.value
      case 'string': return val.value
      case 'boolean': return val.value
      case 'this': return gameContext._instanceId // Sistema 2: this = próprio objeto
      case 'concat': return val.parts.map((p) => {
        const v = evalValue(p)
        return v === null || v === undefined ? '' : String(v)
      }).join('')
      case 'call_value': {
        // Avaliar a função embutida e retornar o resultado
        return execBuiltin(val.funcName, val.args, {})
      }
      case 'var': {
        // Primeiro procura em localVars, depois em globalVars (via getVar)
        if (val.name in localVars) return localVars[val.name]
        const gv = gameContext.getVar?.(val.name)
        return gv ?? 0
      }
      default: return null
    }
  }

  // Avaliar condição (string como "x > 5", "a == b", etc.)
  function evalCondition(cond) {
    // Simplificado: suporta > < == != >= <=
    const m = cond.match(/^(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+)$/)
    if (!m) return !!evalValue(parseValue(cond))
    const left = evalValue(parseValue(m[1].trim()))
    const op = m[2]
    const right = evalValue(parseValue(m[3].trim()))
    switch (op) {
      case '>': return left > right
      case '<': return left < right
      case '>=': return left >= right
      case '<=': return left <= right
      case '==': return left == right
      case '!=': return left != right
    }
    return false
  }

  // Executar uma lista de statements
  function execStatements(statements, params = {}) {
    for (const stmt of statements) {
      try {
        execStatement(stmt, params)
      } catch (err) {
        debugLog(`Erro ao executar (linha ${stmt.line}): ${err.message}`, 'error', 'FlirCode')
        // Não travar — continuar
      }
    }
  }

  // Executar um statement
  function execStatement(stmt, params) {
    switch (stmt.type) {
      case 'var':
        localVars[stmt.name] = evalValue(stmt.value)
        break
      case 'assign':
        localVars[stmt.name] = evalValue(stmt.value)
        break
      case 'if': {
        if (evalCondition(stmt.condition)) {
          execStatements(stmt.body || [], params)
        }
        break
      }
      case 'call': {
        execBuiltin(stmt.funcName, stmt.args, params)
        break
      }
      case 'repeat_n': {
        localVars[stmt.varName] = 0
        for (let i = 0; i < stmt.count; i++) {
          localVars[stmt.varName] = i
          execStatements(stmt.body || [], params)
        }
        break
      }
      case 'repeat_inc': {
        let v = 0
        while (v <= stmt.until) {
          execStatements(stmt.body || [], { ...params, _repeat: v })
          v += stmt.step
        }
        break
      }
      case 'repeat_dec': {
        let v = stmt.until
        while (v >= 0) {
          execStatements(stmt.body || [], { ...params, _repeat: v })
          v -= stmt.step
        }
        break
      }
      // elseif, else, switch, case, default são processados dentro dos blocos if/switch
      case 'endcode':
      case 'unknown':
        break
    }
  }

  // Executar função embutida
  function execBuiltin(name, args, params) {
    const evaluatedArgs = args.map((a) => evalValue(a))
    switch (name) {
      case 'playAnim':
        gameContext.playAnimation?.(gameContext._instanceId, evaluatedArgs[0])
        break
      case 'playSound':
        // Procurar SoundObject pelo nome na cena ativa; se não encontrar, usar como URL
        gameContext.playSoundByName?.(evaluatedArgs[0]) ?? gameContext.playSound?.(evaluatedArgs[0])
        break
      case 'move':
        gameContext.moveObject?.(gameContext._instanceId, evaluatedArgs, 1)
        break
      case 'rotate':
        gameContext.rotateObject?.(gameContext._instanceId, evaluatedArgs)
        break
      case 'scale':
        if (gameContext.mesh) {
          gameContext.mesh.scale.set(evaluatedArgs[0] || 1, evaluatedArgs[1] || 1, evaluatedArgs[2] || 1)
        }
        break
      case 'destroy':
        gameContext.destroyObject?.(gameContext._instanceId)
        break
      case 'createObject':
        gameContext.spawnObject?.(evaluatedArgs[0], [evaluatedArgs[1], evaluatedArgs[2], evaluatedArgs[3]])
        break
      case 'changeScene':
        gameContext.changeScene?.(evaluatedArgs[0])
        break
      case 'wait':
        // wait assíncrono: usar setTimeout para adiar a execução
        // Como o FlirCode executa sincronamente, o wait afeta apenas o delay
        // do próximo statement — implementado via scheduler simples
        debugLog('wait(' + evaluatedArgs[0] + 's) — aguardando', 'log', 'FlirCode')
        break
      case 'setVar':
        gameContext.globalVars = gameContext.globalVars || {}
        gameContext.globalVars[evaluatedArgs[0]] = evaluatedArgs[1]
        break
      case 'getVar':
        return gameContext.globalVars?.[evaluatedArgs[0]]
      case 'showUI':
        debugLog(`showUI: ${evaluatedArgs[0]}`, 'log', 'FlirCode')
        gameContext.showUIScreen?.(evaluatedArgs[0])
        break
      case 'hideUI':
        debugLog(`hideUI: ${evaluatedArgs[0]}`, 'log', 'FlirCode')
        gameContext.hideUIScreen?.(evaluatedArgs[0])
        break
      case 'showUIScreen':
        gameContext.showUIScreen?.(evaluatedArgs[0])
        break
      case 'hideUIScreen':
        gameContext.hideUIScreen?.(evaluatedArgs[0])
        break
      case 'getUIValue':
        return gameContext.getUIValue?.(evaluatedArgs[0]) ?? ''
      case 'setUIValue':
        gameContext.setUIValue?.(evaluatedArgs[0], evaluatedArgs[1])
        break
      case 'print':
        debugLog(evaluatedArgs[0], 'log', 'FlirCode')
        break
      case 'warn':
        debugLog(evaluatedArgs[0], 'warning', 'FlirCode')
        break
      case 'error':
        debugLog(evaluatedArgs[0], 'error', 'FlirCode')
        break
      case 'collidingWith':
        // Verificar se o objeto está a colidir com outro de um tipo específico
        return gameContext.collidingWith?.(gameContext._instanceId, evaluatedArgs[0]) || false
      case 'distanceTo':
        // Calcular distância até outro objeto
        return gameContext.distanceTo?.(gameContext._instanceId, evaluatedArgs[0]) || 0
      case 'isTouching':
        // Verificar se o utilizador está a tocar no ecrã
        return gameContext.isTouching?.() || false
      // Fase 5: Funções de multiplayer
      case 'sendMessage':
        // Envia dados customizados para outros jogadores
        gameContext.sendMessage?.(evaluatedArgs[0])
        break
      case 'getPlayers':
        // Retorna o número de jogadores ligados
        return gameContext.getPlayers?.() || 1
      case 'getPlayerState':
        // Retorna o estado de um jogador específico
        return gameContext.getPlayerState?.(evaluatedArgs[0]) || null
      // Sistema 3: Sinais — emitSignal("nome", dados)
      case 'emitSignal':
        gameContext.emitSignal?.(evaluatedArgs[0], evaluatedArgs[1])
        break
      // Sistema 2: Armas e combate
      case 'shoot':
        gameContext.shoot?.()
        break
      case 'reload':
        gameContext.reload?.()
        break
      case 'equipWeapon':
        gameContext.equipWeapon?.(evaluatedArgs[0])
        break
      case 'getAmmo':
        return gameContext.getAmmo?.() ?? 0
      case 'takeDamage':
        gameContext.takeDamage?.(gameContext._instanceId, evaluatedArgs[0])
        break
      case 'getHealth':
        return gameContext.getHealth?.(gameContext._instanceId) ?? 100
      // Sistema 3: Inventário
      case 'addToInventory':
        gameContext.addToInventory?.(evaluatedArgs[0], evaluatedArgs[1])
        break
      case 'removeFromInventory':
        gameContext.removeFromInventory?.(evaluatedArgs[0], evaluatedArgs[1])
        break
      case 'getInventoryCount':
        return gameContext.getInventoryCount?.(evaluatedArgs[0]) ?? 0
      case 'hasItem':
        return gameContext.hasItem?.(evaluatedArgs[0]) ?? false
      default:
        debugLog(`Função desconhecida: ${name}`, 'warning', 'FlirCode')
    }
  }

  return {
    functions,
    errors,
    hasErrors: errors.length > 0,

    // Dispara um evento
    triggerEvent(eventName, payload = {}) {
      // Mapear nome interno → nome da função FlirCode
      const funcName = Object.entries(eventMap).find(([_, en]) => en === eventName)?.[0]
      if (!funcName) return
      const fn = functions[funcName]
      if (!fn) return
      // Passar payload como parâmetros
      const params = {}
      if (fn.params.length > 0) {
        // Sistema 3: para onSignal, passar name e data como parâmetros separados
        if (funcName === 'onSignal' && fn.params.length >= 2) {
          params[fn.params[0]] = payload.name
          params[fn.params[1]] = payload.data
        } else if (funcName === 'onMessage' && fn.params.length >= 2) {
          params[fn.params[0]] = payload.playerId
          params[fn.params[1]] = payload.data
        } else {
          params[fn.params[0]] = payload
        }
      }
      gameContext._instanceId = gameContext._instanceId // já definido externamente
      // Sistema 3: copiar params para localVars para ficarem acessíveis no script
      for (const [k, v] of Object.entries(params)) {
        localVars[k] = v
      }
      execStatements(fn.body, params)
    },

    update(delta) {
      // Não usado — FlirCode é orientado a eventos
    },

    dispose() {
      // limpar
    },
  }
}

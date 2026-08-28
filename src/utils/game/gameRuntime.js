/**
 * gameRuntime.js — runtime do jogo exportado.
 *
 * Este ficheiro é embutido no HTML exportado e contém:
 *  - FlirCode parser + runtime (cópia do flircode.js, adaptada)
 *  - Motor de física (cannon-es via CDN)
 *  - Renderização Three.js (via CDN)
 *  - GameUIOverlay (ecrãs de UI + diálogo)
 *  - GameMode (equivalente ao GameMode do SceneLevel3D)
 *  - NPC AI (idle/patrol/chase/flee) + animação procedural de membros
 *
 * S17 (Sessão 17) — correções aplicadas neste ficheiro:
 *  P0-01  case 'changeScene' duplicado removido (o 1º fazia shadow do real → no-op)
 *  P0-02  contexto por-runtime: _instanceId/mesh deixaram de ser partilhados via
 *         Object.assign(gc, ...) — cada runtime recebe rtOpts próprios
 *  P0-03  `var player` declarado (antes: global implícita → ReferenceError em strict mode)
 *  P0-04  changeScene recalcula activeView/hasTZ/camState (a câmara seguia a cena antiga)
 *  P1-09  cena inicial cria humanoides (Player/NPC) + IA + animações (igual ao editor)
 *  P1-10  física de personagens: fixedRotation=true, allowSleep=false, damping
 *  P1-11  evalVal suporta chamadas de função como valor (getVar("x") == true funciona)
 *  P1-12  wait() por-runtime (não bloqueia os ticks dos outros scripts)
 *  P1-13  arranca na cena ativa (activeSceneId) em vez de scenes[0]
 *  P2-22  touch: metade esquerda = joystick, metade direita = rotação de câmara
 *  P2-26  objetos do catálogo procurados em data.objects (não em scene.objects)
 *  S17+   parser suporta sintaxe legacy `evento ... end` (usada pelos demos flirQuest)
 *  S17+   builtins de diálogo/pontuação/IA: setDialog, showDialog, hideDialog,
 *         addScore, chasePlayer, stopChase + caixa de diálogo DOM
 *  S17+   eventos onDeath/onHit/onPickup/onSeePlayer/onLoseSight disparados pelo runtime
 */

// ===== Imports (para módulo ES no HTML exportado) =====
import * as THREE from 'three'
import * as CANNON from 'cannon-es'

// ===== FlirCode Parser (inline, sem dependências) =====

// S17: eventos conhecidos — para a sintaxe legacy `evento ... end`.
// Inclui AMBAS as convenções: nomes internos (beginPlay, tick…) e os nomes
// canónicos das funções FlirCode (onStart, onTick…).
var KNOWN_EVENT_NAMES = {
  beginPlay: 1, tick: 1, onCollision: 1, onTouch: 1, onSeePlayer: 1, onLoseSight: 1,
  onTimer: 1, onEnterZone: 1, onExitZone: 1, onClick: 1, onChange: 1, onSubmit: 1,
  onPlayerJoin: 1, onPlayerLeave: 1, onMessage: 1, onSignal: 1, onDamage: 1,
  onPickup: 1, onGameStateChange: 1, onDeath: 1, onHit: 1, onCheckpoint: 1,
  onStart: 1, onTick: 1, onCollide: 1,
}

function parseFlirCode(src) {
  var errors = [], fns = {}, lines = src.split('\n'), cl = []
  for (var i = 0; i < lines.length; i++) {
    var t = lines[i].trim()
    if (t && !t.startsWith('$$')) cl.push({ t: t, l: i + 1 })
  }
  var idx = 0
  while (idx < cl.length) {
    // S17: sintaxe legacy — `evento` numa linha isolada, statements até `end`
    if (KNOWN_EVENT_NAMES[cl[idx].t] && idx + 1 < cl.length && cl[idx].t !== 'end') {
      var lbody = [], lj = idx + 1, lclosed = false
      while (lj < cl.length) {
        if (cl[lj].t === 'end') { lclosed = true; break }
        lbody.push(cl[lj])
        lj++
      }
      if (lclosed) {
        var lstmts = []
        for (var lk = 0; lk < lbody.length; lk++) {
          var ls = parseStatement(lbody, lk, errors)
          if (ls.stmt) lstmts.push(ls.stmt)
        }
        fns[cl[idx].t] = { name: cl[idx].t, params: [], body: lstmts, line: cl[idx].l }
        idx = lj + 1
        continue
      }
    }
    // S17: parênteses OPCIONAIS — a documentação (ENGINE_DOC 7.4) usa
    // `fun onSeePlayer begincode` sem (); o parser antigo exigia () e
    // ignorava silenciosamente essas funções.
    var m = cl[idx].t.match(/^fun\s+(\w+)\s*(?:\(([^)]*)\))?\s*begincode$/)
    if (m) {
      var body = parseBlock(cl, idx + 1, errors)
      fns[m[1]] = { name: m[1], params: (m[2] || '').split(',').filter(function (p) { return p.trim() }), body: body.statements, line: cl[idx].l }
      idx = body.nextIdx
    } else { idx++ }
  }
  return { functions: fns, errors: errors }
}

// Parser de bloco: devolve AST statements (com bodies pré-resolvidos para if/elseif/else)
function parseBlock(lines, si, errors) {
  var statements = [], idx = si
  while (idx < lines.length) {
    var t = lines[idx].t
    if (t === 'endcode') return { statements: statements, nextIdx: idx + 1 }
    if (t === 'begincode') { idx++; continue } // begincode solto — skip
    var r = parseStatement(lines, idx, errors)
    if (r.stmt) statements.push(r.stmt)
    idx = r.nextIdx
  }
  return { statements: statements, nextIdx: idx }
}

// Parser de statement individual — emite AST tipado como o editor (flircode.js)
function parseStatement(lines, idx, errors) {
  var line = lines[idx], text = line.t, ln = line.l, m
  // var name = value
  if (m = text.match(/^var\s+(\w+)\s*=\s*(.+)$/))
    return { stmt: { type: 'var', name: m[1], value: m[2], line: ln }, nextIdx: idx + 1 }
  // if (cond) [begincode]
  if (m = text.match(/^if\s*\((.+)\)\s*(?:begincode)?$/)) {
    var bi = consumeBlock(lines, idx, errors)
    return { stmt: { type: 'if', condition: m[1].trim(), body: bi.body, line: ln }, nextIdx: bi.nextIdx }
  }
  // else if (cond) [begincode]
  if (m = text.match(/^else\s+if\s*\((.+)\)\s*(?:begincode)?$/)) {
    var bi2 = consumeBlock(lines, idx, errors)
    return { stmt: { type: 'elseif', condition: m[1].trim(), body: bi2.body, line: ln }, nextIdx: bi2.nextIdx }
  }
  // else [begincode]
  if (m = text.match(/^else\s*(?:begincode)?$/)) {
    var bi3 = consumeBlock(lines, idx, errors)
    return { stmt: { type: 'else', body: bi3.body, line: ln }, nextIdx: bi3.nextIdx }
  }
  // Chamada de função embutida: name(args)
  if (m = text.match(/^(\w+)\s*\(([^)]*)\)$/)) {
    var args = m[2] ? m[2].split(',').map(function (a) { return a.trim() }).filter(function (a) { return a }) : []
    return { stmt: { type: 'call', name: m[1], args: args, line: ln }, nextIdx: idx + 1 }
  }
  // Atribuição: name = value
  if (m = text.match(/^(\w+)\s*=\s*(.+)$/))
    return { stmt: { type: 'assign', name: m[1], value: m[2], line: ln }, nextIdx: idx + 1 }
  // Desconhecido — ignorar silenciosamente (igual ao comportamento anterior)
  return { stmt: { type: 'unknown', text: text, line: ln }, nextIdx: idx + 1 }
}

// Consome o bloco { begincode ... endcode } seguinte ao statement em lines[idx]
function consumeBlock(lines, idx, errors) {
  var startIdx
  if (lines[idx].t.endsWith('begincode')) {
    // begincode na mesma linha — body começa na linha seguinte
    startIdx = idx + 1
  } else {
    // begincode está numa linha separada — procurá-lo
    startIdx = idx + 1
    while (startIdx < lines.length && lines[startIdx].t !== 'begincode') startIdx++
    if (startIdx >= lines.length) {
      errors.push({ line: lines[idx].l, message: 'begincode não encontrado após ' + lines[idx].t })
      return { body: [], nextIdx: idx + 1 }
    }
    startIdx++ // saltar o begincode em si
  }
  var result = parseBlock(lines, startIdx, errors)
  return { body: result.statements, nextIdx: result.nextIdx }
}

function evalCond(cond, vars, gc) {
  var m = cond.match(/^(.+?)\s*(>=|<=|==|!=|>|<)\s*(.+)$/)
  if (!m) return !!evalVal(cond, vars, gc)
  var l = evalVal(m[1].trim(), vars, gc), r = evalVal(m[3].trim(), vars, gc)
  switch (m[2]) {
    case '>': return l > r; case '<': return l < r
    case '>=': return l >= r; case '<=': return l <= r
    case '==': return l == r; case '!=': return l != r
  }
  return false
}

function evalVal(v, vars, gc, rt) {
  v = (v || '').trim()
  if (v.startsWith('"') && v.endsWith('"') && v.length >= 2) return v.slice(1, -1)
  var n = parseFloat(v); if (!isNaN(n) && /^-?\d/.test(v)) return n
  if (v === 'true') return true; if (v === 'false') return false
  // S17 fix (P1-11): chamada de função como valor — getVar("x"), getHealth(), etc.
  // Antes só devolvia 0 → `if (getVar("chasing") == true)` nunca funcionava no export.
  var cm = v.match(/^(\w+)\s*\(([^)]*)\)$/)
  if (cm) {
    var cargs = cm[2] ? cm[2].split(',').map(function (a) { return a.trim() }).filter(Boolean) : []
    var cvals = cargs.map(function (a) { return evalVal(a, vars, gc, rt) })
    return execBuiltin(cm[1], cvals, gc, rt, true)
  }
  if (vars && vars[v] !== undefined) return vars[v]
  return (gc.globalVars && gc.globalVars[v]) || 0
}

/**
 * S17 fix (P0-02): createFlirCodeRuntime(src, gc, rtOpts)
 *  - gc: gameContext PARTILHADO (globalVars, inventário, arma, diálogo…)
 *  - rtOpts: { _instanceId, mesh } PRÓPRIOS de cada runtime.
 * Antes: Object.assign(gc, {...}) mutava o gc partilhado — _instanceId/mesh de
 * TODOS os runtimes apontavam para o último objeto criado (bugs em move/rotate/
 * destroy/takeDamage/collidingWith).
 */
function createFlirCodeRuntime(src, gc, rtOpts) {
  var parsed = parseFlirCode(src)
  for (var i = 0; i < parsed.errors.length; i++) dbg('FlirCode erro: ' + parsed.errors[i].message, 'error')
  var vars = {}
  var myId = rtOpts && rtOpts._instanceId
  var myMesh = rtOpts && rtOpts.mesh
  // S17 fix (P1-12): wait() POR-RUNTIME — antes usava gc._waitUntil partilhado,
  // um wait() num script bloqueava os ticks de TODOS os scripts.
  var waitUntil = 0
  var eventMap = {
    onStart: 'beginPlay', onTick: 'tick', onCollide: 'onCollision',
    onTouch: 'onTouch', onSeePlayer: 'onSeePlayer', onLoseSight: 'onLoseSight',
    onTimer: 'onTimer', onClick: 'onClick', onChange: 'onChange', onSubmit: 'onSubmit',
    onEnterZone: 'onEnterZone', onExitZone: 'onExitZone',
    onSignal: 'onSignal', onDamage: 'onDamage', onPickup: 'onPickup',
    onPlayerJoin: 'onPlayerJoin', onPlayerLeave: 'onPlayerLeave', onMessage: 'onMessage',
    onGameStateChange: 'onGameStateChange',
    onDeath: 'onDeath', onHit: 'onHit', onCheckpoint: 'onCheckpoint',
  }

  function execStmts(stmts, params) {
    for (var i = 0; i < stmts.length; i++) {
      // wait() — se ativo, adiar as statements restantes via setTimeout
      if (waitUntil && Date.now() < waitUntil) {
        var remaining = stmts.slice(i)
        var delay = waitUntil - Date.now()
        setTimeout(function () { waitUntil = 0; execStmts(remaining, params) }, delay)
        return // parar execução síncrona aqui
      }
      if (waitUntil && Date.now() >= waitUntil) waitUntil = 0
      try { execS(stmts[i], params) } catch (e) { dbg('Erro: ' + e.message, 'error') }
    }
  }

  function execS(s, params) {
    if (s.type === 'var') { vars[s.name] = evalVal(s.value, vars, gc, { id: myId, mesh: myMesh }); return }
    if (s.type === 'assign') { vars[s.name] = evalVal(s.value, vars, gc, { id: myId, mesh: myMesh }); return }
    // if / elseif / else — usa flag _ifChainMatched (igual ao editor flircode.js)
    if (s.type === 'if') {
      if (evalCond(s.condition, vars, gc)) {
        params._ifChainMatched = true
        execStmts(s.body, params)
      } else {
        params._ifChainMatched = false
      }
      return
    }
    if (s.type === 'elseif') {
      if (!params._ifChainMatched && evalCond(s.condition, vars, gc)) {
        params._ifChainMatched = true
        execStmts(s.body, params)
      }
      return
    }
    if (s.type === 'else') {
      if (!params._ifChainMatched) {
        params._ifChainMatched = true
        execStmts(s.body, params)
      }
      return
    }
    if (s.type === 'call') {
      // S17 fix (P1-12): wait() interceptado AQUI — precisa de aceder ao closure
      // do runtime (waitUntil é por-runtime, não partilhado no gc).
      if (s.name === 'wait') {
        var delayS = evalVal(s.args[0], vars, gc, { id: myId, mesh: myMesh }) || 0
        dbg('wait(' + delayS + 's)', 'log')
        waitUntil = Date.now() + delayS * 1000
        return
      }
      var argVals = s.args.map(function (a) { return evalVal(a, vars, gc, { id: myId, mesh: myMesh }) })
      execBuiltin(s.name, argVals, gc, { id: myId, mesh: myMesh })
      return
    }
    // unknown — ignorar silenciosamente
  }

  return {
    functions: parsed.functions, hasErrors: parsed.errors.length > 0,
    isWaiting: function () { return !!(waitUntil && Date.now() < waitUntil) },
    clearWait: function () { waitUntil = 0 },
    triggerEvent: function (en, payload) {
      // Se este runtime está em wait(), eventos são ignorados (cutscene sequencing)
      if (waitUntil && Date.now() < waitUntil) return
      var fnName = null
      for (var k in eventMap) { if (eventMap[k] === en) { fnName = k; break } }
      // S17: funções legacy têm o nome do evento interno (ex: beginPlay)
      var fn = (fnName && parsed.functions[fnName]) || parsed.functions[en]
      if (!fn) return
      // params do evento → vars locais
      var params = payload || {}
      if (fn.params && fn.params.length > 0) {
        for (var pi = 0; pi < fn.params.length; pi++) {
          vars[fn.params[pi]] = (pi === 0) ? payload : (payload && payload[fn.params[pi]])
        }
      }
      execStmts(fn.body, params)
    },
    update: function () {},
    dispose: function () { waitUntil = 0 },
  }
}

// execBuiltin — despacha funções FlirCode. `rt` = { id, mesh } do runtime dono da chamada.
function execBuiltin(name, args, gc, rt, asValue) {
  var myId = rt && rt.id, myMesh = rt && rt.mesh
  switch (name) {
    case 'print': dbg(args[0], 'log'); break
    case 'log': dbg(args[0], 'log'); break
    case 'warn': dbg(args[0], 'warn'); break
    case 'error': dbg(args[0], 'error'); break
    case 'move':
      if (myMesh) { myMesh.position.x += args[0] * 0.016; myMesh.position.y += args[1] * 0.016; myMesh.position.z += args[2] * 0.016 }
      break
    case 'rotate':
      if (myMesh) { myMesh.rotation.x += args[0] * 0.016; myMesh.rotation.y += args[1] * 0.016; myMesh.rotation.z += args[2] * 0.016 }
      break
    case 'scale':
      if (myMesh) { myMesh.scale.set(args[0] || 1, args[1] || 1, args[2] || 1) }
      break
    case 'destroy': if (myMesh) myMesh.visible = false; break
    case 'createObject': gc.spawnObject && gc.spawnObject(args[0], [args[1], args[2], args[3]]); break
    // S17 fix (P0-01): case 'changeScene' ÚNICO — antes havia um duplicado acima
    // deste (apenas dbg) que fazia shadow da implementação real → no-op.
    case 'changeScene':
      if (gc.changeScene) { gc.changeScene(args[0]); break }
      dbg('changeScene: ' + args[0], 'log'); break
    case 'wait':
      // wait() como valor (raro) — devolve os segundos; como statement é
      // interceptado em execS antes de chegar aqui (waitUntil por-runtime)
      return args[0] || 0
    case 'setVar': gc.globalVars = gc.globalVars || {}; gc.globalVars[args[0]] = args[1]; break
    case 'getVar': return (gc.globalVars || {})[args[0]]
    case 'setUIValue': gc.setUIValue && gc.setUIValue(args[0], args[1]); break
    case 'getUIValue': return gc.getUIValue ? gc.getUIValue(args[0]) : ''
    case 'showUIScreen': gc.showUIScreen && gc.showUIScreen(args[0]); break
    case 'hideUIScreen': gc.hideUIScreen && gc.hideUIScreen(args[0]); break
    case 'playSound': gc.playSound && gc.playSound(args[0]); break
    case 'playAnim': dbg('playAnim: ' + args[0], 'log'); break
    case 'collidingWith': return gc.collidingWith ? gc.collidingWith(myId, args[0]) : false
    case 'distanceTo': return gc.distanceTo ? gc.distanceTo(myId, args[0]) : 0
    case 'isTouching': return gc.isTouching ? gc.isTouching() : false
    // Sistema 2: Armas
    case 'shoot': return gc.shoot ? gc.shoot() : false
    case 'reload': gc.reload && gc.reload(); break
    case 'equipWeapon': gc.equipWeapon && gc.equipWeapon(args[0]); break
    case 'getAmmo': return gc.getAmmo ? gc.getAmmo() : 0
    case 'takeDamage': gc.takeDamage && gc.takeDamage(myId, args[0]); break
    case 'getHealth': return gc.getHealth ? gc.getHealth(myId) : 100
    // Sistema 3: Inventário
    case 'addToInventory': gc.addToInventory && gc.addToInventory(args[0], args[1]); break
    case 'removeFromInventory': gc.removeFromInventory && gc.removeFromInventory(args[0], args[1]); break
    case 'getInventoryCount': return gc.getInventoryCount ? gc.getInventoryCount(args[0]) : 0
    case 'hasItem': return gc.hasItem ? gc.hasItem(args[0]) : false
    // Sistema 3: Sinais
    case 'emitSignal': gc.emitSignal && gc.emitSignal(args[0], args[1]); break
    // Aliases showUI/hideUI = showUIScreen/hideUIScreen
    case 'showUI': gc.showUIScreen && gc.showUIScreen(args[0]); break
    case 'hideUI': gc.hideUIScreen && gc.hideUIScreen(args[0]); break
    // Multiplayer (básico no export)
    case 'sendMessage': gc.sendMessage && gc.sendMessage(args[0]); break
    case 'getPlayers': return gc.getPlayers ? gc.getPlayers() : 1
    case 'getPlayerState': return gc.getPlayerState ? gc.getPlayerState(args[0]) : null
    // Sistema: Links — navegar para cena ou tela
    case 'linkTo': gc.linkTo && gc.linkTo(args[0], args[1]); break
    // Sistema: Game State
    case 'setGameState': gc.setGameState && gc.setGameState(args[0]); break
    case 'getGameState': return gc.getGameState ? gc.getGameState() : 'menu'
    // Sistema: Save/Load Progress
    case 'saveProgress': gc.saveProgress && gc.saveProgress(args[0], args[1]); break
    case 'loadProgress': return gc.loadProgress ? gc.loadProgress(args[0]) : null
    // Sistema: Sequenciador
    case 'playSequence': gc.playSequence && gc.playSequence(args[0]); break
    // S17: Diálogo / pontuação / IA (usados pelos demos flirQuest)
    case 'setDialog': gc.setDialog && gc.setDialog(args[0]); break
    case 'showDialog': gc.showDialog && gc.showDialog(args[0]); break
    case 'hideDialog': gc.hideDialog && gc.hideDialog(); break
    case 'addScore': gc.addScore && gc.addScore(args[0]); break
    case 'chasePlayer': gc.chasePlayer && gc.chasePlayer(myId); break
    case 'stopChase': gc.stopChase && gc.stopChase(myId); break
    default:
      if (!asValue) dbg('Função desconhecida: ' + name, 'warn')
      return undefined
  }
  return undefined
}

// ===== Debug =====
function dbg(msg, type) {
  type = type || 'log'
  var d = document.getElementById('debug-body')
  if (d) {
    var e = document.createElement('div')
    e.className = 'dbg-' + type
    e.textContent = '[' + type + '] ' + msg
    d.appendChild(e); d.scrollTop = d.scrollHeight
  }
  if (type === 'error') console.error(msg)
  else console.log(msg)
}

// ===== S17: construtores de humanoides (iguais ao ConectRenderer do editor) =====
function buildHumanoid(bodyColor, skinColor, isPlayer) {
  var g = new THREE.Group()
  var limbRefs = { armL: null, armR: null, legL: null, legR: null, torso: null }
  var mkMat = function (color, rough) { return new THREE.MeshStandardMaterial({ color: color, roughness: rough ?? 0.7 }) }
  // Tronco
  var torsoPivot = new THREE.Group()
  torsoPivot.position.y = 1.2
  var torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 0.8, 4, 12), mkMat(bodyColor, 0.7))
  torso.castShadow = true
  torsoPivot.add(torso)
  g.add(torsoPivot)
  limbRefs.torso = torsoPivot
  // Cabeça
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 16), mkMat(skinColor, 0.6))
  head.position.y = 2.0; head.castShadow = true
  g.add(head)
  // Olhos
  var eyeGeo = new THREE.SphereGeometry(0.04, 8, 8)
  var eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 })
  var eyeL = new THREE.Mesh(eyeGeo, eyeMat); eyeL.position.set(-0.1, 2.05, 0.22); g.add(eyeL)
  var eyeR = new THREE.Mesh(eyeGeo, eyeMat); eyeR.position.set(0.1, 2.05, 0.22); g.add(eyeR)
  // Braços (pivot no ombro)
  var armGeo = new THREE.CapsuleGeometry(0.1, 0.7, 4, 8)
  var armLp = new THREE.Group(); armLp.position.set(-0.4, 1.65, 0)
  var armL = new THREE.Mesh(armGeo, mkMat(bodyColor, 0.7)); armL.position.y = -0.35; armL.castShadow = true
  armLp.add(armL); g.add(armLp); limbRefs.armL = armLp
  var armRp = new THREE.Group(); armRp.position.set(0.4, 1.65, 0)
  var armR = new THREE.Mesh(armGeo, mkMat(bodyColor, 0.7)); armR.position.y = -0.35; armR.castShadow = true
  armRp.add(armR); g.add(armRp); limbRefs.armR = armRp
  // Pernas (pivot no quadril)
  var legGeo = new THREE.CapsuleGeometry(0.13, 0.7, 4, 8)
  var legLp = new THREE.Group(); legLp.position.set(-0.18, 0.75, 0)
  var legL = new THREE.Mesh(legGeo, mkMat(bodyColor, 0.8)); legL.position.y = -0.35; legL.castShadow = true
  legLp.add(legL); g.add(legLp); limbRefs.legL = legLp
  var legRp = new THREE.Group(); legRp.position.set(0.18, 0.75, 0)
  var legR = new THREE.Mesh(legGeo, mkMat(bodyColor, 0.8)); legR.position.y = -0.35; legR.castShadow = true
  legRp.add(legR); g.add(legRp); limbRefs.legR = legRp
  // Estrela indicadora de JOGADOR
  if (isPlayer) {
    var star = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.16),
      new THREE.MeshStandardMaterial({ color: '#ffd700', emissive: '#ffd700', emissiveIntensity: 0.8 })
    )
    star.position.y = 2.5
    g.add(star)
    limbRefs.star = star
  }
  g.userData.limbs = limbRefs
  return g
}

// Anima membros do humanoide conforme velocidade medida (igual ao editor)
function animateHumanoid(group, speed, delta, walkState) {
  var limbs = group && group.userData && group.userData.limbs
  if (!limbs) return
  if (speed > 0.4) {
    var run = speed > 4
    walkState.t = (walkState.t || 0) + delta * (run ? 9 : 5.5)
    var amp = run ? 0.6 : 0.4
    var ph = walkState.t
    if (limbs.armL) limbs.armL.rotation.x = Math.sin(ph) * amp
    if (limbs.armR) limbs.armR.rotation.x = -Math.sin(ph) * amp
    if (limbs.legL) limbs.legL.rotation.x = -Math.sin(ph) * amp
    if (limbs.legR) limbs.legR.rotation.x = Math.sin(ph) * amp
    if (limbs.torso) limbs.torso.rotation.x = run ? 0.15 : 0.05
  } else {
    var b = Math.sin((walkState.clock = (walkState.clock || 0) + delta * 2)) * 0.05
    if (limbs.torso) limbs.torso.rotation.x = b
    if (limbs.armL) limbs.armL.rotation.x = b * 0.5
    if (limbs.armR) limbs.armR.rotation.x = b * 0.5
    if (limbs.legL) limbs.legL.rotation.x = 0
    if (limbs.legR) limbs.legR.rotation.x = 0
  }
}

// ===== S17: caixa de diálogo DOM (showDialog/setDialog do FlirCode) =====
function ensureDialogueBox() {
  var el = document.getElementById('flir-dialog')
  if (!el) {
    el = document.createElement('div')
    el.id = 'flir-dialog'
    el.style.cssText = 'position:fixed;left:50%;bottom:12%;transform:translateX(-50%);max-width:min(520px,86vw);' +
      'background:rgba(13,17,23,0.92);border:1px solid #2f81f7;border-radius:10px;padding:12px 18px;color:#e6edf3;' +
      'font-size:15px;font-family:-apple-system,sans-serif;line-height:1.45;z-index:60;pointer-events:none;' +
      'box-shadow:0 4px 18px rgba(0,0,0,0.5);text-align:center;display:none;transition:opacity .25s;opacity:0;'
    document.body.appendChild(el)
  }
  return el
}
var _dialogTimer = null
function showRuntimeDialog(text) {
  var el = ensureDialogueBox()
  el.textContent = String(text ?? '')
  el.style.display = 'block'
  requestAnimationFrame(function () { el.style.opacity = '1' })
  if (_dialogTimer) clearTimeout(_dialogTimer)
  _dialogTimer = setTimeout(function () { hideRuntimeDialog() }, 4500)
}
function hideRuntimeDialog() {
  var el = document.getElementById('flir-dialog')
  if (el) { el.style.opacity = '0'; setTimeout(function () { el.style.display = 'none' }, 260) }
}

// ===== Game Runtime =====
function startGame() {
  var data = window.__GAME_DATA__
  // S17 fix (P1-13): arrancar na cena ATIVA do projeto (antes: sempre scenes[0])
  var scene = (data.scenes && (data.scenes.find(function (s) { return s.id === data.activeSceneId }) || data.scenes[0])) || null
  if (!scene) {
    // CORRECAO BUG8: usar textContent em vez de innerHTML (evita XSS)
    var splash = document.getElementById('splash')
    splash.textContent = ''
    var errDiv = document.createElement('div')
    errDiv.style.color = '#f85149'
    errDiv.textContent = 'Sem cenas'
    splash.appendChild(errDiv)
    return
  }

  var canvas = document.getElementById('game-canvas')
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true

  var scene3d = new THREE.Scene()
  var bg = scene.background
  if (bg && bg.type === 'gradient') {
    var c = document.createElement('canvas'); c.width = 2; c.height = 256
    var ctx = c.getContext('2d')
    var g = ctx.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, bg.gradientTop); g.addColorStop(1, bg.gradientBottom)
    ctx.fillStyle = g; ctx.fillRect(0, 0, 2, 256)
    scene3d.background = new THREE.CanvasTexture(c)
  } else if (bg) {
    scene3d.background = new THREE.Color(bg.color || '#0d1117')
  }

  scene3d.add(new THREE.AmbientLight(0xffffff, 0.6))
  var dir = new THREE.DirectionalLight(0xffffff, 1.2); dir.position.set(5, 8, 5); dir.castShadow = true
  scene3d.add(dir)

  // Câmara — usar resolveActiveView do cameraController embebido
  var activeView = resolveActiveView(scene.conects) || scene.gameCamera
  var hasTZ = hasCameraTouchZone(scene.conects)
  var camState = createCameraState()
  camState.enabled = true // S17: rotação sempre disponível (rato/setas fallback)
  camState.hasTouchZone = hasTZ
  var cam = activeView || scene.gameCamera || { cameraType: 'perspective', position: [5, 4, 6], fov: 60, near: 0.1, far: 2000 }
  var camera = (cam.cameraType || cam.type) === 'orthographic'
    ? new THREE.OrthographicCamera(-5, 5, 5, -5, cam.near || 0.1, cam.far || 2000)
    : new THREE.PerspectiveCamera(cam.fov || 60, window.innerWidth / window.innerHeight, cam.near || 0.1, cam.far || 2000)
  camera.position.set.apply(camera.position, cam.position || [5, 4, 6])
  if (activeView && activeView.rotation) {
    camera.rotation.set(activeView.rotation[0], activeView.rotation[1], activeView.rotation[2], 'YXZ')
  } else {
    camera.lookAt(0, 0, 0)
  }

  // Física
  var world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })
  world.broadphase = new CANNON.SAPBroadphase(world)
  world.allowSleep = true
  // S19 FIX (character controller): material dedicado com friction=0 para
  // personagens. O solver de fricção do cannon-es "cola" um box upright com
  // velocity horizontal setada por código (o movimento WASD/IA morria: velocity
  // → 0 em cada substep). Controlo horizontal é feito por velocity por frame
  // + linearDamping (padrão em character controllers).
  var charPhysMat = new CANNON.Material('flir-character')
  var groundPhysMat = new CANNON.Material('flir-ground')
  world.addContactMaterial(new CANNON.ContactMaterial(charPhysMat, groundPhysMat, { friction: 0, restitution: 0 }))
  world.addContactMaterial(new CANNON.ContactMaterial(charPhysMat, charPhysMat, { friction: 0.1, restitution: 0 }))
  var bodies = {}
  var meshMap = {}
  var triggers = {}     // S19: instanceId → { size, position, previousContacts } — TriggerObject
  var items = {}        // S20/A2: instanceId → { position, radius, autoPickup, taken, baseY } — ItemObject
  var checkpoints = {}  // S20/A2: instanceId → { position, radius, checkpointId, isStart, active, flag } — CheckpointObject
  var respawnPoint = null // S20/A2: último checkpoint ativado [x, y, z]

  // S17: estado de animação/IA por NPC + player
  var animStates = {}   // instanceId → { t, clock, lastPos:{x,z} }
  var npcAIs = {}       // instanceId → { hasSight, patrolIndex }

  // S17 fix (P0-03): `player` DECLARADO — antes era global implícita (ReferenceError
  // em strict mode no assignment + read-before-write no changeScene).
  var player = null

  // FlirCode runtimes
  var runtimes = {}

  var gc = {
    globalVars: { _score: 0 },
    playSound: function (url) { try { new Audio(url).play() } catch (e) { } },
    showUIScreen: function (name) { var s = (data.uiScreens || []).find(function (s) { return s.name === name }); if (s) { s.visible = true; renderUI() } },
    hideUIScreen: function (name) { var s = (data.uiScreens || []).find(function (s) { return s.name === name }); if (s) { s.visible = false; renderUI() } },
    getUIValue: function (name) { var ss = data.uiScreens || []; for (var i = 0; i < ss.length; i++) { var e = ss[i].elements.find(function (e) { return e.name === name }); if (e) return e.value || e.text || '' } return '' },
    setUIValue: function (name, val) { var ss = data.uiScreens || []; for (var i = 0; i < ss.length; i++) { var e = ss[i].elements.find(function (e) { return e.name === name }); if (e) { e.value = val; e.text = val; e.label = val; renderUI(); return } } },
    triggerUIEvent: function (en, payload) { for (var k in runtimes) { runtimes[k].triggerEvent(en, payload) } },
    spawnObject: function (name, pos) {
      // S17 fix (P2-26): procurar no CATÁLOGO (data.objects) — antes procurava em
      // scene.objects (instâncias) e nunca encontrava o objeto a spawnar.
      var obj = (data.objects || []).find(function (o) { return o.name === name })
      if (!obj) { dbg('spawnObject: objeto "' + name + '" não encontrado no catálogo', 'warn'); return null }
      var geo = new THREE.BoxGeometry(1, 1, 1)
      var mat = new THREE.MeshStandardMaterial({ color: (obj.material && obj.material.color) || '#cccccc', roughness: 0.7 })
      var mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(pos[0] || 0, pos[1] || 0, pos[2] || 0)
      mesh.castShadow = true; mesh.receiveShadow = true
      mesh._name = name + '_' + Date.now()
      mesh._isSpawned = true
      scene3d.add(mesh)
      var newId = 'spawned_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
      meshMap[newId] = mesh
      dbg('spawnObject: ' + name + ' em [' + pos.join(',') + ']', 'log')
      return newId
    },
    collidingWith: function (id, type) {
      if (!bodies[id]) return false
      for (var k in bodies) {
        if (k === id) continue
        var c = bodies[k]._conect
        if (c && (c.type === type || c.name === type)) {
          if (bodies[id].position.distanceTo(bodies[k].position) < 1.5) return true
        }
      }
      return false
    },
    distanceTo: function (id, name) {
      var src = meshMap[id]
      if (!src) return 0
      for (var k in meshMap) {
        var m = meshMap[k]
        if (m._name === name || (m._conect && m._conect.name === name)) {
          return src.position.distanceTo(m.position)
        }
      }
      return 0
    },
    isTouching: function () { return joystick.active },
    // Sistema 2: Armas e combate (exportado) — implementação real com raycast
    shoot: function () {
      if ((gc._weaponAmmo || 0) <= 0) { dbg('shoot: sem munição! Pressiona reload()', 'warn'); return false }
      gc._weaponAmmo = (gc._weaponAmmo || 0) - 1
      var raycaster = new THREE.Raycaster()
      var origin = camera.position.clone()
      var dirV = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize()
      raycaster.set(origin, dirV)
      raycaster.far = gc._weaponRange || 100
      var targets = []
      for (var k in meshMap) {
        if (meshMap[k]._conect && meshMap[k].visible !== false) targets.push(meshMap[k])
      }
      var hits = raycaster.intersectObjects(targets, true)
      if (hits.length > 0) {
        var hit = hits[0]
        var hitMesh = hit.object
        while (hitMesh && !hitMesh._conect && hitMesh.parent) hitMesh = hitMesh.parent
        if (hitMesh && hitMesh._conect) {
          var id = hitMesh._conect.instanceId
          dbg('shoot: atingiu ' + (hitMesh._conect.name || id) + ' a ' + hit.distance.toFixed(1) + 'm', 'log')
          if (gc.takeDamage) gc.takeDamage(id, gc._weaponDamage || 25)
          if (runtimes[id]) runtimes[id].triggerEvent('onHit', { damage: gc._weaponDamage || 25, point: [hit.point.x, hit.point.y, hit.point.z] })
          return id
        }
      }
      dbg('shoot: disparou mas não atingiu nada', 'log')
      return false
    },
    reload: function () {
      var max = gc._weaponMaxAmmo || 30
      gc._weaponAmmo = max
      dbg('reload: munição restaurada para ' + max, 'log')
    },
    equipWeapon: function (name) {
      var w = (scene.conects || []).find(function (c) { return c.type === 'WeaponObject' && c.name === name })
      if (!w) { dbg('equipWeapon: arma "' + name + '" não encontrada', 'warn'); return false }
      gc._weaponDamage = w.damage || 25
      gc._weaponRange = w.range || 100
      gc._weaponMaxAmmo = w.maxAmmo || 30
      gc._weaponAmmo = gc._weaponMaxAmmo
      dbg('equipWeapon: ' + name + ' equipada (dano=' + gc._weaponDamage + ', munição=' + gc._weaponMaxAmmo + ')', 'log')
      return true
    },
    getAmmo: function () { return gc._weaponAmmo || 0 },
    takeDamage: function (id, amount) {
      var conects = (scene && scene.conects) || []
      for (var i = 0; i < conects.length; i++) {
        if (conects[i].instanceId === id) {
          var c = conects[i]
          c.health = Math.max(0, (c.health || 100) - amount)
          dbg(c.name + ' recebeu ' + amount + ' dano (vida: ' + c.health + ')', 'log')
          var rt = runtimes[id]; if (rt) rt.triggerEvent('onDamage', { amount: amount, source: 'weapon' })
          // S17: onDeath quando a vida chega a 0
          if (c.health <= 0) {
            if (meshMap[id]) meshMap[id].visible = false
            if (rt) rt.triggerEvent('onDeath', { killer: 'weapon' })
          }
          break
        }
      }
    },
    getHealth: function (id) {
      var conects = (scene && scene.conects) || []
      for (var i = 0; i < conects.length; i++) { if (conects[i].instanceId === id) return conects[i].health || 100 }
      return 100
    },
    // Sistema 3: Inventário (exportado)
    addToInventory: function (name, qty) {
      gc._inventory = gc._inventory || {}
      gc._inventory[name] = (gc._inventory[name] || 0) + (qty || 1)
      dbg('Item "' + name + '" adicionado (' + qty + '). Total: ' + gc._inventory[name], 'log')
      for (var k in runtimes) { runtimes[k].triggerEvent('onPickup', { itemName: name, quantity: qty }) }
    },
    removeFromInventory: function (name, qty) {
      gc._inventory = gc._inventory || {}
      if (!gc._inventory[name]) return
      gc._inventory[name] = Math.max(0, gc._inventory[name] - (qty || 1))
      if (gc._inventory[name] === 0) delete gc._inventory[name]
    },
    getInventoryCount: function (name) { return (gc._inventory || {})[name] || 0 },
    hasItem: function (name) { return ((gc._inventory || {})[name] || 0) > 0 },
    // Sistema 3: Sinais (exportado)
    emitSignal: function (name, sigData) {
      for (var k in runtimes) { runtimes[k].triggerEvent('onSignal', { name: name, data: sigData }) }
      dbg('Signal emitido: ' + name, 'log')
    },
    // Sistema: Links (exportado)
    linkTo: function (target, sub) {
      if (target === 'scene') {
        var sc = (data.scenes || []).find(function (s) { return s.name === sub || s.id === sub })
        if (sc) { gc.changeScene(sc.id) }
      } else if (target === 'screen') {
        var ss = (data.uiScreens || []).find(function (s) { return s.name === sub || s.id === sub })
        if (ss) { (data.uiScreens || []).forEach(function (s) { s.visible = (s.id === ss.id) }); renderUI(); dbg('Link: tela "' + ss.name + '"', 'log') }
      } else if (target === 'url') { window.open(sub, '_blank') }
    },
    // changeScene real (exportado) — S17 fixes P0-03/P0-04
    changeScene: function (nameOrId) {
      var sc = (data.scenes || []).find(function (s) { return s.name === nameOrId || s.id === nameOrId })
      if (!sc) { dbg('Cena não encontrada: ' + nameOrId, 'error'); return }
      if (scene && sc.id === scene.id) { dbg('Já na cena: ' + sc.name, 'log'); return }
      dbg('A mudar para cena: ' + sc.name, 'log')

      // 1. Guardar estado do jogador (vida, inventário, etc.)
      var savedPlayer = null
      if (player && meshMap[player.instanceId]) {
        savedPlayer = {
          health: player.health,
          inventory: gc._inventory || {},
          score: gc.globalVars._score || 0,
        }
      }

      // 2. Limpar meshes e bodies da cena antiga
      for (var k in meshMap) {
        if (meshMap[k] && meshMap[k].parent) meshMap[k].parent.remove(meshMap[k])
        if (meshMap[k] && meshMap[k].geometry) meshMap[k].geometry.dispose?.()
        if (meshMap[k] && meshMap[k].material) meshMap[k].material.dispose?.()
      }
      meshMap = {}
      triggers = {}
      items = {}        // S20/A2: limpar itens da cena antiga
      checkpoints = {}  // S20/A2: limpar checkpoints da cena antiga
      for (var k2 in bodies) {
        if (bodies[k2]) world.removeBody(bodies[k2])
      }
      bodies = {}
      // Dispose runtimes antigos
      for (var k3 in runtimes) {
        if (runtimes[k3] && runtimes[k3].dispose) runtimes[k3].dispose()
      }
      runtimes = {}
      npcAIs = {}
      animStates = {}

      // 3. Atualizar cena ativa
      data.activeSceneId = sc.id
      scene = sc

      // 4. Re-inicializar física (gravidade da nova cena)
      if (sc.physics && sc.physics.gravity) {
        world.gravity.set(0, sc.physics.gravity[1], 0)
      }

      // 5. Re-criar meshes/bodies/runtimes da nova cena (setup partilhado)
      setupSceneContents(sc)

      // S17 fix (P0-04): RECALCULAR a câmara — activeView/hasTZ/camState ficavam
      // apontados para a cena ANTIGA (câmara seguia o jogador inexistente).
      activeView = resolveActiveView(sc.conects) || sc.gameCamera
      hasTZ = hasCameraTouchZone(sc.conects)
      camState.hasTouchZone = hasTZ
      camState.enabled = true
      if (activeView) {
        camera.fov = activeView.fov || camera.fov
        camera.near = activeView.near || camera.near
        camera.far = activeView.far || camera.far
        camera.updateProjectionMatrix()
      }

      // 6. Reposicionar jogador (spawn da nova cena; manter vida/inventário/score)
      player = (sc.conects || []).find(function (c) { return c.type === 'PersonalObject' })
      if (player && savedPlayer) {
        if (savedPlayer.health !== undefined) player.health = savedPlayer.health
        gc._inventory = savedPlayer.inventory
        gc.globalVars._score = savedPlayer.score
      }

      // 7. Re-render UI
      renderUI()

      dbg('Cena mudou para "' + sc.name + '"', 'log')
    },
    // Sistema: Game State (exportado)
    _gameState: 'menu',
    setGameState: function (s) { gc._gameState = s; dbg('Game State: ' + s, 'log'); for (var k in runtimes) { runtimes[k].triggerEvent('onGameStateChange', { state: s }) } },
    getGameState: function () { return gc._gameState },
    // Sistema: Save/Load Progress (exportado — localStorage do jogador)
    saveProgress: function (key, val) { try { localStorage.setItem('flir_progress_' + key, JSON.stringify(val)); dbg('Progresso guardado: ' + key, 'log') } catch (e) {} },
    loadProgress: function (key) { try { var v = localStorage.getItem('flir_progress_' + key); return v ? JSON.parse(v) : null } catch (e) { return null } },
    // Sistema: Sequenciador (exportado — básico)
    playSequence: function (name) { dbg('Sequência "' + name + '" iniciada', 'log') },
    // S17: Diálogo / pontuação / IA (demos flirQuest)
    setDialog: function (text) { gc.globalVars._dialogText = String(text ?? '') },
    showDialog: function (text) {
      var t = (text !== undefined && text !== null && text !== '') ? String(text) : String(gc.globalVars._dialogText || '')
      showRuntimeDialog(t)
      dbg('Diálogo: "' + t.slice(0, 60) + '"', 'log')
    },
    hideDialog: function () { hideRuntimeDialog() },
    addScore: function (n) {
      gc.globalVars._score = (gc.globalVars._score || 0) + (Number(n) || 0)
      dbg('Pontuação: ' + gc.globalVars._score, 'log')
    },
    chasePlayer: function (id) { if (id) gc.globalVars['_chase_' + id] = true },
    stopChase: function (id) { if (id) gc.globalVars['_chase_' + id] = false },
    // S19: introspeção de debug (read-only) — permite validar/diagnosticar o jogo
    // exportado (posição do player, NPCs, câmara, cena ativa) sem expor o estado interno.
    _debugState: function () {
      var st = { scene: scene ? scene.id : null, npcs: {}, camera: { yaw: camState.yaw, pitch: camState.pitch } }
      if (player && meshMap[player.instanceId]) {
        var pm = meshMap[player.instanceId]
        st.player = [+pm.position.x.toFixed(3), +pm.position.y.toFixed(3), +pm.position.z.toFixed(3)]
      }
      for (var id in npcAIs) {
        if (meshMap[id]) {
          var nm = meshMap[id]
          st.npcs[id] = [+nm.position.x.toFixed(3), +nm.position.y.toFixed(3), +nm.position.z.toFixed(3)]
        }
      }
      st.bodies = {}
      for (var bid in bodies) {
        st.bodies[bid] = {
          y: +bodies[bid].position.y.toFixed(3), vy: +bodies[bid].velocity.y.toFixed(3),
          vx: +bodies[bid].velocity.x.toFixed(3), vz: +bodies[bid].velocity.z.toFixed(3),
        }
      }
      return st
    },
  }
  window._flirGameContext = gc

  // S17: setup partilhado entre arranque inicial e changeScene — cria meshes,
  // bodies, runtimes, IA e animações de UMA cena (P1-09: humanoides também na
  // cena inicial; antes só o caminho changeScene criava humanoides).
  function setupSceneContents(sc) {
    // Objects (catálogo) — S17 fix (P2-26): lookup em data.objects
    ;(sc.objects || []).forEach(function (inst) {
      var obj = (data.objects || []).find(function (o) { return o.id === inst.objectId })
      if (!obj) return
      var mesh = setupMesh(obj, inst.position, inst.rotation, inst.scale)
      meshMap[inst.instanceId] = mesh
      mesh._name = obj.name
      if (obj.flirScript && typeof obj.flirScript === 'string' && obj.flirScript.startsWith('FLIRCODE:')) {
        var rt = createFlirCodeRuntime(obj.flirScript.slice(9), gc, { _instanceId: inst.instanceId, mesh: mesh })
        if (!rt.hasErrors) { runtimes[inst.instanceId] = rt; rt.triggerEvent('beginPlay') }
      }
    })

    // Conects
    ;(sc.conects || []).forEach(function (conect) {
      var mesh = null
      if (['RigidObject', 'StaticObject', 'StopObject', 'PersonalObject', 'NpcObject'].indexOf(conect.type) >= 0) {
        var isChar = conect.type === 'PersonalObject' || conect.type === 'NpcObject'
        if (conect.type === 'NpcObject') {
          // S17 fix (P1-09): humanoide com membros animáveis (igual ao editor e
          // ao caminho changeScene — antes a cena inicial usava um cubo)
          mesh = buildHumanoid(conect.color || '#c0392b', '#f4d4b8', false)
          if (conect.scale) mesh.scale.set(conect.scale[0] || 1, conect.scale[1] || 1, conect.scale[2] || 1)
          mesh.position.set.apply(mesh.position, conect.position || [0, 0.5, 0])
          scene3d.add(mesh)
          meshMap[conect.instanceId] = mesh
          mesh._name = conect.name; mesh._conect = conect
          animStates[conect.instanceId] = { t: 0, clock: 0, lastPos: null }
          npcAIs[conect.instanceId] = { hasSight: false, patrolIndex: 0 }
        } else if (conect.type === 'PersonalObject') {
          // S17: player humanoide (verde, com estrela) — igual ao PlayerHumanoidMesh
          mesh = buildHumanoid('#3fb950', '#f4d4b8', true)
          mesh.position.set.apply(mesh.position, conect.position || [0, 0.5, 0])
          scene3d.add(mesh)
          meshMap[conect.instanceId] = mesh
          mesh._name = conect.name; mesh._conect = conect
          animStates[conect.instanceId] = { t: 0, clock: 0, lastPos: null }
        } else {
          var color = conect.type === 'StaticObject' ? 0x6e7681 : 0x888888
          var geo = new THREE.BoxGeometry(1, 1, 1)
          mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 }))
          mesh.position.set.apply(mesh.position, conect.position || [0, 0.5, 0])
          mesh.castShadow = true; mesh.receiveShadow = true
          scene3d.add(mesh)
          meshMap[conect.instanceId] = mesh
          mesh._name = conect.name; mesh._conect = conect
        }
        // Physics
        // S17 fix (P1-10): personagens com fixedRotation=true, allowSleep=false,
        // damping — antes o herói caía/rolava/deslizava no jogo exportado.
        var isCharacter = conect.type === 'PersonalObject' || conect.type === 'NpcObject'
        var csz = conect.colliderSize || (isCharacter ? [0.7, 1.6, 0.7] : [1, 1, 1])
        var shape = new CANNON.Box(new CANNON.Vec3(csz[0] / 2, csz[1] / 2, csz[2] / 2))
        var body = new CANNON.Body({
          mass: (conect.type === 'StaticObject' || conect.type === 'StopObject') ? 0 : (conect.mass || 1),
          shape: shape,
          position: new CANNON.Vec3(conect.position[0], conect.position[1], conect.position[2]),
          material: isCharacter ? charPhysMat : undefined,
        })
        if (conect.type === 'StaticObject') { body.type = CANNON.Body.STATIC; body.mass = 0 }
        if (conect.type === 'StopObject') { body.type = CANNON.Body.KINEMATIC; body.mass = 0 }
        body.fixedRotation = isCharacter ? true : (conect.fixedRotation || false)
        // S19 FIX: fixedRotation definido APÓS a construção não atualiza a inércia
        // — sem updateMassProperties() o box RODAVA (tombava com a fricção do chão;
        // os NPCs do Showcase apareciam deitados e afundavam até y=0.35).
        if (isCharacter) body.updateMassProperties()
        // S19 FIX: clamp de spawn para personagens — um spawn com o colisor a
        // atravessar o chão (ex.: y=0.05 com meio-colisor 0.8) gera penetração
        // profunda; o cannon-es resolve com um impulso gigante e lança o corpo
        // ao ar (o player do Showcase chegava a y=8 e levava ~8s a aterrar).
        if (isCharacter) {
          var halfH = csz[1] / 2
          if (body.position.y < halfH + 0.02) body.position.y = halfH + 0.02
        }
        body.allowSleep = isCharacter ? false : true
        body.linearDamping = isCharacter ? 0.2 : 0.01
        body.angularDamping = isCharacter ? 0.9 : 0.01
        body._conect = conect
        // S19: offset visual — a origem do humanoide é nos PÉS; o colisor é uma
        // box centrada no body. Sem isto os pés flutuam a meio-colisor do chão.
        if (isCharacter && mesh) mesh._yOffset = -(csz[1] / 2)
        world.addBody(body)
        bodies[conect.instanceId] = body
        body.addEventListener('collide', (function (cid) {
          return function (e) {
            var otherId = null
            for (var k in bodies) { if (bodies[k] === e.body) { otherId = k; break } }
            if (otherId && runtimes[cid]) runtimes[cid].triggerEvent('onCollision', { other: otherId })
          }
        })(conect.instanceId))
      } else if (conect.type === 'TerrainObject') {
        var seg = conect.segments || 64
        var terrainGeo = new THREE.PlaneGeometry(conect.width || 50, conect.depth || 50, seg, seg)
        if (conect.heightmap && conect.heightmap.length > 0) {
          var pos = terrainGeo.attributes.position
          var heightScale = conect.heightScale || 5
          for (var k = 0; k < pos.count; k++) {
            pos.setZ(k, (conect.heightmap[k] || 0) * heightScale)
          }
          pos.needsUpdate = true
        }
        terrainGeo.rotateX(-Math.PI / 2)
        terrainGeo.computeVertexNormals()
        var terrainMesh = new THREE.Mesh(terrainGeo, new THREE.MeshStandardMaterial({ color: conect.color || 0x4a7c3a, roughness: 0.85 }))
        terrainMesh.position.set.apply(terrainMesh.position, conect.position || [0, 0, 0])
        terrainMesh.receiveShadow = true
        scene3d.add(terrainMesh)
        meshMap[conect.instanceId] = terrainMesh
        terrainMesh._name = conect.name; terrainMesh._conect = conect
        // Física: plano de chão infinito (a altura do terrain conect)
        var planeBody = new CANNON.Body({
          mass: 0,
          shape: new CANNON.Plane(),
          position: new CANNON.Vec3(conect.position?.[0] || 0, conect.position?.[1] || 0, conect.position?.[2] || 0),
          material: groundPhysMat,
        })
        planeBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
        world.addBody(planeBody)
        bodies[conect.instanceId] = planeBody
        planeBody._conect = conect
        // S17: NÃO sincronizar o quaternion deste body para o mesh (a geometria
        // já tem rotateX(-PI/2) baked — sincronizar dobrava a rotação → parede)
        planeBody._isTerrain = true
      } else if (conect.type === 'LuminousObject') {
        var light
        if (conect.lightType === 'directional') light = new THREE.DirectionalLight(conect.color || 0xffffff, conect.intensity || 1)
        else if (conect.lightType === 'spot') light = new THREE.SpotLight(conect.color || 0xffffff, conect.intensity || 1)
        else light = new THREE.PointLight(conect.color || 0xffffff, conect.intensity || 1, conect.distance || 10)
        light.position.set.apply(light.position, conect.position || [0, 5, 0])
        light.castShadow = conect.castShadow !== false
        scene3d.add(light)
      } else if (conect.type === 'SkyObject' && conect.skyType === 'gradient') {
        var sc = document.createElement('canvas'); sc.width = 2; sc.height = 256
        var sctx = sc.getContext('2d')
        var sg = sctx.createLinearGradient(0, 0, 0, 256)
        sg.addColorStop(0, conect.topColor || '#1a4d8f'); sg.addColorStop(1, conect.bottomColor || '#aac4e8')
        sctx.fillStyle = sg; sctx.fillRect(0, 0, 2, 256)
        scene3d.background = new THREE.CanvasTexture(sc)
      } else if (conect.type === 'FogObject') {
        if (conect.fogType === 'exponential') scene3d.fog = new THREE.FogExp2(conect.color || 0xa0a0a0, conect.density || 0.02)
        else scene3d.fog = new THREE.Fog(conect.color || 0xa0a0a0, conect.near || 5, conect.far || 50)
      } else if (conect.type === 'SoundObject' && conect.autoplay && conect.url) {
        try { var audio = new Audio(conect.url); audio.volume = conect.volume || 1; audio.loop = conect.loop || false; audio.play() } catch (e) { }
      } else if (conect.type === 'TriggerObject') {
        // S19 FIX (A2): TriggerObject — antes não tinha NENHUMA renderização nem
        // deteção no runtime exportado → onEnterZone nunca disparava (o portal do
        // Showcase ficava invisível e morto). Mesh semi-transparente + registo
        // para deteção AABB no loop animate() (igual ao physicsSystem do editor).
        var tSize = conect.size || [2, 3, 2]
        var tGeo = new THREE.BoxGeometry(tSize[0], tSize[1], tSize[2])
        var tMat = new THREE.MeshBasicMaterial({ color: conect.color || '#8b5cf6', transparent: true, opacity: 0.35, side: THREE.DoubleSide })
        mesh = new THREE.Mesh(tGeo, tMat)
        mesh.position.set.apply(mesh.position, conect.position || [0, 1, 0])
        scene3d.add(mesh)
        meshMap[conect.instanceId] = mesh
        mesh._name = conect.name; mesh._conect = conect
        triggers[conect.instanceId] = { size: tSize, position: conect.position || [0, 1, 0], previousContacts: {} }
      } else if (conect.type === 'ItemObject') {
        // S20/A2 FIX: ItemObject — antes não tinha mesh NENHUM no runtime
        // exportado (ficava invisível e sem pickup). Octaedro emissivo com
        // rotação + flutuação + deteção de pickup por proximidade no animate().
        var iRadius = conect.pickupRadius || 2
        var iColor = conect.color || '#ffd700'
        var iGeo = new THREE.OctahedronGeometry(0.45, 0)
        var iMat = new THREE.MeshStandardMaterial({
          color: iColor, emissive: iColor, emissiveIntensity: 0.85,
          roughness: 0.25, metalness: 0.55,
        })
        mesh = new THREE.Mesh(iGeo, iMat)
        var iPos = conect.position || [0, 1, 0]
        mesh.position.set(iPos[0], iPos[1], iPos[2])
        mesh.castShadow = true
        scene3d.add(mesh)
        meshMap[conect.instanceId] = mesh
        mesh._name = conect.name; mesh._conect = conect
        items[conect.instanceId] = {
          position: iPos, radius: iRadius,
          autoPickup: conect.autoPickup !== false,
          itemName: conect.itemName || 'Item',
          quantity: conect.quantity || 1,
          taken: false, baseY: iPos[1], t: Math.random() * Math.PI * 2,
        }
        dbg('Item "' + (conect.itemName || conect.name) + '" criado em [' + iPos.join(',') + ']', 'log')
      } else if (conect.type === 'CheckpointObject') {
        // S20/A2 FIX: CheckpointObject — antes não tinha mesh NENHUM no runtime
        // exportado. Bandeira (poste + pano + base) com ativação de respawn
        // por proximidade: ao passar, guarda o ponto de renascimento e o pano
        // muda de cor (feedback visual). Respawn ao cair do mundo (y < -20).
        var cPos = conect.position || [0, 0, 0]
        var flagGroup = new THREE.Group()
        var pole = new THREE.Mesh(
          new THREE.CylinderGeometry(0.05, 0.06, 2.2, 10),
          new THREE.MeshStandardMaterial({ color: '#dcdcdc', metalness: 0.75, roughness: 0.3 })
        )
        pole.position.y = 1.1; pole.castShadow = true
        flagGroup.add(pole)
        var cFlagMat = new THREE.MeshStandardMaterial({
          color: conect.color || '#94a3b8', side: THREE.DoubleSide, roughness: 0.85,
        })
        var cFlag = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.58), cFlagMat)
        cFlag.position.set(0.5, 1.86, 0)
        flagGroup.add(cFlag)
        var cBase = new THREE.Mesh(
          new THREE.CylinderGeometry(0.22, 0.3, 0.16, 14),
          new THREE.MeshStandardMaterial({ color: '#3b4048', roughness: 0.55, metalness: 0.35 })
        )
        cBase.position.y = 0.08
        flagGroup.add(cBase)
        flagGroup.position.set(cPos[0], cPos[1], cPos[2])
        scene3d.add(flagGroup)
        mesh = flagGroup
        meshMap[conect.instanceId] = mesh
        mesh._name = conect.name; mesh._conect = conect
        checkpoints[conect.instanceId] = {
          position: cPos, radius: conect.radius || 2.5,
          checkpointId: conect.checkpointId || 0,
          isStart: !!conect.isStart,
          active: false, flag: cFlag, flagMat: cFlagMat, t: Math.random() * Math.PI * 2,
        }
        if (conect.isStart) {
          respawnPoint = [cPos[0], cPos[1] + 0.5, cPos[2]]
          dbg('Checkpoint inicial definido (' + conect.name + ')', 'log')
        }
      }

      // FlirCode para conects — S17 fix (P0-02): rtOpts por-runtime
      if (conect.flirScript && typeof conect.flirScript === 'string' && conect.flirScript.startsWith('FLIRCODE:')) {
        var rt2 = createFlirCodeRuntime(conect.flirScript.slice(9), gc, { _instanceId: conect.instanceId, mesh: mesh })
        if (!rt2.hasErrors) { runtimes[conect.instanceId] = rt2; rt2.triggerEvent('beginPlay') }
      }
      if (conect.flirCode && typeof conect.flirCode === 'string' && conect.flirCode.trim()) {
        var rt3 = createFlirCodeRuntime(conect.flirCode, gc, { _instanceId: conect.instanceId, mesh: mesh })
        if (!rt3.hasErrors) { runtimes[conect.instanceId] = rt3; rt3.triggerEvent('beginPlay') }
      }
    })
  }

  // Setup meshes para objetos do catálogo
  function setupMesh(obj, pos, rot, scl) {
    var geo
    if (obj.type === 'cube') geo = new THREE.BoxGeometry(1, 1, 1)
    else if (obj.type === 'sphere') geo = new THREE.SphereGeometry(0.6, 32, 16)
    else if (obj.type === 'cylinder') geo = new THREE.CylinderGeometry(0.5, 0.5, 1.2, 32)
    else if (obj.type === 'cone') geo = new THREE.ConeGeometry(0.6, 1.2, 32)
    else if (obj.type === 'plane') geo = new THREE.PlaneGeometry(1.5, 1.5)
    else if (obj.type === 'torus') geo = new THREE.TorusGeometry(0.6, 0.2, 16, 64)
    else geo = new THREE.BoxGeometry(1, 1, 1)
    var m = obj.material || {}
    var mat = new THREE.MeshStandardMaterial({ color: m.color || '#888', roughness: m.roughness || 0.7, metalness: m.metalness || 0 })
    var mesh = new THREE.Mesh(geo, mat)
    mesh.position.set.apply(mesh.position, pos || [0, 0.5, 0])
    if (rot) mesh.rotation.set.apply(mesh.rotation, rot)
    if (scl) mesh.scale.set.apply(mesh.scale, scl)
    mesh.castShadow = true; mesh.receiveShadow = true
    scene3d.add(mesh)
    return mesh
  }

  // ===== S17: arranque inicial (usa o setup partilhado) =====
  setupSceneContents(scene)
  player = (scene.conects || []).find(function (c) { return c.type === 'PersonalObject' }) || null

  // Joystick / teclado
  // S17 fix (P2-22): touch — metade ESQUERDA do ecrã = joystick, metade DIREITA =
  // rotação de câmara (estilo COD Mobile). Antes QUALQUER toque ativava o joystick
  // e a rotação por toque não existia no exportado.
  var joystick = { x: 0, z: 0, active: false }
  var joystickTouchId = null, joystickStart = null
  var cameraTouchId = null, cameraLast = null
  canvas.addEventListener('touchstart', function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i]
      if (t.clientX < window.innerWidth / 2 && joystickTouchId === null) {
        joystickTouchId = t.identifier
        joystickStart = { x: t.clientX, y: t.clientY }
        joystick.active = true
      } else if (cameraTouchId === null) {
        cameraTouchId = t.identifier
        cameraLast = { x: t.clientX, y: t.clientY }
      }
    }
    e.preventDefault()
  }, { passive: false })
  canvas.addEventListener('touchmove', function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i]
      if (t.identifier === joystickTouchId && joystickStart) {
        joystick.x = Math.max(-1, Math.min(1, (t.clientX - joystickStart.x) / 50))
        joystick.z = Math.max(-1, Math.min(1, (t.clientY - joystickStart.y) / 50))
      } else if (t.identifier === cameraTouchId && cameraLast) {
        var dx = t.clientX - cameraLast.x
        var dy = t.clientY - cameraLast.y
        cameraLast = { x: t.clientX, y: t.clientY }
        applyCameraInput(dx, dy, camState)
      }
    }
    e.preventDefault()
  }, { passive: false })
  var endTouch = function (e) {
    for (var i = 0; i < e.changedTouches.length; i++) {
      var t = e.changedTouches[i]
      if (t.identifier === joystickTouchId) {
        joystickTouchId = null; joystickStart = null
        joystick.active = false; joystick.x = 0; joystick.z = 0
      }
      if (t.identifier === cameraTouchId) { cameraTouchId = null; cameraLast = null }
    }
  }
  canvas.addEventListener('touchend', endTouch)
  canvas.addEventListener('touchcancel', endTouch)
  var keys = {}
  window.addEventListener('keydown', function (e) { keys[e.key.toLowerCase()] = true })
  window.addEventListener('keyup', function (e) { keys[e.key.toLowerCase()] = false })

  // Câmera FPS — input via cameraController (applyCameraInput + applyCameraKeyInput)
  // Setas para rodar câmara
  window.addEventListener('keydown', function (e) {
    var key = e.key.toLowerCase()
    if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].indexOf(key) >= 0) {
      e.preventDefault()
      applyCameraKeyInput(key, camState)
    }
  })
  // Rato — arrastar para rodar câmara (estilo FPS desktop)
  var mouseDragging = false
  var mouseLast = null
  canvas.addEventListener('mousedown', function (e) {
    if (e.button !== 0) return
    mouseDragging = true
    mouseLast = { x: e.clientX, y: e.clientY }
  })
  window.addEventListener('mousemove', function (e) {
    if (!mouseDragging || !mouseLast) return
    var dx = e.clientX - mouseLast.x
    var dy = e.clientY - mouseLast.y
    mouseLast = { x: e.clientX, y: e.clientY }
    applyCameraInput(dx, dy, camState)
  })
  window.addEventListener('mouseup', function () { mouseDragging = false; mouseLast = null })

  // UI rendering
  function renderUI() {
    var overlay = document.getElementById('ui-overlay')
    // CORRECAO BUG8: remover filhos em vez de innerHTML='' (evita reflow + XSS residual)
    while (overlay.firstChild) overlay.removeChild(overlay.firstChild)
    ;(data.uiScreens || []).forEach(function (screen) {
      if (screen.visible === false) return
      screen.elements.forEach(function (el) {
        if (el.visible === false) return // S17: elemento oculto via painel de camadas
        var dom = document.createElement(el.type === 'Button' ? 'button' : el.type === 'Input' ? 'input' : 'div')
        dom.className = 'ui-el'
        // CORRECAO BUG8: sanitizar valores de CSS para evitar CSS injection
        var sanitizeCss = function (val, fallback) {
          if (!val || typeof val !== 'string') return fallback || ''
          var cleaned = val.replace(/[;}{()\\]/g, '').replace(/[\r\n]/g, '')
          return cleaned.slice(0, 50)
        }
        dom.style.position = 'absolute'
        dom.style.left = (el.position && el.position[0] || 50) + '%'
        dom.style.top = (el.position && el.position[1] || 50) + '%'
        dom.style.width = (el.size && el.size[0] || 120) + 'px'
        dom.style.height = (el.size && el.size[1] || 40) + 'px'
        dom.style.transform = 'translate(-50%,-50%)'
        dom.style.display = 'flex'
        dom.style.alignItems = 'center'
        dom.style.justifyContent = 'center'
        dom.style.background = sanitizeCss(el.color, 'transparent')
        dom.style.color = sanitizeCss(el.textColor, '#e6edf3')
        dom.style.fontSize = (el.fontSize || 14) + 'px'
        dom.style.border = (el.borderWidth || 0) + 'px solid ' + sanitizeCss(el.borderColor, 'transparent')
        dom.style.borderRadius = (el.borderRadius || 0) + 'px'
        dom.style.padding = (el.padding || 0) + 'px'
        dom.style.opacity = (el.opacity || 1)
        dom.style.pointerEvents = 'auto'
        dom.style.userSelect = 'none'
        dom.style.fontFamily = 'sans-serif'
        dom.style.boxSizing = 'border-box'
        if (el.type === 'Button' || el.type === 'Text' || el.type === 'Label') dom.textContent = el.label || el.text || ''
        if (el.type === 'Input') { dom.placeholder = el.placeholder || ''; dom.value = el.value || ''; dom.oninput = function () { el.value = dom.value; gc.triggerUIEvent('onChange', { element: el, value: dom.value }) } }
        if (el.type === 'Button') dom.onclick = function () {
          // Sistema: Links — navegação automática
          if (el.linkType && el.linkType !== 'none' && gc.linkTo) { gc.linkTo(el.linkType, el.linkTarget); return }
          var evName = el.eventName || 'onClick'
          gc.triggerUIEvent(evName, { element: el })
          // S19: botões de sistema — se NENHUM script FlirCode trata o evento,
          // aplicar a ação nativa (PULAR→salto, TIRO→disparo, RELOAD→recarregar).
          // Antes estes botões (demos Arena/Saga/Showcase) não faziam nada: o
          // evento disparava para runtimes sem função onJump/onShoot/onReload.
          var handledByScript = false
          for (var rk in runtimes) {
            if (runtimes[rk].functions && runtimes[rk].functions[evName]) { handledByScript = true; break }
          }
          if (!handledByScript) {
            var pConect = (scene.conects || []).find(function (c) { return c.type === 'PersonalObject' })
            if (evName === 'onJump' && pConect && pConect.canJump && bodies[pConect.instanceId]) {
              bodies[pConect.instanceId].velocity.y = pConect.jumpForce || 8
              dbg('Salto (botão UI)', 'log')
            } else if (evName === 'onShoot' && gc.shoot) {
              gc.shoot()
            } else if (evName === 'onReload' && gc.reload) {
              gc.reload()
            }
          }
        }
        // Post-Audit 4.0 — A3/S1: construção segura via DOM API (sem innerHTML)
        if (el.type === 'Checkbox') {
          var cbInput = document.createElement('input')
          cbInput.type = 'checkbox'
          cbInput.checked = !!el.checked
          var cbLabel = document.createElement('span')
          cbLabel.textContent = el.label || ''
          dom.appendChild(cbInput)
          dom.appendChild(cbLabel)
          cbInput.onchange = function () { el.checked = this.checked; gc.triggerUIEvent('onChange', { element: el, value: this.checked }) }
        }
        if (el.type === 'Slider') {
          var slInput = document.createElement('input')
          slInput.type = 'range'
          slInput.min = String(el.min || 0)
          slInput.max = String(el.max || 100)
          slInput.value = String(el.value || 50)
          var slLabel = document.createElement('span')
          slLabel.style.fontSize = '10px'
          slLabel.textContent = String(el.value || '')
          dom.appendChild(slInput)
          dom.appendChild(slLabel)
          slInput.oninput = function () { el.value = Number(this.value); gc.triggerUIEvent('onChange', { element: el, value: Number(this.value) }) }
        }
        if (el.type === 'Image' && el.url) {
          var img = document.createElement('img')
          img.setAttribute('src', el.url)
          img.style.width = '100%'
          img.style.height = '100%'
          img.style.objectFit = 'contain'
          dom.appendChild(img)
        }
        overlay.appendChild(dom)
      })
    })
  }
  renderUI()

  // ===== S17: NPC AI leve (idle/patrol/chase/flee) — igual em espírito ao npcAI.js =====
  function updateNPCAI(delta) {
    if (!player) return
    var playerMesh = meshMap[player.instanceId]
    if (!playerMesh) return
    for (var id in npcAIs) {
      var st = npcAIs[id]
      var conect = bodies[id] && bodies[id]._conect
      var npcMesh = meshMap[id]
      if (!conect || !npcMesh || npcMesh.visible === false) continue
      var behavior = conect.behavior || conect.aiMode || 'idle'
      if (behavior === 'idle') continue
      var speed = conect.moveSpeed || 3

      var dx = playerMesh.position.x - npcMesh.position.x
      var dz = playerMesh.position.z - npcMesh.position.z
      var dist = Math.sqrt(dx * dx + dz * dz)
      var detectR = conect.detectionRadius || 8
      var loseR = conect.loseSightRadius || 12

      // Eventos de vista
      if (!st.hasSight && dist < detectR) {
        st.hasSight = true
        if (runtimes[id]) runtimes[id].triggerEvent('onSeePlayer', { player: [playerMesh.position.x, playerMesh.position.y, playerMesh.position.z] })
      } else if (st.hasSight && dist > loseR) {
        st.hasSight = false
        if (runtimes[id]) runtimes[id].triggerEvent('onLoseSight', {})
      }

      var body = bodies[id]
      if (!body) continue

      if (behavior === 'chase') {
        var chaseOverride = gc.globalVars['_chase_' + id]
        if ((!st.hasSight && !chaseOverride) || dist < 1.2) continue
        var d = dist || 1
        body.velocity.x = (dx / d) * speed
        body.velocity.z = (dz / d) * speed
      } else if (behavior === 'flee') {
        if (!st.hasSight) continue
        var fd = dist || 1
        body.velocity.x = (-dx / fd) * speed
        body.velocity.z = (-dz / fd) * speed
      } else if (behavior === 'patrol') {
        // S19 FIX (A3): port do fix S18 do editor — aceitar waypoints INLINE
        // (conect.patrolPoints = [[x,y,z],...]) além de PathObject via
        // patrolPath. Os NPCs do Showcase definem patrolPoints diretamente;
        // antes o exportado só lia o PathObject → patrulha errada (fallback ±3).
        // S19 FIX (P3-31): os pontos do PathObject são LOCAIS ao path (o PathMesh
        // do editor renderiza-os como filhos de um group posicionado) — somar a
        // posição do path para obter coordenadas de mundo.
        var path = (scene.conects || []).find(function (c) { return c.instanceId === conect.patrolPath })
        var pts = null
        if (path && path.points && path.points.length > 0) {
          var poff = path.position || [0, 0, 0]
          pts = path.points.map(function (p) { return [p[0] + poff[0], p[1] + poff[1], p[2] + poff[2]] })
        }
        if (!pts || pts.length === 0) pts = conect.patrolPoints
        if (!pts || pts.length === 0) {
          // Sem path: patrulha pequena à volta da posição inicial
          pts = [[conect.position[0] - 3, 0, conect.position[2]], [conect.position[0] + 3, 0, conect.position[2]]]
        }
        var target = pts[st.patrolIndex % pts.length]
        var pdx = target[0] - npcMesh.position.x
        var pdz = target[2] - npcMesh.position.z
        var pdist = Math.sqrt(pdx * pdx + pdz * pdz)
        if (pdist < 0.6) {
          st.patrolIndex = (st.patrolIndex + 1) % pts.length
        } else {
          body.velocity.x = (pdx / pdist) * speed * 0.7
          body.velocity.z = (pdz / pdist) * speed * 0.7
        }
      }
    }
  }

  // Game loop
  var lastTime = performance.now()
  function animate() {
    requestAnimationFrame(animate)
    var now = performance.now()
    var delta = (now - lastTime) / 1000
    lastTime = now

    // Physics
    // S19: maxSubSteps 10 (antes 3) — em dispositivos lentos (software WebGL,
    // ~4fps) a simulação avançava só 0.2s por segundo real (câmara lenta). Com 10
    // substeps a física mantém-se próxima do tempo real.
    world.step(1 / 60, delta, 10)
    for (var id in bodies) {
      var b = bodies[id]
      var m = meshMap[id]
      if (m) {
        m.position.copy(b.position)
        if (m._yOffset) m.position.y += m._yOffset
        // S17 (P0-05 equivalente): terreno nunca sincroniza rotação (geometria baked)
        if (!b._isTerrain) m.quaternion.copy(b.quaternion)
      }
    }

    // FlirCode onTick — S17 fix (P1-12): cada runtime decide o seu próprio wait
    for (var rid in runtimes) {
      if (!runtimes[rid].isWaiting()) runtimes[rid].triggerEvent('tick', { deltaTime: delta })
    }

    // S17: NPC AI
    updateNPCAI(delta)

    // S19 FIX (A2): TriggerObject — deteção AABB com previousContacts (replica
    // o physicsSystem do editor). Dispara onEnterZone/onExitZone no runtime
    // FlirCode do trigger → changeScene("...") do portal funciona no exportado.
    for (var tid in triggers) {
      var trg = triggers[tid]
      var tcontacts = {}
      for (var bid in bodies) {
        if (bid === tid) continue
        var bp = bodies[bid].position
        if (Math.abs(bp.x - trg.position[0]) < trg.size[0] / 2 &&
            Math.abs(bp.y - trg.position[1]) < trg.size[1] / 2 &&
            Math.abs(bp.z - trg.position[2]) < trg.size[2] / 2) tcontacts[bid] = true
      }
      for (var ncid in tcontacts) {
        if (!trg.previousContacts[ncid] && runtimes[tid]) {
          dbg('Trigger ' + tid + ': enter (' + ncid + ')', 'log')
          runtimes[tid].triggerEvent('onEnterZone', { other: ncid })
        }
      }
      for (var pcid in trg.previousContacts) {
        if (!tcontacts[pcid] && runtimes[tid]) runtimes[tid].triggerEvent('onExitZone', { other: pcid })
      }
      trg.previousContacts = tcontacts
    }

    // S20/A2: ItemObject — animação (rotação + flutuação) + pickup por proximidade
    // (var playerConect: ÚNICA declaração no animate() — a atribuição em baixo
    // reutiliza esta declaração hoisted; sem ela: ReferenceError no 1º frame)
    var playerConect = (scene.conects || []).find(function (c) { return c.type === 'PersonalObject' }) || null
    var playerBody = playerConect ? bodies[playerConect.instanceId] || null : null
    for (var iid in items) {
      var itm = items[iid]
      var im = meshMap[iid]
      if (itm.taken || !im || im.visible === false) continue
      // Animação: rotação contínua + bobbing sinusoidal
      itm.t += delta
      im.rotation.y += delta * 1.6
      im.position.y = itm.baseY + Math.sin(itm.t * 2.2) * 0.14
      // Pickup (auto): distância ao player < pickupRadius
      if (itm.autoPickup && playerBody) {
        var idx = playerBody.position.x - itm.position[0]
        var idy = playerBody.position.y - itm.position[1]
        var idz = playerBody.position.z - itm.position[2]
        if (idx * idx + idy * idy + idz * idz < itm.radius * itm.radius) {
          itm.taken = true
          im.visible = false
          if (gc.addToInventory) gc.addToInventory(itm.itemName, itm.quantity)
          if (runtimes[iid]) runtimes[iid].triggerEvent('onPickup', { item: itm.itemName, quantity: itm.quantity })
          dbg('Item apanhado: ' + itm.itemName + ' x' + itm.quantity, 'log')
        }
      }
    }

    // S20/A2: CheckpointObject — ativação por proximidade + respawn ao cair
    for (var ckid in checkpoints) {
      var ck = checkpoints[ckid]
      ck.t += delta
      // Onda do pano da bandeira
      if (ck.flag) ck.flag.rotation.y = Math.sin(ck.t * 3.1) * 0.16
      if (!ck.active && playerBody) {
        var cdx = playerBody.position.x - ck.position[0]
        var cdy = playerBody.position.y - ck.position[1]
        var cdz = playerBody.position.z - ck.position[2]
        if (cdx * cdx + cdy * cdy + cdz * cdz < ck.radius * ck.radius) {
          ck.active = true
          // Feedback visual: pano verde + emissivo
          if (ck.flagMat) { ck.flagMat.color.set('#22c55e'); ck.flagMat.emissive = new THREE.Color('#0f5132'); ck.flagMat.emissiveIntensity = 0.6 }
          respawnPoint = [ck.position[0], ck.position[1] + 0.6, ck.position[2]]
          if (runtimes[ckid]) runtimes[ckid].triggerEvent('onCheckpoint', { id: ck.checkpointId })
          dbg('Checkpoint ' + ck.checkpointId + ' ativado!', 'log')
        }
      }
    }
    // S20/A2: respawn — se o player cair do mundo (y < -20), volta ao último checkpoint
    if (playerBody && respawnPoint && playerBody.position.y < -20) {
      playerBody.position.set(respawnPoint[0], respawnPoint[1], respawnPoint[2])
      playerBody.velocity.set(0, 0, 0)
      dbg('Respawn no checkpoint', 'log')
    }

    // S20/A2+F: hook de debug/testes — estado do jogo exportado (player/NPCs/items/checkpoints)
    try {
      var dbgSt = { t: performance.now(), player: null, npcs: [], items: [], checkpoints: [], inventory: gc._inventory || {} }
      for (var cid2 in meshMap) {
        var cm = meshMap[cid2]
        var cc = cm._conect
        if (!cc) continue
        var cp2 = { id: cid2, x: +cm.position.x.toFixed(3), y: +cm.position.y.toFixed(3), z: +cm.position.z.toFixed(3), qx: +cm.quaternion.x.toFixed(3), qz: +cm.quaternion.z.toFixed(3), visible: cm.visible !== false }
        if (cc.type === 'PersonalObject') dbgSt.player = cp2
        else if (cc.type === 'NpcObject') { cp2.type = cc.aiMode || cc.behavior || 'patrol'; dbgSt.npcs.push(cp2) }
        else if (cc.type === 'ItemObject') dbgSt.items.push(cp2)
        else if (cc.type === 'CheckpointObject') { cp2.active = !!(checkpoints[cid2] && checkpoints[cid2].active); dbgSt.checkpoints.push(cp2) }
      }
      window.__flirPlayState = dbgSt
    } catch (e) { }

    // PersonalObject movement — camera-relative (estilo Godot, igual ao editor)
    // (S20/A2: playerConect/playerBody já resolvidos acima — sem re-declaração)
    playerConect = (scene.conects || []).find(function (c) { return c.type === 'PersonalObject' }) || null
    if (playerConect && bodies[playerConect.instanceId]) {
      var speed = playerConect.moveSpeed || 5
      var mx = 0, mz = 0
      if (joystick.active) { mx = joystick.x * speed; mz = joystick.z * speed }
      if (keys['w'] || keys['arrowup']) mz = -speed
      if (keys['s'] || keys['arrowdown']) mz = speed
      if (keys['a']) mx = -speed
      if (keys['d']) mx = speed
      // Rodar (mx, mz) pelo yaw da câmara — movimento camera-relative
      var yaw = camState.yaw
      var cosY = Math.cos(yaw)
      var sinY = Math.sin(yaw)
      var vx = mx * cosY + mz * sinY
      var vz = -mx * sinY + mz * cosY
      bodies[playerConect.instanceId].velocity.x = vx
      bodies[playerConect.instanceId].velocity.z = vz
      if ((keys[' '] || keys['space']) && playerConect.canJump) bodies[playerConect.instanceId].velocity.y = playerConect.jumpForce || 8
    }

    // S17: animação procedural dos humanoides (player + NPCs) por velocidade real
    for (var aid in animStates) {
      var am = meshMap[aid]
      if (!am || am.visible === false) continue
      var stt = animStates[aid]
      if (stt.lastPos) {
        var adx = am.position.x - stt.lastPos.x
        var adz = am.position.z - stt.lastPos.z
        var aspeed = Math.sqrt(adx * adx + adz * adz) / Math.max(0.001, delta)
        animateHumanoid(am, aspeed, delta, stt)
      }
      stt.lastPos = { x: am.position.x, z: am.position.z }
    }

    // Camera follow — usando cameraController unificado (CAMERA_CONTROLLER_SOURCE embebido)
    var av = activeView
    var pm = (activeView && activeView.cameraRole === 'player' && playerConect && meshMap[playerConect.instanceId]) ? meshMap[playerConect.instanceId] : null
    var targetMeshForCam = pm
    // Verificar followTarget explícito
    if (av && av.followTarget && meshMap[av.followTarget]) {
      targetMeshForCam = meshMap[av.followTarget]
    }
    updateCamera(camera, av, targetMeshForCam, camState, {
      gameCamera: scene.gameCamera,
      hasTouchZone: hasTZ,
      delta: Math.min(delta || 1 / 60, 0.1),
    })

    renderer.render(scene3d, camera)
  }

  // Splash
  setTimeout(function () {
    var splash = document.getElementById('splash')
    splash.style.opacity = '0'
    setTimeout(function () { splash.style.display = 'none' }, 400)
  }, 2000)

  animate()

  // Resize
  window.addEventListener('resize', function () {
    camera.aspect = window.innerWidth / window.innerHeight
    camera.updateProjectionMatrix()
    renderer.setSize(window.innerWidth, window.innerHeight)
  })
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startGame)
} else {
  startGame()
}

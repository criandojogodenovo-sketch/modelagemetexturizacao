/**
 * gameRuntime.js — runtime do jogo exportado.
 *
 * Este ficheiro é embutido no HTML exportado e contém:
 *  - FlirCode parser + runtime (cópia do flircode.js, adaptada)
 *  - Motor de física (cannon-es via CDN)
 *  - Renderização Three.js (via CDN)
 *  - GameUIOverlay
 *  - GameMode (equivalente ao GameMode do SceneLevel3D)
 *
 * O runtime é funcionalmente idêntico ao "Executar Jogo" do editor.
 */

// ===== Imports (para módulo ES no HTML exportado) =====
import * as THREE from 'three'
import * as CANNON from 'cannon-es'

// ===== FlirCode Parser (inline, sem dependências) =====
function parseFlirCode(src) {
  var errors = [], fns = {}, lines = src.split('\n'), cl = []
  for (var i = 0; i < lines.length; i++) {
    var t = lines[i].trim()
    if (t && !t.startsWith('$$')) cl.push({ t: t, l: i + 1 })
  }
  var idx = 0
  while (idx < cl.length) {
    var m = cl[idx].t.match(/^fun\s+(\w+)\s*\(([^)]*)\)\s*begincode$/)
    if (m) {
      var body = parseBlock(cl, idx + 1, errors)
      fns[m[1]] = { name: m[1], params: m[2].split(',').filter(function (p) { return p.trim() }), body: body.statements, line: cl[idx].l }
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

function evalVal(v, vars, gc) {
  v = v.trim()
  if (v.startsWith('"') && v.endsWith('"')) return v.slice(1, -1)
  var n = parseFloat(v); if (!isNaN(n)) return n
  if (v === 'true') return true; if (v === 'false') return false
  return vars[v] !== undefined ? vars[v] : (gc.globalVars && gc.globalVars[v]) || 0
}

function createFlirCodeRuntime(src, gc) {
  var parsed = parseFlirCode(src)
  for (var i = 0; i < parsed.errors.length; i++) dbg('FlirCode erro: ' + parsed.errors[i].message, 'error')
  var vars = {}
  var eventMap = {
    onStart: 'beginPlay', onTick: 'tick', onCollide: 'onCollision',
    onTouch: 'onTouch', onSeePlayer: 'onSeePlayer', onLoseSight: 'onLoseSight',
    onTimer: 'onTimer', onClick: 'onClick', onChange: 'onChange', onSubmit: 'onSubmit',
    onEnterZone: 'onEnterZone', onExitZone: 'onExitZone'
  }

  function execStmts(stmts, params) {
    for (var i = 0; i < stmts.length; i++) {
      // wait() deferral — se um wait está ativo, adiar as statements restantes via setTimeout
      if (gc._waitUntil && Date.now() < gc._waitUntil) {
        var remaining = stmts.slice(i)
        var delay = gc._waitUntil - Date.now()
        var resume = function () { gc._waitUntil = 0; execStmts(remaining, params) }
        setTimeout(resume, delay)
        return // parar execução síncrona aqui
      }
      try { execS(stmts[i], params) } catch (e) { dbg('Erro: ' + e.message, 'error') }
    }
  }

  function execS(s, params) {
    if (s.type === 'var') { vars[s.name] = evalVal(s.value, vars, gc); return }
    if (s.type === 'assign') { vars[s.name] = evalVal(s.value, vars, gc); return }
    // if / elseif / else — usa flag _ifChainMatched (igual ao editor flircode.js:544-565)
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
      var argVals = s.args.map(function (a) { return evalVal(a, vars, gc) })
      execBuiltin(s.name, argVals, params)
      return
    }
    // unknown — ignorar silenciosamente
  }

  function execBuiltin(name, args, params) {
    switch (name) {
      case 'print': dbg(args[0], 'log'); break
      case 'log': dbg(args[0], 'log'); break
      case 'warn': dbg(args[0], 'warn'); break
      case 'error': dbg(args[0], 'error'); break
      case 'move':
        if (gc.mesh) { gc.mesh.position.x += args[0] * 0.016; gc.mesh.position.y += args[1] * 0.016; gc.mesh.position.z += args[2] * 0.016 }
        break
      case 'rotate':
        if (gc.mesh) { gc.mesh.rotation.x += args[0] * 0.016; gc.mesh.rotation.y += args[1] * 0.016; gc.mesh.rotation.z += args[2] * 0.016 }
        break
      case 'scale':
        if (gc.mesh) { gc.mesh.scale.set(args[0] || 1, args[1] || 1, args[2] || 1) }
        break
      case 'destroy': if (gc.mesh) gc.mesh.visible = false; break
      case 'createObject': gc.spawnObject && gc.spawnObject(args[0], [args[1], args[2], args[3]]); break
      case 'changeScene': dbg('changeScene: ' + args[0], 'log'); break
      case 'wait':
        // wait(seconds) — implementa _waitUntil (igual ao editor flircode.js:673-681)
        // O execStmts verifica _waitUntil antes de cada statement e faz setTimeout para deferir
        gc._waitUntil = Date.now() + (args[0] || 0) * 1000
        dbg('wait(' + args[0] + 's)', 'log')
        break
      case 'setVar': gc.globalVars = gc.globalVars || {}; gc.globalVars[args[0]] = args[1]; break
      case 'getVar': return (gc.globalVars || {})[args[0]]
      case 'setUIValue': gc.setUIValue && gc.setUIValue(args[0], args[1]); break
      case 'getUIValue': return gc.getUIValue ? gc.getUIValue(args[0]) : ''
      case 'showUIScreen': gc.showUIScreen && gc.showUIScreen(args[0]); break
      case 'hideUIScreen': gc.hideUIScreen && gc.hideUIScreen(args[0]); break
      case 'playSound': gc.playSound && gc.playSound(args[0]); break
      case 'playAnim': dbg('playAnim: ' + args[0], 'log'); break
      case 'collidingWith': return gc.collidingWith ? gc.collidingWith(gc._instanceId, args[0]) : false
      case 'distanceTo': return gc.distanceTo ? gc.distanceTo(gc._instanceId, args[0]) : 0
      case 'isTouching': return gc.isTouching ? gc.isTouching() : false
      // Sistema 2: Armas
      case 'shoot': gc.shoot && gc.shoot(); break
      case 'reload': gc.reload && gc.reload(); break
      case 'equipWeapon': gc.equipWeapon && gc.equipWeapon(args[0]); break
      case 'getAmmo': return gc.getAmmo ? gc.getAmmo() : 0
      case 'takeDamage': gc.takeDamage && gc.takeDamage(gc._instanceId, args[0]); break
      case 'getHealth': return gc.getHealth ? gc.getHealth(gc._instanceId) : 100
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
      // changeScene real
      case 'changeScene':
        if (gc.changeScene) { gc.changeScene(args[0]); break }
        dbg('changeScene: ' + args[0], 'log'); break
      default: dbg('Função desconhecida: ' + name, 'warn')
    }
  }

  return {
    functions: parsed.functions, hasErrors: parsed.errors.length > 0,
    triggerEvent: function (en, payload) {
      var fnName = null
      for (var k in eventMap) { if (eventMap[k] === en) { fnName = k; break } }
      if (!fnName) return
      var fn = parsed.functions[fnName]; if (!fn) return
      gc._instanceId = gc._instanceId
      execStmts(fn.body, payload || {})
    },
    update: function () {}, dispose: function () {}
  }
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
  console.log(msg)
}

// ===== Game Runtime =====
function startGame() {
  var data = window.__GAME_DATA__
  var scene = data.scenes && data.scenes[0]
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
  camState.enabled = hasTZ
  camState.hasTouchZone = hasTZ
  var cam = activeView || scene.gameCamera || { cameraType: 'perspective', position: [5, 4, 6], fov: 60, near: 0.1, far: 2000 }
  var camera = (cam.cameraType || cam.type) === 'orthographic'
    ? new THREE.OrthographicCamera(-5, 5, 5, -5, cam.near || 0.1, cam.far || 2000)
    : new THREE.PerspectiveCamera(cam.fov || 60, window.innerWidth / window.innerHeight, cam.near || 0.1, cam.far || 2000)
  camera.position.set.apply(camera, cam.position || [5, 4, 6])
  if (activeView && activeView.rotation) {
    camera.rotation.set(activeView.rotation[0], activeView.rotation[1], activeView.rotation[2], 'YXZ')
  } else {
    camera.lookAt(0, 0, 0)
  }

  // Física
  var world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) })
  world.broadphase = new CANNON.SAPBroadphase(world)
  world.allowSleep = true
  var bodies = {}
  var meshMap = {}

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
      // Procurar objeto do catálogo por nome e cloná-lo
      var obj = (data.objects || []).find(function (o) { return o.name === name })
      if (!obj) { dbg('spawnObject: objeto "' + name + '" não encontrado no catálogo', 'warning', 'Spawn'); return null }
      var geo = obj.bufferGeometry || new THREE.BoxGeometry(1, 1, 1)
      var mat = new THREE.MeshStandardMaterial({ color: obj.material?.color || '#cccccc', roughness: 0.7 })
      var mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(pos[0] || 0, pos[1] || 0, pos[2] || 0)
      mesh.castShadow = true; mesh.receiveShadow = true
      mesh._name = name + '_' + Date.now()
      mesh._isSpawned = true
      scene3d.add(mesh)
      // Adicionar ao meshMap para ser encontrável por name/distanceTo
      var newId = 'spawned_' + Date.now() + '_' + Math.floor(Math.random() * 1000)
      meshMap[newId] = mesh
      dbg('spawnObject: ' + name + ' spawnado em [' + pos.join(',') + '] (id=' + newId + ')', 'log', 'Spawn')
      return newId
    },
    collidingWith: function (id, type) { for (var k in bodies) { if (k === id) continue; if (bodies[k]._conect.type === type || bodies[k]._conect.name === type) { if (bodies[id].position.distanceTo(bodies[k].position) < 1.5) return true } } return false },
    distanceTo: function (id, name) { for (var k in meshMap) { if (meshMap[k]._name === name) { return meshMap[id].position.distanceTo(meshMap[k].position) } } return 0 },
    isTouching: function () { return joystick.active },
    // Sistema 2: Armas e combate (exportado) — implementação real com raycast
    shoot: function () {
      if ((gc._weaponAmmo || 0) <= 0) { dbg('shoot: sem munição! Pressiona reload()', 'warning', 'Weapon'); return false }
      gc._weaponAmmo = (gc._weaponAmmo || 0) - 1
      // Raycast a partir da câmara
      var raycaster = new THREE.Raycaster()
      var origin = camera.position.clone()
      var dir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize()
      raycaster.set(origin, dir)
      raycaster.far = gc._weaponRange || 100
      // Colectar todos os meshes com _conect (inimigos/NPCs)
      var targets = []
      for (var k in meshMap) {
        if (meshMap[k]._conect && meshMap[k].visible !== false) targets.push(meshMap[k])
      }
      var hits = raycaster.intersectObjects(targets, true)
      if (hits.length > 0) {
        var hit = hits[0]
        var hitMesh = hit.object
        // Subir na hierarquia até encontrar um mesh com _conect
        while (hitMesh && !hitMesh._conect && hitMesh.parent) hitMesh = hitMesh.parent
        if (hitMesh && hitMesh._conect) {
          var id = hitMesh._conect.instanceId
          dbg('shoot: atingiu ' + (hitMesh._conect.name || id) + ' a ' + hit.distance.toFixed(1) + 'm', 'log', 'Weapon')
          // Aplicar dano
          if (gc.takeDamage) gc.takeDamage(id, gc._weaponDamage || 25)
          // Disparar evento onHit no target
          if (runtimes[id]) runtimes[id].triggerEvent('onHit', { damage: gc._weaponDamage || 25, point: [hit.point.x, hit.point.y, hit.point.z] })
          return id
        }
      }
      dbg('shoot: disparou mas não atingiu nada', 'log', 'Weapon')
      return false
    },
    reload: function () {
      var max = gc._weaponMaxAmmo || 30
      gc._weaponAmmo = max
      dbg('reload: munição restaurada para ' + max, 'log', 'Weapon')
    },
    equipWeapon: function (name) {
      // Procurar WeaponObject na cena com este nome
      var w = (scene.conects || []).find(function (c) { return c.type === 'WeaponObject' && c.name === name })
      if (!w) { dbg('equipWeapon: arma "' + name + '" não encontrada', 'warning', 'Weapon'); return false }
      gc._weaponDamage = w.damage || 25
      gc._weaponRange = w.range || 100
      gc._weaponMaxAmmo = w.maxAmmo || 30
      gc._weaponAmmo = gc._weaponMaxAmmo
      dbg('equipWeapon: ' + name + ' equipada (dano=' + gc._weaponDamage + ', alcance=' + gc._weaponRange + ', munição=' + gc._weaponMaxAmmo + ')', 'log', 'Weapon')
      return true
    },
    getAmmo: function () { return gc._weaponAmmo || 0 },
    takeDamage: function (id, amount) {
      for (var i = 0; i < scene.conects.length; i++) {
        if (scene.conects[i].instanceId === id) {
          var c = scene.conects[i]
          c.health = Math.max(0, (c.health || 100) - amount)
          dbg(c.name + ' recebeu ' + amount + ' dano (vida: ' + c.health + ')', 'log', 'Combat')
          var rt = runtimes[id]; if (rt) rt.triggerEvent('onDamage', { amount: amount, source: 'weapon' })
          if (c.health <= 0 && meshMap[id]) meshMap[id].visible = false
          break
        }
      }
    },
    getHealth: function (id) {
      for (var i = 0; i < scene.conects.length; i++) { if (scene.conects[i].instanceId === id) return scene.conects[i].health || 100 }
      return 100
    },
    // Sistema 3: Inventário (exportado)
    addToInventory: function (name, qty) {
      gc._inventory = gc._inventory || {}
      gc._inventory[name] = (gc._inventory[name] || 0) + (qty || 1)
      dbg('Item "' + name + '" adicionado (' + qty + '). Total: ' + gc._inventory[name], 'log', 'Inventory')
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
      dbg('Signal emitido: ' + name, 'log', 'Signals')
    },
    // Sistema: Links (exportado)
    linkTo: function (target, sub) {
      if (target === 'scene') {
        var sc = (data.scenes || []).find(function (s) { return s.name === sub || s.id === sub })
        if (sc) { data.activeSceneId = sc.id; dbg('Link: cena "' + sc.name + '"', 'log', 'Links') }
      } else if (target === 'screen') {
        var ss = (data.uiScreens || []).find(function (s) { return s.name === sub || s.id === sub })
        if (ss) { (data.uiScreens || []).forEach(function (s) { s.visible = (s.id === ss.id) }); renderUI(); dbg('Link: tela "' + ss.name + '"', 'log', 'Links') }
      } else if (target === 'url') { window.open(sub, '_blank') }
    },
    // changeScene real (exportado)
    changeScene: function (name) {
      var sc = (data.scenes || []).find(function (s) { return s.name === name || s.id === name })
      if (sc) { data.activeSceneId = sc.id; dbg('Cena mudou para "' + sc.name + '"', 'log', 'Game') }
    },
    // Sistema: Game State (exportado)
    _gameState: 'menu',
    setGameState: function (s) { gc._gameState = s; dbg('Game State: ' + s, 'log', 'GameState'); for (var k in runtimes) { runtimes[k].triggerEvent('onGameStateChange', { state: s }) } },
    getGameState: function () { return gc._gameState },
    // Sistema: Save/Load Progress (exportado — localStorage do jogador)
    saveProgress: function (key, val) { try { localStorage.setItem('flir_progress_' + key, JSON.stringify(val)); dbg('Progresso guardado: ' + key, 'log', 'Save') } catch (e) {} },
    loadProgress: function (key) { try { var v = localStorage.getItem('flir_progress_' + key); return v ? JSON.parse(v) : null } catch (e) { return null } },
    // Sistema: Sequenciador (exportado — básico)
    playSequence: function (name) { dbg('Sequência "' + name + '" iniciada', 'log', 'Sequence') },
  }
  window._flirGameContext = gc

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
    mesh.position.set.apply(mesh, pos || [0, 0.5, 0])
    if (rot) mesh.rotation.set.apply(mesh, rot)
    if (scl) mesh.scale.set.apply(mesh, scl)
    mesh.castShadow = true; mesh.receiveShadow = true
    scene3d.add(mesh)
    return mesh
  }

  // Objects
  (scene.objects || []).forEach(function (inst) {
    var obj = (scene.objects || []).find(function (o) { return o.id === inst.objectId })
    if (!obj) return
    var mesh = setupMesh(obj, inst.position, inst.rotation, inst.scale)
    meshMap[inst.instanceId] = mesh
    mesh._name = obj.name
    // FlirCode
    if (obj.flirScript && typeof obj.flirScript === 'string' && obj.flirScript.startsWith('FLIRCODE:')) {
      var rt = createFlirCodeRuntime(obj.flirScript.slice(9), Object.assign(gc, { _instanceId: inst.instanceId, mesh: mesh }))
      if (!rt.hasErrors) { runtimes[inst.instanceId] = rt; rt.triggerEvent('beginPlay') }
    }
  })

  // Conects
  ;(scene.conects || []).forEach(function (conect) {
    var mesh = null
    if (['RigidObject', 'StaticObject', 'StopObject', 'PersonalObject', 'NpcObject'].indexOf(conect.type) >= 0) {
      var color = conect.type === 'PersonalObject' ? 0x3fb950 : conect.type === 'StaticObject' ? 0x6e7681 : conect.type === 'NpcObject' ? 0xe63946 : 0x888888
      var geo = conect.type === 'PersonalObject' ? new THREE.CapsuleGeometry(0.4, 1, 8, 16) : new THREE.BoxGeometry(1, 1, 1)
      mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: color, roughness: 0.6 }))
      mesh.position.set.apply(mesh, conect.position || [0, 0.5, 0])
      mesh.castShadow = true; mesh.receiveShadow = true
      scene3d.add(mesh)
      meshMap[conect.instanceId] = mesh
      mesh._name = conect.name
      mesh._conect = conect
      // Physics
      var shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.5, 0.5))
      var body = new CANNON.Body({ mass: conect.type === 'StaticObject' ? 0 : (conect.mass || 1), shape: shape, position: new CANNON.Vec3(conect.position[0], conect.position[1], conect.position[2]) })
      if (conect.type === 'StaticObject') { body.type = CANNON.Body.STATIC; body.mass = 0 }
      if (conect.type === 'StopObject') { body.type = CANNON.Body.KINEMATIC; body.mass = 0 }
      body.fixedRotation = conect.fixedRotation || false
      body._conect = conect
      world.addBody(body)
      bodies[conect.instanceId] = body
      body.addEventListener('collide', function (e) {
        var otherId = null
        for (var k in bodies) { if (bodies[k] === e.body) { otherId = k; break } }
        if (otherId && runtimes[conect.instanceId]) runtimes[conect.instanceId].triggerEvent('onCollision', { other: otherId })
      })
    } else if (conect.type === 'LuminousObject') {
      var light
      if (conect.lightType === 'directional') light = new THREE.DirectionalLight(conect.color || 0xffffff, conect.intensity || 1)
      else if (conect.lightType === 'spot') light = new THREE.SpotLight(conect.color || 0xffffff, conect.intensity || 1)
      else light = new THREE.PointLight(conect.color || 0xffffff, conect.intensity || 1, conect.distance || 10)
      light.position.set.apply(light, conect.position || [0, 5, 0])
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
    }

    // FlirCode para conects
    if (conect.flirScript && typeof conect.flirScript === 'string' && conect.flirScript.startsWith('FLIRCODE:')) {
      var rt2 = createFlirCodeRuntime(conect.flirScript.slice(9), Object.assign(gc, { _instanceId: conect.instanceId, mesh: mesh }))
      if (!rt2.hasErrors) { runtimes[conect.instanceId] = rt2; rt2.triggerEvent('beginPlay') }
    }
  })

  // Joystick / teclado
  var joystick = { x: 0, z: 0, active: false }
  var touchStart = null
  canvas.addEventListener('touchstart', function (e) { if (e.touches.length === 1) { touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY }; joystick.active = true } })
  canvas.addEventListener('touchmove', function (e) { if (touchStart && e.touches.length === 1) { joystick.x = Math.max(-1, Math.min(1, (e.touches[0].clientX - touchStart.x) / 50)); joystick.z = Math.max(-1, Math.min(1, (e.touches[0].clientY - touchStart.y) / 50)) } })
  canvas.addEventListener('touchend', function () { joystick.active = false; joystick.x = 0; joystick.z = 0; touchStart = null })
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
        var dom = document.createElement(el.type === 'Button' ? 'button' : el.type === 'Input' ? 'input' : 'div')
        dom.className = 'ui-el'
        // CORRECAO BUG8: sanitizar valores de CSS para evitar CSS injection
        // (el.color, el.textColor, el.borderColor podem conter "); url(javascript:..." etc)
        var sanitizeCss = function (val, fallback) {
          if (!val || typeof val !== 'string') return fallback || ''
          // Remover ; } { ( ) e quebras de linha — previne fechar a string cssText e injetar regras
          var cleaned = val.replace(/[;}{()\\]/g, '').replace(/[\r\n]/g, '')
          // Limitar comprimento para evitar DoS
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
          gc.triggerUIEvent(el.eventName || 'onClick', { element: el })
        }
        // Post-Audit 4.0 — A3/S1: Substituído innerHTML por createElement + appendChild
        // para evitar XSS via el.label / el.url / el.min / el.max / el.value não sanitizados.
        // Antes: dom.innerHTML = '<input type="checkbox" ...> <span>' + el.label + '</span>'
        // Agora: construção segura via DOM API.
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
          // Post-Audit 4.0 — A3/S1: setAttribute('src') em vez de innerHTML.
          // setAttribute não interpreta HTML — el.url é tratado como string literal.
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

  // Game loop
  var lastTime = performance.now()
  function animate() {
    requestAnimationFrame(animate)
    var now = performance.now()
    var delta = (now - lastTime) / 1000
    lastTime = now

    // Physics
    world.step(1 / 60, delta, 3)
    for (var id in bodies) { var b = bodies[id]; var m = meshMap[id]; if (m) { m.position.copy(b.position); m.quaternion.copy(b.quaternion) } }

    // FlirCode onTick — saltar se um wait() está ativo (para evitar re-entrada no mesmo wait)
    if (!gc._waitUntil || Date.now() >= gc._waitUntil) {
      for (var rid in runtimes) { runtimes[rid].triggerEvent('tick', { deltaTime: delta }) }
    }

    // PersonalObject movement — camera-relative (estilo Godot, igual ao editor)
    var player = (scene.conects || []).find(function (c) { return c.type === 'PersonalObject' })
    if (player && bodies[player.instanceId]) {
      var speed = player.moveSpeed || 5
      var mx = 0, mz = 0
      if (joystick.active) { mx = joystick.x * speed; mz = joystick.z * speed }
      if (keys['w'] || keys['arrowup']) mz = -speed
      if (keys['s'] || keys['arrowdown']) mz = speed
      if (keys['a'] || keys['arrowleft']) mx = -speed
      if (keys['d'] || keys['arrowright']) mx = speed
      // Rodar (mx, mz) pelo yaw da câmara — movimento camera-relative
      var yaw = camState.yaw
      var cosY = Math.cos(yaw)
      var sinY = Math.sin(yaw)
      var vx =  mx * cosY + mz * sinY
      var vz = -mx * sinY + mz * cosY
      bodies[player.instanceId].velocity.x = vx
      bodies[player.instanceId].velocity.z = vz
      if ((keys[' '] || keys['space']) && player.canJump) bodies[player.instanceId].velocity.y = player.jumpForce || 8
    }

    // Camera follow — usando cameraController unificado (CAMERA_CONTROLLER_SOURCE embebido)
    var av = activeView
    var pm = (activeView && activeView.cameraRole === 'player' && player && meshMap[player.instanceId]) ? meshMap[player.instanceId] : null
    var targetMeshForCam = pm
    // Verificar followTarget explícito
    if (av && av.followTarget && meshMap[av.followTarget]) {
      targetMeshForCam = meshMap[av.followTarget]
    }
    updateCamera(camera, av, targetMeshForCam, camState, {
      gameCamera: scene.gameCamera,
      hasTouchZone: hasTZ,
      delta: 1/60,
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

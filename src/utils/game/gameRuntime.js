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
      fns[m[1]] = { name: m[1], params: m[2].split(',').filter(function (p) { return p.trim() }), body: body.s, line: cl[idx].l }
      idx = body.ni
    } else { idx++ }
  }
  return { functions: fns, errors: errors }
}

function parseBlock(lines, si, errors) {
  var s = [], idx = si, depth = 1
  while (idx < lines.length && depth > 0) {
    if (lines[idx].t === 'endcode') { depth--; if (depth === 0) return { s: s, ni: idx + 1 } }
    else { s.push({ t: lines[idx].t, l: lines[idx].l }) }
    idx++
  }
  return { s: s, ni: idx }
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
      try { execS(stmts[i], params) } catch (e) { dbg('Erro: ' + e.message, 'error') }
    }
  }

  function execS(s, params) {
    var m
    if (m = s.t.match(/^var\s+(\w+)\s*=\s*(.+)$/)) { vars[m[1]] = evalVal(m[2], vars, gc); return }
    if (m = s.t.match(/^(\w+)\s*=\s*(.+)$/)) { vars[m[1]] = evalVal(m[2], vars, gc); return }
    if (m = s.t.match(/^if\s*\((.+)\)$/)) { if (evalCond(m[1], vars, gc)) { /* procurar begincode seguinte */ } return }
    if (m = s.t.match(/^(\w+)\s*\(([^)]*)\)$/)) {
      execBuiltin(m[1], m[2].split(',').map(function (a) { return evalVal(a.trim(), vars, gc) }), params)
      return
    }
  }

  function execBuiltin(name, args, params) {
    switch (name) {
      case 'print': dbg(args[0], 'log'); break
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
      case 'wait': dbg('wait(' + args[0] + 's)', 'log'); break
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
  if (!scene) { document.getElementById('splash').innerHTML = '<div style="color:#f85149">Sem cenas</div>'; return }

  var canvas = document.getElementById('game-canvas')
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.shadowMap.enabled = true

  var scene3d = new THREE.Scene()
  var bg = data.scene.background
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

  // Câmara
  var viewConects = (scene.conects || []).filter(function (c) { return c.type === 'ViewObject' })
  var activeView = viewConects.find(function (c) { return c.cameraRole === 'player' })
    || viewConects.find(function (c) { return c.cameraRole === 'primary' })
    || viewConects[0]
  var cam = activeView || scene.gameCamera || { cameraType: 'perspective', position: [5, 4, 6], fov: 60, near: 0.1, far: 200 }
  var camera = (cam.cameraType || cam.type) === 'orthographic'
    ? new THREE.OrthographicCamera(-5, 5, 5, -5, cam.near || 0.1, cam.far || 200)
    : new THREE.PerspectiveCamera(cam.fov || 60, window.innerWidth / window.innerHeight, cam.near || 0.1, cam.far || 200)
  camera.position.set.apply(camera, cam.position || [5, 4, 6])
  if (activeView && activeView.rotation) camera.rotation.set.apply(camera, activeView.rotation)
  else camera.lookAt(0, 0, 0)

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
    spawnObject: function (name, pos) { dbg('spawnObject: ' + name + ' em ' + pos, 'log') },
    collidingWith: function (id, type) { for (var k in bodies) { if (k === id) continue; if (bodies[k]._conect.type === type || bodies[k]._conect.name === type) { if (bodies[id].position.distanceTo(bodies[k].position) < 1.5) return true } } return false },
    distanceTo: function (id, name) { for (var k in meshMap) { if (meshMap[k]._name === name) { return meshMap[id].position.distanceTo(meshMap[k].position) } } return 0 },
    isTouching: function () { return joystick.active },
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
    var obj = (data.scene.objects || []).find(function (o) { return o.id === inst.objectId })
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

  // UI rendering
  function renderUI() {
    var overlay = document.getElementById('ui-overlay')
    overlay.innerHTML = ''
    ;(data.uiScreens || []).forEach(function (screen) {
      if (screen.visible === false) return
      screen.elements.forEach(function (el) {
        var dom = document.createElement(el.type === 'Button' ? 'button' : el.type === 'Input' ? 'input' : 'div')
        dom.className = 'ui-el'
        dom.style.cssText = 'position:absolute;left:' + (el.position && el.position[0] || 50) + '%;top:' + (el.position && el.position[1] || 50) + '%;width:' + (el.size && el.size[0] || 120) + 'px;height:' + (el.size && el.size[1] || 40) + 'px;transform:translate(-50%,-50%);display:flex;align-items:center;justify-content:center;background:' + (el.color || 'transparent') + ';color:' + (el.textColor || '#e6edf3') + ';font-size:' + (el.fontSize || 14) + 'px;border:' + (el.borderWidth || 0) + 'px solid ' + (el.borderColor || 'transparent') + ';border-radius:' + (el.borderRadius || 0) + 'px;padding:' + (el.padding || 0) + 'px;opacity:' + (el.opacity || 1) + ';pointer-events:auto;user-select:none;font-family:sans-serif;box-sizing:border-box;'
        if (el.type === 'Button' || el.type === 'Text' || el.type === 'Label') dom.textContent = el.label || el.text || ''
        if (el.type === 'Input') { dom.placeholder = el.placeholder || ''; dom.value = el.value || ''; dom.oninput = function () { el.value = dom.value; gc.triggerUIEvent('onChange', { element: el, value: dom.value }) } }
        if (el.type === 'Button') dom.onclick = function () { gc.triggerUIEvent(el.eventName || 'onClick', { element: el }) }
        if (el.type === 'Checkbox') { dom.innerHTML = '<input type="checkbox" ' + (el.checked ? 'checked' : '') + '> <span>' + (el.label || '') + '</span>'; dom.querySelector('input').onchange = function () { el.checked = this.checked; gc.triggerUIEvent('onChange', { element: el, value: this.checked }) } }
        if (el.type === 'Slider') { dom.innerHTML = '<input type="range" min="' + (el.min || 0) + '" max="' + (el.max || 100) + '" value="' + (el.value || 50) + '"><span style="font-size:10px">' + (el.value || '') + '</span>'; dom.querySelector('input').oninput = function () { el.value = Number(this.value); gc.triggerUIEvent('onChange', { element: el, value: Number(this.value) }) } }
        if (el.type === 'Image' && el.url) dom.innerHTML = '<img src="' + el.url + '" style="width:100%;height:100%;object-fit:contain">'
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

    // FlirCode onTick
    for (var rid in runtimes) { runtimes[rid].triggerEvent('tick', { deltaTime: delta }) }

    // PersonalObject movement
    var player = (scene.conects || []).find(function (c) { return c.type === 'PersonalObject' })
    if (player && bodies[player.instanceId]) {
      var speed = player.moveSpeed || 5
      var mx = 0, mz = 0
      if (joystick.active) { mx = joystick.x * speed; mz = joystick.z * speed }
      if (keys['w'] || keys['arrowup']) mz = -speed
      if (keys['s'] || keys['arrowdown']) mz = speed
      if (keys['a'] || keys['arrowleft']) mx = -speed
      if (keys['d'] || keys['arrowright']) mx = speed
      bodies[player.instanceId].velocity.x = mx
      bodies[player.instanceId].velocity.z = mz
      if ((keys[' '] || keys['space']) && player.canJump) bodies[player.instanceId].velocity.y = player.jumpForce || 8
    }

    // Camera follow
    if (activeView && activeView.cameraRole === 'player' && player && meshMap[player.instanceId]) {
      var pm = meshMap[player.instanceId]
      camera.position.lerp(new THREE.Vector3(pm.position.x, pm.position.y + (activeView.followHeight || 3), pm.position.z + (activeView.followDistance || 6)), 0.1)
      camera.lookAt(pm.position)
    }

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

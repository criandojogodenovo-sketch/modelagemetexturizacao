/**
 * ScenePreview — modo de pré-visualização da cena em ecrã cheio.
 *
 * **Fase 3**:
 *  - Renderiza Conects (RigidObject, StaticObject, VisualObject, LuminousObject, etc.)
 *  - Inicializa PhysicsSystem com cannon-es
 *  - Dispara eventos OnCollision/onTriggerEnter/onTriggerExit para o FlirScript
 *  - PersonalObject liga-se a JoystickObject automaticamente
 *  - ViewObject segue o jogador (modo third/top/side)
 *  - UI objects (Button, Joystick, Text, Image, Panel) renderizados como overlay DOM
 *
 * Botão "Sair" no canto superior direito.
 */
import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import SceneObject from '../3d/SceneObject'
import ConectRenderer from './ConectRenderer'
import GameUIOverlay from './GameUIOverlay'
import { useStore } from '../../store/useStore'
import { IconClose, IconPlay } from '../ui/Icons'
import GameSplash from '../ui/GameSplash'
import DebugConsole from './debug/DebugConsole'
import { createFlirScriptRuntime, validateGraph } from '../../utils/flirscript/executor'
import { createFlirCodeRuntime } from '../../utils/flirscript/flircode'
import { createPhysicsSystem } from '../../utils/conects/physicsSystem'
import { createAnimationPlayer } from '../../utils/animationPlayer'
import { createNPCAI } from '../../utils/conects/npcAI'
import { debugLog } from '../../utils/debug/debugStore'

function PreviewBackground({ background }) {
  const { scene } = useThree()
  useEffect(() => {
    if (background.type === 'gradient') {
      const canvas = document.createElement('canvas')
      canvas.width = 2
      canvas.height = 256
      const ctx = canvas.getContext('2d')
      const grad = ctx.createLinearGradient(0, 0, 0, 256)
      grad.addColorStop(0, background.gradientTop)
      grad.addColorStop(1, background.gradientBottom)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 2, 256)
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      scene.background = tex
      return () => tex.dispose()
    } else {
      scene.background = new THREE.Color(background.color)
    }
  }, [background, scene])
  return null
}

// Avalia condições do AnimationController (speed>X, grounded==true, etc.)
function evaluateCondition(condition, ctx) {
  if (!condition) return false
  let m = condition.match(/^speed\s*>\s*(\d+(\.\d+)?)/)
  if (m) return (ctx.speed || 0) > parseFloat(m[1])
  m = condition.match(/^speed\s*<\s*(\d+(\.\d+)?)/)
  if (m) return (ctx.speed || 0) < parseFloat(m[1])
  m = condition.match(/^grounded\s*==\s*(true|false)/)
  if (m) return ctx.grounded === (m[1] === 'true')
  m = condition.match(/^attacking\s*==\s*(true|false)/)
  if (m) return !!ctx.attacking === (m[1] === 'true')
  return false
}

// Runner que integra física + FlirScript + Animação + IA NPC
function GameRunner({ activeScene, meshRefs, conectMeshRefs, objects }) {
  const { camera, scene: threeScene } = useThree()
  const physicsRef = useRef(null)
  const runtimesRef = useRef(new Map()) // FlirScript runtimes por conect.instanceId
  const animPlayersRef = useRef(new Map()) // animationPlayers por instanceId
  const npcAIsRef = useRef(new Map()) // NPC AI por instanceId
  const timerStatesRef = useRef(new Map()) // TimerObject states
  const joystickRef = useRef({ x: 0, z: 0, active: false })
  const toast = useStore((s) => s.toast)

  // Inicializar física + runtimes quando a cena muda
  useEffect(() => {
    // Limpar runtimes antigos
    for (const rt of runtimesRef.current.values()) rt.dispose()
    runtimesRef.current.clear()
    if (physicsRef.current) physicsRef.current.dispose()

    // Criar physics system
    const gravity = activeScene.physics?.gravity || [0, -9.82, 0]
    physicsRef.current = createPhysicsSystem({ gravity: gravity[1] })

    // Game context: API que os nós FlirScript podem chamar
    const gameContext = {
      globalVars: { _score: 0 },
      moveObject: (instanceId, direction, speed) => {
        // Se for um conect com física, usar movePersonal; senão mover o mesh diretamente
        if (physicsRef.current && activeScene.conects?.find((c) => c.instanceId === instanceId && c.type === 'PersonalObject')) {
          physicsRef.current.movePersonal(instanceId, direction, speed)
        } else {
          const mesh = meshRefs.current.get(instanceId) || conectMeshRefs.current.get(instanceId)
          if (mesh) {
            mesh.position.x += direction[0] * speed * 0.016
            mesh.position.y += direction[1] * speed * 0.016
            mesh.position.z += direction[2] * speed * 0.016
          }
        }
      },
      rotateObject: (instanceId, rotation) => {
        const mesh = meshRefs.current.get(instanceId) || conectMeshRefs.current.get(instanceId)
        if (mesh) {
          mesh.rotation.x += THREE.MathUtils.degToRad(rotation[0]) * 0.016
          mesh.rotation.y += THREE.MathUtils.degToRad(rotation[1]) * 0.016
          mesh.rotation.z += THREE.MathUtils.degToRad(rotation[2]) * 0.016
        }
      },
      playAnimation: (instanceId, clip) => {
        const player = animPlayersRef.current.get(instanceId)
        if (player) {
          player.play(clip, { loop: true })
          debugLog(`A tocar animação "${clip}" em ${instanceId.slice(-6)}`, 'log', 'Animation')
        }
      },
      playSound: (soundUrl) => {
        try {
          const audio = new Audio(soundUrl)
          audio.play().catch(() => {})
        } catch {}
      },
      playSoundByName: (name) => {
        // Procurar SoundObject pelo nome na cena ativa
        const soundConect = (activeScene.conects || []).find((c) => c.type === 'SoundObject' && c.name === name)
        if (soundConect && soundConect.url) {
          try {
            const audio = new Audio(soundConect.url)
            audio.volume = soundConect.volume ?? 1
            audio.loop = soundConect.loop || false
            audio.play().catch(() => {})
            debugLog(`A tocar som "${name}"`, 'log', 'Audio')
          } catch {}
          return true
        }
        return false // não encontrado — fallback para playSound com URL
      },
      destroyObject: (instanceId) => {
        const mesh = meshRefs.current.get(instanceId) || conectMeshRefs.current.get(instanceId)
        if (mesh) mesh.visible = false
      },
      spawnObject: (objectName, position) => {
        const obj = objects.find((o) => o.name === objectName)
        if (obj) useStore.getState().addObjectToScene(obj.id, position)
      },
      changeScene: (sceneName) => {
        const scenes = useStore.getState().scenes
        const target = scenes.find((s) => s.name === sceneName)
        if (target) {
          useStore.getState().setActiveScene(target.id)
          toast(`Mudou para a cena "${sceneName}"`, 'info')
        }
      },
      setVisible: (instanceId, visible) => {
        const mesh = meshRefs.current.get(instanceId) || conectMeshRefs.current.get(instanceId)
        if (mesh) mesh.visible = visible
      },
      // Acesso ao physics para nós de física
      applyForce: (instanceId, force) => physicsRef.current?.applyForce(instanceId, force),
      jumpPlayer: (instanceId) => physicsRef.current?.jumpPersonal(instanceId),
      // ===== Funções de UI =====
      showUIScreen: (screenName) => {
        const screens = useStore.getState().uiScreens
        const screen = screens.find((s) => s.name === screenName)
        if (screen) useStore.getState().setUIScreenVisible(screen.id, true)
      },
      hideUIScreen: (screenName) => {
        const screens = useStore.getState().uiScreens
        const screen = screens.find((s) => s.name === screenName)
        if (screen) useStore.getState().setUIScreenVisible(screen.id, false)
      },
      getUIValue: (elementName) => {
        const screens = useStore.getState().uiScreens
        for (const sc of screens) {
          const el = sc.elements.find((e) => e.name === elementName)
          if (el) return el.value ?? el.checked ?? el.text ?? ''
        }
        return ''
      },
      setUIValue: (elementName, value) => {
        const screens = useStore.getState().uiScreens
        for (const sc of screens) {
          const el = sc.elements.find((e) => e.name === elementName)
          if (el) {
            useStore.getState().updateUIElement(el.id, { value, text: value, label: value })
            return
          }
        }
      },
      triggerUIEvent: (eventName, payload) => {
        // Disparar evento de UI em todos os runtimes ativos
        for (const rt of runtimesRef.current.values()) {
          rt.triggerEvent(eventName, payload)
        }
      },
      // ===== Funções de query (collidingWith, distanceTo, isTouching) =====
      collidingWith: (instanceId, type) => {
        // Verificar contacts do cannon-es
        if (!physicsRef.current) return false
        const entry = physicsRef.current.bodies.get(instanceId)
        if (!entry) return false
        for (const [otherId, otherEntry] of physicsRef.current.bodies) {
          if (otherId === instanceId) continue
          if (otherEntry.conect.type === type || otherEntry.conect.name === type) {
            // Verificar se há contacto
            const dist = entry.body.position.distanceTo(otherEntry.body.position)
            if (dist < 1.5) return true
          }
        }
        return false
      },
      distanceTo: (instanceId, targetName) => {
        const scenes = useStore.getState().scenes
        const activeScene = scenes.find((s) => s.id === useStore.getState().activeSceneId)
        // Procurar o objeto alvo pelo nome
        let targetMesh = null
        for (const inst of activeScene.objects || []) {
          const obj = objects.find((o) => o.id === inst.objectId)
          if (obj && obj.name === targetName) {
            targetMesh = meshRefs.current.get(inst.instanceId)
            break
          }
        }
        if (!targetMesh) {
          for (const conect of activeScene.conects || []) {
            if (conect.name === targetName) {
              targetMesh = conectMeshRefs.current.get(conect.instanceId)
              break
            }
          }
        }
        const sourceMesh = meshRefs.current.get(instanceId) || conectMeshRefs.current.get(instanceId)
        if (!sourceMesh || !targetMesh) return 0
        return sourceMesh.position.distanceTo(targetMesh.position)
      },
      isTouching: () => {
        return joystickRef.current.active || false
      },
    }
    // Expor globalmente para o GameUIOverlay
    window._flirGameContext = gameContext

    // Registar conects com física
    setTimeout(() => {
      if (!physicsRef.current) return
      for (const conect of activeScene.conects || []) {
        const mesh = conectMeshRefs.current.get(conect.instanceId)
        if (mesh) {
          physicsRef.current.addConect(conect, mesh)
        }
      }
      // ===== Setup JointObjects (juntas físicas entre corpos) =====
      for (const conect of activeScene.conects || []) {
        if (conect.type === 'JointObject' && conect.targetA && conect.targetB) {
          physicsRef.current.addJoint(conect)
        }
      }
      // Avisar se exceder limite
      const stats = physicsRef.current.getStats()
      if (stats.atLimit) {
        toast(`Aviso: ${stats.bodyCount} corpos físicos ativos — pode ser lento em telemóveis`, 'warning', 4000)
      }
    }, 100) // esperar que os meshes estejam prontos

    // Eventos de física → FlirScript
    physicsRef.current.on('onCollision', ({ instanceId, otherInstanceId }) => {
      const rt = runtimesRef.current.get(instanceId)
      if (rt) rt.triggerEvent('onCollision', { other: otherInstanceId })
    })
    physicsRef.current.on('onTriggerEnter', ({ instanceId, otherInstanceId }) => {
      const rt = runtimesRef.current.get(instanceId)
      if (rt) rt.triggerEvent('onEnterZone', { other: otherInstanceId })
    })
    physicsRef.current.on('onTriggerExit', ({ instanceId, otherInstanceId }) => {
      const rt = runtimesRef.current.get(instanceId)
      if (rt) rt.triggerEvent('onExitZone', { other: otherInstanceId })
    })

    // Criar runtimes FlirScript/FlirCode para objetos com script
    const setupRuntime = (instance, scriptData) => {
      if (!scriptData) return
      try {
        // Detectar se é FlirCode (texto) ou grafo visual (objeto)
        if (typeof scriptData === 'string' && scriptData.startsWith('FLIRCODE:')) {
          // FlirCode (texto)
          const source = scriptData.slice('FLIRCODE:'.length)
          const rt = createFlirCodeRuntime(source, { ...gameContext, _instanceId: instance.instanceId })
          if (!rt.hasErrors) {
            runtimesRef.current.set(instance.instanceId, rt)
            rt.triggerEvent('beginPlay')
          } else {
            debugLog(`FlirCode tem erros — não executado para ${instance.name}`, 'error', 'FlirCode')
          }
        } else if (typeof scriptData === 'object') {
          // Grafo visual (litegraph serializado)
          const errors = validateGraph(scriptData)
          if (errors.length > 0) return
          const rt = createFlirScriptRuntime(scriptData, gameContext)
          rt.graph.nodes.forEach((n) => { n._instanceId = instance.instanceId })
          runtimesRef.current.set(instance.instanceId, rt)
          rt.triggerEvent('beginPlay')
        }
      } catch (err) {
        debugLog(`Erro ao inicializar script: ${err.message}`, 'error', 'Script')
      }
    }
    for (const instance of activeScene.objects || []) {
      setupRuntime(instance, instance.flirScript)
    }
    for (const conect of activeScene.conects || []) {
      setupRuntime(conect, conect.flirScript)
    }

    // Auto-start timers e spawns
    for (const conect of activeScene.conects || []) {
      if (conect.type === 'TimerObject' && conect.autoStart) {
        timerStatesRef.current.set(conect.instanceId, {
          remaining: conect.duration || 5,
          loop: conect.loop || false,
          duration: conect.duration || 5,
        })
      }
      // SpawnObject auto-start
      if (conect.type === 'SpawnObject' && conect.autoStart && conect.objectToSpawn) {
        const obj = objects.find((o) => o.id === conect.objectToSpawn || o.name === conect.objectToSpawn)
        if (obj) {
          const interval = setInterval(() => {
            useStore.getState().addObjectToScene(obj.id, conect.position || [0, 0.5, 0])
          }, (conect.interval || 2) * 1000)
          // Guardar para limpar depois
          timerStatesRef.current.set(`_spawn_${conect.instanceId}`, { interval })
        }
      }
    }

    // ===== Setup Animation Players para objetos com animações =====
    for (const instance of [...(activeScene.objects || []), ...(activeScene.conects || [])]) {
      if (instance.animations && Object.keys(instance.animations).length > 0) {
        const player = createAnimationPlayer(
          instance.animations,
          () => meshRefs.current.get(instance.instanceId) || conectMeshRefs.current.get(instance.instanceId),
          () => null // bones não suportados ainda neste nível
        )
        animPlayersRef.current.set(instance.instanceId, player)
        // Tocar animação default (idle) se existir
        if (instance.animations.idle) {
          player.play('idle', { loop: true })
        } else {
          const firstClip = Object.keys(instance.animations)[0]
          if (firstClip) player.play(firstClip, { loop: true })
        }
      }
    }

    // ===== Setup NPC AI para NpcObject =====
    for (const conect of activeScene.conects || []) {
      if (conect.type === 'NpcObject') {
        const ai = createNPCAI(conect, {
          getPlayerPos: () => {
            // Encontrar PersonalObject na cena
            const player = (activeScene.conects || []).find((c) => c.type === 'PersonalObject')
            if (!player) return null
            const playerMesh = conectMeshRefs.current.get(player.instanceId)
            if (!playerMesh) return null
            return [playerMesh.position.x, playerMesh.position.y, playerMesh.position.z]
          },
          getPathPoints: (pathInstanceId) => {
            const path = (activeScene.conects || []).find((c) => c.instanceId === pathInstanceId)
            return path?.points || null
          },
          physicsMove: (instId, dir, speed) => physicsRef.current?.movePersonal(instId, dir, speed),
          physicsJump: (instId) => physicsRef.current?.jumpPersonal(instId),
          emitEvent: (eventName, payload) => {
            const rt = runtimesRef.current.get(conect.instanceId)
            if (rt) {
              // Eventos NPC dedicados (não mapear para onTouch)
              if (eventName === 'OnSeePlayer') rt.triggerEvent('onSeePlayer', payload)
              else if (eventName === 'OnLoseSight') rt.triggerEvent('onLoseSight', payload)
              debugLog(`NPC ${conect.name}: ${eventName}`, 'log', 'NPC AI')
            }
          },
        })
        npcAIsRef.current.set(conect.instanceId, ai)
      }
    }

    // ===== Aplicar SkyObject, FogObject à cena 3D =====
    const skyConect = (activeScene.conects || []).find((c) => c.type === 'SkyObject')
    if (skyConect) {
      if (skyConect.skyType === 'gradient' || skyConect.skyType === 'solid') {
        const canvas = document.createElement('canvas')
        canvas.width = 2
        canvas.height = 256
        const ctx = canvas.getContext('2d')
        if (skyConect.skyType === 'gradient') {
          const grad = ctx.createLinearGradient(0, 0, 0, 256)
          grad.addColorStop(0, skyConect.topColor || '#1a4d8f')
          grad.addColorStop(1, skyConect.bottomColor || '#aac4e8')
          ctx.fillStyle = grad
        } else {
          ctx.fillStyle = skyConect.topColor || '#1a4d8f'
        }
        ctx.fillRect(0, 0, 2, 256)
        const tex = new THREE.CanvasTexture(canvas)
        tex.colorSpace = THREE.SRGBColorSpace
        threeScene.background = tex
      }
    }
    const fogConect = (activeScene.conects || []).find((c) => c.type === 'FogObject')
    if (fogConect) {
      if (fogConect.fogType === 'exponential') {
        threeScene.fog = new THREE.FogExp2(new THREE.Color(fogConect.color || '#a0a0a0'), fogConect.density || 0.02)
      } else {
        threeScene.fog = new THREE.Fog(
          new THREE.Color(fogConect.color || '#a0a0a0'),
          fogConect.near || 5,
          fogConect.far || 50
        )
      }
    }

    // ===== SoundObject: tocar automaticamente se autoplay =====
    const soundObjects = (activeScene.conects || []).filter((c) => c.type === 'SoundObject' && c.autoplay && c.url)
    for (const sound of soundObjects) {
      try {
        const audio = new Audio(sound.url)
        audio.volume = sound.volume ?? 1
        audio.loop = sound.loop || false
        audio.play().catch(() => {})
        // Guardar referência para parar depois
        timerStatesRef.current.set(`_audio_${sound.instanceId}`, { audio })
      } catch {}
    }

    return () => {
      for (const rt of runtimesRef.current.values()) rt.dispose()
      runtimesRef.current.clear()
      for (const ai of npcAIsRef.current.values()) ai.dispose()
      npcAIsRef.current.clear()
      for (const [, state] of timerStatesRef.current) {
        if (state.interval) clearInterval(state.interval)
        if (state.audio) { state.audio.pause(); state.audio = null }
      }
      timerStatesRef.current.clear()
      animPlayersRef.current.clear()
      physicsRef.current?.dispose()
      physicsRef.current = null
      // Restaurar fog/background
      threeScene.fog = null
    }
  }, [activeScene, objects])

  // Loop principal: física + tick + animações + IA + timers + joystick + camera
  useFrame((_, delta) => {
    if (physicsRef.current) {
      physicsRef.current.update(delta)
    }

    // Disparar Tick nos runtimes FlirScript
    for (const rt of runtimesRef.current.values()) {
      rt.update(delta)
      rt.triggerEvent('tick', { deltaTime: delta })
    }

    // ===== Atualizar Animation Players =====
    for (const player of animPlayersRef.current.values()) {
      player.update(delta)
    }

    // ===== Atualizar NPC AI =====
    for (const ai of npcAIsRef.current.values()) {
      ai.update(delta)
    }

    // ===== Atualizar Timers =====
    for (const [id, state] of timerStatesRef.current) {
      if (id.startsWith('_')) continue // skip audio/spawn
      state.remaining -= delta
      if (state.remaining <= 0) {
        const rt = runtimesRef.current.get(id)
        if (rt) rt.triggerEvent('onTimer') // evento dedicado onTimer
        if (state.loop) {
          state.remaining = state.duration
        } else {
          timerStatesRef.current.delete(id)
        }
      }
    }

    // ===== Controlador de Animação para PersonalObject/NpcObject =====
    for (const conect of activeScene.conects || []) {
      if (conect.type !== 'PersonalObject' && conect.type !== 'NpcObject') continue
      if (!conect.animationController) continue
      const player = animPlayersRef.current.get(conect.instanceId)
      if (!player) continue
      const mesh = conectMeshRefs.current.get(conect.instanceId)
      // Calcular contexto (velocidade, grounded)
      const physicsEntry = physicsRef.current?.bodies?.get(conect.instanceId)
      const ctx = {
        speed: mesh ? Math.sqrt(
          (mesh.position.x - (player._lastX || mesh.position.x)) ** 2 +
          (mesh.position.z - (player._lastZ || mesh.position.z)) ** 2
        ) / Math.max(delta, 0.001) : 0,
        grounded: physicsEntry?.grounded ?? true,
        attacking: false,
      }
      if (mesh) {
        player._lastX = mesh.position.x
        player._lastZ = mesh.position.z
      }
      // Avaliar transições do controlador
      const controller = conect.animationController
      const currentState = player.getCurrentClip()
      for (const t of controller.transitions || []) {
        if (t.from !== currentState) continue
        if (evaluateCondition(t.condition, ctx)) {
          const targetState = controller.states?.find((s) => s.id === t.to)
          if (targetState) {
            player.play(targetState.clip || targetState.name, { loop: true })
          }
          break
        }
      }
    }

    // ===== Atualizar TrailObjects =====
    for (const conect of activeScene.conects || []) {
      if (conect.type !== 'TrailObject') continue
      const trailMesh = conectMeshRefs.current.get(conect.instanceId)
      if (!trailMesh) continue
      // Seguir o objeto pai (followTarget)
      const targetId = conect.followTarget
      if (targetId) {
        const targetMesh = meshRefs.current.get(targetId) || conectMeshRefs.current.get(targetId)
        if (targetMesh) {
          // Atualizar posição do trail para seguir o alvo
          trailMesh.position.lerp(targetMesh.position, 0.3)
          // Atualizar geometria da linha com histórico de posições
          if (!trailMesh.userData.trailPoints) {
            trailMesh.userData.trailPoints = []
          }
          const points = trailMesh.userData.trailPoints
          points.push(targetMesh.position.clone())
          const maxLen = conect.length || 30
          while (points.length > maxLen) points.shift()
          // Atualizar geometria da linha
          const lineObj = trailMesh.children?.find((c) => c.isLine)
          if (lineObj && points.length > 1) {
            const newGeo = new THREE.BufferGeometry().setFromPoints(points)
            lineObj.geometry.dispose()
            lineObj.geometry = newGeo
          }
        }
      }
    }

    // Joystick → mover PersonalObject
    if (joystickRef.current.active) {
      for (const conect of activeScene.conects || []) {
        if (conect.type === 'PersonalObject') {
          const speed = conect.moveSpeed || 5
          physicsRef.current?.movePersonal(conect.instanceId, [
            joystickRef.current.x, 0, joystickRef.current.z,
          ], speed)
        }
      }
    }

    // ===== Câmaras: ViewObject com follow ou cameraRole='player' =====
    // Câmaras com cameraRole='player' seguem automaticamente o PersonalObject
    const allViewConects = (activeScene.conects || []).filter((c) => c.type === 'ViewObject')
    // Priorizar: câmara ativa (já escolhida acima) — usar a activeViewConect
    const followCam = activeViewConect
    if (followCam) {
      // Se cameraRole='player' e não tem followTarget, seguir PersonalObject automaticamente
      let targetId = followCam.followTarget
      if (!targetId && followCam.cameraRole === 'player') {
        const player = (activeScene.conects || []).find((c) => c.type === 'PersonalObject')
        if (player) targetId = player.instanceId
      }
      if (targetId && followCam.followMode !== 'none') {
        const targetMesh = meshRefs.current.get(targetId) || conectMeshRefs.current.get(targetId)
        if (targetMesh) {
          const mode = followCam.followMode
          const dist = followCam.followDistance || 6
          const height = followCam.followHeight || 3
          if (mode === 'third') {
            camera.position.lerp(new THREE.Vector3(
              targetMesh.position.x,
              targetMesh.position.y + height,
              targetMesh.position.z + dist,
            ), 0.1)
            camera.lookAt(targetMesh.position)
          } else if (mode === 'top') {
            camera.position.lerp(new THREE.Vector3(
              targetMesh.position.x,
              targetMesh.position.y + dist,
              targetMesh.position.z,
            ), 0.1)
            camera.lookAt(targetMesh.position)
          } else if (mode === 'side') {
            camera.position.lerp(new THREE.Vector3(
              targetMesh.position.x + dist,
              targetMesh.position.y + height / 2,
              targetMesh.position.z,
            ), 0.1)
            camera.lookAt(targetMesh.position)
          }
        }
      }
    }
  })

  return null
}

export default function ScenePreview() {
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const objects = useStore((s) => s.objects)
  const background = useStore((s) => s.background)
  const lights = useStore((s) => s.lights)
  const closeScenePreview = useStore((s) => s.closeScenePreview)
  const [useGameCam, setUseGameCam] = useState(true) // default: usar ViewObject ativa
  const [showSplash, setShowSplash] = useState(true)
  const [showDebug, setShowDebug] = useState(true) // Consola visível por defeito durante o jogo
  const orbitRef = useRef(null)
  const meshRefs = useRef(new Map())
  const conectMeshRefs = useRef(new Map())

  const activeScene = scenes.find((s) => s.id === activeSceneId)

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') closeScenePreview()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeScenePreview])

  if (!activeScene) return null

  // Procurar câmara ativa: prioridade player > primary > isActive > primeira
  const viewConects = (activeScene.conects || []).filter((c) => c.type === 'ViewObject')
  const activeViewConect =
    viewConects.find((c) => c.cameraRole === 'player') ||
    viewConects.find((c) => c.cameraRole === 'primary') ||
    viewConects.find((c) => c.isActive) ||
    viewConects[0] ||
    null
  const useOrbital = !activeViewConect || !useGameCam

  // Configuração de câmara: usar ViewObject ativa se disponível
  const cam = activeViewConect || activeScene.gameCamera
  const cameraProps = (cam.cameraType || cam.type) === 'orthographic'
    ? { type: 'orthographic', position: cam.position || [5, 4, 6], near: cam.near || 0.1, far: cam.far || 200, zoom: 5 / (cam.orthoSize || 5) }
    : { type: 'perspective', position: cam.position || [5, 4, 6], fov: cam.fov || 60, near: cam.near || 0.1, far: cam.far || 200 }

  return (
    <div className="scene-preview-fullscreen">
      {showSplash && <GameSplash onDone={() => setShowSplash(false)} />}

      <button
        className="preview-exit-btn"
        onClick={closeScenePreview}
        title="Parar execução e voltar ao editor (Esc)"
      >
        <IconClose width={18} height={18} />
        <span>⏹ Parar</span>
      </button>

      {activeViewConect && (
        <button
          className="preview-cam-btn"
          onClick={() => setUseGameCam(!useGameCam)}
          title={useGameCam ? 'Câmara orbital' : 'Câmara de jogo (ViewObject ativa)'}
        >
          <IconPlay width={14} height={14} />
          {useGameCam ? 'Orbital' : 'Game Cam'}
        </button>
      )}

      <div className="preview-info">
        <strong>{activeScene.name}</strong>
        <span className="muted small">
          {' · '}{activeScene.objects.length} objetos
          {' · '}{activeScene.conects?.length || 0} conects
          {activeScene.playerObjectId && ' · jogador definido'}
          {(activeScene.conects || []).some((c) => c.flirScript) && ' · FlirScript ativo'}
        </span>
      </div>

      <Canvas
        key="scene-preview-canvas"
        shadows
        dpr={[1, 2]}
        camera={cameraProps}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => {
          // Forçar clear depois de criar
          gl.clearColor(0.05, 0.07, 0.09, 1)
          gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
        }}
      >
        <Suspense fallback={null}>
          <PreviewBackground background={background} />
          <ambientLight intensity={lights.ambient.intensity} color={lights.ambient.color} />
          <directionalLight
            intensity={lights.directional.intensity}
            color={lights.directional.color}
            position={lights.directional.position}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-30}
            shadow-camera-right={30}
            shadow-camera-top={30}
            shadow-camera-bottom={-30}
          />
          <hemisphereLight intensity={0.3} groundColor="#1a1a2e" color="#ffffff" />

          <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={50} blur={2.5} far={5} />

          {/* Objetos do catálogo */}
          {activeScene.objects.map((instance) => {
            const obj = objects.find((o) => o.id === instance.objectId)
            if (!obj) return null
            const sceneObj = {
              ...obj,
              id: instance.instanceId,
              position: instance.position,
              rotation: instance.rotation,
              scale: instance.scale,
            }
            return (
              <SceneObject
                key={instance.instanceId}
                ref={(node) => {
                  if (node) meshRefs.current.set(instance.instanceId, node)
                  else meshRefs.current.delete(instance.instanceId)
                }}
                obj={sceneObj}
                isSelected={false}
                onSelect={() => {}}
              />
            )
          })}

          {/* Conects da cena */}
          {(activeScene.conects || []).map((conect) => (
            <ConectRenderer
              key={conect.instanceId}
              conect={conect}
              objects={objects}
              setMeshRef={(node) => {
                if (node) conectMeshRefs.current.set(conect.instanceId, node)
                else conectMeshRefs.current.delete(conect.instanceId)
              }}
            />
          ))}

          {/* Runner: física + FlirScript + camera follow + joystick */}
          <GameRunner
            activeScene={activeScene}
            meshRefs={meshRefs}
            conectMeshRefs={conectMeshRefs}
            objects={objects}
          />

          {useOrbital && (
            <OrbitControls
              ref={orbitRef}
              makeDefault
              enableDamping
              dampingFactor={0.08}
              minDistance={1}
              maxDistance={100}
              maxPolarAngle={Math.PI * 0.495}
              touches={{
                ONE: THREE.TOUCH.ROTATE,
                TWO: THREE.TOUCH.DOLLY_PAN,
              }}
            />
          )}
          {/* Aplicar rotação da ViewObject à câmara quando não há follow */}
          {activeViewConect && useGameCam && !activeViewConect.followTarget && (
            <ViewCameraRig viewConect={activeViewConect} />
          )}
        </Suspense>
      </Canvas>

      {/* UI Overlay: usa o mesmo UIElementRenderer do editor */}
      <GameUIOverlay />

      {/* Consola de Debug visível durante o jogo */}
      {showDebug && (
        <div style={{ position: 'fixed', bottom: 0, right: 0, width: 320, maxHeight: 200, zIndex: 90, opacity: 0.9 }}>
          <DebugConsole onClose={() => setShowDebug(false)} />
        </div>
      )}
    </div>
  )
}

// Aplica a rotação da ViewObject à câmara do canvas
function ViewCameraRig({ viewConect }) {
  const { camera } = useThree()
  useEffect(() => {
    if (!viewConect || !camera) return
    camera.position.set(...(viewConect.position || [5, 4, 6]))
    if (viewConect.rotation) {
      camera.rotation.set(...viewConect.rotation)
    } else {
      // Sem rotação definida — olhar para a origem
      camera.lookAt(0, 0, 0)
    }
    if (viewConect.fov && camera.fov !== undefined) {
      camera.fov = viewConect.fov
      camera.updateProjectionMatrix()
    }
  }, [viewConect.position, viewConect.rotation, viewConect.fov, camera])
  return null
}

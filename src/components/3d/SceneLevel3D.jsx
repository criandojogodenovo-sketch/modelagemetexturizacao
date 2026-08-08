/**
 * SceneLevel3D — viewport 3D para o editor de cenas E para o modo de jogo.
 *
 * **Fase 6 (reescrito)**: Um único Canvas WebGL para editor e jogo.
 * Quando scenePreviewOpen é true, o modo "jogo" é activado:
 *  - Gizmos e OrbitControls desactivados
 *  - Física cannon-es activada
 *  - FlirCode runtimes iniciados
 *  - ViewObject ativa usada como câmara
 *  - GameUIOverlay renderizado sobre o canvas
 *
 * Isto elimina o problema de WebGL context loss que ocorria quando
 * dois Canvas WebGL coexistiam.
 */
import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, TransformControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import SceneObject from './SceneObject'
import ConectRenderer from '../panels/ConectRenderer'
import { useStore } from '../../store/useStore'
import { createPhysicsSystem } from '../../utils/conects/physicsSystem'
import { createFlirScriptRuntime, validateGraph } from '../../utils/flirscript/executor'
import { createFlirCodeRuntime } from '../../utils/flirscript/flircode'
import { createAnimationPlayer } from '../../utils/animationPlayer'
import { createNPCAI } from '../../utils/conects/npcAI'
import { debugLog } from '../../utils/debug/debugStore'

function PlayerMarker({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.5, 0]}>
        <coneGeometry args={[0.2, 0.4, 16]} />
        <meshBasicMaterial color="#3fb950" />
      </mesh>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.7, 32]} />
        <meshBasicMaterial color="#3fb950" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function GameCameraGizmo({ camera }) {
  if (!camera) return null
  return (
    <group position={camera.position} rotation={camera.rotation}>
      <mesh>
        <boxGeometry args={[0.4, 0.3, 0.5]} />
        <meshBasicMaterial color="#f4a261" wireframe />
      </mesh>
    </group>
  )
}

// Componente interno que aplica o fundo da cena
function SceneBackgroundSolid({ background }) {
  const { scene } = useThree()
  useEffect(() => {
    if (background.type === 'gradient') {
      const canvas = document.createElement('canvas')
      canvas.width = 2; canvas.height = 256
      const ctx = canvas.getContext('2d')
      const grad = ctx.createLinearGradient(0, 0, 0, 256)
      grad.addColorStop(0, background.gradientTop)
      grad.addColorStop(1, background.gradientBottom)
      ctx.fillStyle = grad; ctx.fillRect(0, 0, 2, 256)
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

// ===== Componente que gere o modo jogo dentro do canvas =====
function GameMode({ activeScene, objects, meshRefs, conectMeshRefs, isGameMode }) {
  const { camera } = useThree()
  const physicsRef = useRef(null)
  const runtimesRef = useRef(new Map())
  const animPlayersRef = useRef(new Map())
  const npcAIsRef = useRef(new Map())
  const timerStatesRef = useRef(new Map())
  const joystickRef = useRef({ x: 0, z: 0, active: false })

  // Setup quando o modo jogo é activado
  useEffect(() => {
    if (!isGameMode || !activeScene) return

    debugLog('Jogo iniciado', 'log', 'Game')

    // Criar gameContext
    const gameContext = {
      globalVars: { _score: 0 },
      moveObject: (instanceId, direction, speed) => {
        const mesh = meshRefs.current.get(instanceId) || conectMeshRefs.current.get(instanceId)
        if (mesh) {
          mesh.position.x += direction[0] * speed * 0.016
          mesh.position.y += direction[1] * speed * 0.016
          mesh.position.z += direction[2] * speed * 0.016
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
        if (player) player.play(clip, { loop: true })
      },
      playSound: (url) => { try { new Audio(url).play() } catch {} },
      playSoundByName: (name) => {
        const sc = (activeScene.conects || []).find((c) => c.type === 'SoundObject' && c.name === name)
        if (sc && sc.url) { try { const a = new Audio(sc.url); a.volume = sc.volume ?? 1; a.loop = sc.loop || false; a.play() } catch {} }
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
        if (target) useStore.getState().setActiveScene(target.id)
      },
      setVisible: (instanceId, visible) => {
        const mesh = meshRefs.current.get(instanceId) || conectMeshRefs.current.get(instanceId)
        if (mesh) mesh.visible = visible
      },
      applyForce: (instanceId, force) => physicsRef.current?.applyForce(instanceId, force),
      jumpPlayer: (instanceId) => physicsRef.current?.jumpPersonal(instanceId),
      showUIScreen: (name) => {
        const s = useStore.getState().uiScreens.find((s) => s.name === name)
        if (s) useStore.getState().setUIScreenVisible(s.id, true)
      },
      hideUIScreen: (name) => {
        const s = useStore.getState().uiScreens.find((s) => s.name === name)
        if (s) useStore.getState().setUIScreenVisible(s.id, false)
      },
      getUIValue: (name) => {
        for (const s of useStore.getState().uiScreens) {
          const el = s.elements.find((e) => e.name === name)
          if (el) return el.value ?? el.text ?? ''
        }
        return ''
      },
      setUIValue: (name, val) => {
        for (const s of useStore.getState().uiScreens) {
          const el = s.elements.find((e) => e.name === name)
          if (el) { useStore.getState().updateUIElement(el.id, { value: val, text: val, label: val }); return }
        }
      },
      triggerUIEvent: (eventName, payload) => {
        for (const rt of runtimesRef.current.values()) rt.triggerEvent(eventName, payload)
      },
      collidingWith: (instanceId, type) => {
        if (!physicsRef.current) return false
        const entry = physicsRef.current.bodies.get(instanceId)
        if (!entry) return false
        for (const [otherId, otherEntry] of physicsRef.current.bodies) {
          if (otherId === instanceId) continue
          if (otherEntry.conect.type === type || otherEntry.conect.name === type) {
            if (entry.body.position.distanceTo(otherEntry.body.position) < 1.5) return true
          }
        }
        return false
      },
      distanceTo: (instanceId, targetName) => {
        for (const inst of activeScene.objects || []) {
          const obj = objects.find((o) => o.id === inst.objectId)
          if (obj && obj.name === targetName) {
            const target = meshRefs.current.get(inst.instanceId)
            const source = meshRefs.current.get(instanceId) || conectMeshRefs.current.get(instanceId)
            if (source && target) return source.position.distanceTo(target.position)
          }
        }
        return 0
      },
      isTouching: () => joystickRef.current.active,
    }
    window._flirGameContext = gameContext

    // Física
    const gravity = activeScene.physics?.gravity || [0, -9.82, 0]
    physicsRef.current = createPhysicsSystem({ gravity: gravity[1] })

    // Registar conects com física
    setTimeout(() => {
      if (!physicsRef.current) return
      for (const conect of activeScene.conects || []) {
        const mesh = conectMeshRefs.current.get(conect.instanceId)
        if (mesh) physicsRef.current.addConect(conect, mesh)
      }
      for (const conect of activeScene.conects || []) {
        if (conect.type === 'JointObject' && conect.targetA && conect.targetB) {
          physicsRef.current.addJoint(conect)
        }
      }
    }, 50)

    // Eventos de física
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

    // FlirCode/FlirScript runtimes
    const setupRuntime = (instance, scriptData) => {
      if (!scriptData) return
      try {
        if (typeof scriptData === 'string' && scriptData.startsWith('FLIRCODE:')) {
          const source = scriptData.slice(9)
          const rt = createFlirCodeRuntime(source, { ...gameContext, _instanceId: instance.instanceId, mesh: conectMeshRefs.current.get(instance.instanceId) || meshRefs.current.get(instance.instanceId) })
          if (!rt.hasErrors) {
            runtimesRef.current.set(instance.instanceId, rt)
            rt.triggerEvent('beginPlay')
          }
        } else if (typeof scriptData === 'object') {
          const errors = validateGraph(scriptData)
          if (errors.length > 0) return
          const rt = createFlirScriptRuntime(scriptData, gameContext)
          rt.graph.nodes.forEach((n) => { n._instanceId = instance.instanceId })
          runtimesRef.current.set(instance.instanceId, rt)
          rt.triggerEvent('beginPlay')
        }
      } catch (err) {
        debugLog('Erro ao inicializar script: ' + err.message, 'error', 'Script')
      }
    }
    for (const inst of activeScene.objects || []) setupRuntime(inst, inst.flirScript)
    for (const conect of activeScene.conects || []) setupRuntime(conect, conect.flirScript)

    // Animation players
    for (const inst of [...(activeScene.objects || []), ...(activeScene.conects || [])]) {
      if (inst.animations && Object.keys(inst.animations).length > 0) {
        const player = createAnimationPlayer(inst.animations, () => meshRefs.current.get(inst.instanceId) || conectMeshRefs.current.get(inst.instanceId), () => null)
        animPlayersRef.current.set(inst.instanceId, player)
        if (inst.animations.idle) player.play('idle', { loop: true })
        else { const f = Object.keys(inst.animations)[0]; if (f) player.play(f, { loop: true }) }
      }
    }

    // NPC AI
    for (const conect of activeScene.conects || []) {
      if (conect.type === 'NpcObject') {
        const ai = createNPCAI(conect, {
          getPlayerPos: () => {
            const player = (activeScene.conects || []).find((c) => c.type === 'PersonalObject')
            if (!player) return null
            const pm = conectMeshRefs.current.get(player.instanceId)
            return pm ? [pm.position.x, pm.position.y, pm.position.z] : null
          },
          getPathPoints: (pathId) => {
            const path = (activeScene.conects || []).find((c) => c.instanceId === pathId)
            return path?.points || null
          },
          physicsMove: (id, dir, speed) => physicsRef.current?.movePersonal(id, dir, speed),
          physicsJump: (id) => physicsRef.current?.jumpPersonal(id),
          emitEvent: (en, payload) => {
            const rt = runtimesRef.current.get(conect.instanceId)
            if (rt) {
              if (en === 'OnSeePlayer') rt.triggerEvent('onSeePlayer', payload)
              else if (en === 'OnLoseSight') rt.triggerEvent('onLoseSight', payload)
            }
          },
        })
        npcAIsRef.current.set(conect.instanceId, ai)
      }
    }

    // Timers
    for (const conect of activeScene.conects || []) {
      if (conect.type === 'TimerObject' && conect.autoStart) {
        timerStatesRef.current.set(conect.instanceId, { remaining: conect.duration || 5, loop: conect.loop || false, duration: conect.duration || 5 })
      }
    }

    // SkyObject / FogObject
    const skyConect = (activeScene.conects || []).find((c) => c.type === 'SkyObject')
    if (skyConect) {
      // Aplicado via SceneBackgroundSolid se mudar o background
    }
    const fogConect = (activeScene.conects || []).find((c) => c.type === 'FogObject')
    // Fog aplicado no useFrame

    // Joystick touch
    const onTouchStart = (e) => { if (e.touches.length === 1) { joystickRef.current.active = true } }
    const onTouchEnd = () => { joystickRef.current.active = false; joystickRef.current.x = 0; joystickRef.current.z = 0 }
    window.addEventListener('touchstart', onTouchStart)
    window.addEventListener('touchend', onTouchEnd)

    // Teclado
    const keys = {}
    const onKeyDown = (e) => { keys[e.key.toLowerCase()] = true }
    const onKeyUp = (e) => { keys[e.key.toLowerCase()] = false }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window._flirKeys = keys

    return () => {
      for (const rt of runtimesRef.current.values()) rt.dispose()
      runtimesRef.current.clear()
      for (const ai of npcAIsRef.current.values()) ai.dispose()
      npcAIsRef.current.clear()
      for (const [, s] of timerStatesRef.current) { if (s.interval) clearInterval(s.interval); if (s.audio) s.audio.pause() }
      timerStatesRef.current.clear()
      animPlayersRef.current.clear()
      physicsRef.current?.dispose()
      physicsRef.current = null
      window.removeEventListener('touchstart', onTouchStart)
      window.removeEventListener('touchend', onTouchEnd)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window._flirGameContext = null
    }
  }, [isGameMode, activeScene, objects])

  // Loop do jogo
  useFrame((_, delta) => {
    if (!isGameMode) return

    // Física
    if (physicsRef.current) {
      physicsRef.current.update(delta)
      // Sincronizar meshes com bodies
      for (const [id, entry] of physicsRef.current.bodies) {
        const mesh = meshRefs.current.get(id) || conectMeshRefs.current.get(id)
        if (mesh) {
          mesh.position.copy(entry.body.position)
          mesh.quaternion.copy(entry.body.quaternion)
        }
      }
    }

    // FlirCode onTick
    for (const rt of runtimesRef.current.values()) {
      rt.update(delta)
      rt.triggerEvent('tick', { deltaTime: delta })
    }

    // Animation players
    for (const player of animPlayersRef.current.values()) player.update(delta)

    // NPC AI
    for (const ai of npcAIsRef.current.values()) ai.update(delta)

    // Timers
    for (const [id, state] of timerStatesRef.current) {
      if (id.startsWith('_')) continue
      state.remaining -= delta
      if (state.remaining <= 0) {
        const rt = runtimesRef.current.get(id)
        if (rt) rt.triggerEvent('onTimer')
        if (state.loop) state.remaining = state.duration
        else timerStatesRef.current.delete(id)
      }
    }

    // Joystick → PersonalObject
    const keys = window._flirKeys || {}
    if (joystickRef.current.active || keys['w'] || keys['a'] || keys['s'] || keys['d']) {
      for (const conect of activeScene.conects || []) {
        if (conect.type === 'PersonalObject') {
          const speed = conect.moveSpeed || 5
          let mx = 0, mz = 0
          if (joystickRef.current.active) { mx = joystickRef.current.x * speed; mz = joystickRef.current.z * speed }
          if (keys['w']) mz = -speed
          if (keys['s']) mz = speed
          if (keys['a']) mx = -speed
          if (keys['d']) mx = speed
          physicsRef.current?.movePersonal(conect.instanceId, [mx, 0, mz], 1)
          if ((keys[' '] || keys['space']) && conect.canJump) {
            physicsRef.current?.jumpPersonal(conect.instanceId)
          }
        }
      }
    }

    // Câmara: ViewObject ativa
    const viewConects = (activeScene.conects || []).filter((c) => c.type === 'ViewObject')
    const activeView = viewConects.find((c) => c.cameraRole === 'player') || viewConects.find((c) => c.cameraRole === 'primary') || viewConects[0]
    if (activeView) {
      // Se cameraRole='player' e não tem followTarget, seguir PersonalObject
      let targetId = activeView.followTarget
      if (!targetId && activeView.cameraRole === 'player') {
        const player = (activeScene.conects || []).find((c) => c.type === 'PersonalObject')
        if (player) targetId = player.instanceId
      }
      if (targetId && activeView.followMode && activeView.followMode !== 'none') {
        const targetMesh = meshRefs.current.get(targetId) || conectMeshRefs.current.get(targetId)
        if (targetMesh) {
          const mode = activeView.followMode
          const dist = activeView.followDistance || 6
          const height = activeView.followHeight || 3
          if (mode === 'third') {
            camera.position.lerp(new THREE.Vector3(targetMesh.position.x, targetMesh.position.y + height, targetMesh.position.z + dist), 0.1)
            camera.lookAt(targetMesh.position)
          } else if (mode === 'top') {
            camera.position.lerp(new THREE.Vector3(targetMesh.position.x, targetMesh.position.y + dist, targetMesh.position.z), 0.1)
            camera.lookAt(targetMesh.position)
          } else if (mode === 'side') {
            camera.position.lerp(new THREE.Vector3(targetMesh.position.x + dist, targetMesh.position.y + height / 2, targetMesh.position.z), 0.1)
            camera.lookAt(targetMesh.position)
          }
        }
      } else {
        // Câmara estática na posição da ViewObject
        camera.position.set(...(activeView.position || [5, 4, 6]))
        if (activeView.rotation) camera.rotation.set(...activeView.rotation)
        else camera.lookAt(0, 0, 0)
      }
    }
  })

  return null
}

// ===== Componente principal =====
export default function SceneLevel3D() {
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const objects = useStore((s) => s.objects)
  const background = useStore((s) => s.background)
  const grid = useStore((s) => s.grid)
  const lights = useStore((s) => s.lights)
  const transformMode = useStore((s) => s.transformMode)
  const updateSceneInstance = useStore((s) => s.updateSceneInstance)
  const updateConect = useStore((s) => s.updateConect)
  const addObjectToScene = useStore((s) => s.addObjectToScene)
  const addConectToScene = useStore((s) => s.addConectToScene)
  const selectConect = useStore((s) => s.selectConect)
  const scenePreviewOpen = useStore((s) => s.scenePreviewOpen)

  const [selectedInstanceId, setSelectedInstanceId] = useState(null)
  const [selectedType, setSelectedType] = useState(null)
  const orbitRef = useRef(null)
  const meshRefs = useRef(new Map())
  const conectMeshRefs = useRef(new Map())
  const [selectedMesh, setSelectedMesh] = useState(null)

  const activeScene = scenes.find((s) => s.id === activeSceneId)
  const isGameMode = scenePreviewOpen

  useEffect(() => {
    if (selectedInstanceId && meshRefs.current.has(selectedInstanceId)) {
      setSelectedMesh(meshRefs.current.get(selectedInstanceId))
    } else if (selectedInstanceId && conectMeshRefs.current.has(selectedInstanceId)) {
      setSelectedMesh(conectMeshRefs.current.get(selectedInstanceId))
    } else {
      setSelectedMesh(null)
    }
  }, [selectedInstanceId, activeScene])

  const setMeshRef = useCallback((id, node) => {
    if (node) meshRefs.current.set(id, node)
    else meshRefs.current.delete(id)
  }, [])

  const setConectMeshRef = useCallback((id, node) => {
    if (node) conectMeshRefs.current.set(id, node)
    else conectMeshRefs.current.delete(id)
  }, [])

  const handleDrop = useCallback((e) => {
    if (isGameMode) return
    e.preventDefault()
    const objectId = e.dataTransfer.getData('text/objectId')
    const conectType = e.dataTransfer.getData('text/conectType')
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    const position = [x * 3, 0.5, -y * 3]
    if (objectId) addObjectToScene(objectId, position)
    else if (conectType) addConectToScene(conectType, position)
  }, [addObjectToScene, addConectToScene, isGameMode])

  const selectObject = useCallback((instanceId) => {
    if (isGameMode) return
    setSelectedInstanceId(instanceId)
    setSelectedType('object')
    selectConect(null)
  }, [selectConect, isGameMode])

  const selectConectInstance = useCallback((instanceId) => {
    if (isGameMode) return
    setSelectedInstanceId(instanceId)
    setSelectedType('conect')
    selectConect(instanceId)
  }, [selectConect, isGameMode])

  const handleTransformUpdate = useCallback(() => {
    if (!selectedMesh || !selectedInstanceId) return
    const transform = {
      position: [selectedMesh.position.x, selectedMesh.position.y, selectedMesh.position.z],
      rotation: [selectedMesh.rotation.x, selectedMesh.rotation.y, selectedMesh.rotation.z],
      scale: [selectedMesh.scale.x, selectedMesh.scale.y, selectedMesh.scale.z],
    }
    if (selectedType === 'conect') updateConect(selectedInstanceId, transform)
    else updateSceneInstance(selectedInstanceId, transform)
  }, [selectedMesh, selectedInstanceId, selectedType, updateConect, updateSceneInstance])

  if (!activeScene) {
    return (
      <div className="viewport" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="empty-state">
          <div style={{ fontSize: 32, opacity: 0.4 }}>🎬</div>
          <div>Nenhuma cena ativa.</div>
        </div>
      </div>
    )
  }

  return (
    <div className="viewport" onDragOver={(e) => !isGameMode && e.preventDefault()} onDrop={handleDrop}>
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [8, 6, 10], fov: 50, near: 0.1, far: 200 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }}
        onPointerMissed={() => {
          if (!isGameMode) {
            setSelectedInstanceId(null)
            setSelectedType(null)
            selectConect(null)
          }
        }}
      >
        <Suspense fallback={null}>
          <SceneBackgroundSolid background={background} />

          <ambientLight intensity={lights.ambient.intensity} color={lights.ambient.color} />
          <directionalLight
            intensity={lights.directional.intensity}
            color={lights.directional.color}
            position={lights.directional.position}
            castShadow
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-20}
            shadow-camera-right={20}
            shadow-camera-top={20}
            shadow-camera-bottom={-20}
          />
          <hemisphereLight intensity={0.3} groundColor="#1a1a2e" color="#ffffff" />

          {/* Grelha — só no editor */}
          {!isGameMode && grid.visible && (
            <Grid position={[0, 0, 0]} args={[grid.size, grid.divisions]} cellColor={grid.color} sectionColor={grid.color} sectionThickness={1.2} cellThickness={0.6} fadeDistance={30} fadeStrength={1} />
          )}
          {!isGameMode && <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={40} blur={2.5} far={5} />}

          {/* Objetos do catálogo */}
          {activeScene.objects.map((instance) => {
            const obj = objects.find((o) => o.id === instance.objectId)
            if (!obj) return null
            const sceneObj = { ...obj, id: instance.instanceId, position: instance.position, rotation: instance.rotation, scale: instance.scale }
            const isSelected = !isGameMode && instance.instanceId === selectedInstanceId
            const isPlayer = instance.instanceId === activeScene.playerObjectId
            return (
              <group key={instance.instanceId}>
                <SceneObject ref={(node) => setMeshRef(instance.instanceId, node)} obj={sceneObj} isSelected={isSelected} onSelect={() => selectObject(instance.instanceId)} />
                {isPlayer && !isGameMode && <PlayerMarker position={instance.position} />}
              </group>
            )
          })}

          {/* Conects */}
          {(activeScene.conects || []).map((conect) => (
            <ConectSelectorWrapper key={conect.instanceId} conect={conect} objects={objects} isSelected={!isGameMode && conect.instanceId === selectedInstanceId} onSelect={() => selectConectInstance(conect.instanceId)} setMeshRef={(node) => setConectMeshRef(conect.instanceId, node)} isGameMode={isGameMode} />
          ))}

          {/* GameCamera gizmo — só no editor */}
          {!isGameMode && !(activeScene.conects || []).some((c) => c.type === 'ViewObject') && (
            <GameCameraGizmo camera={activeScene.gameCamera} />
          )}

          {/* TransformControls — só no editor */}
          {!isGameMode && selectedMesh && selectedInstanceId && (
            <TransformControls object={selectedMesh} mode={transformMode} size={0.8}
              onMouseDown={() => { if (orbitRef.current) orbitRef.current.enabled = false }}
              onMouseUp={() => { if (orbitRef.current) orbitRef.current.enabled = true; handleTransformUpdate() }}
              onObjectChange={handleTransformUpdate}
            />
          )}

          {/* OrbitControls — só no editor */}
          {!isGameMode && (
            <OrbitControls ref={orbitRef} makeDefault enableDamping dampingFactor={0.08} minDistance={1} maxDistance={100} maxPolarAngle={Math.PI * 0.495}
              touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
            />
          )}

          {/* GameMode — activado quando scenePreviewOpen */}
          <GameMode activeScene={activeScene} objects={objects} meshRefs={meshRefs} conectMeshRefs={conectMeshRefs} isGameMode={isGameMode} />
        </Suspense>
      </Canvas>
    </div>
  )
}

function ConectSelectorWrapper({ conect, objects, isSelected, onSelect, setMeshRef, isGameMode }) {
  const handlePointerDown = (e) => {
    if (isGameMode) return
    e.stopPropagation()
    onSelect()
  }
  return (
    <group onPointerDown={handlePointerDown}>
      <ConectRenderer conect={conect} objects={objects} setMeshRef={setMeshRef} />
    </group>
  )
}

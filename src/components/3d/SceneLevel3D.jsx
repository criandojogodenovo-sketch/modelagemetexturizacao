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
import TerrainSculpt3D from './TerrainSculpt3D'
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

// ===== FogApplier — aplica FogObject à cena 3D =====
function FogApplier({ conects }) {
  const { scene } = useThree()
  const fogConect = (conects || []).find(c => c.type === 'FogObject')
  useEffect(() => {
    if (!fogConect) {
      scene.fog = null
      return
    }
    if (fogConect.fogType === 'exponential') {
      scene.fog = new THREE.FogExp2(fogConect.color || '#a0a0a0', fogConect.density || 0.02)
    } else {
      scene.fog = new THREE.Fog(fogConect.color || '#a0a0a0', fogConect.near || 5, fogConect.far || 50)
    }
  }, [fogConect?.fogType, fogConect?.color, fogConect?.near, fogConect?.far, fogConect?.density, scene])
  return null
}

// ===== InstancingRenderer — adiciona HardwareInstancingSystems à cena e atualiza por frame =====
function InstancingRenderer() {
  const { scene, camera } = useThree()
  const addedRef = useRef(new Set())

  useFrame(() => {
    const systems = window._flirInstancingSystems
    if (!systems || systems.length === 0) return
    for (const sys of systems) {
      // Adicionar à cena se ainda não foi adicionado
      if (!addedRef.current.has(sys)) {
        try {
          sys.addToScene(scene)
          addedRef.current.add(sys)
        } catch (e) {
          // já foi adicionado ou sistema dispuesto
        }
      }
      // Atualizar frustum culling + LOD + matrizes por instância
      try { sys.update(camera) } catch {}
    }
  })

  // Limpar ao desmontar
  useEffect(() => {
    return () => {
      for (const sys of addedRef.current) {
        try {
          for (const mesh of sys.instanceMeshes || []) {
            scene.remove(mesh)
          }
        } catch {}
      }
      addedRef.current.clear()
    }
  }, [scene])

  return null
}

// ===== TerrainSculptBridge — ativa escultura 3D no viewport quando um TerrainObject está selecionado =====
function TerrainSculptBridge({ activeScene, conectMeshRefs, isGameMode, onDragStateChange }) {
  // Procurar se há um TerrainObject selecionado e um modo de escultura ativo
  const terrainSculptActive = useStore((s) => s.terrainSculptActive)
  const terrainBrush = useStore((s) => s.terrainBrush)
  const selectedConectId = useStore((s) => s.selectedConectId)
  const updateConect = useStore((s) => s.updateConect)

  // Encontrar o TerrainObject atualmente selecionado
  const terrainConect = useMemo(() => {
    if (!activeScene?.conects || !selectedConectId) return null
    const c = activeScene.conects.find(c => c.instanceId === selectedConectId && c.type === 'TerrainObject')
    return c || null
  }, [activeScene, selectedConectId])

  const terrainMesh = useMemo(() => {
    if (!terrainConect) return null
    return conectMeshRefs.current.get(terrainConect.instanceId) || null
  }, [terrainConect, conectMeshRefs, activeScene])

  // Callback quando heightmap é alterado pela escultura 3D
  const handleHeightmapChange = useCallback((newHm) => {
    if (!terrainConect) return
    // Persistir alteração no conect
    updateConect(terrainConect.instanceId, {
      heightmap: Array.from(newHm),
    })
  }, [terrainConect, updateConect])

  if (!terrainSculptActive || !terrainConect || !terrainMesh || isGameMode) return null

  return (
    <TerrainSculpt3D
      terrainMesh={terrainMesh}
      heightmap={terrainConect.heightmap ? new Float32Array(terrainConect.heightmap) : null}
      seg={terrainConect.segments || 64}
      brushMode={terrainBrush?.mode || 'raise'}
      brushSize={terrainBrush?.size || 8}
      brushStrength={terrainBrush?.strength || 0.5}
      falloffType={terrainBrush?.falloff || 'smooth'}
      onHeightmapChange={handleHeightmapChange}
      onDragStateChange={onDragStateChange}
      isActive={terrainSculptActive}
    />
  )
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
  const inventoryRef = useRef({})
  const weaponStateRef = useRef({ equipped: false, ammo: 0, maxAmmo: 0, damage: 0, fireRate: 0.3, range: 50, reloadTime: 2, lastShot: 0 })
  const collisionEventsRef = useRef(new Map()) // instanceId → Set de otherIds em contacto
  const checkpointRef = useRef(null) // último checkpoint registado
  const skyRef = useRef(null) // referência ao SkyObject ativo

  // Expor meshRefs globalmente para TrailObject poder seguir objetos
  useEffect(() => {
    window._flirConectMeshRefs = conectMeshRefs
    window._flirMeshRefs = meshRefs
    return () => {
      window._flirConectMeshRefs = null
      window._flirMeshRefs = null
    }
  }, [conectMeshRefs, meshRefs])

  // P2.5 fix: armazenar a cena ativa num ref para que modificações feitas pelo
  // FlirCode (createObject, etc.) NÃO reiniciem o jogo (evita loop infinito).
  // O useEffect só deve correr quando isGameMode muda (true→false ou false→true),
  // não quando activeScene é modificado por spawnObject.
  const activeSceneRef = useRef(activeScene)
  const objectsRef = useRef(objects)
  const gameStartedRef = useRef(false)

  // Expor joystickRef globalmente para o GameUIOverlay poder atualizá-lo
  useEffect(() => {
    window._flirJoystick = joystickRef.current
    return () => { window._flirJoystick = null }
  }, [])

  // Use o ref para o setup
  const setupScene = activeSceneRef.current

  // Fase 5: Expor multiplayer globalmente e configurar sync de estado do PersonalObject
  useEffect(() => {
    if (!isGameMode) return
    let mp
    import('../../utils/multiplayer/multiplayerManager').then(({ multiplayer }) => {
      mp = multiplayer
      window._multiplayer = mp
      // Configurar getter de estado local (posição do PersonalObject)
      mp.setLocalStateGetter(() => {
        for (const conect of setupScene?.conects || []) {
          if (conect.type === 'PersonalObject') {
            const mesh = conectMeshRefs.current.get(conect.instanceId)
            if (mesh) {
              return {
                position: [mesh.position.x, mesh.position.y, mesh.position.z],
                rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
                playerId: mp.playerId,
              }
            }
          }
        }
        return null
      })
      // Registar callbacks para eventos multiplayer → FlirCode
      mp.on('playerJoin', (playerId) => {
        for (const rt of runtimesRef.current.values()) {
          rt.triggerEvent('onPlayerJoin', { playerId })
        }
      })
      mp.on('playerLeave', (playerId) => {
        for (const rt of runtimesRef.current.values()) {
          rt.triggerEvent('onPlayerLeave', { playerId })
        }
      })
      mp.on('message', (playerId, data) => {
        for (const rt of runtimesRef.current.values()) {
          rt.triggerEvent('onMessage', { playerId, data })
        }
      })
    })
    return () => {
      window._multiplayer = null
    }
  }, [isGameMode, setupScene])

  // Atualizar refs sem re-disparar o useEffect
  useEffect(() => {
    // Só atualizar o ref se o jogo ainda não começou OU se a cena mudou de verdade
    // (não por spawnObject, mas por mudança de cena manual via changeScene)
    if (!gameStartedRef.current || (activeScene && activeScene.id !== activeSceneRef.current?.id)) {
      activeSceneRef.current = activeScene
      objectsRef.current = objects
    } else {
      // Jogo em curso: manter o snapshot antigo, mas atualizar objects (para spawn)
      objectsRef.current = objects
    }
  }, [activeScene, objects])

  // Setup quando o modo jogo é activado
  useEffect(() => {
    if (!isGameMode || !setupScene) return
    gameStartedRef.current = true

    debugLog('Jogo iniciado', 'log', 'Game')

    // Criar gameContext
    const gameContext = {
      globalVars: { _score: 0 },
      // P2.5: setVar/getVar — expostos no gameContext para o FlirCode
      setVar: (name, value) => { gameContext.globalVars[name] = value },
      getVar: (name) => gameContext.globalVars[name] ?? 0,
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
        if (player) {
          // Usar blendTime do AnimationBoostObject se existir
          const boost = (setupScene?.conects || []).find((c) => c.type === 'AnimationBoostObject')
          player.play(clip, { loop: true, blendTime: boost?.blendTime ?? 0.3 })
        }
      },
      playSound: (url) => { try { new Audio(url).play() } catch {} },
      playSoundByName: (name) => {
        const sc = (setupScene.conects || []).find((c) => c.type === 'SoundObject' && c.name === name)
        if (sc && sc.url) { try { const a = new Audio(sc.url); a.volume = sc.volume ?? 1; a.loop = sc.loop || false; a.play() } catch {} }
      },
      destroyObject: (instanceId) => {
        const mesh = meshRefs.current.get(instanceId) || conectMeshRefs.current.get(instanceId)
        if (mesh) mesh.visible = false
      },
      spawnObject: (objectName, position) => {
        const obj = objectsRef.current.find((o) => o.name === objectName)
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
        // Procurar em uiScreens
        for (const s of useStore.getState().uiScreens) {
          const el = s.elements.find((e) => e.name === name)
          if (el) return el.value ?? el.text ?? ''
        }
        // Procurar em Conects de UI (TextObject, ButtonObject)
        const scene = useStore.getState().scenes.find((s) => s.id === useStore.getState().activeSceneId)
        const conect = (scene?.conects || []).find((c) => c.name === name && (c.type === 'TextObject' || c.type === 'ButtonObject'))
        if (conect) return conect.text ?? conect.label ?? conect.value ?? ''
        return ''
      },
      setUIValue: (name, val) => {
        // Procurar em uiScreens
        for (const s of useStore.getState().uiScreens) {
          const el = s.elements.find((e) => e.name === name)
          if (el) { useStore.getState().updateUIElement(el.id, { value: val, text: val, label: val }); return }
        }
        // Procurar em Conects de UI (TextObject, ButtonObject)
        const state = useStore.getState()
        const scene = state.scenes.find((s) => s.id === state.activeSceneId)
        if (scene) {
          const conect = (scene.conects || []).find((c) => c.name === name && (c.type === 'TextObject' || c.type === 'ButtonObject'))
          if (conect) {
            state.updateConect(conect.instanceId, { text: String(val), label: String(val) })
            return
          }
        }
      },
      triggerUIEvent: (eventName, payload) => {
        for (const rt of runtimesRef.current.values()) rt.triggerEvent(eventName, payload)
      },
      collidingWith: (instanceId, type) => {
        if (!physicsRef.current) return false
        // Usar contactos reais do cannon-es em vez de distância
        const contacts = physicsRef.current.getContacts?.(instanceId)
        if (contacts && contacts.length > 0) {
          for (const otherId of contacts) {
            const otherEntry = physicsRef.current.bodies.get(otherId)
            if (!otherEntry) continue
            if (otherEntry.conect.type === type || otherEntry.conect.name === type) {
              return true
            }
          }
          return false
        }
        // Fallback: usar eventos de colisão registados
        const collisionSet = collisionEventsRef.current.get(instanceId)
        if (collisionSet && collisionSet.size > 0) {
          for (const otherId of collisionSet) {
            const otherEntry = physicsRef.current.bodies.get(otherId)
            if (!otherEntry) continue
            if (otherEntry.conect.type === type || otherEntry.conect.name === type) {
              return true
            }
          }
        }
        return false
      },
      distanceTo: (instanceId, targetName) => {
        // P2.5: procurar em objects E conects da cena ativa
        for (const inst of setupScene.objects || []) {
          const obj = objectsRef.current.find((o) => o.id === inst.objectId)
          if (obj && (obj.name === targetName || inst.name === targetName)) {
            const target = meshRefs.current.get(inst.instanceId)
            const source = meshRefs.current.get(instanceId) || conectMeshRefs.current.get(instanceId)
            if (source && target) return source.position.distanceTo(target.position)
          }
        }
        for (const conect of setupScene.conects || []) {
          if (conect.name === targetName) {
            const target = conectMeshRefs.current.get(conect.instanceId)
            const source = meshRefs.current.get(instanceId) || conectMeshRefs.current.get(instanceId)
            if (source && target) return source.position.distanceTo(target.position)
          }
        }
        return 0
      },
      isTouching: () => joystickRef.current.active,
      // Fase 5: Multiplayer functions
      sendMessage: (data) => {
        try {
          const mp = window._multiplayer
          if (mp && mp.connected) mp.sendMessage(data)
        } catch {}
      },
      getPlayers: () => {
        const mp = window._multiplayer
        return mp && mp.connected ? mp.getOtherPlayers().length + 1 : 1
      },
      getPlayerState: (playerId) => {
        const mp = window._multiplayer
        return mp && mp.connected ? mp.getPlayerState(playerId) : null
      },

      // ===== Inventário (ItemObject auto-pickup) =====
      addToInventory: (itemName, qty = 1) => {
        inventoryRef.current[itemName] = (inventoryRef.current[itemName] || 0) + qty
        window._flirInventory = inventoryRef.current
        debugLog(`Item "${itemName}" adicionado (total: ${inventoryRef.current[itemName]})`, 'log', 'Inventory')
      },
      removeFromInventory: (itemName, qty = 1) => {
        if (!inventoryRef.current[itemName]) return
        inventoryRef.current[itemName] = Math.max(0, inventoryRef.current[itemName] - qty)
        if (inventoryRef.current[itemName] === 0) delete inventoryRef.current[itemName]
        window._flirInventory = inventoryRef.current
      },
      getInventoryCount: (itemName) => inventoryRef.current[itemName] || 0,
      hasItem: (itemName) => (inventoryRef.current[itemName] || 0) > 0,

      // ===== Combate (WeaponObject) =====
      equipWeapon: (damage, ammo, fireRate, range, reloadTime) => {
        weaponStateRef.current = {
          equipped: true,
          ammo, maxAmmo: ammo,
          damage: damage || 10,
          fireRate: fireRate || 0.3,
          range: range || 50,
          reloadTime: reloadTime || 2,
          lastShot: 0,
        }
        window._flirCrosshair = true
        debugLog(`Arma equipada (dano: ${damage}, munições: ${ammo})`, 'log', 'Weapon')
      },
      shoot: () => {
        const w = weaponStateRef.current
        if (!w.equipped || w.ammo <= 0) return false
        const now = performance.now() / 1000
        if (now - w.lastShot < w.fireRate) return false
        w.lastShot = now
        w.ammo--
        // Raycast da câmara para detetar hit
        const raycaster = new THREE.Raycaster()
        raycaster.setFromCamera({ x: 0, y: 0 }, camera)
        raycaster.far = w.range
        debugLog(`Disparo! Munições restantes: ${w.ammo}`, 'log', 'Weapon')
        return true
      },
      reload: () => {
        const w = weaponStateRef.current
        if (!w.equipped) return
        w.ammo = w.maxAmmo
        debugLog('Arma recarregada', 'log', 'Weapon')
      },
      getAmmo: () => weaponStateRef.current.ammo,

      // ===== Combate (saúde) =====
      takeDamage: (instanceId, amount) => {
        // Reduzir "saúde" via globalVar _health
        const health = gameContext.getVar('_health_' + instanceId)
        gameContext.setVar('_health_' + instanceId, Math.max(0, (health || 100) - amount))
        debugLog(`${instanceId} sofreu ${amount} de dano (saúde: ${gameContext.getVar('_health_' + instanceId)})`, 'log', 'Combat')
      },
      getHealth: (instanceId) => gameContext.getVar('_health_' + instanceId) || 100,

      // ===== Sinais =====
      emitSignal: (name, data) => {
        for (const rt of runtimesRef.current.values()) {
          rt.triggerEvent('onSignal', { name, data })
        }
        debugLog(`Sinal "${name}" emitido`, 'log', 'Signal')
      },

      // ===== Estado de jogo =====
      _gameState: 'menu',
      setGameState: (s) => { gameContext._gameState = s; debugLog('Game State: ' + s, 'log', 'GameState'); for (const rt of runtimesRef.current.values()) { rt.triggerEvent('onGameStateChange', { state: s }) } },
      getGameState: () => gameContext._gameState,

      // ===== Save/Load =====
      saveProgress: (key, val) => { try { localStorage.setItem('flir_progress_' + key, JSON.stringify(val)); debugLog('Progresso guardado: ' + key, 'log', 'Save') } catch (e) {} },
      loadProgress: (key) => { try { const v = localStorage.getItem('flir_progress_' + key); return v ? JSON.parse(v) : null } catch (e) { return null } },

      // ===== Sequenciador =====
      playSequence: (name) => { debugLog('Sequência "' + name + '" iniciada', 'log', 'Sequence') },

      // ===== Câmara (FPS/BR) =====
      getCameraRotation: () => {
        if (window._flirCameraRotation) return { yaw: window._flirCameraRotation.yaw, pitch: window._flirCameraRotation.pitch }
        return { yaw: 0, pitch: 0 }
      },
      setCameraSensitivity: (value) => {
        if (window._flirCameraRotation) window._flirCameraRotation.sensitivity = value
      },

      // ===== Checkpoint — respawn =====
      respawnAtCheckpoint: () => {
        if (!checkpointRef.current) {
          // Tentar carregar do localStorage
          try {
            const saved = localStorage.getItem('flir_checkpoint')
            if (saved) checkpointRef.current = JSON.parse(saved)
          } catch (e) {}
        }
        if (checkpointRef.current) {
          const player = (setupScene?.conects || []).find((c) => c.type === 'PersonalObject')
          if (player) {
            const playerMesh = conectMeshRefs.current.get(player.instanceId)
            if (playerMesh) {
              playerMesh.position.set(...checkpointRef.current.position)
              if (physicsRef.current) {
                physicsRef.current.bodies.get(player.instanceId)?.body?.position.set(...checkpointRef.current.position)
              }
              debugLog('Respawn no checkpoint!', 'log', 'Checkpoint')
            }
          }
        }
      },
      getLastCheckpoint: () => checkpointRef.current,

      // ===== Roguelike — run progress + geração de salas =====
      _runState: { runId: 0, seed: 0, started: false },
      startNewRun: () => {
        const newSeed = Math.floor(Math.random() * 99999) + 1
        gameContext._runState.runId += 1
        gameContext._runState.seed = newSeed
        gameContext._runState.started = true
        debugLog(`Nova run iniciada — Run #${gameContext._runState.runId}, Seed: ${newSeed}`, 'log', 'Roguelike')

        // Procurar RoguelikeGenerator na cena
        const roguelikeGen = (setupScene.conects || []).find((c) => c.type === 'RoguelikeGenerator')
        if (roguelikeGen) {
          // PRNG mulberry32 — determinístico por seed
          let _s = newSeed >>> 0
          const rng = () => {
            _s = (_s + 0x6D2B79F5) >>> 0
            let t = _s
            t = Math.imul(t ^ (t >>> 15), t | 1)
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296
          }
          const roomCount = roguelikeGen.roomCount || 5
          const gridSize = roguelikeGen.gridSize || 12
          const roomPrefabs = roguelikeGen.roomPrefabs || []

          debugLog(`A gerar ${roomCount} salas com seed ${newSeed}...`, 'log', 'Roguelike')

          // Layout simples: salas em linha com corredores
          for (let i = 0; i < roomCount; i++) {
            const x = i * gridSize
            const z = (rng() - 0.5) * gridSize * 0.5 // variação Z
            // Se há prefabs de sala, instanciar um aleatório
            if (roomPrefabs.length > 0) {
              const prefabId = roomPrefabs[Math.floor(rng() * roomPrefabs.length)]
              const prefabObj = (setupScene.conects || []).find((c) => c.instanceId === prefabId)
              if (prefabObj && prefabObj.prefabData) {
                // Expandir prefab na posição gerada
                try {
                  const prefabData = typeof prefabObj.prefabData === 'string'
                    ? JSON.parse(prefabObj.prefabData)
                    : prefabObj.prefabData
                  for (const child of prefabData) {
                    useStore.getState().addConectToScene(child.type, [
                      x + (child.position?.[0] || 0),
                      child.position?.[1] || 0,
                      z + (child.position?.[2] || 0),
                    ])
                  }
                } catch (e) {}
              }
            } else {
              // Sem prefabs: gerar sala simples (cubo oco com porta)
              useStore.getState().addConectToScene('StaticObject', [x, 0, z])
            }
            // Corredor entre salas (exceto última)
            if (i < roomCount - 1) {
              useStore.getState().addConectToScene('StaticObject', [x + gridSize / 2, 0, z])
            }
          }
          debugLog(`Geração concluída: ${roomCount} salas + ${roomCount - 1} corredores`, 'log', 'Roguelike')
        }

        gameContext.emitSignal('roguelike:generate', { runId: gameContext._runState.runId, seed: newSeed })
        return gameContext._runState
      },
      getRunSeed: () => gameContext._runState.seed,
      getRunId: () => gameContext._runState.runId,
      endRun: () => {
        debugLog(`Run #${gameContext._runState.runId} terminada`, 'log', 'Roguelike')
        gameContext._runState.started = false
        gameContext.emitSignal('roguelike:end', { runId: gameContext._runState.runId })
      },

      // ===== linkTo — navegação (scene/screen/url) =====
      linkTo: (target, sub) => {
        if (target === 'scene') {
          const sc = (useStore.getState().scenes || []).find((s) => s.name === sub || s.id === sub)
          if (sc) {
            useStore.getState().setActiveScene(sc.id)
            debugLog(`linkTo: cena mudou para "${sc.name}"`, 'log', 'Links')
          } else {
            debugLog(`linkTo: cena "${sub}" não encontrada`, 'error', 'Links')
          }
        } else if (target === 'screen') {
          const screens = useStore.getState().uiScreens || []
          for (const s of screens) {
            s.visible = (s.name === sub || s.id === sub)
          }
          useStore.setState({ uiScreens: [...screens] })
          debugLog(`linkTo: tela "${sub}" visível`, 'log', 'Links')
        } else if (target === 'url') {
          window.open(sub, '_blank')
          debugLog(`linkTo: URL "${sub}" aberta`, 'log', 'Links')
        }
      },

      // ===== Controlo de luzes por script =====
      setLightIntensity: (lightName, intensity) => {
        // Procurar luzes na cena com este nome
        for (const [id, mesh] of conectMeshRefs.current) {
          if (mesh && mesh.name === lightName) {
            // Procurar luzes dentro do mesh/group
            mesh.traverse((child) => {
              if (child.isDirectionalLight || child.isPointLight || child.isSpotLight || child.isAmbientLight) {
                child.intensity = intensity
              }
            })
            debugLog(`Luz "${lightName}" intensidade → ${intensity}`, 'log', 'Light')
            return
          }
        }
        // Também procurar por nome do conect
        const lightConect = (setupScene.conects || []).find((c) => c.name === lightName)
        if (lightConect) {
          const mesh = conectMeshRefs.current.get(lightConect.instanceId)
          if (mesh) {
            mesh.traverse((child) => {
              if (child.isDirectionalLight || child.isPointLight || child.isSpotLight || child.isAmbientLight) {
                child.intensity = intensity
              }
            })
            debugLog(`Luz "${lightName}" intensidade → ${intensity}`, 'log', 'Light')
          }
        }
      },
      setLightColor: (lightName, color) => {
        const c = new THREE.Color(color)
        for (const [id, mesh] of conectMeshRefs.current) {
          if (mesh && mesh.name === lightName) {
            mesh.traverse((child) => {
              if (child.isDirectionalLight || child.isPointLight || child.isSpotLight || child.isAmbientLight) {
                child.color.copy(c)
              }
            })
            debugLog(`Luz "${lightName}" cor → ${color}`, 'log', 'Light')
            return
          }
        }
        const lightConect = (setupScene.conects || []).find((c) => c.name === lightName)
        if (lightConect) {
          const mesh = conectMeshRefs.current.get(lightConect.instanceId)
          if (mesh) {
            mesh.traverse((child) => {
              if (child.isDirectionalLight || child.isPointLight || child.isSpotLight || child.isAmbientLight) {
                child.color.copy(c)
              }
            })
            debugLog(`Luz "${lightName}" cor → ${color}`, 'log', 'Light')
          }
        }
      },
      setLightVisible: (lightName, visible) => {
        for (const [id, mesh] of conectMeshRefs.current) {
          if (mesh && mesh.name === lightName) {
            mesh.traverse((child) => {
              if (child.isDirectionalLight || child.isPointLight || child.isSpotLight || child.isAmbientLight) {
                child.visible = visible
              }
            })
            return
          }
        }
        const lightConect = (setupScene.conects || []).find((c) => c.name === lightName)
        if (lightConect) {
          const mesh = conectMeshRefs.current.get(lightConect.instanceId)
          if (mesh) {
            mesh.traverse((child) => {
              if (child.isDirectionalLight || child.isPointLight || child.isSpotLight || child.isAmbientLight) {
                child.visible = visible
              }
            })
          }
        }
      },
    }
    window._flirGameContext = gameContext
    window._flirInventory = inventoryRef.current

    // Física
    const gravity = setupScene.physics?.gravity || [0, -9.82, 0]
    physicsRef.current = createPhysicsSystem({ gravity: gravity[1] })

    // Registar conects com física
    setTimeout(() => {
      if (!physicsRef.current) return
      for (const conect of setupScene.conects || []) {
        const mesh = conectMeshRefs.current.get(conect.instanceId)
        if (mesh) physicsRef.current.addConect(conect, mesh)
      }
      for (const conect of setupScene.conects || []) {
        if (conect.type === 'JointObject' && conect.targetA && conect.targetB) {
          physicsRef.current.addJoint(conect)
        }
      }
    }, 50)

    // Eventos de física
    physicsRef.current.on('onCollision', ({ instanceId, otherInstanceId }) => {
      // Registar colisão para collidingWith()
      if (!collisionEventsRef.current.has(instanceId)) {
        collisionEventsRef.current.set(instanceId, new Set())
      }
      collisionEventsRef.current.get(instanceId).add(otherInstanceId)
      // Limitar tempo de vida do contacto (expira em 0.5s se não renovado)
      setTimeout(() => {
        const set = collisionEventsRef.current.get(instanceId)
        if (set) set.delete(otherInstanceId)
      }, 500)

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
    const setupRuntime = (instance, scriptData, scriptField) => {
      if (!scriptData) return
      try {
        let source = null
        if (typeof scriptData === 'string') {
          // Suportar ambos: "FLIRCODE:codigo" e código direto (flirCode field)
          if (scriptData.startsWith('FLIRCODE:')) {
            source = scriptData.slice(9)
          } else {
            source = scriptData
          }
        } else if (typeof scriptData === 'object') {
          // FlirScript (grafo de nós)
          const errors = validateGraph(scriptData)
          if (errors.length > 0) return
          const rt = createFlirScriptRuntime(scriptData, gameContext)
          rt.graph.nodes.forEach((n) => { n._instanceId = instance.instanceId })
          runtimesRef.current.set(instance.instanceId, rt)
          rt.triggerEvent('beginPlay')
          return
        }
        if (source) {
          const rt = createFlirCodeRuntime(source, { ...gameContext, _instanceId: instance.instanceId, mesh: conectMeshRefs.current.get(instance.instanceId) || meshRefs.current.get(instance.instanceId) })
          if (!rt.hasErrors) {
            runtimesRef.current.set(instance.instanceId, rt)
            rt.triggerEvent('beginPlay')
          } else {
            debugLog(`Erros no FlirCode de ${instance.name || instance.type}: ${rt.errors.length}`, 'warn', 'Script')
          }
        }
      } catch (err) {
        debugLog('Erro ao inicializar script: ' + err.message, 'error', 'Script')
      }
    }
    // Registar runtimes: tentar flirScript primeiro, depois flirCode
    for (const inst of setupScene.objects || []) {
      setupRuntime(inst, inst.flirScript || inst.flirCode)
    }
    for (const conect of setupScene.conects || []) {
      setupRuntime(conect, conect.flirScript || conect.flirCode)
    }

    // Animation players — ler AnimationBoostObject para blendTime
    const boostConect = (setupScene.conects || []).find((c) => c.type === 'AnimationBoostObject')
    const boostBlendTime = boostConect?.blendTime ?? 0.3
    const boostQuality = boostConect?.interpolationQuality ?? 'normal'
    for (const inst of [...(setupScene.objects || []), ...(setupScene.conects || [])]) {
      if (inst.animations && Object.keys(inst.animations).length > 0) {
        const player = createAnimationPlayer(inst.animations, () => meshRefs.current.get(inst.instanceId) || conectMeshRefs.current.get(inst.instanceId), () => null)
        animPlayersRef.current.set(inst.instanceId, player)
        if (inst.animations.idle) player.play('idle', { loop: true, blendTime: boostBlendTime })
        else { const f = Object.keys(inst.animations)[0]; if (f) player.play(f, { loop: true, blendTime: boostBlendTime }) }
      }
    }

    // NPC AI
    for (const conect of setupScene.conects || []) {
      if (conect.type === 'NpcObject') {
        const ai = createNPCAI(conect, {
          getPlayerPos: () => {
            const player = (setupScene.conects || []).find((c) => c.type === 'PersonalObject')
            if (!player) return null
            const pm = conectMeshRefs.current.get(player.instanceId)
            return pm ? [pm.position.x, pm.position.y, pm.position.z] : null
          },
          getPathPoints: (pathId) => {
            const path = (setupScene.conects || []).find((c) => c.instanceId === pathId)
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
    for (const conect of setupScene.conects || []) {
      if (conect.type === 'TimerObject' && conect.autoStart) {
        timerStatesRef.current.set(conect.instanceId, { remaining: conect.duration || 5, loop: conect.loop || false, duration: conect.duration || 5 })
      }
    }

    // PrefabObject — expandir prefabs na cena (instanciar objetos do prefabData)
    for (const conect of setupScene.conects || []) {
      if (conect.type === 'PrefabObject' && conect.prefabData && Array.isArray(conect.prefabData)) {
        try {
          const prefabData = typeof conect.prefabData === 'string'
            ? JSON.parse(conect.prefabData)
            : conect.prefabData
          for (const childConect of prefabData) {
            // Instanciar cada conect do prefab na posição relativa ao PrefabObject
            const newConect = {
              ...childConect,
              instanceId: `prefab_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
              position: [
                (conect.position?.[0] || 0) + (childConect.position?.[0] || 0),
                (conect.position?.[1] || 0) + (childConect.position?.[1] || 0),
                (conect.position?.[2] || 0) + (childConect.position?.[2] || 0),
              ],
            }
            // Adicionar à cena via store (para que ConectRenderer o renderize)
            useStore.getState().addConectToScene(newConect.type, newConect.position)
          }
          debugLog(`Prefab "${conect.name}" expandido (${prefabData.length} objetos)`, 'log', 'Prefab')
        } catch (e) {
          debugLog(`Erro ao expandir prefab: ${e.message}`, 'error', 'Prefab')
        }
      }
    }

    // SkyObject — aplicar fundo do céu à cena
    const skyConect = (setupScene.conects || []).find((c) => c.type === 'SkyObject')
    if (skyConect) {
      // O SkyMesh no ConectRenderer trata do visual (esfera com shader)
      // Aqui garantimos que o background da cena não tapa o sky
      skyRef.current = skyConect
    }

    // FogObject — aplicar névoa à cena (via FogApplier que já existe no render)
    const fogConect = (setupScene.conects || []).find((c) => c.type === 'FogObject')
    // FogApplier no render trata disto — basta existir na cena

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
      gameStartedRef.current = false
    }
  }, [isGameMode, setupScene])

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

    // Actualizar variáveis de posição do jogador para FlirCode
    const playerConect = (setupScene?.conects || []).find((c) => c.type === 'PersonalObject')
    if (playerConect) {
      const playerMesh = conectMeshRefs.current.get(playerConect.instanceId)
      if (playerMesh) {
        gameContext.setVar('_player_x', playerMesh.position.x)
        gameContext.setVar('_player_y', playerMesh.position.y)
        gameContext.setVar('_player_z', playerMesh.position.z)
        gameContext.setVar('_y_pos', playerMesh.position.y)
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

    // CheckpointObject — registar checkpoint quando jogador toca
    const player3 = (setupScene?.conects || []).find((c) => c.type === 'PersonalObject')
    if (player3) {
      const playerMesh = conectMeshRefs.current.get(player3.instanceId)
      if (playerMesh) {
        for (const cp of setupScene?.conects || []) {
          if (cp.type === 'CheckpointObject') {
            const cpMesh = conectMeshRefs.current.get(cp.instanceId)
            if (cpMesh && cpMesh.visible !== false) {
              const dist = playerMesh.position.distanceTo(cpMesh.position)
              if (dist <= (cp.triggerRadius || 2)) {
                // Registar checkpoint
                checkpointRef.current = {
                  position: [cpMesh.position.x, cpMesh.position.y, cpMesh.position.z],
                  sceneId: setupScene.id,
                }
                // Guardar no localStorage
                try {
                  localStorage.setItem('flir_checkpoint', JSON.stringify(checkpointRef.current))
                } catch (e) {}
                // Disparar evento
                const rt = runtimesRef.current.get(cp.instanceId)
                if (rt) rt.triggerEvent('onCheckpoint', { position: checkpointRef.current.position })
                debugLog('Checkpoint atingido!', 'log', 'Checkpoint')
              }
            }
          }
        }
      }
    }
    if (player3) {
      const playerMesh = conectMeshRefs.current.get(player3.instanceId)
      if (playerMesh) {
        for (const nav of setupScene?.conects || []) {
          if (nav.type === 'NavigatorObject' && nav.targetSceneId) {
            const navMesh = conectMeshRefs.current.get(nav.instanceId)
            if (navMesh && navMesh.visible !== false) {
              const dist = playerMesh.position.distanceTo(navMesh.position)
              if (dist <= (nav.triggerRadius || 2)) {
                // Transportar para a cena de destino
                debugLog(`Portal ativado! A mudar para cena ${nav.targetSceneId}`, 'log', 'Navigator')
                useStore.getState().closeScenePreview()
                setTimeout(() => {
                  useStore.getState().setActiveScene(nav.targetSceneId)
                  useStore.getState().openScenePreview()
                }, (nav.transitionDuration || 0.5) * 1000)
                break
              }
            }
          }
        }
      }
    }

    // ItemObject — auto-pickup quando jogador próximo
    if (player3) {
      const playerMesh = conectMeshRefs.current.get(player3.instanceId)
      if (playerMesh) {
        for (const item of setupScene?.conects || []) {
          if (item.type === 'ItemObject' && item.autoPickup !== false) {
            const itemMesh = conectMeshRefs.current.get(item.instanceId)
            if (itemMesh && itemMesh.visible !== false) {
              const dist = playerMesh.position.distanceTo(itemMesh.position)
              if (dist <= (item.pickupRadius || 2)) {
                // Apanhar item
                if (gameContext.addToInventory) {
                  gameContext.addToInventory(item.itemName || 'Item', item.quantity || 1)
                }
                itemMesh.visible = false
                debugLog(`Item "${item.itemName}" apanhado!`, 'log', 'Inventory')
              }
            }
          }
        }
      }
    }

    // SpawnObject — spawning temporal de objetos
    for (const spawn of setupScene?.conects || []) {
      if (spawn.type === 'SpawnObject' && spawn.autoStart !== false && spawn.objectToSpawn) {
        if (!timerStatesRef.current.has(spawn.instanceId + '_spawn')) {
          timerStatesRef.current.set(spawn.instanceId + '_spawn', {
            remaining: spawn.interval || 3,
            duration: spawn.interval || 3,
            loop: true,
          })
        }
        const st = timerStatesRef.current.get(spawn.instanceId + '_spawn')
        st.remaining -= delta
        if (st.remaining <= 0) {
          st.remaining = st.duration
          // Spawn do objeto
          const spawnMesh = conectMeshRefs.current.get(spawn.instanceId)
          const spawnPos = spawnMesh
            ? [spawnMesh.position.x, spawnMesh.position.y, spawnMesh.position.z]
            : spawn.position || [0, 1, 0]
          gameContext.spawnObject(spawn.objectToSpawn, spawnPos)
          debugLog(`Spawn: "${spawn.objectToSpawn}" em ${spawnPos}`, 'log', 'Spawn')
        }
      }
    }

    // GroupObject — aplicar parenting
    for (const grp of setupScene?.conects || []) {
      if (grp.type === 'GroupObject' && grp.children && grp.children.length > 0) {
        const groupMesh = conectMeshRefs.current.get(grp.instanceId)
        if (groupMesh && !groupMesh.userData._grouped) {
          for (const childId of grp.children) {
            const childMesh = conectMeshRefs.current.get(childId) || meshRefs.current.get(childId)
            if (childMesh && childMesh.parent !== groupMesh) {
              groupMesh.attach(childMesh)
            }
          }
          groupMesh.userData._grouped = true
        }
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
  const [isTerrainSculptDragging, setIsTerrainSculptDragging] = useState(false)

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
          <div style={{ fontSize: 32, opacity: 0.4 }}></div>
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
          <FogApplier conects={activeScene?.conects} />

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
            <TransformControls object={selectedMesh} mode={transformMode} size={1.2}
              onMouseDown={() => { if (orbitRef.current) orbitRef.current.enabled = false }}
              onMouseUp={() => { if (orbitRef.current) orbitRef.current.enabled = true; handleTransformUpdate() }}
              onObjectChange={handleTransformUpdate}
            />
          )}

          {/* OrbitControls — só no editor */}
          {!isGameMode && (
            <OrbitControls ref={orbitRef} makeDefault enableDamping dampingFactor={0.08} minDistance={1} maxDistance={100} maxPolarAngle={Math.PI * 0.495}
              touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
              enabled={!isTerrainSculptDragging}
            />
          )}

          {/* Terrain Sculpt 3D — raycast + cursor + aplicação em tempo real */}
          <TerrainSculptBridge
            activeScene={activeScene}
            conectMeshRefs={conectMeshRefs}
            isGameMode={isGameMode}
            onDragStateChange={setIsTerrainSculptDragging}
          />

          {/* Hardware Instancing renderer — busca sistemas de window._flirInstancingSystems */}
          <InstancingRenderer />

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

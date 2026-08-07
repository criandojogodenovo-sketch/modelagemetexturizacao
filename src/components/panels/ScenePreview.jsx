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
import { createFlirScriptRuntime, validateGraph } from '../../utils/flirscript/executor'
import { createPhysicsSystem } from '../../utils/conects/physicsSystem'

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

// Runner que integra física + FlirScript
function GameRunner({ activeScene, meshRefs, conectMeshRefs, objects }) {
  const { camera } = useThree()
  const physicsRef = useRef(null)
  const runtimesRef = useRef(new Map()) // FlirScript runtimes por conect.instanceId
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
        console.log(`[FlirScript] playAnimation: ${instanceId} → ${clip}`)
      },
      playSound: (soundUrl) => {
        try {
          const audio = new Audio(soundUrl)
          audio.play().catch(() => {})
        } catch {}
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
    }

    // Registar conects com física
    setTimeout(() => {
      if (!physicsRef.current) return
      for (const conect of activeScene.conects || []) {
        const mesh = conectMeshRefs.current.get(conect.instanceId)
        if (mesh) {
          physicsRef.current.addConect(conect, mesh)
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

    // Criar runtimes FlirScript para objetos com script
    for (const instance of activeScene.objects || []) {
      if (instance.flirScript) {
        const errors = validateGraph(instance.flirScript)
        if (errors.length > 0) continue
        try {
          const rt = createFlirScriptRuntime(instance.flirScript, gameContext)
          rt.graph.nodes.forEach((n) => { n._instanceId = instance.instanceId })
          runtimesRef.current.set(instance.instanceId, rt)
          rt.triggerEvent('beginPlay')
        } catch (err) {
          console.error('[FlirScript] Erro:', err)
        }
      }
    }
    // E para conects com script
    for (const conect of activeScene.conects || []) {
      if (conect.flirScript) {
        const errors = validateGraph(conect.flirScript)
        if (errors.length > 0) continue
        try {
          const rt = createFlirScriptRuntime(conect.flirScript, gameContext)
          rt.graph.nodes.forEach((n) => { n._instanceId = conect.instanceId })
          runtimesRef.current.set(conect.instanceId, rt)
          rt.triggerEvent('beginPlay')
        } catch (err) {
          console.error('[FlirScript] Erro:', err)
        }
      }
    }

    // Auto-start timers e spawns
    for (const conect of activeScene.conects || []) {
      if (conect.type === 'TimerObject' && conect.autoStart) {
        setTimeout(() => {
          const rt = runtimesRef.current.get(conect.instanceId)
          // Trigger onTimer event (simplificado: chama beginPlay)
          if (rt) rt.triggerEvent('beginPlay')
        }, (conect.duration || 5) * 1000)
      }
    }

    return () => {
      for (const rt of runtimesRef.current.values()) rt.dispose()
      runtimesRef.current.clear()
      physicsRef.current?.dispose()
      physicsRef.current = null
    }
  }, [activeScene, objects])

  // Loop principal: física + tick + joystick → player + camera follow
  useFrame((_, delta) => {
    if (physicsRef.current) {
      physicsRef.current.update(delta)
    }

    // Disparar Tick nos runtimes FlirScript
    for (const rt of runtimesRef.current.values()) {
      rt.update(delta)
      rt.triggerEvent('tick', { deltaTime: delta })
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

    // ViewObject seguir jogador
    const viewConect = (activeScene.conects || []).find((c) => c.type === 'ViewObject' && c.followTarget && c.followMode !== 'none')
    if (viewConect) {
      const targetMesh = meshRefs.current.get(viewConect.followTarget) || conectMeshRefs.current.get(viewConect.followTarget)
      if (targetMesh) {
        const mode = viewConect.followMode
        const dist = viewConect.followDistance || 6
        const height = viewConect.followHeight || 3
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
  const [useGameCam, setUseGameCam] = useState(false)
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

  // Se há ViewObject, usá-lo como câmara em vez da orbital
  const viewConect = (activeScene.conects || []).find((c) => c.type === 'ViewObject')
  const useOrbital = !viewConect || !useGameCam

  // Configuração de câmara: usar ViewObject se disponível, senão gameCamera da cena
  const cam = viewConect || activeScene.gameCamera
  const cameraProps = (cam.cameraType || cam.type) === 'orthographic'
    ? { type: 'orthographic', position: cam.position || [5, 4, 6], near: cam.near || 0.1, far: cam.far || 200, zoom: 5 / (cam.orthoSize || 5) }
    : { type: 'perspective', position: cam.position || [5, 4, 6], fov: cam.fov || 60, near: cam.near || 0.1, far: cam.far || 200 }

  return (
    <div className="scene-preview-fullscreen">
      <button
        className="preview-exit-btn"
        onClick={closeScenePreview}
        title="Sair da pré-visualização (Esc)"
      >
        <IconClose width={18} height={18} />
        <span>Sair</span>
      </button>

      {viewConect && (
        <button
          className="preview-cam-btn"
          onClick={() => setUseGameCam(!useGameCam)}
          title={useGameCam ? 'Câmara orbital' : 'Câmara de jogo (ViewObject)'}
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
        shadows
        dpr={[1, 2]}
        camera={cameraProps}
        gl={{ antialias: true, alpha: false }}
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
        </Suspense>
      </Canvas>

      {/* UI Overlay: botões, joystick, texto, imagens */}
      <GameUIOverlay conects={activeScene.conects || []} />
    </div>
  )
}

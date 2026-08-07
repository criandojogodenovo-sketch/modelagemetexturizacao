/**
 * ScenePreview — modo de pré-visualização da cena em ecrã cheio.
 *
 * Mostra a cena ativa sem os painéis de edição, usando a gameCamera configurada.
 * O utilizador pode orbitar livremente ou alternar para a gameCamera.
 *
 * **Fase 2 — FlirScript**: quando a preview abre, instanciamos um runtime
 * FlirScript para cada objeto que tenha um grafo, e disparamos eventos
 * (BeginPlay no início, Tick a cada frame, OnCollision, OnTouch, etc.).
 *
 * Botão "Sair" no canto superior direito para voltar ao editor.
 */
import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import SceneObject from '../3d/SceneObject'
import { useStore } from '../../store/useStore'
import { IconClose, IconPlay } from '../ui/Icons'
import { createFlirScriptRuntime, validateGraph } from '../../utils/flirscript/executor'

// Marcador do jogador
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

// Componente que instancia e executa os grafos FlirScript de cada objeto
// Vive dentro do Canvas para ter acesso ao useFrame e useThree.
function FlirScriptRunner({ instances, meshRefs, objects, activeSceneId }) {
  const runtimesRef = useRef(new Map())
  const gameContextRef = useRef(null)
  const toast = useStore((s) => s.toast)

  // Constroi o gameContext (API que os nós FlirScript podem chamar)
  const buildGameContext = () => {
    return {
      globalVars: { _score: 0 },
      moveObject: (instanceId, direction, speed) => {
        const mesh = meshRefs.current.get(instanceId)
        if (!mesh) return
        const dt = 0.016 // aproximação
        mesh.position.x += direction[0] * speed * dt
        mesh.position.y += direction[1] * speed * dt
        mesh.position.z += direction[2] * speed * dt
        // Atualizar também no store para persistir
        useStore.getState().updateSceneInstance(instanceId, {
          position: [mesh.position.x, mesh.position.y, mesh.position.z],
        })
      },
      rotateObject: (instanceId, rotation) => {
        const mesh = meshRefs.current.get(instanceId)
        if (!mesh) return
        const dt = 0.016
        mesh.rotation.x += THREE.MathUtils.degToRad(rotation[0]) * dt
        mesh.rotation.y += THREE.MathUtils.degToRad(rotation[1]) * dt
        mesh.rotation.z += THREE.MathUtils.degToRad(rotation[2]) * dt
      },
      playAnimation: (instanceId, clip) => {
        // Fase 2: apenas log — integração real com o sistema de animação virá depois
        console.log(`[FlirScript] playAnimation: ${instanceId} → ${clip}`)
      },
      playSound: (soundUrl) => {
        try {
          const audio = new Audio(soundUrl)
          audio.play().catch(() => {})
        } catch {}
      },
      destroyObject: (instanceId) => {
        // Marcar para remoção no próximo frame
        const mesh = meshRefs.current.get(instanceId)
        if (mesh) mesh.visible = false
      },
      spawnObject: (objectName, position) => {
        const obj = objects.find((o) => o.name === objectName)
        if (obj) {
          useStore.getState().addObjectToScene(obj.id, position)
        }
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
        const mesh = meshRefs.current.get(instanceId)
        if (mesh) mesh.visible = visible
      },
    }
  }

  // Inicializar runtimes quando as instâncias mudam
  useEffect(() => {
    // Limpar runtimes antigos
    for (const rt of runtimesRef.current.values()) {
      rt.dispose()
    }
    runtimesRef.current.clear()

    if (!gameContextRef.current) {
      gameContextRef.current = buildGameContext()
    }

    // Criar runtime para cada instância que tenha flirScript
    for (const instance of instances) {
      if (instance.flirScript) {
        // Validar antes de executar
        const errors = validateGraph(instance.flirScript)
        if (errors.length > 0) {
          console.warn(`[FlirScript] Erros no grafo de ${instance.instanceId}:`, errors)
          continue
        }
        try {
          const rt = createFlirScriptRuntime(instance.flirScript, gameContextRef.current)
          // Marcar cada nó com o instanceId para que as ações saibam a que objeto se referem
          rt.graph.nodes.forEach((node) => {
            node._instanceId = instance.instanceId
          })
          runtimesRef.current.set(instance.instanceId, rt)
          // Disparar BeginPlay
          rt.triggerEvent('beginPlay')
        } catch (err) {
          console.error(`[FlirScript] Erro ao iniciar runtime de ${instance.instanceId}:`, err)
        }
      }
    }

    return () => {
      for (const rt of runtimesRef.current.values()) {
        rt.dispose()
      }
      runtimesRef.current.clear()
    }
  }, [instances, objects])

  // Tick a cada frame
  useFrame((_, delta) => {
    for (const rt of runtimesRef.current.values()) {
      rt.update(delta)
      rt.triggerEvent('tick', { deltaTime: delta })
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

  const activeScene = scenes.find((s) => s.id === activeSceneId)

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') closeScenePreview()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeScenePreview])

  if (!activeScene) return null

  const cam = activeScene.gameCamera
  const cameraProps = cam.type === 'orthographic'
    ? { type: 'orthographic', position: cam.position, near: cam.near, far: cam.far, zoom: 5 / cam.orthoSize }
    : { type: 'perspective', position: cam.position, fov: cam.fov, near: cam.near, far: cam.far }

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

      <button
        className="preview-cam-btn"
        onClick={() => {
          setUseGameCam(!useGameCam)
          if (useGameCam && orbitRef.current) {
            orbitRef.current.enabled = true
            orbitRef.current.update()
          }
        }}
        title={useGameCam ? 'Usar câmara orbital' : 'Usar câmara de jogo'}
      >
        <IconPlay width={14} height={14} />
        {useGameCam ? 'Orbital' : 'Game Cam'}
      </button>

      <div className="preview-info">
        <strong>{activeScene.name}</strong>
        <span className="muted small">
          {' · '}{activeScene.objects.length} objetos
          {activeScene.playerObjectId && ' · jogador definido'}
          {activeScene.objects.some((o) => o.flirScript) && ' · FlirScript ativo'}
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

          {/* Instâncias de objetos */}
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
            const isPlayer = instance.instanceId === activeScene.playerObjectId
            return (
              <group key={instance.instanceId}>
                <SceneObject
                  ref={(node) => {
                    if (node) meshRefs.current.set(instance.instanceId, node)
                    else meshRefs.current.delete(instance.instanceId)
                  }}
                  obj={sceneObj}
                  isSelected={false}
                  onSelect={() => {}}
                />
                {isPlayer && <PlayerMarker position={instance.position} />}
              </group>
            )
          })}

          {/* Runner do FlirScript — executa os grafos de cada objeto */}
          <FlirScriptRunner
            instances={activeScene.objects}
            meshRefs={meshRefs}
            objects={objects}
            activeSceneId={activeSceneId}
          />

          {!useGameCam && (
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
          {useGameCam && <GameCameraRig camera={cam} />}
        </Suspense>
      </Canvas>
    </div>
  )
}

function GameCameraRig({ camera: camConfig }) {
  const { camera } = useThree()
  useEffect(() => {
    camera.position.set(...camConfig.position)
    camera.rotation.set(...camConfig.rotation)
    if (camConfig.type === 'perspective' && camera.fov !== undefined) {
      camera.fov = camConfig.fov
      camera.updateProjectionMatrix()
    }
    if (camConfig.type === 'orthographic' && camera.zoom !== undefined) {
      camera.zoom = 5 / camConfig.orthoSize
      camera.updateProjectionMatrix()
    }
  }, [camConfig, camera])
  return null
}

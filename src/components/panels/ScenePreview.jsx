/**
 * ScenePreview — modo de pré-visualização da cena em ecrã cheio.
 *
 * Mostra a cena ativa sem os painéis de edição, usando a gameCamera configurada.
 * O utilizador pode orbitar livremente (câmara orbital) ou alternar para a
 * gameCamera da cena (botão no canto).
 *
 * Botão "Sair" no canto superior direito para voltar ao editor.
 *
 * Esta é uma primeira aproximação ao "modo de jogo" — na Fase 2 será
 * substituído por um player real com lógica de scripting.
 */
import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import SceneObject from '../3d/SceneObject'
import { useStore } from '../../store/useStore'
import { IconClose, IconPlay } from '../ui/Icons'

// Marcador do jogador (igual ao do SceneLevel3D)
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

export default function ScenePreview() {
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const objects = useStore((s) => s.objects)
  const background = useStore((s) => s.background)
  const lights = useStore((s) => s.lights)
  const closeScenePreview = useStore((s) => s.closeScenePreview)
  const [useGameCam, setUseGameCam] = useState(false)
  const orbitRef = useRef(null)

  const activeScene = scenes.find((s) => s.id === activeSceneId)

  useEffect(() => {
    // ESC para sair
    const handler = (e) => {
      if (e.key === 'Escape') closeScenePreview()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [closeScenePreview])

  if (!activeScene) return null

  const cam = activeScene.gameCamera
  // Configuração da câmara consoante o tipo
  const cameraProps = cam.type === 'orthographic'
    ? { type: 'orthographic', position: cam.position, near: cam.near, far: cam.far, zoom: 5 / cam.orthoSize }
    : { type: 'perspective', position: cam.position, fov: cam.fov, near: cam.near, far: cam.far }

  return (
    <div className="scene-preview-fullscreen">
      {/* Botão Sair */}
      <button
        className="preview-exit-btn"
        onClick={closeScenePreview}
        title="Sair da pré-visualização (Esc)"
      >
        <IconClose width={18} height={18} />
        <span>Sair</span>
      </button>

      {/* Botão alternar câmara */}
      <button
        className="preview-cam-btn"
        onClick={() => {
          setUseGameCam(!useGameCam)
          // Se voltarmos ao orbital, garantir que o orbit está enabled
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

      {/* Info bar */}
      <div className="preview-info">
        <strong>{activeScene.name}</strong>
        <span className="muted small">
          {' · '}{activeScene.objects.length} objetos
          {activeScene.playerObjectId && ' · jogador definido'}
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
                <SceneObject obj={sceneObj} isSelected={false} onSelect={() => {}} />
                {isPlayer && <PlayerMarker position={instance.position} />}
              </group>
            )
          })}

          {/* Se useGameCam, posicionamos a câmara na gameCamera; caso contrário, orbital */}
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

// Componente que aplica a transformação da gameCamera à câmara do canvas
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

/**
 * SceneLevel3D — viewport 3D para o editor de cenas/níveis.
 *
 * Diferente do Scene3D (modo modelagem), este viewport:
 *  - Renderiza todas as instâncias de objetos da cena ativa (com position/rotation/scale específicos)
 *  - Suporta seleção e transformação de instâncias (não dos objetos do catálogo)
 *  - Mostra a gameCamera da cena como um wireframe/gizmo visual
 *  - Marca visualmente o objeto que é "Jogador" com um indicador
 *  - Permite arrastar objetos do catálogo (lado esquerdo) para a cena
 *
 * O Scene3D original continua a ser usado no modo Modelagem.
 */
import { Suspense, useEffect, useRef, useState, useCallback, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, TransformControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import SceneObject from './SceneObject'
import { useStore } from '../../store/useStore'

// Componente interno: marcador visual para o objeto "Jogador"
function PlayerMarker({ position }) {
  return (
    <group position={position}>
      {/* Cone a apontar para baixo, acima do objeto */}
      <mesh position={[0, 1.5, 0]}>
        <coneGeometry args={[0.2, 0.4, 16]} />
        <meshBasicMaterial color="#3fb950" />
      </mesh>
      {/* Anel no chão */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.6, 0.7, 32]} />
        <meshBasicMaterial color="#3fb950" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// Componente interno: gameCamera visualizada como wireframe
function GameCameraGizmo({ camera }) {
  const { scene } = useThree()
  if (!camera) return null
  const pos = camera.position
  return (
    <group position={pos} rotation={camera.rotation}>
      {/* Corpo da câmara */}
      <mesh>
        <boxGeometry args={[0.4, 0.3, 0.5]} />
        <meshBasicMaterial color="#f4a261" wireframe />
      </mesh>
      {/* Lente a apontar para -Z */}
      <mesh position={[0, 0, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 0.3, 16]} />
        <meshBasicMaterial color="#f4a261" wireframe />
      </mesh>
      {/* Linha a indicar direção */}
      <mesh position={[0, 0, -1]}>
        <boxGeometry args={[0.05, 0.05, 1.5]} />
        <meshBasicMaterial color="#f4a261" transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

// Componente principal
export default function SceneLevel3D() {
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const objects = useStore((s) => s.objects) // catálogo de objetos do projeto
  const background = useStore((s) => s.background)
  const grid = useStore((s) => s.grid)
  const lights = useStore((s) => s.lights)
  const transformMode = useStore((s) => s.transformMode)
  const updateSceneInstance = useStore((s) => s.updateSceneInstance)
  const addObjectToScene = useStore((s) => s.addObjectToScene)

  const [selectedInstanceId, setSelectedInstanceId] = useState(null)
  const orbitRef = useRef(null)
  const meshRefs = useRef(new Map())
  const [selectedMesh, setSelectedMesh] = useState(null)

  const activeScene = scenes.find((s) => s.id === activeSceneId)

  // Aplicar fundo da cena
  useEffect(() => {
    // Feito dentro do canvas via SceneBackground do Scene3D original
    // Aqui usamos o background global
  }, [background])

  useEffect(() => {
    if (selectedInstanceId && meshRefs.current.has(selectedInstanceId)) {
      setSelectedMesh(meshRefs.current.get(selectedInstanceId))
    } else {
      setSelectedMesh(null)
    }
  }, [selectedInstanceId, activeScene])

  const setMeshRef = useCallback((id, node) => {
    if (node) meshRefs.current.set(id, node)
    else meshRefs.current.delete(id)
  }, [])

  // Drag-and-drop: quando o utilizador larga um objeto do catálogo na cena
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const objectId = e.dataTransfer.getData('text/objectId')
    if (!objectId) return
    // Converter coords do ecrã para coords do mundo (no plano XZ)
    // Como o canvas está atrás, usamos raycast contra o plano Y=0
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    // O raycast real seria feito dentro do canvas; aqui usamos uma aproximação simples
    // posicionando o objeto na origem + offset baseado no rato
    addObjectToScene(objectId, [x * 3, 0.5, -y * 3])
  }, [addObjectToScene])

  if (!activeScene) {
    return (
      <div
        className="viewport"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <div className="empty-state">
          <div style={{ fontSize: 32, opacity: 0.4 }}>🎬</div>
          <div>Nenhuma cena ativa.</div>
          <div className="small mt-2">Cria uma cena no painel lateral.</div>
        </div>
      </div>
    )
  }

  return (
    <div
      className="viewport"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [8, 6, 10], fov: 50, near: 0.1, far: 200 }}
        gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }}
        onPointerMissed={() => setSelectedInstanceId(null)}
      >
        <Suspense fallback={null}>
          <SceneBackgroundSolid background={background} />

          {/* Iluminação */}
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

          {/* Grelha */}
          {grid.visible && (
            <Grid
              position={[0, 0, 0]}
              args={[grid.size, grid.divisions]}
              cellColor={grid.color}
              sectionColor={grid.color}
              sectionThickness={1.2}
              cellThickness={0.6}
              fadeDistance={30}
              fadeStrength={1}
            />
          )}

          <ContactShadows position={[0, 0.001, 0]} opacity={0.35} scale={40} blur={2.5} far={5} />

          {/* Instâncias de objetos na cena */}
          {activeScene.objects.map((instance) => {
            const obj = objects.find((o) => o.id === instance.objectId)
            if (!obj) return null
            // Criamos uma versão "cena" do objeto com transform da instância
            const sceneObj = {
              ...obj,
              id: instance.instanceId, // id único na cena
              position: instance.position,
              rotation: instance.rotation,
              scale: instance.scale,
            }
            const isSelected = instance.instanceId === selectedInstanceId
            const isPlayer = instance.instanceId === activeScene.playerObjectId
            return (
              <group key={instance.instanceId}>
                <SceneObject
                  ref={(node) => setMeshRef(instance.instanceId, node)}
                  obj={sceneObj}
                  isSelected={isSelected}
                  onSelect={() => setSelectedInstanceId(instance.instanceId)}
                />
                {isPlayer && <PlayerMarker position={instance.position} />}
              </group>
            )
          })}

          {/* GameCamera gizmo */}
          <GameCameraGizmo camera={activeScene.gameCamera} />

          {/* TransformControls para a instância selecionada */}
          {selectedMesh && selectedInstanceId && (
            <TransformControls
              object={selectedMesh}
              mode={transformMode}
              size={0.8}
              onMouseDown={() => { if (orbitRef.current) orbitRef.current.enabled = false }}
              onMouseUp={() => {
                if (orbitRef.current) orbitRef.current.enabled = true
                if (selectedMesh) {
                  updateSceneInstance(selectedInstanceId, {
                    position: [selectedMesh.position.x, selectedMesh.position.y, selectedMesh.position.z],
                    rotation: [selectedMesh.rotation.x, selectedMesh.rotation.y, selectedMesh.rotation.z],
                    scale: [selectedMesh.scale.x, selectedMesh.scale.y, selectedMesh.scale.z],
                  })
                }
              }}
              onObjectChange={() => {
                if (selectedMesh) {
                  updateSceneInstance(selectedInstanceId, {
                    position: [selectedMesh.position.x, selectedMesh.position.y, selectedMesh.position.z],
                    rotation: [selectedMesh.rotation.x, selectedMesh.rotation.y, selectedMesh.rotation.z],
                    scale: [selectedMesh.scale.x, selectedMesh.scale.y, selectedMesh.scale.z],
                  })
                }
              }}
            />
          )}

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
        </Suspense>
      </Canvas>
    </div>
  )
}

// Helper local para fundo
function SceneBackgroundSolid({ background }) {
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

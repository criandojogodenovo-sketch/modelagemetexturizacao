/**
 * SceneLevel3D — viewport 3D para o editor de cenas/níveis.
 *
 * Renderiza:
 *  - Instâncias de objetos do catálogo (activeScene.objects)
 *  - Conects da cena ativa (activeScene.conects) — RigidObject, ViewObject, etc.
 *
 * Suporta seleção e transformação (gizmos) de QUALQUER objeto ou Conect.
 * Ao transformar um objeto do catálogo → updateSceneInstance
 * Ao transformar um Conect → updateConect
 *
 * Drag-and-drop:
 *  - text/objectId → adiciona objeto do catálogo
 *  - text/conectType → adiciona Conect
 */
import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, TransformControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import SceneObject from './SceneObject'
import ConectRenderer from '../panels/ConectRenderer'
import { useStore } from '../../store/useStore'

// Marcador visual para o objeto "Jogador"
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

// gameCamera da cena como wireframe (fallback quando não há ViewObject)
function GameCameraGizmo({ camera }) {
  if (!camera) return null
  return (
    <group position={camera.position} rotation={camera.rotation}>
      <mesh>
        <boxGeometry args={[0.4, 0.3, 0.5]} />
        <meshBasicMaterial color="#f4a261" wireframe />
      </mesh>
      <mesh position={[0, 0, -0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.15, 0.2, 0.3, 16]} />
        <meshBasicMaterial color="#f4a261" wireframe />
      </mesh>
      <mesh position={[0, 0, -1]}>
        <boxGeometry args={[0.05, 0.05, 1.5]} />
        <meshBasicMaterial color="#f4a261" transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

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

  const [selectedInstanceId, setSelectedInstanceId] = useState(null)
  // Tipo do selecionado: 'object' | 'conect' — determina qual update chamar
  const [selectedType, setSelectedType] = useState(null)
  const orbitRef = useRef(null)
  const meshRefs = useRef(new Map())
  const [selectedMesh, setSelectedMesh] = useState(null)

  const activeScene = scenes.find((s) => s.id === activeSceneId)

  // Atualizar mesh selecionado quando muda a seleção ou a cena
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

  // Selecionar um objeto do catálogo
  const selectObject = useCallback((instanceId) => {
    setSelectedInstanceId(instanceId)
    setSelectedType('object')
    selectConect(null) // desselecionar conect no store
  }, [selectConect])

  // Selecionar um Conect
  const selectConectInstance = useCallback((instanceId) => {
    setSelectedInstanceId(instanceId)
    setSelectedType('conect')
    selectConect(instanceId)
  }, [selectConect])

  // Drag-and-drop
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const objectId = e.dataTransfer.getData('text/objectId')
    const conectType = e.dataTransfer.getData('text/conectType')
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
    const position = [x * 3, 0.5, -y * 3]

    if (objectId) {
      addObjectToScene(objectId, position)
    } else if (conectType) {
      addConectToScene(conectType, position)
    }
  }, [addObjectToScene, addConectToScene])

  // Handler para transform — decide qual update chamar
  const handleTransformUpdate = useCallback(() => {
    if (!selectedMesh || !selectedInstanceId) return
    const transform = {
      position: [selectedMesh.position.x, selectedMesh.position.y, selectedMesh.position.z],
      rotation: [selectedMesh.rotation.x, selectedMesh.rotation.y, selectedMesh.rotation.z],
      scale: [selectedMesh.scale.x, selectedMesh.scale.y, selectedMesh.scale.z],
    }
    if (selectedType === 'conect') {
      updateConect(selectedInstanceId, transform)
    } else {
      updateSceneInstance(selectedInstanceId, transform)
    }
  }, [selectedMesh, selectedInstanceId, selectedType, updateConect, updateSceneInstance])

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
        onPointerMissed={() => {
          setSelectedInstanceId(null)
          setSelectedType(null)
          selectConect(null)
        }}
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

          {/* ===== Objetos do catálogo na cena ===== */}
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
            const isSelected = instance.instanceId === selectedInstanceId
            const isPlayer = instance.instanceId === activeScene.playerObjectId
            return (
              <group key={instance.instanceId}>
                <SceneObject
                  ref={(node) => setMeshRef(instance.instanceId, node)}
                  obj={sceneObj}
                  isSelected={isSelected}
                  onSelect={() => selectObject(instance.instanceId)}
                />
                {isPlayer && <PlayerMarker position={instance.position} />}
              </group>
            )
          })}

          {/* ===== Conects na cena (RigidObject, ViewObject, etc.) ===== */}
          {(activeScene.conects || []).map((conect) => (
            <ConectSelectorWrapper
              key={conect.instanceId}
              conect={conect}
              objects={objects}
              isSelected={conect.instanceId === selectedInstanceId}
              onSelect={() => selectConectInstance(conect.instanceId)}
              setMeshRef={(node) => setMeshRef(conect.instanceId, node)}
            />
          ))}

          {/* GameCamera gizmo (só se não há ViewObject na cena) */}
          {!(activeScene.conects || []).some((c) => c.type === 'ViewObject') && (
            <GameCameraGizmo camera={activeScene.gameCamera} />
          )}

          {/* TransformControls para o objeto/conect selecionado */}
          {selectedMesh && selectedInstanceId && (
            <TransformControls
              object={selectedMesh}
              mode={transformMode}
              size={0.8}
              onMouseDown={() => { if (orbitRef.current) orbitRef.current.enabled = false }}
              onMouseUp={() => {
                if (orbitRef.current) orbitRef.current.enabled = true
                handleTransformUpdate()
              }}
              onObjectChange={handleTransformUpdate}
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

// Wrapper que envolve ConectRenderer e adiciona pointer events para seleção
function ConectSelectorWrapper({ conect, objects, isSelected, onSelect, setMeshRef }) {
  const handlePointerDown = (e) => {
    e.stopPropagation()
    onSelect()
  }
  return (
    <group onPointerDown={handlePointerDown}>
      <ConectRenderer
        conect={conect}
        objects={objects}
        setMeshRef={setMeshRef}
      />
      {/* Outline de seleção para conects com visual */}
      {isSelected && <SelectionOutline conect={conect} />}
    </group>
  )
}

// Outline simples para Conects selecionados
function SelectionOutline({ conect }) {
  // Apenas mostra um indicador — o ConectRenderer já tem o seu próprio visual
  return (
    <mesh position={conect.position}>
      <sphereGeometry args={[0.05, 8, 8]} />
      <meshBasicMaterial color="#2f81f7" />
    </mesh>
  )
}

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

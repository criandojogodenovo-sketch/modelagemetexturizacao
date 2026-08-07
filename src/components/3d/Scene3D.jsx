/**
 * Scene3D — viewport principal com Three.js via @react-three/fiber.
 *
 * Contém:
 *  - Canvas com fundo configurável (cor sólida ou gradiente)
 *  - Luz ambiente + luz direcional (com sombras)
 *  - Grelha de referência
 *  - Câmara orbital (OrbitControls) com suporte a toque (pinch zoom, 1 dedo = rotate, 2 dedos = pan/zoom)
 *  - Renderização de todos os objetos da cena
 *  - TransformControls (gizmo) para o objeto selecionado
 *  - Click no vazio = deselect
 *
 * O TransformControls é renderizado como sibling dos meshes e recebe o Object3D
 * do mesh selecionado via um mapa de refs mantido pelo Scene3D.
 */
import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, TransformControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import SceneObject from './SceneObject'
import { useStore } from '../../store/useStore'

// ----- Componente interno: aplica o fundo da cena -----
function SceneBackground({ background }) {
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
      return () => {
        tex.dispose()
      }
    } else {
      scene.background = new THREE.Color(background.color)
    }
  }, [background, scene])
  return null
}

// ----- Componente interno: TransformControls -----
function SelectedTransformControls({ selectedMesh, orbitRef }) {
  const transformMode = useStore((s) => s.transformMode)
  const transformObject = useStore((s) => s.transformObject)
  const selectedId = useStore((s) => s.selectedId)

  if (!selectedMesh || !selectedId) return null

  return (
    <TransformControls
      object={selectedMesh}
      mode={transformMode}
      size={0.8}
      onMouseDown={() => {
        if (orbitRef.current) orbitRef.current.enabled = false
      }}
      onMouseUp={() => {
        if (orbitRef.current) orbitRef.current.enabled = true
        if (selectedMesh) {
          transformObject(selectedId, {
            position: [
              selectedMesh.position.x,
              selectedMesh.position.y,
              selectedMesh.position.z,
            ],
            rotation: [
              selectedMesh.rotation.x,
              selectedMesh.rotation.y,
              selectedMesh.rotation.z,
            ],
            scale: [
              selectedMesh.scale.x,
              selectedMesh.scale.y,
              selectedMesh.scale.z,
            ],
          })
        }
      }}
      onObjectChange={() => {
        if (selectedMesh) {
          transformObject(selectedId, {
            position: [
              selectedMesh.position.x,
              selectedMesh.position.y,
              selectedMesh.position.z,
            ],
            rotation: [
              selectedMesh.rotation.x,
              selectedMesh.rotation.y,
              selectedMesh.rotation.z,
            ],
            scale: [selectedMesh.scale.x, selectedMesh.scale.y, selectedMesh.scale.z],
          })
        }
      }}
    />
  )
}

// ----- Componente principal -----
export default function Scene3D() {
  const objects = useStore((s) => s.objects)
  const selectedId = useStore((s) => s.selectedId)
  const selectObject = useStore((s) => s.selectObject)
  const deselect = useStore((s) => s.deselect)
  const background = useStore((s) => s.background)
  const grid = useStore((s) => s.grid)
  const lights = useStore((s) => s.lights)

  // Refs dos OrbitControls (precisam ser desativados durante TransformControls)
  const orbitRef = useRef(null)

  // Mapa de refs dos meshes por id
  const meshRefs = useRef(new Map())

  // Mesh selecionado (Object3D) — recalculado quando muda a seleção
  const [selectedMesh, setSelectedMesh] = useState(null)

  useEffect(() => {
    if (selectedId && meshRefs.current.has(selectedId)) {
      setSelectedMesh(meshRefs.current.get(selectedId))
    } else {
      setSelectedMesh(null)
    }
  }, [selectedId, objects])

  const setMeshRef = useCallback((id, node) => {
    if (node) meshRefs.current.set(id, node)
    else meshRefs.current.delete(id)
  }, [])

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [5, 4, 6], fov: 50, near: 0.1, far: 200 }}
      gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }}
      onPointerMissed={(e) => {
        if (e.type === 'click' || e.type === 'touchend') {
          deselect()
        }
      }}
    >
      <Suspense fallback={null}>
        <SceneBackground background={background} />

        {/* Iluminação */}
        <ambientLight intensity={lights.ambient.intensity} color={lights.ambient.color} />
        <directionalLight
          intensity={lights.directional.intensity}
          color={lights.directional.color}
          position={lights.directional.position}
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
          shadow-camera-near={0.5}
          shadow-camera-far={50}
        />
        <hemisphereLight intensity={0.3} groundColor="#1a1a2e" color="#ffffff" />

        {/* Grelha de chão */}
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
            infiniteGrid={false}
          />
        )}

        {/* Sombras de contacto (chão) */}
        <ContactShadows
          position={[0, 0.001, 0]}
          opacity={0.35}
          scale={30}
          blur={2.5}
          far={5}
        />

        {/* Objetos da cena */}
        {objects.map((obj) => (
          <SceneObject
            key={obj.id}
            ref={(node) => setMeshRef(obj.id, node)}
            obj={obj}
            isSelected={obj.id === selectedId}
            onSelect={selectObject}
          />
        ))}

        {/* Gizmo de transformação no objeto selecionado */}
        <SelectedTransformControls selectedMesh={selectedMesh} orbitRef={orbitRef} />

        {/* Câmara orbital */}
        <OrbitControls
          ref={orbitRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={1}
          maxDistance={50}
          maxPolarAngle={Math.PI * 0.495}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN,
          }}
        />
      </Suspense>
    </Canvas>
  )
}

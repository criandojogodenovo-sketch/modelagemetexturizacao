/**
 * Scene3D — viewport principal com Three.js via @react-three/fiber.
 *
 * Contém:
 *  - Canvas com fundo configurável (cor sólida ou gradiente)
 *  - Luz ambiente + luz direcional (com sombras)
 *  - Grelha de referência
 *  - Câmara orbital (OrbitControls) com suporte a toque
 *  - Renderização de todos os objetos da cena
 *  - TransformControls (gizmo) — só em modo 'object'
 *  - Modo Sculpt: raycast + sculptStrokeAt ao clicar/arrastar
 *  - Modo Edit: seleção de vértices/arestas/faces (visual overlay)
 *  - Click no vazio = deselect
 */
import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls, Grid, TransformControls, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'
import SceneObject from './SceneObject'
import SkeletonGizmo from './SkeletonGizmo'
import { useStore } from '../../store/useStore'
import {
  DEFAULT_CAMERA_FAR,
  updatePanSpeed,
  focusSelected as focusSelectedUtil,
  frameAll as frameAllUtil,
  resetCamera as resetCameraUtil,
  updateTargetToSelection,
} from '../../utils/navigationUtils'

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

// ----- Componente interno: raycast para sculpt -----
function SculptRaycaster({ meshRefs, orbitRef }) {
  const { gl, camera, pointer } = useThree()
  const mode = useStore((s) => s.mode)
  const selectedId = useStore((s) => s.selectedId)
  const sculptStrokeAt = useStore((s) => s.sculptStrokeAt)
  const sculptSettings = useStore((s) => s.sculptSettings)
  const isDraggingRef = useRef(false)
  const raycaster = useRef(new THREE.Raycaster())

  useEffect(() => {
    if (mode !== 'sculpt' || !selectedId) return
    const canvas = gl.domElement

    const onPointerDown = (e) => {
      isDraggingRef.current = true
      if (orbitRef.current) orbitRef.current.enabled = false
      doStroke(e)
    }
    const onPointerMove = (e) => {
      if (!isDraggingRef.current) return
      doStroke(e)
    }
    const onPointerUp = () => {
      isDraggingRef.current = false
      if (orbitRef.current) orbitRef.current.enabled = true
    }
    const doStroke = (e) => {
      const mesh = meshRefs.current.get(selectedId)
      if (!mesh) return
      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.current.setFromCamera(new THREE.Vector2(x, y), camera)
      const intersects = raycaster.current.intersectObject(mesh)
      if (intersects.length === 0) return
      const hit = intersects[0]
      sculptStrokeAt(selectedId, [hit.point.x, hit.point.y, hit.point.z],
        [hit.face.normal.x, hit.face.normal.y, hit.face.normal.z],
        sculptSettings)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      if (orbitRef.current) orbitRef.current.enabled = true
    }
  }, [mode, selectedId, sculptStrokeAt, sculptSettings, gl, camera, meshRefs, orbitRef])

  return null
}

// ----- Componente interno: TransformControls -----
function SelectedTransformControls({ selectedMesh, orbitRef }) {
  const transformMode = useStore((s) => s.transformMode)
  const transformObject = useStore((s) => s.transformObject)
  const selectedId = useStore((s) => s.selectedId)
  const mode = useStore((s) => s.mode)

  // Só mostra TransformControls em modo 'object' (não em edit/sculpt/etc.)
  if (!selectedMesh || !selectedId || mode !== 'object') return null

  return (
    <TransformControls
      object={selectedMesh}
      mode={transformMode}
      size={1.2}
      onMouseDown={() => {
        if (orbitRef.current) orbitRef.current.enabled = false
      }}
      onMouseUp={() => {
        if (orbitRef.current) orbitRef.current.enabled = true
        if (selectedMesh) {
          transformObject(selectedId, {
            position: [selectedMesh.position.x, selectedMesh.position.y, selectedMesh.position.z],
            rotation: [selectedMesh.rotation.x, selectedMesh.rotation.y, selectedMesh.rotation.z],
            scale: [selectedMesh.scale.x, selectedMesh.scale.y, selectedMesh.scale.z],
          })
        }
      }}
      onObjectChange={() => {
        if (selectedMesh) {
          transformObject(selectedId, {
            position: [selectedMesh.position.x, selectedMesh.position.y, selectedMesh.position.z],
            rotation: [selectedMesh.rotation.x, selectedMesh.rotation.y, selectedMesh.rotation.z],
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
  const mode = useStore((s) => s.mode)
  const renderSettings = useStore((s) => s.renderSettings)

  const orbitRef = useRef(null)
  const meshRefs = useRef(new Map())
  const [selectedMesh, setSelectedMesh] = useState(null)

  useEffect(() => {
    if (selectedId && meshRefs.current.has(selectedId)) {
      const mesh = meshRefs.current.get(selectedId)
      setSelectedMesh(mesh)
      // Actualizar target do OrbitControls para o objeto seleccionado (sem mover a câmara)
      updateTargetToSelection(orbitRef, mesh)
    } else {
      // O mesh pode ainda não estar montado — tentar novamente no próximo tick
      setSelectedMesh(null)
      if (selectedId) {
        const timer = setTimeout(() => {
          if (meshRefs.current.has(selectedId)) {
            const mesh = meshRefs.current.get(selectedId)
            setSelectedMesh(mesh)
            updateTargetToSelection(orbitRef, mesh)
          }
        }, 50)
        return () => clearTimeout(timer)
      }
    }
  }, [selectedId, objects])

  // Atalhos de navegação: F=Focus Selected, A=Frame All, Home=Reset Camera
  useEffect(() => {
    const handler = (e) => {
      const tag = e.target.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) return
      const key = e.key.toLowerCase()
      if (key === 'f') {
        e.preventDefault()
        if (selectedMesh && orbitRef.current) {
          const { camera } = orbitRef.current.object.parent // canvas camera
          // Obter a câmara do three via R3F — usar orbitRef.current.object (que é a câmara)
          focusSelectedUtil(orbitRef, orbitRef.current.object, selectedMesh, 50)
        }
      } else if (key === 'a') {
        e.preventDefault()
        if (orbitRef.current) {
          const meshes = Array.from(meshRefs.current.values()).filter(Boolean)
          frameAllUtil(orbitRef, orbitRef.current.object, meshes, 50)
        }
      } else if (key === 'home') {
        e.preventDefault()
        if (orbitRef.current) {
          resetCameraUtil(orbitRef, orbitRef.current.object)
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [selectedMesh])

  const setMeshRef = useCallback((id, node) => {
    if (node) {
      meshRefs.current.set(id, node)
      // Se este mesh é o atualmente selecionado, atualizar o selectedMesh imediatamente
      if (id === selectedId) {
        setSelectedMesh(node)
      }
    } else {
      meshRefs.current.delete(id)
    }
  }, [selectedId])

  // DPR e shadowMapSize do renderSettings
  const pixelRatio = renderSettings?.pixelRatio || 1
  const dprMax = pixelRatio >= 2 ? 2 : pixelRatio >= 1.5 ? 1.5 : 1
  const shadowMapSize = renderSettings?.shadowMapSize || 1024

  return (
    <Canvas
      shadows
      dpr={[1, dprMax]}
      camera={{ position: [5, 4, 6], fov: 50, near: 0.1, far: DEFAULT_CAMERA_FAR }}
      gl={{ antialias: true, preserveDrawingBuffer: true, alpha: false }}
      onPointerMissed={(e) => {
        if (e.type === 'click' || e.type === 'touchend') {
          if (mode === 'object') deselect()
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
          shadow-mapSize-width={shadowMapSize}
          shadow-mapSize-height={shadowMapSize}
          shadow-camera-left={-15}
          shadow-camera-right={15}
          shadow-camera-top={15}
          shadow-camera-bottom={-15}
          shadow-camera-near={0.5}
          shadow-camera-far={50}
        />
        <hemisphereLight intensity={0.3} groundColor="#1a1a2e" color="#ffffff" />

        {/* Grelha de chão — infinita para não dar sensação de "mundo acaba" */}
        {grid.visible && (
          <Grid
            position={[0, 0, 0]}
            args={[grid.size, grid.divisions]}
            cellColor={grid.color}
            sectionColor={grid.color}
            sectionThickness={1.2}
            cellThickness={0.6}
            fadeDistance={100}
            fadeStrength={1}
            infiniteGrid={true}
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

        {/* Gizmo de transformação no objeto selecionado (só em modo object) */}
        <SelectedTransformControls selectedMesh={selectedMesh} orbitRef={orbitRef} />

        {/* Esqueleto sobreposto ao modelo (quando em modo rig/animate) */}
        <SkeletonGizmo meshRef={selectedMesh} />

        {/* Raycast para sculpt */}
        <SculptRaycaster meshRefs={meshRefs} orbitRef={orbitRef} />

        {/* Câmara orbital — sem limites artificiais de distância; maxPolarAngle permite olhar de baixo */}
        <OrbitControls
          ref={orbitRef}
          makeDefault
          enableDamping
          dampingFactor={0.08}
          minDistance={0.5}
          maxDistance={Infinity}
          maxPolarAngle={Math.PI}
          screenSpacePanning={false}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.PAN,
          }}
          touches={{
            ONE: THREE.TOUCH.ROTATE,
            TWO: THREE.TOUCH.DOLLY_PAN,
          }}
          onPointerDown={() => updatePanSpeed(orbitRef)}
          onWheel={(e) => {
            // Zoom logarítmico: cada scroll multiplica a distância por ZOOM_FACTOR
            if (!orbitRef.current) return
            const controls = orbitRef.current
            const distance = controls.getDistance()
            const factor = e.deltaY > 0 ? 1.1 : 0.9
            const newDistance = distance * factor
            const dir = new THREE.Vector3()
            dir.subVectors(controls.object.position, controls.target)
            if (dir.lengthSq() < 0.001) dir.set(0, 0, 1)
            dir.normalize()
            controls.object.position.copy(controls.target).addScaledVector(dir, newDistance)
            controls.update()
          }}
        />
      </Suspense>
    </Canvas>
  )
}

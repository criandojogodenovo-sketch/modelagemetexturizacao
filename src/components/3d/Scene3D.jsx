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
import { getCachedPose, applyPose, clearPoseCache } from '../../utils/sharedAnimationCache'
import { applyFlirGI, removeFlirGI } from '../../utils/flirGI'
import { updateAdaptiveLODs } from '../../utils/flirAdaptiveMesh'

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

// ----- Componente: raycast para weight painting -----
function WeightPaintRaycaster({ meshRefs, orbitRef }) {
  const { gl, camera } = useThree()
  const mode = useStore((s) => s.mode)
  const selectedId = useStore((s) => s.selectedId)
  const objects = useStore((s) => s.objects)
  const updateObject = useStore((s) => s.updateObject)
  const isDraggingRef = useRef(false)
  const raycaster = useRef(new THREE.Raycaster())

  useEffect(() => {
    if (mode !== 'weight' || !selectedId) return
    const canvas = gl.domElement

    const onPointerDown = (e) => {
      isDraggingRef.current = true
      if (orbitRef.current) orbitRef.current.enabled = false
      doPaint(e)
    }
    const onPointerMove = (e) => {
      if (!isDraggingRef.current) return
      doPaint(e)
    }
    const onPointerUp = () => {
      isDraggingRef.current = false
      if (orbitRef.current) orbitRef.current.enabled = true
    }

    const doPaint = (e) => {
      const obj = objects.find(o => o.id === selectedId)
      if (!obj || !obj.skeleton || !obj.skeleton.bones) return
      const mesh = meshRefs.current.get(selectedId)
      if (!mesh) return

      const rect = canvas.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1
      raycaster.current.setFromCamera(new THREE.Vector2(x, y), camera)
      const intersects = raycaster.current.intersectObject(mesh)
      if (intersects.length === 0) return

      const hit = intersects[0]
      const activeBoneId = window._weightPaintActiveBone
      if (!activeBoneId) return

      const geom = mesh.geometry
      const positions = geom.attributes.position
      const skinWeights = obj.skinWeights || {}
      const brushRadius = window._weightPaintBrushSize || 0.3
      const brushStrength = window._weightPaintBrushStrength || 0.5

      const localHit = hit.point.clone().applyMatrix4(new THREE.Matrix4().copy(mesh.matrixWorld).invert())
      const newWeights = { ...skinWeights }
      let painted = 0

      for (let v = 0; v < positions.count; v++) {
        const vx = positions.getX(v)
        const vy = positions.getY(v)
        const vz = positions.getZ(v)
        const dist = Math.sqrt((vx - localHit.x) ** 2 + (vy - localHit.y) ** 2 + (vz - localHit.z) ** 2)

        if (dist <= brushRadius) {
          const falloff = 1 - (dist / brushRadius)
          const weight = falloff * brushStrength
          if (!newWeights[v]) newWeights[v] = {}
          const current = newWeights[v][activeBoneId] || 0
          newWeights[v][activeBoneId] = Math.min(1, current + weight)
          const total = Object.values(newWeights[v]).reduce((a, b) => a + b, 0)
          if (total > 0) {
            for (const boneId in newWeights[v]) {
              newWeights[v][boneId] /= total
            }
          }
          painted++
        }
      }

      if (painted > 0) {
        updateObject(selectedId, { skinWeights: newWeights })
      }
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
  }, [mode, selectedId, objects, updateObject, gl, camera, meshRefs, orbitRef])

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
      size={0.8}
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

// ----- Componente: TransformControls para bones (modo rig/animate) -----
function BoneTransformControls({ boneObj, orbitRef, objId, boneId }) {
  const transformMode = useStore((s) => s.transformMode)
  const updateBone = useStore((s) => s.updateBone)
  const mode = useStore((s) => s.mode)

  // Só mostra em modo rig ou weight ou animate (não em object/edit/sculpt)
  if (!boneObj || !objId || !boneId) return null
  if (mode !== 'rig' && mode !== 'weight' && mode !== 'animate') return null

  return (
    <TransformControls
      object={boneObj}
      mode={transformMode}
      size={0.6}
      onMouseDown={() => {
        if (orbitRef.current) orbitRef.current.enabled = false
      }}
      onMouseUp={() => {
        if (orbitRef.current) orbitRef.current.enabled = true
        updateBone(objId, boneId, {
          position: [boneObj.position.x, boneObj.position.y, boneObj.position.z],
          rotation: [boneObj.rotation.x, boneObj.rotation.y, boneObj.rotation.z],
          scale: [boneObj.scale.x, boneObj.scale.y, boneObj.scale.z],
        })
      }}
      onObjectChange={() => {
        updateBone(objId, boneId, {
          position: [boneObj.position.x, boneObj.position.y, boneObj.position.z],
          rotation: [boneObj.rotation.x, boneObj.rotation.y, boneObj.rotation.z],
          scale: [boneObj.scale.x, boneObj.scale.y, boneObj.scale.z],
        })
      }}
    />
  )
}

// ----- Componente: aplica animação de keyframes aos bones no editor -----
function EditorAnimationPlayer({ meshRefs }) {
  const animation = useStore((s) => s.animation)
  const selectedId = useStore((s) => s.selectedId)
  const objects = useStore((s) => s.objects)

  useFrame(() => {
    clearPoseCache()
    if (!animation.playing || !selectedId) return
    const obj = objects.find(o => o.id === selectedId)
    if (!obj || !obj.animations) return
    const clip = obj.animations[animation.activeClip]
    if (!clip || clip.length === 0) return

    const mesh = meshRefs.current.get(selectedId)
    if (!mesh || !mesh.isSkinnedMesh || !mesh.skeleton) return
    const bones = mesh.skeleton.bones

    // Calcular pose no tempo atual e aplicar aos bones
    const pose = getCachedPose(animation.activeClip, clip, animation.currentTime)
    applyPose(pose, bones)
    mesh.skeleton.update()
  })

  return null
}

// ----- Componente: aplica/remove Flir GI (iluminação global) -----
function FlirGIHelper({ enabled }) {
  const { scene } = useThree()
  useEffect(() => {
    if (enabled) {
      const gi = applyFlirGI(scene)
      return () => gi.dispose()
    } else {
      removeFlirGI(scene)
    }
  }, [enabled, scene])
  return null
}

// ----- Componente: atualiza LODs adaptativos a cada frame -----
function FlirAdaptiveMeshHelper({ enabled }) {
  const { camera, scene } = useThree()
  useFrame(() => {
    if (!enabled) return
    updateAdaptiveLODs(scene, camera)
  })
  return null
}

// ----- Componente: shadow distance culling -----
// Desliga castShadow em meshes que estão além da distância configurada da câmara.
// Reduz draw calls na shadow pass (o gargalo principal confirmado em testes).
// Otimização: usa meshRefs (Map) em vez de scene.traverse, e só reavalia
// quando a câmara se move significativamente (>5 unidades) ou quando o nº de meshes muda.
function ShadowOptimizer({ enabled, distance, meshRefs }) {
  const { camera } = useThree()
  const lastCamPosRef = useRef(new THREE.Vector3(Infinity, Infinity, Infinity))
  const lastMeshCountRef = useRef(0)

  useFrame(() => {
    if (!enabled || !meshRefs?.current) return
    const camPos = camera.position
    const meshCount = meshRefs.current.size
    // Só reavaliar se a câmara se moveu >5 unidades OU se o nº de meshes mudou
    if (camPos.distanceToSquared(lastCamPosRef.current) < 25 && meshCount === lastMeshCountRef.current) return
    lastCamPosRef.current.copy(camPos)
    lastMeshCountRef.current = meshCount

    const distSq = distance * distance
    for (const [, mesh] of meshRefs.current) {
      if (mesh && mesh.geometry) {
        const meshPos = mesh.position
        const dx = meshPos.x - camPos.x
        const dy = meshPos.y - camPos.y
        const dz = meshPos.z - camPos.z
        const d = dx * dx + dy * dy + dz * dz
        mesh.castShadow = d <= distSq
      }
    }
  })
  return null
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
  const renderSettings = useStore((s) => s.renderSettings)
  const mode = useStore((s) => s.mode)
  const selectedBoneId = useStore((s) => s.selectedBoneId)
  const selectBone = useStore((s) => s.selectBone)
  const updateBone = useStore((s) => s.updateBone)

  const orbitRef = useRef(null)
  const meshRefs = useRef(new Map())
  const [selectedMesh, setSelectedMesh] = useState(null)
  const [selectedBoneObj, setSelectedBoneObj] = useState(null)

  useEffect(() => {
    if (selectedId && meshRefs.current.has(selectedId)) {
      setSelectedMesh(meshRefs.current.get(selectedId))
    } else {
      // O mesh pode ainda não estar montado — tentar novamente no próximo tick
      setSelectedMesh(null)
      if (selectedId) {
        const timer = setTimeout(() => {
          if (meshRefs.current.has(selectedId)) {
            setSelectedMesh(meshRefs.current.get(selectedId))
          }
        }, 50)
        return () => clearTimeout(timer)
      }
    }
  }, [selectedId, objects])

  // Resolver THREE.Bone a partir do selectedBoneId (para TransformControls)
  useEffect(() => {
    if (!selectedBoneId || !selectedId) {
      setSelectedBoneObj(null)
      return
    }
    const mesh = meshRefs.current.get(selectedId)
    if (mesh && mesh.isSkinnedMesh && mesh.skeleton) {
      const bone = mesh.skeleton.bones.find(b => b.userData?.boneId === selectedBoneId)
      setSelectedBoneObj(bone || null)
    } else {
      setSelectedBoneObj(null)
    }
  }, [selectedBoneId, selectedId, selectedMesh])

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

  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [5, 4, 6], fov: 50, near: 0.1, far: 200 }}
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
          shadow-mapSize-width={renderSettings?.shadowMapSize || 1024}
          shadow-mapSize-height={renderSettings?.shadowMapSize || 1024}
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
          <group key={obj.id}>
            <SceneObject
              ref={(node) => setMeshRef(obj.id, node)}
              obj={obj}
              isSelected={obj.id === selectedId}
              onSelect={selectObject}
            />
            {/* SkeletonGizmo — visualização do esqueleto sobreposta ao modelo */}
            {obj.id === selectedId && obj.skeleton && obj.skeleton.bones?.length > 0 && (
              <SkeletonGizmo skeleton={obj.skeleton} selectedBoneId={selectedBoneId} onSelectBone={selectBone} />
            )}
          </group>
        ))}

        {/* Gizmo de transformação no objeto selecionado (só em modo object) */}
        <SelectedTransformControls selectedMesh={selectedMesh} orbitRef={orbitRef} />

        {/* Gizmo de transformação no osso selecionado (só em modo rig/weight/animate) */}
        <BoneTransformControls
          boneObj={selectedBoneObj}
          orbitRef={orbitRef}
          objId={selectedId}
          boneId={selectedBoneId}
        />

        {/* Raycast para sculpt */}
        <SculptRaycaster meshRefs={meshRefs} orbitRef={orbitRef} />
        <WeightPaintRaycaster meshRefs={meshRefs} orbitRef={orbitRef} />

        {/* Player de animação no editor (aplica keyframes aos bones) */}
        <EditorAnimationPlayer meshRefs={meshRefs} />

        {/* Flir GI — iluminação global (recurso pesado) */}
        <FlirGIHelper enabled={renderSettings?.flirGI || false} />

        {/* Flir Adaptive Mesh — LOD adaptativo (recurso pesado) */}
        <FlirAdaptiveMeshHelper enabled={renderSettings?.flirAdaptiveMesh || false} />

        {/* Shadow Optimizer — distance culling (reduz draw calls na shadow pass) */}
        <ShadowOptimizer
          enabled={renderSettings?.shadowOptimizations ?? true}
          distance={renderSettings?.shadowDistance || 20}
          meshRefs={meshRefs}
        />

        {/* Câmara orbital — desativada em modo sculpt durante o arraste */}
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

/**
 * ModifierBrush3D — pincel 3D para aplicar Displace localmente em modelos.
 *
 * Fase 12 — Pincel 3D para Modificadores.
 *
 * Permite pintar deslocamento (displace) diretamente na geometria de um
 * modelo no viewport, como esculpir mas ligado ao sistema de modificadores
 * não-destrutivos. Usa RaycastSystem (BVH) para raycast eficiente.
 *
 * Uso: Colocar dentro do Canvas quando há um objeto selecionado com
 * customGeometry e o modo de escultura está ativo.
 */
import { useRef, useEffect, useState } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store/useStore'

export default function ModifierBrush3D({ isActive }) {
  const { gl, camera, raycaster, scene } = useThree()
  const selectedId = useStore((s) => s.selectedId)
  const objects = useStore((s) => s.objects)
  const updateObject = useStore((s) => s.updateObject)
  const [isDragging, setIsDragging] = useState(false)
  const [cursorPos, setCursorPos] = useState(null)
  const cursorRef = useRef()
  const lastApplyRef = useRef(0)
  const _tmpVec = useRef(new THREE.Vector3())

  const selected = objects.find(o => o.id === selectedId)

  useFrame(() => {
    if (cursorRef.current && cursorPos) {
      cursorRef.current.position.copy(cursorPos)
    }
  })

  useEffect(() => {
    if (!isActive || !selectedId) return
    const canvas = gl.domElement

    // CORREÇÃO BUG2: getSelectedMesh agora usa scene do useThree (API correta)
    const getSelectedMesh = () => {
      // Tentar via window._flirMeshRefs (populado em appMode='scene')
      const refs = window._flirMeshRefs
      if (refs?.current?.has(selectedId)) return refs.current.get(selectedId)
      // Fallback: traverse da scene do three.js
      if (scene) {
        let found = null
        scene.traverse((obj) => {
          if (obj.userData?.objectId === selectedId && obj.isMesh) found = obj
        })
        return found
      }
      return null
    }

    const doStroke = (clientX, clientY) => {
      const mesh = getSelectedMesh()
      if (!mesh || !mesh.geometry) return

      const rect = canvas.getBoundingClientRect()
      const x = ((clientX - rect.left) / rect.width) * 2 - 1
      const y = -((clientY - rect.top) / rect.height) * 2 + 1
      raycaster.setFromCamera(_tmpVec.current.set(x, y, 0), camera)

      const intersects = raycaster.intersectObject(mesh, false)
      if (intersects.length === 0) return

      const hit = intersects[0]
      setCursorPos(hit.point.clone())

      // Aplicar displace local na geometria (precisa de customGeometry no objeto)
      const obj = objects.find(o => o.id === selectedId)
      if (!obj || !obj.customGeometry) {
        // Sem customGeometry: não aplicamos (teria que converter geometria paramétrica para customGeometry)
        return
      }

      const positions = obj.customGeometry.positions
      const normals = obj.customGeometry.normals
      const point = hit.point
      const normal = hit.face?.normal || new THREE.Vector3(0, 1, 0)
      const brushRadius = 0.5
      const brushStrength = 0.05

      // Converter point para local space do mesh
      mesh.worldToLocal(_tmpVec.current.copy(point))
      const localPoint = _tmpVec.current.clone()

      // Aplicar displace a vértices próximos
      for (let i = 0; i < positions.length; i += 3) {
        const vx = positions[i]
        const vy = positions[i + 1]
        const vz = positions[i + 2]
        const dx = vx - localPoint.x
        const dy = vy - localPoint.y
        const dz = vz - localPoint.z
        const distSq = dx * dx + dy * dy + dz * dz
        if (distSq > brushRadius * brushRadius) continue

        const dist = Math.sqrt(distSq)
        const falloff = 0.5 * (Math.cos(Math.PI * dist / brushRadius) + 1)

        // Deslocar ao longo da normal
        if (normals) {
          const nx = normals[i]
          const ny = normals[i + 1]
          const nz = normals[i + 2]
          positions[i] += nx * falloff * brushStrength
          positions[i + 1] += ny * falloff * brushStrength
          positions[i + 2] += nz * falloff * brushStrength
        } else {
          // Sem normal: deslocar em Y
          positions[i + 1] += falloff * brushStrength
        }
      }

      // Actualizar geometria no store + flag needsUpdate no mesh three.js
      updateObject(selectedId, {
        customGeometry: {
          ...obj.customGeometry,
          positions: [...positions],
          normals: normals ? [...normals] : null,
        }
      })
      // Forçar recálculo visual (SceneObject usa useMemo em customGeometry)
      if (mesh.geometry.attributes.position) {
        mesh.geometry.attributes.position.needsUpdate = true
        mesh.geometry.computeVertexNormals()
      }
    }

    const onPointerDown = (e) => {
      if (e.button !== undefined && e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      doStroke(e.clientX, e.clientY)
    }

    const onPointerMove = (e) => {
      if (isDragging) {
        const now = performance.now()
        if (now - lastApplyRef.current > 33) { // ~30fps throttle
          lastApplyRef.current = now
          doStroke(e.clientX, e.clientY)
        }
      }
    }

    const onPointerUp = () => {
      setIsDragging(false)
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [isActive, selectedId, objects, gl, camera, raycaster, updateObject])

  if (!isActive) return null

  return (
    <>
      {/* Cursor 3D no viewport */}
      {cursorPos && (
        <mesh ref={cursorRef} position={cursorPos}>
          <ringGeometry args={[0.2, 0.3, 16]} />
          <meshBasicMaterial color="#2f81f7" transparent opacity={0.6} side={THREE.DoubleSide} />
        </mesh>
      )}
      {/* Ponto central do pincel */}
      {cursorPos && (
        <mesh position={cursorPos}>
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="#2f81f7" />
        </mesh>
      )}
    </>
  )
}

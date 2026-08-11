/**
 * SkeletonGizmo — renderiza o esqueleto (ossos) sobreposto ao modelo no viewport 3D.
 *
 * Mostra:
 *  - Linhas entre ossos pai-filho (hierarquia)
 *  - Pontos nos ossos (joints)
 *  - Osso selecionado destacado em cor diferente
 *
 * Só é renderizado quando:
 *  - Há um objeto selecionado com skeleton
 *  - O modo é 'rig' ou 'animate' (para não atrapalhar edição normal)
 */
import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store/useStore'

export default function SkeletonGizmo({ meshRef }) {
  const selectedId = useStore((s) => s.selectedId)
  const mode = useStore((s) => s.mode)
  const objects = useStore((s) => s.objects)
  const selectedBoneId = useStore((s) => s.selectedBoneId)
  const groupRef = useRef()

  const obj = objects.find((o) => o.id === selectedId)
  if (!obj || !obj.skeleton || !obj.skeleton.bones || obj.skeleton.bones.length === 0) return null

  // Só mostra em modo rig/animate (não atrapalha edit/sculpt)
  if (mode !== 'rig' && mode !== 'animate' && mode !== 'object') return null

  const bones = obj.skeleton.bones

  // Construir linhas entre pai e filho
  const lineSegments = useMemo(() => {
    const points = []
    for (const bone of bones) {
      if (bone.parentId) {
        const parent = bones.find((b) => b.id === bone.parentId)
        if (parent) {
          points.push(
            parent.position[0], parent.position[1], parent.position[2],
            bone.position[0], bone.position[1], bone.position[2]
          )
        }
      }
    }
    return points
  }, [bones])

  // Construir pontos (joints)
  const jointPositions = useMemo(() => {
    return bones.flatMap((b) => [b.position[0], b.position[1], b.position[2]])
  }, [bones])

  const lineGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(lineSegments, 3))
    return geo
  }, [lineSegments])

  const jointGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(jointPositions, 3))
    return geo
  }, [jointPositions])

  // Geometry para o osso selecionado
  const selectedBone = bones.find((b) => b.id === selectedBoneId)
  const selectedBoneGeometry = useMemo(() => {
    if (!selectedBone) return null
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      selectedBone.position[0], selectedBone.position[1], selectedBone.position[2]
    ], 3))
    return geo
  }, [selectedBone])

  return (
    <group ref={groupRef} position={obj.position || [0, 0, 0]} rotation={obj.rotation || [0, 0, 0]} scale={obj.scale || [1, 1, 1]}>
      {/* Linhas entre ossos (hierarquia) — brancas subtis */}
      <lineSegments geometry={lineGeometry}>
        <lineBasicMaterial color="#ffffff" transparent opacity={0.4} depthTest={false} />
      </lineSegments>

      {/* Joints (pontos) — azul para não selecionados */}
      <points geometry={jointGeometry}>
        <pointsMaterial size={0.08} color="#3b82f6" sizeAttenuation depthTest={false} />
      </points>

      {/* Osso selecionado — destacado em amarelo, maior */}
      {selectedBoneGeometry && (
        <points geometry={selectedBoneGeometry}>
          <pointsMaterial size={0.15} color="#f59e0b" sizeAttenuation depthTest={false} />
        </points>
      )}
    </group>
  )
}

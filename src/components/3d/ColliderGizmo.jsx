/**
 * ColliderGizmo — gizmo visual do colisor independente do modelo.
 *
 * Sistema 1: Mostra o colisor (caixa/esfera/cápsula) em wireframe verde,
 * separado do gizmo de transformação do modelo visual.
 *
 * Só aparece no editor (não no modo jogo) e apenas quando o conect tem
 * hasPhysics e colliderShape definido.
 */
import { useMemo } from 'react'
import * as THREE from 'three'

export default function ColliderGizmo({ conect, isSelected = false }) {
  // Só mostrar no editor e para conects com física
  // (assume-se que isGameMode é tratado pelo caller)

  const shape = conect.colliderShape || 'model'

  // Não mostrar gizmo se for "model" (usa o próprio mesh)
  if (shape === 'model' || !shape) return null

  const offset = conect.colliderOffset || [0, 0, 0]
  const size = conect.colliderSize || [1, 1, 1]
  const radius = Math.max(0.05, conect.colliderRadius || 0.5)
  const height = Math.max(0.1, conect.colliderHeight || 1.5)

  // Cor do gizmo: verde brilhante quando selecionado, verde mais escuro caso contrário
  const color = isSelected ? '#3fb950' : '#2a9d8f'

  const gizmoPosition = [offset[0], offset[1], offset[2]]

  return (
    <group position={gizmoPosition}>
      {shape === 'box' && (
        <mesh>
          <boxGeometry args={[size[0], size[1], size[2]]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.7} />
        </mesh>
      )}
      {shape === 'sphere' && (
        <mesh>
          <sphereGeometry args={[radius, 16, 12]} />
          <meshBasicMaterial color={color} wireframe transparent opacity={0.7} />
        </mesh>
      )}
      {shape === 'capsule' && (
        <>
          {/* Corpo cilíndrico */}
          <mesh>
            <cylinderGeometry args={[radius, radius, height, 16]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.7} />
          </mesh>
          {/* Tampas esféricas */}
          <mesh position={[0, height / 2, 0]}>
            <sphereGeometry args={[radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.7} />
          </mesh>
          <mesh position={[0, -height / 2, 0]} rotation={[Math.PI, 0, 0]}>
            <sphereGeometry args={[radius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshBasicMaterial color={color} wireframe transparent opacity={0.7} />
          </mesh>
        </>
      )}
    </group>
  )
}

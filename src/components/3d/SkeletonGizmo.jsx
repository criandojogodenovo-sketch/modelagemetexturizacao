/**
 * SkeletonGizmo — visualização 3D do esqueleto sobreposto ao modelo.
 *
 * Mostra cada osso como uma linha + octaedro (estilo Blender),
 * com cores diferentes para o osso selecionado.
 *
 * Só é visível no editor (não no modo jogo).
 */
import * as THREE from 'three'

export default function SkeletonGizmo({ skeleton, selectedBoneId, onSelectBone }) {
  if (!skeleton || !skeleton.bones || skeleton.bones.length === 0) return null

  const bones = skeleton.bones

  return (
    <group>
      {bones.map((bone, i) => {
        const isSelected = bone.id === selectedBoneId
        const color = isSelected ? '#3fb950' : '#f4a261'

        // Posição do osso
        const pos = bone.position || [0, 0, 0]

        // Calcular posição do fim do osso (para a linha)
        const length = bone.length || 0.5
        const endPos = [pos[0], pos[1] + length, pos[2]]

        // Se tem pai, a linha vai do pai até este osso
        const parent = bone.parentId ? bones.find(b => b.id === bone.parentId) : null
        const lineStart = parent ? parent.position : pos
        const lineEnd = pos

        return (
          <group key={bone.id}>
            {/* Linha do osso (do início ao fim) */}
            <line
              onClick={(e) => { e.stopPropagation(); onSelectBone?.(bone.id) }}
              onPointerDown={(e) => { e.stopPropagation(); onSelectBone?.(bone.id) }}
            >
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([...lineStart, ...lineEnd])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color={color} linewidth={2} />
            </line>

            {/* Octaedro no início do osso (junta) */}
            <mesh
              position={pos}
              onClick={(e) => { e.stopPropagation(); onSelectBone?.(bone.id) }}
              onPointerDown={(e) => { e.stopPropagation(); onSelectBone?.(bone.id) }}
            >
              <octahedronGeometry args={[0.04, 0]} />
              <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.9} />
            </mesh>

            {/* Ponto no fim do osso */}
            <mesh position={endPos}>
              <sphereGeometry args={[0.025, 8, 6]} />
              <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.7} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

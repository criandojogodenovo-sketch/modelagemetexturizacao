/**
 * ConectRenderer — renderiza um Conect na cena 3D.
 *
 * Dependendo do tipo de Conect:
 *  - VisualObject: renderiza o modelo do catálogo (sourceObjectId)
 *  - RigidObject/StaticObject/StopObject: renderiza um cubo placeholder + física
 *  - PersonalObject: renderiza um capsule/cubo como jogador
 *  - TriggerObject: renderiza um wireframe transparente (não visível no jogo)
 *  - LuminousObject: adiciona uma luz à cena
 *  - ParticleObject: sistema de partículas
 *  - TerrainObject: terreno com heightmap
 *  - WaterObject: plano de água
 *  - PathObject: renderiza waypoints
 *  - CheckpointObject: renderiza uma bandeira/marca
 *  - Outros (UI, Sound, Sky, Fog, View, etc.): sem visual 3D (só lógica)
 */
import { forwardRef, useMemo, useEffect } from 'react'
import * as THREE from 'three'
import { useStore } from '../../store/useStore'
import { findConectDefinition } from '../../utils/conects/taxonomy'
import SceneObject from '../3d/SceneObject'

const ConectRenderer = forwardRef(function ConectRenderer({ conect, objects, setMeshRef }, meshRef) {
  const def = findConectDefinition(conect.type)

  // Se não tem visual, não renderiza mesh — mas pode adicionar luzes, etc.
  if (conect.type === 'LuminousObject') {
    return <LuminousMesh conect={conect} />
  }

  if (conect.type === 'TerrainObject') {
    return <TerrainMesh conect={conect} setMeshRef={setMeshRef} />
  }

  if (conect.type === 'WaterObject') {
    return <WaterMesh conect={conect} setMeshRef={setMeshRef} />
  }

  if (conect.type === 'PathObject') {
    return <PathMesh conect={conect} setMeshRef={setMeshRef} />
  }

  if (conect.type === 'CheckpointObject') {
    return <CheckpointMesh conect={conect} setMeshRef={setMeshRef} />
  }

  if (conect.type === 'ParticleObject') {
    return <ParticleMesh conect={conect} setMeshRef={setMeshRef} />
  }

  if (!def?.hasVisual && conect.type !== 'VisualObject') {
    // Sem visual — ligar o meshRef a null para que physics não tente usar
    useEffect(() => { setMeshRef?.(null) }, [])
    return null
  }

  // VisualObject: usa modelo do catálogo
  if (conect.type === 'VisualObject') {
    const obj = objects.find((o) => o.id === conect.sourceObjectId)
    if (!obj) return null
    const sceneObj = {
      ...obj,
      id: conect.instanceId,
      position: conect.position,
      rotation: conect.rotation,
      scale: conect.scale,
    }
    return (
      <SceneObject
        ref={(node) => setMeshRef?.(node)}
        obj={sceneObj}
        isSelected={false}
        onSelect={() => {}}
      />
    )
  }

  // Rigid/Static/Stop/Personal: placeholder com geometria simples
  return (
    <PlaceholderMesh
      ref={(node) => {
        if (typeof meshRef === 'function') meshRef(node)
        else if (meshRef) meshRef.current = node
        setMeshRef?.(node)
      }}
      conect={conect}
    />
  )
})

export default ConectRenderer

// ===== Placeholder para conects com física =====
const PlaceholderMesh = forwardRef(function PlaceholderMesh({ conect }, ref) {
  const color = conect.type === 'PersonalObject' ? '#3fb950'
                : conect.type === 'StaticObject' ? '#6e7681'
                : conect.type === 'StopObject' ? '#d29922'
                : '#888888'
  const geometry = conect.type === 'PersonalObject'
    ? <capsuleGeometry args={[0.4, 1, 8, 16]} />
    : <boxGeometry args={[1, 1, 1]} />
  return (
    <mesh
      ref={ref}
      position={conect.position}
      rotation={conect.rotation}
      scale={conect.scale}
      visible={conect.visible !== false}
      castShadow
      receiveShadow
      userData={{ conectInstanceId: conect.instanceId }}
    >
      {geometry}
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.1} />
    </mesh>
  )
})

// ===== LuminousObject =====
function LuminousMesh({ conect }) {
  const props = {
    position: conect.position,
    intensity: conect.intensity,
    color: conect.color,
    castShadow: conect.castShadow,
  }
  if (conect.lightType === 'directional') {
    return <directionalLight {...props} />
  }
  if (conect.lightType === 'spot') {
    return <spotLight {...props} distance={conect.distance} angle={Math.PI / 4} penumbra={0.3} />
  }
  return <pointLight {...props} distance={conect.distance} />
}

// ===== TerrainObject =====
function TerrainMesh({ conect, setMeshRef }) {
  const geometry = useMemo(() => {
    const seg = conect.segments || 64
    const g = new THREE.PlaneGeometry(
      conect.width || 50, conect.depth || 50, seg, seg
    )
    g.rotateX(-Math.PI / 2)
    const positions = g.attributes.position
    const heightScale = conect.heightScale || 5

    // Se há heightmap exportado do TerrainEditor, usá-lo
    if (conect.heightmap && conect.heightmap.length > 0) {
      const hm = conect.heightmap
      // positions.count = (seg+1) * (seg+1) que deve bater com hm.length
      for (let i = 0; i < positions.count && i < hm.length; i++) {
        positions.setY(i, hm[i] * heightScale)
      }
    } else {
      // Fallback: gerar procedural
      const seed = conect.heightmapSeed || 1
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i)
        const z = positions.getZ(i)
        const h =
          Math.sin(x * 0.3 + seed) * Math.cos(z * 0.3 + seed) * 0.5 +
          Math.sin(x * 0.1 + z * 0.1) * 0.3
        positions.setY(i, h * heightScale)
      }
    }
    g.computeVertexNormals()
    return g
  }, [conect.width, conect.depth, conect.segments, conect.heightScale, conect.heightmapSeed, conect.heightmap])

  return (
    <mesh
      ref={setMeshRef}
      geometry={geometry}
      position={conect.position}
      receiveShadow
      castShadow
    >
      <meshStandardMaterial
        color={conect.textureColor || '#5a7d3a'}
        roughness={0.9}
        metalness={0}
      />
    </mesh>
  )
}

// ===== WaterObject =====
function WaterMesh({ conect, setMeshRef }) {
  return (
    <mesh
      ref={setMeshRef}
      position={conect.position}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <planeGeometry args={conect.size || [20, 20]} />
      <meshStandardMaterial
        color={conect.color}
        transparent
        opacity={conect.opacity}
        roughness={0.1}
        metalness={0.3}
      />
    </mesh>
  )
}

// ===== PathObject =====
function PathMesh({ conect, setMeshRef }) {
  if (!conect.points || conect.points.length === 0) return null
  return (
    <group ref={setMeshRef} position={conect.position}>
      {conect.points.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.15, 12, 12]} />
          <meshBasicMaterial color="#2f81f7" />
        </mesh>
      ))}
      {/* Linhas entre pontos */}
      {conect.points.length > 1 && (
        <Line points={conect.points} loop={conect.loop} />
      )}
    </group>
  )
}

function Line({ points, loop }) {
  const geometry = useMemo(() => {
    const pts = loop ? [...points, points[0]] : points
    return new THREE.BufferGeometry().setFromPoints(pts.map((p) => new THREE.Vector3(...p)))
  }, [points, loop])
  return (
    <line geometry={geometry}>
      <lineBasicMaterial color="#2f81f7" transparent opacity={0.5} />
    </line>
  )
}

// ===== CheckpointObject =====
function CheckpointMesh({ conect, setMeshRef }) {
  return (
    <group ref={setMeshRef} position={conect.position}>
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[0.05, 0.05, 2, 8]} />
        <meshStandardMaterial color="#888" />
      </mesh>
      <mesh position={[0.3, 1.7, 0]}>
        <planeGeometry args={[0.5, 0.3]} />
        <meshStandardMaterial color={conect.isStart ? '#3fb950' : '#f4a261'} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ===== ParticleObject =====
function ParticleMesh({ conect, setMeshRef }) {
  const particles = useMemo(() => {
    const arr = []
    const count = Math.min(conect.maxParticles || 100, 500)
    for (let i = 0; i < count; i++) {
      arr.push({
        position: [
          (Math.random() - 0.5) * (conect.spread || 1),
          Math.random() * 0.5,
          (Math.random() - 0.5) * (conect.spread || 1),
        ],
        size: 0.02 + Math.random() * (conect.particleSize || 0.1),
      })
    }
    return arr
  }, [conect.maxParticles, conect.particleSize, conect.spread])

  return (
    <group ref={setMeshRef} position={conect.position}>
      {particles.map((p, i) => (
        <mesh key={i} position={p.position}>
          <sphereGeometry args={[p.size, 6, 6]} />
          <meshBasicMaterial color={conect.color} transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

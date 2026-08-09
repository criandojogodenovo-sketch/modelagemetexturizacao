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
    return <LuminousMesh conect={conect} setMeshRef={setMeshRef} />
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

  // ViewObject: renderiza um gizmo de câmara visível no editor (selecionável)
  if (conect.type === 'ViewObject') {
    return <ViewObjectMesh conect={conect} setMeshRef={setMeshRef} />
  }

  // TrailObject: rasto visual atrás de um objeto em movimento
  if (conect.type === 'TrailObject') {
    return <TrailMesh conect={conect} setMeshRef={setMeshRef} />
  }

  // ReflectObject: sonda de reflexo (renderiza uma esfera espelhada)
  if (conect.type === 'ReflectObject') {
    return <ReflectMesh conect={conect} setMeshRef={setMeshRef} />
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
  var color = '#888888'
  if (conect.type === 'PersonalObject') color = '#3fb950'
  else if (conect.type === 'StaticObject') color = '#6e7681'
  else if (conect.type === 'StopObject') color = '#d29922'
  else if (conect.type === 'RigidObject') color = '#f4a261'
  else if (conect.type === 'NpcObject') color = '#f85149'
  else if (conect.type === 'WeaponObject') color = '#8957e5'
  else if (conect.type === 'ItemObject') color = '#3fb950'
  var geometry
  var castShadow = true
  if (conect.type === 'PersonalObject') {
    geometry = <capsuleGeometry args={[0.4, 1, 8, 16]} />
  } else if (conect.type === 'WeaponObject') {
    geometry = <boxGeometry args={[0.15, 0.2, 0.8]} />
  } else if (conect.type === 'ItemObject') {
    geometry = <sphereGeometry args={[0.3, 16, 12]} />
  } else if (conect.type === 'NpcObject') {
    // OTIMIZAÇÃO: NPCs usam geometria mais simples e não projetam sombra
    geometry = <capsuleGeometry args={[0.3, 1.2, 4, 8]} />
    castShadow = false
  } else {
    geometry = <boxGeometry args={[1, 1, 1]} />
  }
  return (
    <mesh
      ref={ref}
      position={conect.position}
      rotation={conect.rotation}
      scale={conect.scale}
      visible={conect.visible !== false}
      castShadow={castShadow}
      receiveShadow
      userData={{ conectInstanceId: conect.instanceId }}
    >
      {geometry}
      <meshStandardMaterial color={color} roughness={0.6} metalness={0.1}
        emissive={conect.type === 'ItemObject' ? color : '#000'}
        emissiveIntensity={conect.type === 'ItemObject' ? 0.3 : 0}
      />
    </mesh>
  )
})

// ===== LuminousObject =====
// Luz real + gizmo visual (esfera amarela) para seleção no editor
function LuminousMesh({ conect, setMeshRef }) {
  const lightProps = {
    intensity: conect.intensity,
    color: conect.color,
    castShadow: conect.castShadow,
  }
  let lightElement
  if (conect.lightType === 'directional') {
    lightElement = <directionalLight {...lightProps} position={[0, 0, 0]} />
  } else if (conect.lightType === 'spot') {
    lightElement = <spotLight {...lightProps} distance={conect.distance} angle={Math.PI / 4} penumbra={0.3} position={[0, 0, 0]} />
  } else {
    lightElement = <pointLight {...lightProps} distance={conect.distance} position={[0, 0, 0]} />
  }
  return (
    <group
      ref={setMeshRef}
      position={conect.position}
      rotation={conect.rotation}
      userData={{ conectInstanceId: conect.instanceId }}
    >
      {lightElement}
      {/* Gizmo visual: esfera amarela para seleção */}
      <mesh>
        <sphereGeometry args={[0.2, 12, 12]} />
        <meshBasicMaterial color="#ffd700" />
      </mesh>
      {/* Halo ao redor */}
      <mesh>
        <sphereGeometry args={[0.35, 12, 12]} />
        <meshBasicMaterial color="#ffd700" transparent opacity={0.2} />
      </mesh>
    </group>
  )
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

    // Vertex colors from splatmap (multi-layer blending) — P7
    if (conect.splatmap && conect.textureLayers && conect.splatmap.length > 0) {
      const maxLayers = conect.maxLayers || 4
      const layers = conect.textureLayers
      const colors = new Float32Array(positions.count * 3)
      const sm = conect.splatmap
      const hexToRgb = (hex) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255
        const g = parseInt(hex.slice(3, 5), 16) / 255
        const b = parseInt(hex.slice(5, 7), 16) / 255
        return [r, g, b]
      }
      const layerRgb = layers.map((l) => hexToRgb(l.color || '#5a7d3a'))
      for (let i = 0; i < positions.count; i++) {
        let r = 0, g = 0, b = 0
        for (let l = 0; l < maxLayers && l < layers.length; l++) {
          const w = sm[i * maxLayers + l] || 0
          const c = layerRgb[l] || [0.35, 0.49, 0.23]
          r += c[0] * w
          g += c[1] * w
          b += c[2] * w
        }
        colors[i * 3] = r
        colors[i * 3 + 1] = g
        colors[i * 3 + 2] = b
      }
      g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    }

    return g
  }, [conect.width, conect.depth, conect.segments, conect.heightScale, conect.heightmapSeed, conect.heightmap, conect.splatmap, conect.textureLayers, conect.maxLayers])

  const hasVertexColors = !!(conect.splatmap && conect.textureLayers && conect.splatmap.length > 0)

  return (
    <mesh
      ref={setMeshRef}
      geometry={geometry}
      position={conect.position}
      receiveShadow
      castShadow
    >
      <meshStandardMaterial
        color={hasVertexColors ? '#ffffff' : (conect.textureColor || '#5a7d3a')}
        vertexColors={hasVertexColors}
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

// ===== ViewObject (câmara visível no editor) =====
function ViewObjectMesh({ conect, setMeshRef }) {
  return (
    <group
      ref={setMeshRef}
      position={conect.position}
      rotation={conect.rotation}
      scale={conect.scale}
      userData={{ conectInstanceId: conect.instanceId, isViewObject: true }}
    >
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.35, 0.6]} />
        <meshStandardMaterial color="#f4a261" emissive="#f4a261" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[0, 0, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.22, 0.3, 16]} />
        <meshStandardMaterial color="#2a9d8f" emissive="#2a9d8f" emissiveIntensity={0.1} />
      </mesh>
      <mesh position={[0, 0, -1.5]}>
        <coneGeometry args={[1, 2, 4, 1, true]} />
        <meshBasicMaterial color="#f4a261" wireframe transparent opacity={0.3} />
      </mesh>
      {/* Indicador do papel da câmara */}
      {conect.cameraRole && (
        <mesh position={[0, 0.4, 0]}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial color={
            conect.cameraRole === 'player' ? '#2f81f7'
            : conect.cameraRole === 'primary' ? '#3fb950'
            : '#d29922' // secondary
          } />
        </mesh>
      )}
      {/* Label do papel */}
      {conect.cameraRole && (
        <mesh position={[0, 0.6, 0]}>
          <boxGeometry args={[0.02, 0.02, 0.02]} />
          <meshBasicMaterial color={
            conect.cameraRole === 'player' ? '#2f81f7'
            : conect.cameraRole === 'primary' ? '#3fb950'
            : '#d29922'
          } />
        </mesh>
      )}
    </group>
  )
}

// ===== TrailObject (rasto visual) =====
// Renderiza uma linha que segue a posição do objeto pai.
// Em tempo de execução, o GameRunner atualiza as posições do trail.
function TrailMesh({ conect, setMeshRef }) {
  const points = useMemo(() => {
    const arr = []
    const len = conect.length || 30
    for (let i = 0; i < len; i++) {
      arr.push(new THREE.Vector3(conect.position[0], conect.position[1], conect.position[2]))
    }
    return arr
  }, [conect.length])

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry().setFromPoints(points)
    return g
  }, [points])

  return (
    <group ref={setMeshRef} position={conect.position}>
      <line geometry={geometry}>
        <lineBasicMaterial
          color={conect.color || '#2f81f7'}
          transparent
          opacity={conect.fade !== false ? 0.6 : 1}
          linewidth={conect.width || 2}
        />
      </line>
    </group>
  )
}

// ===== ReflectObject (sonda de reflexo) =====
// Renderiza uma esfera com material metálico que reflete o ambiente.
// Em implementação completa, capturaria o ambiente num cubemap.
function ReflectMesh({ conect, setMeshRef }) {
  return (
    <mesh ref={setMeshRef} position={conect.position}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial
        color="#c0c0c0"
        metalness={1.0}
        roughness={0.0}
        envMapIntensity={conect.intensity || 1}
      />
    </mesh>
  )
}

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
import { forwardRef, useMemo, useEffect, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../../store/useStore'
import { findConectDefinition } from '../../utils/conects/taxonomy'
import { createWaterProMaterial } from '../../utils/waterShaderPro'
import { createSkyProMaterial, calculateSunDirection } from '../../utils/skyShaderPro'
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

  // SkyObject: renderiza esfera de céu com shader procedural
  if (conect.type === 'SkyObject') {
    return <SkyMesh conect={conect} setMeshRef={setMeshRef} />
  }

  // SunObject: luz direcional (sol)
  if (conect.type === 'SunObject') {
    return <SunLightMesh conect={conect} setMeshRef={setMeshRef} />
  }

  // PointObject: luz pontual
  if (conect.type === 'PointObject') {
    return <PointLightMesh conect={conect} setMeshRef={setMeshRef} />
  }

  // SpotObject: luz spot
  if (conect.type === 'SpotObject') {
    return <SpotLightMesh conect={conect} setMeshRef={setMeshRef} />
  }

  // AmbientObject: luz ambiente (sem gizmo, só aplica à cena)
  if (conect.type === 'AmbientObject') {
    return <AmbientLightMesh conect={conect} setMeshRef={setMeshRef} />
  }

  // ReferenceObject: renderiza conteúdo de outra cena
  if (conect.type === 'ReferenceObject') {
    return <ReferenceMesh conect={conect} setMeshRef={setMeshRef} />
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
  const meshRef = useRef()
  const time = useRef(0)
  const waterQuality = useStore((s) => s.renderSettings?.waterQuality || 'basic')

  // Material Pro (Gerstner + caustics + IOR + Fresnel) quando quality = professional
  const proMaterial = useMemo(() => {
    if (waterQuality !== 'professional') return null
    return createWaterProMaterial({
      color: conect.color || '#2f81f7',
      deepColor: conect.deepColor || '#0a3d5c',
      opacity: conect.opacity ?? 0.85,
      waveHeight: conect.waveHeight ?? 0.2,
      waveSpeed: conect.waveSpeed ?? 0.5,
      waterMode: conect.waterMode || 'lake',
      flowDirection: conect.flowDirection || 0,
      foamEnabled: conect.foamEnabled !== false,
      foamThreshold: conect.foamThreshold ?? 0.7,
      depthGradient: conect.depthGradient !== false,
      skyColor: '#88aacc',
    })
  }, [waterQuality, conect.color, conect.deepColor, conect.opacity, conect.waveHeight,
      conect.waveSpeed, conect.waterMode, conect.flowDirection, conect.foamEnabled,
      conect.foamThreshold, conect.depthGradient])

  const geometry = useMemo(() => {
    const [w, h] = conect.size || [20, 20]
    const segs = waterQuality === 'professional' ? 48 : 32
    const g = new THREE.PlaneGeometry(w, h, segs, segs)
    g.rotateX(-Math.PI / 2)
    return g
  }, [conect.size, waterQuality])

  // Animar ondas no useFrame (apenas para water básico; Pro usa shader)
  useFrame((state, delta) => {
    if (!meshRef.current) return
    if (proMaterial) {
      // Pro: actualizar uniforms do shader
      if (proMaterial.uniforms) {
        proMaterial.uniforms.uTime.value += delta
        proMaterial.uniforms.uCameraPos.value.copy(state.camera.position)
      }
      return
    }
    // Básico: animar vértices
    time.current += delta * (conect.waveSpeed || 0.5)
    const pos = meshRef.current.geometry.attributes.position
    const waveHeight = conect.waveHeight || 0.1
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      const y = Math.sin(x * 0.5 + time.current) * waveHeight
        + Math.cos(z * 0.5 + time.current * 0.7) * waveHeight * 0.5
      pos.setY(i, y)
    }
    pos.needsUpdate = true
    meshRef.current.geometry.computeVertexNormals()
  })

  return (
    <mesh
      ref={(node) => {
        meshRef.current = node
        if (typeof setMeshRef === 'function') setMeshRef(node)
      }}
      position={conect.position}
      geometry={geometry}
      material={proMaterial || undefined}
    >
      {!proMaterial && (
        <meshStandardMaterial
          color={conect.color || '#2f81f7'}
          transparent
          opacity={conect.opacity ?? 0.6}
          roughness={0.1}
          metalness={0.3}
        />
      )}
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
  const groupRef = useRef()
  const timeRef = useRef(0)

  // Usar BufferGeometry + Points para performance (1 draw call em vez de N)
  const count = Math.min(conect.maxParticles || 100, 300)
  const positionsRef = useRef(new Float32Array(count * 3))
  const velocitiesRef = useRef(new Float32Array(count * 3))
  const lifeRef = useRef(new Float32Array(count))

  // Inicializar partículas
  useMemo(() => {
    const spread = conect.spread || 1
    const speed = conect.particleSpeed || 0.5
    for (let i = 0; i < count; i++) {
      positionsRef.current[i * 3] = (Math.random() - 0.5) * spread
      positionsRef.current[i * 3 + 1] = 0
      positionsRef.current[i * 3 + 2] = (Math.random() - 0.5) * spread
      velocitiesRef.current[i * 3] = (Math.random() - 0.5) * speed
      velocitiesRef.current[i * 3 + 1] = Math.random() * speed + 0.2
      velocitiesRef.current[i * 3 + 2] = (Math.random() - 0.5) * speed
      lifeRef.current[i] = Math.random() * (conect.particleLife || 2)
    }
  }, [count, conect.spread, conect.particleSpeed, conect.particleLife])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positionsRef.current, 3))
    return geo
  }, [])

  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      color: conect.color || '#ffffff',
      size: conect.particleSize || 0.1,
      transparent: true,
      opacity: 0.7,
      sizeAttenuation: true,
      depthWrite: false,
    })
  }, [conect.color, conect.particleSize])

  // Animar partículas no useFrame
  useFrame((_, delta) => {
    timeRef.current += delta
    const positions = positionsRef.current
    const velocities = velocitiesRef.current
    const life = lifeRef.current
    const gravity = conect.gravity ?? -0.5
    const maxLife = conect.particleLife || 2
    const spread = conect.spread || 1

    for (let i = 0; i < count; i++) {
      // Atualizar vida
      life[i] += delta
      if (life[i] >= maxLife) {
        // Reciclar partícula
        positions[i * 3] = (Math.random() - 0.5) * spread
        positions[i * 3 + 1] = 0
        positions[i * 3 + 2] = (Math.random() - 0.5) * spread
        velocities[i * 3] = (Math.random() - 0.5) * (conect.particleSpeed || 0.5)
        velocities[i * 3 + 1] = Math.random() * (conect.particleSpeed || 0.5) + 0.2
        velocities[i * 3 + 2] = (Math.random() - 0.5) * (conect.particleSpeed || 0.5)
        life[i] = 0
      } else {
        // Mover partícula
        positions[i * 3] += velocities[i * 3] * delta
        positions[i * 3 + 1] += velocities[i * 3 + 1] * delta
        positions[i * 3 + 2] += velocities[i * 3 + 2] * delta
        // Aplicar gravidade
        velocities[i * 3 + 1] += gravity * delta
      }
    }
    geometry.attributes.position.needsUpdate = true
  })

  // Cleanup
  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  return (
    <points
      ref={(node) => {
        groupRef.current = node
        if (typeof setMeshRef === 'function') setMeshRef(node)
      }}
      position={conect.position}
      geometry={geometry}
      material={material}
    />
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
  const groupRef = useRef()
  const lineRef = useRef()
  const maxPoints = conect.length || 30
  const positionsRef = useRef(new Float32Array(maxPoints * 3))
  const currentIndexRef = useRef(0)
  const frameCountRef = useRef(0)

  // Inicializar todas as posições na posição inicial do trail
  useMemo(() => {
    const px = conect.position?.[0] || 0
    const py = conect.position?.[1] || 0
    const pz = conect.position?.[2] || 0
    for (let i = 0; i < maxPoints; i++) {
      positionsRef.current[i * 3] = px
      positionsRef.current[i * 3 + 1] = py
      positionsRef.current[i * 3 + 2] = pz
    }
  }, [maxPoints, conect.position])

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positionsRef.current, 3))
    return geo
  }, [])

  // Seguir o followTarget e atualizar o trail
  useFrame(() => {
    if (!conect.followTarget) return
    // Procurar o mesh do followTarget nos conectMeshRefs
    const targetMesh = window._flirConectMeshRefs?.get(conect.followTarget)
      || window._flirMeshRefs?.get(conect.followTarget)
    if (!targetMesh) return

    // Atualizar a cada N frames (não todos os frames — performance)
    const updateInterval = Math.max(1, Math.floor(60 / (conect.updateRate || 30)))
    frameCountRef.current++
    if (frameCountRef.current < updateInterval) return
    frameCountRef.current = 0

    // Shift: mover todos os pontos uma posição para trás
    const positions = positionsRef.current
    for (let i = maxPoints - 1; i > 0; i--) {
      positions[i * 3] = positions[(i - 1) * 3]
      positions[i * 3 + 1] = positions[(i - 1) * 3 + 1]
      positions[i * 3 + 2] = positions[(i - 1) * 3 + 2]
    }
    // Novo ponto na posição do target
    positions[0] = targetMesh.position.x
    positions[1] = targetMesh.position.y
    positions[2] = targetMesh.position.z

    geometry.attributes.position.needsUpdate = true
    geometry.setDrawRange(0, maxPoints)
  })

  // Cleanup
  useEffect(() => {
    return () => { geometry.dispose() }
  }, [geometry])

  return (
    <group ref={setMeshRef} position={[0, 0, 0]}>
      <line ref={lineRef} geometry={geometry}>
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

// ===== SkyObject — esfera de céu com shader procedural =====
function SkyMesh({ conect, setMeshRef }) {
  const { scene } = useThree()
  const meshRef = useRef()

  // Ler propriedades com os nomes correctos da taxonomy
  const skyType = conect.skyType || 'gradient'
  const topColor = conect.topColor || conect.gradientTop || '#1a4d8f'
  const bottomColor = conect.bottomColor || conect.gradientBottom || '#aac4e8'
  const solidColor = conect.solidColor || conect.color || '#87ceeb'

  // Material Pro para procedural (Rayleigh + Mie scattering)
  const proMaterial = useMemo(() => {
    if (skyType !== 'procedural') return null
    // Calcular direção do sol a partir de elevation/azimuth
    const sunDir = calculateSunDirection(
      conect.sunElevation || 25,   // graus
      172,                          // dia do ano (verão)
      0                             // latitude equador
    )
    return createSkyProMaterial({
      sunDirection: sunDir.toArray(),
      sunIntensity: 15,
      rayleigh: conect.rayleigh ?? 2.5,
      mie: 0.5,
      turbidity: conect.turbidity ?? 10,
      starsEnabled: conect.starsEnabled || false,
    })
  }, [skyType, conect.sunElevation, conect.rayleigh, conect.turbidity, conect.starsEnabled])

  // Animar uTime do sky shader
  useFrame((_, delta) => {
    if (proMaterial && proMaterial.uniforms?.uTime) {
      proMaterial.uniforms.uTime.value += delta
    }
  })

  // Aplicar background à cena
  useEffect(() => {
    if (!scene) return
    if (skyType === 'procedural' && proMaterial) {
      // Procedural usa esfera com shader — limpar background para não tapar
      scene.background = null
    } else if (skyType === 'gradient') {
      // Gradiente via canvas
      const canvas = document.createElement('canvas')
      canvas.width = 2; canvas.height = 256
      const ctx = canvas.getContext('2d')
      const grad = ctx.createLinearGradient(0, 0, 0, 256)
      grad.addColorStop(0, topColor)
      grad.addColorStop(1, bottomColor)
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 2, 256)
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      scene.background = tex
      return () => { tex.dispose() }
    } else if (skyType === 'hdri' && conect.hdriUrl) {
      import('three/examples/jsm/loaders/RGBELoader.js').then(({ RGBELoader }) => {
        const loader = new RGBELoader()
        loader.load(conect.hdriUrl, (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping
          scene.background = texture
          scene.environment = texture
        })
      }).catch(() => {
        scene.background = new THREE.Color(solidColor)
      })
    } else {
      // solid
      scene.background = new THREE.Color(solidColor)
    }
  }, [scene, skyType, topColor, bottomColor, solidColor, conect.hdriUrl, proMaterial])

  // Esfera grande com material de céu
  if (skyType === 'procedural' && proMaterial) {
    // Esfera com shader procedural (Rayleigh + Mie)
    return (
      <mesh
        ref={(node) => {
          meshRef.current = node
          if (typeof setMeshRef === 'function') setMeshRef(node)
        }}
        scale={[100, 100, 100]}
        material={proMaterial}
      >
        <sphereGeometry args={[1, 32, 16]} />
      </mesh>
    )
  }
  if (skyType === 'solid' || skyType === 'hdri') {
    return (
      <mesh ref={setMeshRef} scale={[100, 100, 100]}>
        <sphereGeometry args={[1, 32, 16]} />
        <meshBasicMaterial
          color={solidColor}
          side={THREE.BackSide}
          fog={false}
        />
      </mesh>
    )
  }
  // gradient: background canvas, mesh invisível
  return (
    <mesh ref={setMeshRef} visible={false} scale={[0.001, 0.001, 0.001]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial />
    </mesh>
  )
}

// ===== SunObject — luz direcional =====
function SunLightMesh({ conect, setMeshRef }) {
  return (
    <group ref={setMeshRef} position={conect.position}>
      <directionalLight
        color={conect.color || '#ffffff'}
        intensity={conect.intensity ?? 1.5}
        castShadow={conect.castShadow !== false}
      />
      {/* Gizmo esférico para visualizar no editor */}
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color={conect.color || '#ffff00'} />
      </mesh>
    </group>
  )
}

// ===== PointObject — luz pontual =====
function PointLightMesh({ conect, setMeshRef }) {
  return (
    <group ref={setMeshRef} position={conect.position}>
      <pointLight
        color={conect.color || '#ffffff'}
        intensity={conect.intensity ?? 1.0}
        distance={conect.distance || 20}
        decay={2}
      />
      <mesh>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshBasicMaterial color={conect.color || '#ffffff'} />
      </mesh>
    </group>
  )
}

// ===== SpotObject — luz spot =====
function SpotLightMesh({ conect, setMeshRef }) {
  return (
    <group ref={setMeshRef} position={conect.position}>
      <spotLight
        color={conect.color || '#ffffff'}
        intensity={conect.intensity ?? 2.0}
        distance={conect.distance || 30}
        angle={conect.angle ? (conect.angle * Math.PI / 180) : Math.PI / 6}
        penumbra={conect.penumbra ?? 0.3}
        castShadow={conect.castShadow !== false}
      />
      <mesh>
        <coneGeometry args={[0.2, 0.4, 12]} />
        <meshBasicMaterial color={conect.color || '#ffffff'} />
      </mesh>
    </group>
  )
}

// ===== AmbientObject — luz ambiente =====
function AmbientLightMesh({ conect, setMeshRef }) {
  const { scene } = useThree()

  useEffect(() => {
    if (!scene) return
    // Adicionar luz ambiente à cena
    const ambient = new THREE.AmbientLight(
      conect.color || '#ffffff',
      conect.intensity ?? 0.5
    )
    scene.add(ambient)
    return () => { scene.remove(ambient) }
  }, [scene, conect.color, conect.intensity])

  // Sem gizmo visível
  return null
}

// ===== ReferenceObject — renderiza conteúdo de outra cena =====
function ReferenceMesh({ conect, setMeshRef }) {
  const scenes = useStore((s) => s.scenes)
  const targetScene = scenes.find(s => s.id === conect.targetSceneId)

  if (!targetScene) {
    // Sem cena de destino — mostrar gizmo de placeholder
    return (
      <mesh ref={setMeshRef} position={conect.position} rotation={conect.rotation} scale={conect.scale}>
        <boxGeometry args={[0.5, 0.5, 0.5]} />
        <meshBasicMaterial color="#8957e5" wireframe />
      </mesh>
    )
  }

  // Renderizar objetos do catálogo da cena referenciada
  const refObjects = (targetScene.objects || []).map((instance) => {
    const obj = objects.find((o) => o.id === instance.objectId)
    if (!obj) return null
    const sceneObj = {
      ...obj,
      id: `${conect.instanceId}_ref_${instance.instanceId}`,
      position: [
        (conect.position?.[0] || 0) + (instance.position?.[0] || 0),
        (conect.position?.[1] || 0) + (instance.position?.[1] || 0),
        (conect.position?.[2] || 0) + (instance.position?.[2] || 0),
      ],
      rotation: instance.rotation || [0, 0, 0],
      scale: instance.scale || [1, 1, 1],
    }
    return <SceneObject key={instance.instanceId} obj={sceneObj} isSelected={false} onSelect={() => {}} />
  }).filter(Boolean)

  return (
    <group ref={setMeshRef} position={conect.position} rotation={conect.rotation} scale={conect.scale}>
      {refObjects}
    </group>
  )
}

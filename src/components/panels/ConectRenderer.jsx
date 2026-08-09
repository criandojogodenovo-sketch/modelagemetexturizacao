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
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Sky } from 'three/examples/jsm/objects/Sky.js'
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js'
import { useStore } from '../../store/useStore'
import { findConectDefinition } from '../../utils/conects/taxonomy'
import SceneObject from '../3d/SceneObject'

// ===== Helper: converter temperatura Kelvin para cor RGB =====
// Baseado em http://www.tannerhelland.com/4435/convert-temperature-rgb-algorithm-code/
function kelvinToRGB(kelvin) {
  const temp = kelvin / 100
  let r, g, b
  if (temp <= 66) {
    r = 255
    g = 99.4708025861 * Math.log(temp) - 161.1195681661
    b = temp <= 19 ? 0 : 138.5177312231 * Math.log(temp - 10) - 305.0447927307
  } else {
    r = 329.698727446 * Math.pow(temp - 60, -0.1332047592)
    g = 288.1221695283 * Math.pow(temp - 60, -0.0755148492)
    b = 255
  }
  r = Math.max(0, Math.min(255, r)) / 255
  g = Math.max(0, Math.min(255, g)) / 255
  b = Math.max(0, Math.min(255, b)) / 255
  return new THREE.Color(r, g, b)
}

const ConectRenderer = forwardRef(function ConectRenderer({ conect, objects, setMeshRef }, meshRef) {
  const def = findConectDefinition(conect.type)

  // Se não tem visual, não renderiza mesh — mas pode adicionar luzes, etc.
  if (conect.type === 'LuminousObject') {
    return <LuminousMesh conect={conect} setMeshRef={setMeshRef} />
  }

  // Novos tipos de luz (expandir Conects de Luz)
  if (conect.type === 'SunObject') {
    return <SunMesh conect={conect} setMeshRef={setMeshRef} />
  }
  if (conect.type === 'PointObject') {
    return <PointLightMesh conect={conect} setMeshRef={setMeshRef} />
  }
  if (conect.type === 'SpotObject') {
    return <SpotLightMesh conect={conect} setMeshRef={setMeshRef} />
  }
  if (conect.type === 'AreaObject') {
    return <AreaLightMesh conect={conect} setMeshRef={setMeshRef} />
  }
  if (conect.type === 'AmbientObject') {
    return <AmbientLightMesh conect={conect} setMeshRef={setMeshRef} />
  }

  // SkyObject agora tem visual (céu procedural, HDRI, gradient, solid)
  if (conect.type === 'SkyObject') {
    return <SkyMesh conect={conect} setMeshRef={setMeshRef} />
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

  // VisualObject, PersonalObject e NpcObject com sourceObjectId:
  // usam o modelo do catálogo (incluindo esqueleto/animações) via SceneObject.
  // Isto é CRÍTICO — sem isto, o runtime só mostra uma cápsula placeholder
  // e o SkinnedMesh nunca é instanciado.
  if (
    conect.type === 'VisualObject' ||
    ((conect.type === 'PersonalObject' || conect.type === 'NpcObject' || conect.type === 'RigidObject') && conect.sourceObjectId)
  ) {
    const obj = objects.find((o) => o.id === conect.sourceObjectId)
    if (!obj) {
      // sourceObjectId definido mas modelo não encontrado — fallback para placeholder
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
    }
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

  // Rigid/Static/Stop/Personal sem modelo: placeholder com geometria simples
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

// ===== SunObject (luz direcional com temperatura de cor Kelvin) =====
function SunMesh({ conect, setMeshRef }) {
  // Converter temperatura Kelvin para cor RGB
  const color = useMemo(() => kelvinToRGB(conect.temperature || 6500), [conect.temperature])
  // Calcular direção do sol a partir de elevação/azimute
  const sunDirection = useMemo(() => {
    const elev = THREE.MathUtils.degToRad(conect.elevation ?? 45)
    const azim = THREE.MathUtils.degToRad(conect.azimuth ?? 180)
    return [
      Math.cos(elev) * Math.sin(azim),
      Math.sin(elev),
      Math.cos(elev) * Math.cos(azim),
    ]
  }, [conect.elevation, conect.azimuth])

  return (
    <group
      ref={setMeshRef}
      position={conect.position}
      userData={{ conectInstanceId: conect.instanceId, isLight: true, lightType: 'sun' }}
    >
      <directionalLight
        intensity={conect.intensity}
        color={color}
        position={sunDirection}
        castShadow={conect.castShadow}
      />
      {/* Gizmo: sol (esfera laranja + raios paralelos) */}
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color="#ffa500" />
      </mesh>
      {/* Setas paralelas indicando direção da luz */}
      <group position={[0, 0, 0]}>
        {[0, 1, 2].map(i => (
          <mesh key={i} position={[sunDirection[0] * (1 + i * 0.5), sunDirection[1] * (1 + i * 0.5), sunDirection[2] * (1 + i * 0.5)]}>
            <coneGeometry args={[0.08, 0.2, 4]} />
            <meshBasicMaterial color="#ffa500" transparent opacity={0.6} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// ===== PointObject (luz pontual com alcance e atenuação) =====
function PointLightMesh({ conect, setMeshRef }) {
  return (
    <group
      ref={setMeshRef}
      position={conect.position}
      userData={{ conectInstanceId: conect.instanceId, isLight: true, lightType: 'point' }}
    >
      <pointLight
        intensity={conect.intensity}
        color={conect.color}
        distance={conect.distance}
        decay={conect.decay}
        castShadow={conect.castShadow}
      />
      {/* Gizmo: esfera azul (luz pontual) */}
      <mesh>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color={conect.color || '#ffffff'} />
      </mesh>
      {/* Halo */}
      <mesh>
        <sphereGeometry args={[0.35, 16, 16]} />
        <meshBasicMaterial color={conect.color || '#ffffff'} transparent opacity={0.15} />
      </mesh>
      {/* Esfera wireframe a indicar alcance */}
      {conect.distance > 0 && (
        <mesh>
          <sphereGeometry args={[conect.distance, 16, 16]} />
          <meshBasicMaterial color={conect.color || '#ffffff'} wireframe transparent opacity={0.05} />
        </mesh>
      )}
    </group>
  )
}

// ===== SpotObject (holofote com cone) =====
function SpotLightMesh({ conect, setMeshRef }) {
  const targetRef = useRef()
  const angleRad = THREE.MathUtils.degToRad(conect.angle || 45)
  // Calcular posição do target (aponta para -Y do grupo)
  const targetPos = [0, -1, 0]

  useEffect(() => {
    if (targetRef.current) {
      targetRef.current.position.set(...targetPos)
    }
  }, [])

  return (
    <group
      ref={setMeshRef}
      position={conect.position}
      rotation={conect.rotation}
      userData={{ conectInstanceId: conect.instanceId, isLight: true, lightType: 'spot' }}
    >
      <spotLight
        intensity={conect.intensity}
        color={conect.color}
        distance={conect.distance}
        angle={angleRad}
        penumbra={conect.penumbra}
        decay={conect.decay}
        castShadow={conect.castShadow}
        position={[0, 0, 0]}
        target={targetRef.current}
      />
      <object3D ref={targetRef} position={targetPos} />
      {/* Gizmo: cone a indicar direção do holofote */}
      <mesh position={[0, -0.5, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[Math.tan(angleRad) * 1, 1, 16, 1, true]} />
        <meshBasicMaterial color={conect.color || '#ffffff'} wireframe transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      {/* Pequena esfera na fonte */}
      <mesh>
        <sphereGeometry args={[0.15, 12, 12]} />
        <meshBasicMaterial color={conect.color || '#ffffff'} />
      </mesh>
    </group>
  )
}

// ===== AreaObject (luz de área retangular) =====
function AreaLightMesh({ conect, setMeshRef }) {
  const lightRef = useRef()
  // RectAreaLight precisa de RectAreaLightUniformsLib (inicializado no Scene3D)
  useEffect(() => {
    if (lightRef.current) {
      lightRef.current.width = conect.width || 2
      lightRef.current.height = conect.height || 2
    }
  }, [conect.width, conect.height])

  return (
    <group
      ref={setMeshRef}
      position={conect.position}
      rotation={conect.rotation}
      userData={{ conectInstanceId: conect.instanceId, isLight: true, lightType: 'area' }}
    >
      <rectAreaLight
        ref={lightRef}
        intensity={conect.intensity}
        color={conect.color}
        width={conect.width || 2}
        height={conect.height || 2}
        position={[0, 0, 0]}
      />
      {/* Gizmo: retângulo a indicar a área da luz */}
      <mesh>
        <planeGeometry args={[conect.width || 2, conect.height || 2]} />
        <meshBasicMaterial color={conect.color || '#ffffff'} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>
      {/* Wireframe para melhor visibilidade */}
      <mesh>
        <planeGeometry args={[conect.width || 2, conect.height || 2]} />
        <meshBasicMaterial color={conect.color || '#ffffff'} wireframe side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// ===== AmbientObject (luz ambiente com cor de céu/chão) =====
function AmbientLightMesh({ conect, setMeshRef }) {
  return (
    <group
      ref={setMeshRef}
      position={conect.position}
      userData={{ conectInstanceId: conect.instanceId, isLight: true, lightType: 'ambient' }}
    >
      <hemisphereLight
        intensity={conect.intensity}
        color={conect.color}
        groundColor={conect.groundColor}
      />
      {/* Gizmo: esfera cinza semi-transparente (sem direção) */}
      <mesh>
        <sphereGeometry args={[0.3, 16, 16]} />
        <meshBasicMaterial color="#888888" transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

// ===== SkyObject (solid, gradient, hdri, procedural) =====
function SkyMesh({ conect, setMeshRef }) {
  const { scene, gl } = useThree()

  // Criar o objeto Sky uma vez (não recriar a cada render)
  const skyObj = useMemo(() => {
    if (conect.skyType !== 'procedural') return null
    const sky = new Sky()
    sky.scale.setScalar(1000)
    return sky
  }, [conect.skyType])

  // Atualizar uniforms do Sky quando parâmetros mudam
  useEffect(() => {
    if (!skyObj) return
    const sun = new THREE.Vector3()
    const elev = THREE.MathUtils.degToRad(conect.sunElevation ?? 25)
    const azim = THREE.MathUtils.degToRad(conect.sunAzimuth ?? 180)
    sun.setFromSphericalCoords(1, elev, azim)
    skyObj.material.uniforms['sunPosition'].value.copy(sun)
    skyObj.material.uniforms['turbidity'].value = conect.turbidity ?? 10
    skyObj.material.uniforms['rayleigh'].value = conect.rayleigh ?? 1
    skyObj.material.uniforms['mieCoefficient'].value = conect.mieCoefficient ?? 0.005
    skyObj.material.uniforms['mieDirectionalG'].value = 0.8
  }, [skyObj, conect.sunElevation, conect.sunAzimuth, conect.turbidity, conect.rayleigh, conect.mieCoefficient])

  // Aplicar background consoante o tipo
  useEffect(() => {
    if (conect.skyType === 'solid') {
      scene.background = new THREE.Color(conect.solidColor || '#87ceeb')
    } else if (conect.skyType === 'gradient') {
      const canvas = document.createElement('canvas')
      canvas.width = 2
      canvas.height = 256
      const ctx = canvas.getContext('2d')
      const grad = ctx.createLinearGradient(0, 0, 0, 256)
      grad.addColorStop(0, conect.topColor || '#1a4d8f')
      grad.addColorStop(1, conect.bottomColor || '#aac4e8')
      ctx.fillStyle = grad
      ctx.fillRect(0, 0, 2, 256)
      const tex = new THREE.CanvasTexture(canvas)
      tex.colorSpace = THREE.SRGBColorSpace
      scene.background = tex
    } else if (conect.skyType === 'hdri' && conect.hdriUrl) {
      const pmrem = new THREE.PMREMGenerator(gl)
      new RGBELoader().load(conect.hdriUrl, (texture) => {
        const envMap = pmrem.fromEquirectangular(texture).texture
        scene.background = envMap
        scene.environment = envMap
        texture.dispose()
        pmrem.dispose()
      })
    } else if (conect.skyType === 'procedural') {
      // Para procedural, limpar scene.background para que o Sky mesh seja visível
      // (o Sky é um mesh 3D que renderiza o céu)
      scene.background = null
    }
  }, [conect.skyType, conect.solidColor, conect.topColor, conect.bottomColor, conect.hdriUrl, scene, gl])

  // Adicionar Sky diretamente à cena se for procedural
  useEffect(() => {
    if (conect.skyType === 'procedural' && skyObj) {
      scene.add(skyObj)
      return () => { scene.remove(skyObj) }
    }
  }, [skyObj, scene, conect.skyType])

  if (conect.skyType === 'procedural' && skyObj) {
    return (
      <group ref={setMeshRef} userData={{ conectInstanceId: conect.instanceId }}>
        {conect.starsEnabled && <StarsMesh />}
        {/* Sky é adicionado diretamente à cena via useEffect acima */}
        <mesh visible={false}>
          <sphereGeometry args={[0.1, 8, 8]} />
          <meshBasicMaterial />
        </mesh>
      </group>
    )
  }

  return (
    <group ref={setMeshRef} userData={{ conectInstanceId: conect.instanceId }}>
      <mesh visible={false}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial />
      </mesh>
    </group>
  )
}

// Componente auxiliar: estrelas (Points)
function StarsMesh() {
  const points = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    const count = 1000
    const positions = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      // Distribuir numa esfera de raio 800
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      const r = 800
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.cos(phi)
      positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return geo
  }, [])
  return (
    <points geometry={points}>
      <pointsMaterial color="#ffffff" size={1.5} sizeAttenuation={false} transparent opacity={0.8} />
    </points>
  )
}

// ===== WaterObject (com ondas e reflexos via THREE.Water) =====

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

// ===== WaterObject (com ondas animadas via vertex displacement) =====
function WaterMesh({ conect, setMeshRef }) {
  const meshRef = useRef()
  const time = useRef(0)

  // Geometria com subdivisões para ondas
  const geometry = useMemo(() => {
    const [w, h] = conect.size || [20, 20]
    const g = new THREE.PlaneGeometry(w, h, 32, 32)
    g.rotateX(-Math.PI / 2)
    return g
  }, [conect.size])

  // Animar ondas no useFrame
  useFrame((_, delta) => {
    time.current += delta * (conect.waveSpeed || 0.5)
    if (!meshRef.current) return
    const pos = meshRef.current.geometry.attributes.position
    const waveHeight = conect.waveHeight || 0.1
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i)
      const z = pos.getZ(i)
      // Ondas senoidais combinadas
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
    >
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

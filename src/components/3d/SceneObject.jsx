/**
 * SceneObject — renderiza um único objeto da cena no Three.js.
 *
 * Responsabilidades:
 *  - Construir geometria (primitiva, importada, ou customGeometry de edit mode)
 *  - Aplicar modificadores não destrutivos (subdivision, mirror, array, solidify)
 *  - Construir material PBR com cor, roughness, metalness, emissive, opacity,
 *    map, normalMap, múltiplas camadas de textura
 *  - Aplicar repeat/offset (tiling UV)
 *  - Suportar seleção visual
 *  - Receber pointer events para seleção
 *  - Forward ref do mesh para o parent usar com TransformControls
 *  - Suportar skeleton (ossos) para animação
 */
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { PRIMITIVES } from '../../utils/primitives'
import {
  subdivide,
  mirrorGeometry,
  arrayGeometry,
  solidifyGeometry,
  bevelGeometry,
  displaceGeometry as meshDisplaceGeometry,
  taperGeometry as meshTaperGeometry,
  twistGeometry as meshTwistGeometry,
  bendGeometry as meshBendGeometry,
  smoothGeometry as meshSmoothGeometry,
  decimateGeometry,
} from '../../utils/meshOperations'
import { compositeTextureLayers } from '../../utils/textureCompositor'

// Cache de texturas carregadas a partir de dataURLs
const textureCache = new Map()

export function loadTexture(dataURL) {
  if (!dataURL) return null
  if (textureCache.has(dataURL)) return textureCache.get(dataURL)
  const loader = new THREE.TextureLoader()
  const tex = loader.load(dataURL)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  textureCache.set(dataURL, tex)
  return tex
}

// === Implementações de modificadores locais ===

// Wireframe — converte para LineSegments
function wireframeGeometry(geometry, thickness = 0.02) {
  const edges = new THREE.EdgesGeometry(geometry)
  const wireGeo = new THREE.BufferGeometry()
  const positions = edges.attributes.position.array
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  return wireGeo
}

// Spherify — deforma em direcção a uma esfera
function spherifyGeometry(geometry, factor = 0.5) {
  const pos = geometry.attributes.position
  geometry.computeBoundingSphere()
  const radius = geometry.boundingSphere.radius
  const center = geometry.boundingSphere.center
  const v = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const dir = v.clone().sub(center).normalize()
    const target = center.clone().addScaledVector(dir, radius)
    v.lerp(target, factor)
    pos.setXYZ(i, v.x, v.y, v.z)
  }
  pos.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

// Aplica a stack de modificadores a uma geometria
function applyModifiers(geometry, modifiers) {
  if (!modifiers || modifiers.length === 0) return geometry
  let result = geometry
  for (const mod of modifiers) {
    if (!mod.enabled) continue
    try {
      switch (mod.type) {
        case 'subdivision':
          result = subdivide(result, mod.params.levels || 1)
          break
        case 'mirror':
          result = mirrorGeometry(result, mod.params.axis || 'x')
          break
        case 'array':
          result = arrayGeometry(
            result,
            mod.params.count || 2,
            mod.params.offset || [1.5, 0, 0]
          )
          break
        case 'solidify':
          result = solidifyGeometry(result, mod.params.thickness || 0.1)
          break
        case 'bevel':
          try { result = bevelGeometry(result, (mod.params.width || 0.05) / 2, mod.params.segments || 2) } catch {}
          break
        case 'displace':
          result = meshDisplaceGeometry(result, {
            strength: mod.params.strength || 0.5,
            scale: mod.params.scale || 1.0,
          })
          break
        case 'bend':
          result = meshBendGeometry(result, {
            angle: ((mod.params.angle || 45) * Math.PI) / 180,
            axis: mod.params.axis || 'y',
          })
          break
        case 'twist':
          result = meshTwistGeometry(result, {
            angle: ((mod.params.angle || 90) * Math.PI) / 180,
            axis: mod.params.axis || 'y',
          })
          break
        case 'taper':
          result = meshTaperGeometry(result, {
            factor: mod.params.amount || 0.5,
            axis: mod.params.axis || 'y',
          })
          break
        case 'wireframe':
          result = wireframeGeometry(result, mod.params.thickness || 0.02)
          break
        case 'remesh':
          // Simplificação: usa decimate (não é voxelização real)
          result = decimateGeometry(result, { ratio: 0.5 })
          break
        case 'smooth':
          result = meshSmoothGeometry(result, {
            iterations: mod.params.iterations || 1,
            factor: mod.params.factor || 0.5,
          })
          break
        case 'spherify':
          result = spherifyGeometry(result, mod.params.factor || 0.5)
          break
        default:
          break
      }
    } catch (err) {
      console.warn('Erro ao aplicar modificador', mod.type, err)
    }
  }
  return result
}

const SceneObject = forwardRef(function SceneObject({ obj, isSelected, onSelect }, meshRef) {
  const innerRef = useRef()

  // ----- Geometria (com modificadores aplicados) -----
  const geometry = useMemo(() => {
    let base
    if (obj.customGeometry) {
      // Geometria editada (edit mode / sculpt / boolean)
      base = new THREE.BufferGeometry()
      base.setAttribute('position', new THREE.Float32BufferAttribute(obj.customGeometry.positions, 3))
      if (obj.customGeometry.normals) {
        base.setAttribute('normal', new THREE.Float32BufferAttribute(obj.customGeometry.normals, 3))
      } else {
        base.computeVertexNormals()
      }
      if (obj.customGeometry.uvs) {
        base.setAttribute('uv', new THREE.Float32BufferAttribute(obj.customGeometry.uvs, 2))
      }
    } else if (obj.imported && obj.bufferGeometry) {
      base = obj.bufferGeometry
    } else {
      const def = PRIMITIVES[obj.type]
      base = def ? def.build(THREE, obj.args) : new THREE.BoxGeometry(1, 1, 1)
    }
    // Aplicar modificadores não destrutivos
    const final = applyModifiers(base, obj.modifiers)
    return final
  }, [obj.type, obj.args, obj.imported, obj.bufferGeometry, obj.customGeometry, obj.modifiers])

  // ----- Material -----
  const material = useMemo(() => {
    const m = obj.material || {}
    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(m.color || '#cccccc'),
      roughness: m.roughness ?? 0.7,
      metalness: m.metalness ?? 0.0,
      transparent: m.transparent || (m.opacity ?? 1) < 1,
      opacity: m.opacity ?? 1,
      wireframe: m.wireframe || false,
      flatShading: m.flatShading || false,
      side: obj.type === 'plane' ? THREE.DoubleSide : THREE.FrontSide,
    })

    // Emissive
    if (m.emissive && m.emissive !== '#000000') {
      mat.emissive = new THREE.Color(m.emissive)
      mat.emissiveIntensity = m.emissiveIntensity ?? 1
    }

    if (m.map) {
      const tex = loadTexture(m.map)
      if (tex) {
        tex.repeat.set(m.repeat?.[0] ?? 1, m.repeat?.[1] ?? 1)
        tex.offset.set(m.offset?.[0] ?? 0, m.offset?.[1] ?? 0)
        tex.needsUpdate = true
        mat.map = tex
      }
    }

    if (m.normalMap) {
      const tex = loadTexture(m.normalMap)
      if (tex) {
        tex.repeat.set(m.repeat?.[0] ?? 1, m.repeat?.[1] ?? 1)
        tex.offset.set(m.offset?.[0] ?? 0, m.offset?.[1] ?? 0)
        tex.needsUpdate = true
        mat.normalMap = tex
      }
    }

    // Emissive map (se existir)
    if (m.emissiveMap) {
      const tex = loadTexture(m.emissiveMap)
      if (tex) mat.emissiveMap = tex
    }

    mat.needsUpdate = true
    return mat
  }, [obj.material, obj.type])

  // ----- Compositing de camadas de textura (assíncrono) -----
  // Quando há múltiplas camadas, compõe-as num único mapa e aplica ao material.
  useEffect(() => {
    const m = obj.material
    if (!m || !m.layers || m.layers.length === 0) return
    let cancelled = false
    compositeTextureLayers(m.layers, 512).then((composedTex) => {
      if (cancelled || !composedTex) return
      composedTex.repeat.set(m.repeat?.[0] ?? 1, m.repeat?.[1] ?? 1)
      composedTex.offset.set(m.offset?.[0] ?? 0, m.offset?.[1] ?? 0)
      // Se já há um map simples, as camadas substituem-no
      material.map = composedTex
      material.needsUpdate = true
    })
    return () => { cancelled = true }
  }, [obj.material?.layers, obj.material?.repeat, obj.material?.offset, material])

  // ----- Atualização de repeat/offset em tempo real -----
  useEffect(() => {
    if (!material) return
    const m = obj.material
    const applyTiling = (tex) => {
      if (!tex) return
      tex.repeat.set(m.repeat?.[0] ?? 1, m.repeat?.[1] ?? 1)
      tex.offset.set(m.offset?.[0] ?? 0, m.offset?.[1] ?? 0)
      tex.needsUpdate = true
    }
    if (m.map) applyTiling(loadTexture(m.map))
    if (m.normalMap) applyTiling(loadTexture(m.normalMap))
  }, [obj.material?.repeat, obj.material?.offset, obj.material?.map, obj.material?.normalMap, material])

  // ----- Sincronizar transform -----
  // Aplicamos diretamente como props do mesh para garantir que estão sempre
  // sincronizados (o useEffect anterior falhava na 1ª renderização porque
  // innerRef.current ainda era null quando o effect disparava).
  // Mantemos o useEffect como fallback para mudanças dinâmicas via gizmo.
  useEffect(() => {
    const mesh = innerRef.current
    if (!mesh) return
    mesh.position.set(...obj.position)
    mesh.rotation.set(...obj.rotation)
    mesh.scale.set(...obj.scale)
  }, [obj.position, obj.rotation, obj.scale])

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      if (geometry && !obj.imported) geometry.dispose?.()
      material.dispose?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, material])

  // Performance Core 3.4 — Registar mesh no LODSystem
  // Só regista se: tem geometria, não é customGeometry, não é animado (skeleton),
  // e tem >1000 triângulos. LODSystem decide se cria THREE.LOD ou ignora.
  // Import lazy para evitar cycle dependency em modo Editor.
  useEffect(() => {
    const mesh = innerRef.current
    if (!mesh || !geometry) return
    // Calcular triângulos (positions.count / 3 para não indexada, index.count / 3 para indexada)
    let triCount = 0
    if (geometry.index) {
      triCount = geometry.index.count / 3
    } else if (geometry.attributes.position) {
      triCount = geometry.attributes.position.count / 3
    }
    // Verificar se é animado (tem skeleton — NÃO aplicar LOD)
    const isAnimated = !!(obj.skeleton || obj.animations)
    const isCustomGeometry = !!obj.customGeometry

    // Import dinâmico para evitar cycle e não carregar LODSystem em Editor mode
    import('../../utils/lodSystem').then(({ LODSystem }) => {
      // Só regista se LODSystem está ativo (Play Mode)
      // LODSystem.restore() é chamado no cleanup do useLOD, pelo que registos
      // só persistem durante Play Mode
      LODSystem.register(obj.id, mesh, triCount, {
        isAnimated,
        isCustomGeometry,
      })
    }).catch(() => {
      // Ignorar erro de import (não crítico)
    })

    return () => {
      // Desregistar ao desmontar
      import('../../utils/lodSystem').then(({ LODSystem }) => {
        LODSystem.unregister(obj.id)
      }).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [geometry, obj.id, obj.skeleton, obj.animations, obj.customGeometry])

  const handlePointerDown = (e) => {
    e.stopPropagation()
    onSelect?.(obj.id)
  }

  // Determinar cor do outline consoante o modo
  const outlineColor =
    obj.outlineColor ||
    (isSelected ? '#2f81f7' : null)

  return (
    <mesh
      ref={(node) => {
        innerRef.current = node
        if (typeof meshRef === 'function') meshRef(node)
        else if (meshRef) meshRef.current = node
      }}
      geometry={geometry}
      material={material}
      position={obj.position}
      rotation={obj.rotation}
      scale={obj.scale}
      visible={obj.visible !== false}
      onPointerDown={handlePointerDown}
      castShadow
      receiveShadow
      userData={{ objectId: obj.id }}
    >
      {isSelected && (
        <mesh scale={[1.02, 1.02, 1.02]} geometry={geometry}>
          <meshBasicMaterial
            color="#2f81f7"
            wireframe
            transparent
            opacity={0.6}
            depthTest={false}
          />
        </mesh>
      )}
    </mesh>
  )
})

export default SceneObject

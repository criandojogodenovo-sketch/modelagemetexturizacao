/**
 * SceneObject — renderiza um único objeto da cena no Three.js.
 *
 * Responsabilidades:
 *  - Construir geometria (primitiva, importada, ou customGeometry de edit mode)
 *  - Aplicar modificadores não destrutivos (subdivision, mirror, array, solidify)
 *  - Construir material PBR completo (MeshPhysicalMaterial) com:
 *      cor, roughness, metalness, emissive, opacity
 *      map, normalMap, roughnessMap, metalnessMap, emissiveMap
 *      anisotropy, ior, transmission, clearcoat, sheen, specularIntensity
 *  - Aplicar repeat/offset (tiling UV)
 *  - Suportar seleção visual
 *  - Receber pointer events para seleção
 *  - Forward ref do mesh para o parent usar com TransformControls
 *  - Suportar skeleton (ossos) para animação
 *  - INTEGRAÇÃO TEXTURE PAINT: usa PaintTextureManager para pintura real-time
 *      nos 4 canais (color/roughness/metallic/normal) sem recriar textura
 */
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { PRIMITIVES } from '../../utils/primitives'
import {
  subdivide,
  mirrorGeometry,
  arrayGeometry,
  solidifyGeometry,
} from '../../utils/meshOperations'
import { compositeTextureLayers } from '../../utils/textureCompositor'
import { getPaintTexture } from '../../utils/texturePaint'

// Cache de texturas carregadas a partir de dataURLs (texturas importadas, não paint)
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
        default:
          break
      }
    } catch (err) {
      console.warn('Erro ao aplicar modificador', mod.type, err)
    }
  }
  return result
}

// Aplica tiling UV a uma textura (helper)
function applyTilingToTexture(tex, m) {
  if (!tex) return
  tex.repeat.set(m.repeat?.[0] ?? 1, m.repeat?.[1] ?? 1)
  tex.offset.set(m.offset?.[0] ?? 0, m.offset?.[1] ?? 0)
  tex.needsUpdate = true
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
      } else {
        // Sem UVs — gerar UVs planar para permitir pintura
        const uvs = new Float32Array(base.attributes.position.count * 2)
        base.computeBoundingBox()
        const bb = base.boundingBox
        const size = new THREE.Vector3(); bb.getSize(size)
        const pos = base.attributes.position
        for (let i = 0; i < pos.count; i++) {
          uvs[i * 2]     = (pos.getX(i) - bb.min.x) / Math.max(0.0001, size.x)
          uvs[i * 2 + 1] = (pos.getY(i) - bb.min.y) / Math.max(0.0001, size.y)
        }
        base.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
      }
    } else if (obj.imported && obj.bufferGeometry) {
      base = obj.bufferGeometry
      // Garantir que imported geometries têm UVs
      if (!base.getAttribute('uv')) {
        const uvs = new Float32Array(base.attributes.position.count * 2)
        base.computeBoundingBox()
        const bb = base.boundingBox
        const size = new THREE.Vector3(); bb.getSize(size)
        const pos = base.attributes.position
        for (let i = 0; i < pos.count; i++) {
          uvs[i * 2]     = (pos.getX(i) - bb.min.x) / Math.max(0.0001, size.x)
          uvs[i * 2 + 1] = (pos.getY(i) - bb.min.y) / Math.max(0.0001, size.y)
        }
        base.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
      }
    } else {
      const def = PRIMITIVES[obj.type]
      base = def ? def.build(THREE, obj.args) : new THREE.BoxGeometry(1, 1, 1)
    }
    // Aplicar modificadores não destrutivos
    const final = applyModifiers(base, obj.modifiers)
    return final
  }, [obj.type, obj.args, obj.imported, obj.bufferGeometry, obj.customGeometry, obj.modifiers])

  // ----- Material (MeshPhysicalMaterial — PBR completo) -----
  const material = useMemo(() => {
    const m = obj.material || {}
    const isTransparent = m.transparent || (m.opacity ?? 1) < 1 || (m.transmission ?? 0) > 0
    const mat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(m.color || '#cccccc'),
      roughness: m.roughness ?? 0.7,
      metalness: m.metalness ?? 0.0,
      transparent: isTransparent,
      opacity: m.opacity ?? 1,
      wireframe: m.wireframe || false,
      flatShading: m.flatShading || false,
      side: obj.type === 'plane' ? THREE.DoubleSide : THREE.FrontSide,
      // PBR físico:
      anisotropy: m.anisotropy ?? 0.0,
      anisotropyRotation: m.anisotropyRotation ?? 0.0,
      ior: m.ior ?? 1.5,
      transmission: m.transmission ?? 0.0,
      thickness: m.thickness ?? 0.0,
      attenuationColor: new THREE.Color(m.attenuationColor || '#ffffff'),
      attenuationDistance: m.attenuationDistance ?? 0.5,
      clearcoat: m.clearcoat ?? 0.0,
      clearcoatRoughness: m.clearcoatRoughness ?? 0.0,
      sheen: m.sheen ?? 0.0,
      sheenColor: new THREE.Color(m.sheenColor || '#ffffff'),
      sheenRoughness: m.sheenRoughness ?? 0.5,
      specularIntensity: m.specularIntensity ?? 1.0,
      specularColor: new THREE.Color(m.specularColor || '#ffffff'),
      envMapIntensity: m.envMapIntensity ?? 1.0,
    })

    // Emissive
    if (m.emissive && m.emissive !== '#000000') {
      mat.emissive = new THREE.Color(m.emissive)
      mat.emissiveIntensity = m.emissiveIntensity ?? 1
    }

    // ===== Texturas importadas (dataURL) — aplicadas com prioridade =====
    // Se o utilizador fez upload de um mapa, usa esse. Caso contrário,
    // a textura do PaintTextureManager (paint) é aplicada no effect abaixo.

    if (m.map) {
      const tex = loadTexture(m.map)
      if (tex) {
        applyTilingToTexture(tex, m)
        mat.map = tex
      }
    }

    if (m.normalMap) {
      const tex = loadTexture(m.normalMap)
      if (tex) {
        applyTilingToTexture(tex, m)
        tex.colorSpace = THREE.NoColorSpace
        mat.normalMap = tex
      }
    }

    if (m.roughnessMap) {
      const tex = loadTexture(m.roughnessMap)
      if (tex) {
        applyTilingToTexture(tex, m)
        tex.colorSpace = THREE.NoColorSpace
        mat.roughnessMap = tex
      }
    }

    if (m.metalnessMap) {
      const tex = loadTexture(m.metalnessMap)
      if (tex) {
        applyTilingToTexture(tex, m)
        tex.colorSpace = THREE.NoColorSpace
        mat.metalnessMap = tex
      }
    }

    if (m.emissiveMap) {
      const tex = loadTexture(m.emissiveMap)
      if (tex) mat.emissiveMap = tex
    }

    mat.needsUpdate = true
    return mat
  }, [obj.material, obj.type])

  // ----- INTEGRAÇÃO TEXTURE PAINT (real-time, sem recriar textura) -----
  // Quando o material é criado (ou o objeto é selecionado para pintura),
  // obter as CanvasTextures vivas do PaintTextureManager e atribuí-las
  // aos slots do material. Isto permite que a pintura apareça instantaneamente
  // no mesh via texture.needsUpdate = true (passo 8 do pipeline).
  useEffect(() => {
    if (!material || !obj.id) return
    // Atribuir CanvasTexture do PaintTextureManager a cada canal que não
    // tenha textura importada (a importada tem prioridade).
    const m = obj.material || {}

    if (!m.map) {
      const pt = getPaintTexture(obj.id, 'color')
      if (pt && pt.texture) {
        applyTilingToTexture(pt.texture, m)
        material.map = pt.texture
        material.needsUpdate = true
      }
    }
    if (!m.normalMap) {
      const pt = getPaintTexture(obj.id, 'normal')
      if (pt && pt.texture) {
        applyTilingToTexture(pt.texture, m)
        material.normalMap = pt.texture
        material.needsUpdate = true
      }
    }
    if (!m.roughnessMap) {
      const pt = getPaintTexture(obj.id, 'roughness')
      if (pt && pt.texture) {
        applyTilingToTexture(pt.texture, m)
        material.roughnessMap = pt.texture
        material.needsUpdate = true
      }
    }
    if (!m.metalnessMap) {
      const pt = getPaintTexture(obj.id, 'metallic')
      if (pt && pt.texture) {
        applyTilingToTexture(pt.texture, m)
        material.metalnessMap = pt.texture
        material.needsUpdate = true
      }
    }
  }, [obj.id, obj.material, material])

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
    if (m.map) applyTilingToTexture(loadTexture(m.map), m)
    if (m.normalMap) applyTilingToTexture(loadTexture(m.normalMap), m)
    if (m.roughnessMap) applyTilingToTexture(loadTexture(m.roughnessMap), m)
    if (m.metalnessMap) applyTilingToTexture(loadTexture(m.metalnessMap), m)
    // Aplicar também às CanvasTextures do PaintTextureManager
    const ptColor = getPaintTexture(obj.id, 'color', { dataURL: m.map })
    applyTilingToTexture(ptColor?.texture, m)
    const ptNormal = getPaintTexture(obj.id, 'normal', { dataURL: m.normalMap })
    applyTilingToTexture(ptNormal?.texture, m)
    const ptRough = getPaintTexture(obj.id, 'roughness', { dataURL: m.roughnessMap })
    applyTilingToTexture(ptRough?.texture, m)
    const ptMetal = getPaintTexture(obj.id, 'metallic', { dataURL: m.metalnessMap })
    applyTilingToTexture(ptMetal?.texture, m)
  }, [obj.material?.repeat, obj.material?.offset, obj.material?.map, obj.material?.normalMap, obj.material?.roughnessMap, obj.material?.metalnessMap, obj.id, material])

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

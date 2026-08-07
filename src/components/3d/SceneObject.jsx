/**
 * SceneObject — renderiza um único objeto da cena no Three.js.
 *
 * Responsabilidades:
 *  - Construir a geometria a partir do tipo/args (primitiva) ou usar BufferGeometry externa (importado)
 *  - Construir o material (MeshStandardMaterial) com cor, roughness, metalness, texturas
 *  - Carregar texturas a partir de dataURLs (map, normalMap)
 *  - Aplicar repeat/offset (tiling UV)
 *  - Suportar seleção visual (outline via wireframe overlay)
 *  - Receber pointer events para seleção
 *  - Forward ref do mesh para o parent usar com TransformControls
 */
import { forwardRef, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { PRIMITIVES } from '../../utils/primitives'

// Cache de texturas carregadas a partir de dataURLs (evita recarregar a mesma imagem)
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

const SceneObject = forwardRef(function SceneObject({ obj, isSelected, onSelect }, meshRef) {
  const innerRef = useRef()

  // ----- Geometria -----
  const geometry = useMemo(() => {
    if (obj.imported && obj.bufferGeometry) {
      return obj.bufferGeometry
    }
    const def = PRIMITIVES[obj.type]
    if (!def) return new THREE.BoxGeometry(1, 1, 1)
    return def.build(THREE, obj.args)
  }, [obj.type, obj.args, obj.imported, obj.bufferGeometry])

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

    mat.needsUpdate = true
    return mat
  }, [obj.material, obj.type])

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

  // ----- Sincronizar transform inicial -----
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

  return (
    <mesh
      ref={(node) => {
        innerRef.current = node
        if (typeof meshRef === 'function') meshRef(node)
        else if (meshRef) meshRef.current = node
      }}
      geometry={geometry}
      material={material}
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

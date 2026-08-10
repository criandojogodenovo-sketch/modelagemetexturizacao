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
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PRIMITIVES } from '../../utils/primitives'
import {
  subdivide,
  mirrorGeometry,
  arrayGeometry,
  solidifyGeometry,
  curveDeform,
} from '../../utils/meshOperations'
import { compositeTextureLayers } from '../../utils/textureCompositor'
import { computeVertexAO, applyVertexAO } from '../../utils/vertexAO'
import { useStore } from '../../store/useStore'

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

// Aplica a stack de modificadores a uma geometria
// pathLookup: função (pathId) → array de [x,y,z] pontos (para modificador 'curve')
function applyModifiers(geometry, modifiers, pathLookup) {
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
        case 'curve': {
          // Deforma ao longo de um PathObject
          if (!mod.params.pathId) break
          const pathPoints = pathLookup?.(mod.params.pathId)
          if (!pathPoints || pathPoints.length < 2) break
          result = curveDeform(result, pathPoints, {
            twist: mod.params.twist || 0,
            stretch: mod.params.stretch || 1,
          })
          break
        }
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
  // Modo de edição (para mostrar mapa de calor em weight painting)
  const mode = useStore((s) => s.mode)
  const selectedId = useStore((s) => s.selectedId)
  const isWeightMode = mode === 'weight' && selectedId === obj.id

  // Vertex AO setting
  const vertexAOEnabled = useStore((s) => s.renderSettings?.vertexAO || false)

  // pathLookup: procura PathObject na cena ativa e devolve os pontos
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const pathLookup = useMemo(() => {
    return (pathId) => {
      // Procurar em todas as cenas por um conect com instanceId === pathId
      for (const scene of scenes || []) {
        const pathConect = (scene.conects || []).find(c => c.instanceId === pathId)
        if (pathConect?.points) return pathConect.points
      }
      return null
    }
  }, [scenes, activeSceneId])

  // ----- Geometria (com modificadores aplicados) -----
  const geometry = useMemo(() => {
    let base
    if (obj.customGeometry) {
      // Geometria editada (edit mode / sculpt / boolean) ou importada (FBX)
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
      // Suportar índices (FBX importado pode ter)
      if (obj.customGeometry.indices) {
        base.setIndex(obj.customGeometry.indices)
      }
    } else if (obj.imported && obj.bufferGeometry) {
      base = obj.bufferGeometry
    } else {
      const def = PRIMITIVES[obj.type]
      base = def ? def.build(THREE, obj.args) : new THREE.BoxGeometry(1, 1, 1)
    }
    // Aplicar modificadores não destrutivos
    const final = applyModifiers(base, obj.modifiers, pathLookup)

    // Aplicar Vertex AO se ativado (apenas para geometrias com >50 vértices
    // — primitivas muito simples não beneficiam)
    if (vertexAOEnabled && final.attributes.position && final.attributes.normal) {
      const vertCount = final.attributes.position.count
      if (vertCount > 50) {
        try {
          const aoValues = computeVertexAO(final, { samples: 16, distance: 1.5 })
          if (aoValues) {
            applyVertexAO(final, aoValues, 0.5)
          }
        } catch (err) {
          console.warn('Vertex AO falhou:', err)
        }
      }
    }

    return final
  }, [obj.type, obj.args, obj.imported, obj.bufferGeometry, obj.customGeometry, obj.modifiers, pathLookup, vertexAOEnabled])

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
      // Ativar vertexColors se Vertex AO estiver ativo (para mostrar o AO)
      vertexColors: vertexAOEnabled,
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

  // ----- Material de mapa de calor para weight painting -----
  // Criado apenas quando em modo 'weight' e o objeto está selecionado.
  // Mostra a influência do osso ativo (window._weightPaintActiveBone) como
  // gradiente azul (0) → verde → amarelo → vermelho (1).
  // Usa MeshBasicMaterial (não precisa de luz) para garantir que as cores
  // são sempre visíveis independentemente da iluminação ou transform do skeleton.
  const weightMaterial = useMemo(() => {
    if (!isWeightMode) return null
    const mat = new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
    })
    return mat
  }, [isWeightMode])

  // Atualizar vertex colors no useFrame (em modo weight)
  useFrame(() => {
    if (!isWeightMode || !weightMaterial || !innerRef.current) return
    const mesh = innerRef.current
    const geom = mesh.geometry
    if (!geom || !geom.attributes.position) return

    const vertCount = geom.attributes.position.count
    const activeBoneId = window._weightPaintActiveBone
    const skinWeights = obj.skinWeights || {}

    // Criar ou reutilizar o buffer de cores
    let colorAttr = geom.attributes.color
    if (!colorAttr || colorAttr.count !== vertCount) {
      colorAttr = new THREE.BufferAttribute(new Float32Array(vertCount * 3), 3)
      geom.setAttribute('color', colorAttr)
      // Forçar recompilação do material quando o attribute é criado pela 1ª vez
      if (mesh.material) {
        mesh.material.vertexColors = true
        mesh.material.needsUpdate = true
      }
    }

    // Para cada vértice, calcular peso do osso ativo e mapear para cor
    for (let v = 0; v < vertCount; v++) {
      const w = activeBoneId ? (skinWeights[v]?.[activeBoneId] || 0) : 0
      // Mapa de calor: 0=azul, 0.25=ciano, 0.5=verde, 0.75=amarelo, 1=vermelho
      let r, g, b
      if (w < 0.25) {
        const t = w / 0.25
        r = 0; g = t * 0.5; b = 1
      } else if (w < 0.5) {
        const t = (w - 0.25) / 0.25
        r = 0; g = 0.5 + t * 0.5; b = 1 - t
      } else if (w < 0.75) {
        const t = (w - 0.5) / 0.25
        r = t; g = 1; b = 0
      } else {
        const t = (w - 0.75) / 0.25
        r = 1; g = 1 - t; b = 0
      }
      colorAttr.setXYZ(v, r, g, b)
    }
    colorAttr.needsUpdate = true
    // Garantir que o material tem vertexColors ativado
    if (mesh.material && !mesh.material.vertexColors) {
      mesh.material.vertexColors = true
      mesh.material.needsUpdate = true
    }
  })

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

  // ----- Skinning: criar SkinnedMesh + Skeleton se o objeto tem esqueleto -----
  const skinData = useMemo(() => {
    if (!obj.skeleton || !obj.skeleton.bones || obj.skeleton.bones.length === 0) return null

    // Criar THREE.Bone objects a partir dos dados do esqueleto
    const bones = []
    const boneMap = {} // boneId → THREE.Bone
    for (const boneDef of obj.skeleton.bones) {
      const bone = new THREE.Bone()
      bone.name = boneDef.name || boneDef.id
      bone.position.set(...(boneDef.position || [0, 0, 0]))
      bone.rotation.set(...(boneDef.rotation || [0, 0, 0]))
      bone.scale.set(...(boneDef.scale || [1, 1, 1]))
      bone.userData.boneId = boneDef.id
      boneMap[boneDef.id] = bone
      bones.push(bone)
    }
    // Construir hierarquia
    for (const boneDef of obj.skeleton.bones) {
      if (boneDef.parentId && boneMap[boneDef.parentId]) {
        boneMap[boneDef.parentId].add(boneMap[boneDef.id])
      }
    }

    // Criar Skeleton
    const skeleton = new THREE.Skeleton(bones)

    // Criar skinIndices e skinWeights para a geometria
    const skinWeights = obj.skinWeights || {}
    const vertCount = geometry.attributes.position.count
    const skinIndices = new Float32Array(vertCount * 4)
    const skinWeightsArr = new Float32Array(vertCount * 4)

    // Para cada vértice, encontrar os pesos
    for (let v = 0; v < vertCount; v++) {
      const weights = skinWeights[v] || {}
      // Ordenar ossos por peso (maior primeiro) e pegar top 4
      const sorted = Object.entries(weights)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)

      let totalWeight = 0
      for (let i = 0; i < 4; i++) {
        if (i < sorted.length) {
          const [boneId, weight] = sorted[i]
          const boneIdx = obj.skeleton.bones.findIndex(b => b.id === boneId)
          if (boneIdx >= 0) {
            skinIndices[v * 4 + i] = boneIdx
            skinWeightsArr[v * 4 + i] = weight
            totalWeight += weight
          }
        }
      }
      // Normalizar para soma = 1
      if (totalWeight > 0) {
        for (let i = 0; i < 4; i++) {
          skinWeightsArr[v * 4 + i] /= totalWeight
        }
      }
    }

    // Aplicar skinIndices e skinWeights à geometria
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndices, 4))
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeightsArr, 4))

    return { bones, skeleton }
  }, [obj.skeleton, obj.skinWeights, geometry])

  // ----- Atualizar bones quando a animação corre (modo editor) -----
  useFrame(() => {
    if (skinData && innerRef.current && innerRef.current.isSkinnedMesh) {
      // Forçar update do skeleton se os bones foram modificados
      skinData.skeleton.update()
    }
  })

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

  // Material efetivo: em modo weight, usar o weightMaterial (vertex colors);
  // caso contrário, o material normal.
  const effectiveMaterial = weightMaterial || material

  // Se tem esqueleto, usar SkinnedMesh; caso contrário, Mesh normal
  if (skinData) {
    return (
      <skinnedMesh
        ref={(node) => {
          innerRef.current = node
          if (typeof meshRef === 'function') meshRef(node)
          else if (meshRef) meshRef.current = node
        }}
        geometry={geometry}
        material={effectiveMaterial}
        position={obj.position}
        rotation={obj.rotation}
        scale={obj.scale}
        visible={obj.visible !== false}
        onPointerDown={handlePointerDown}
        castShadow
        receiveShadow
        userData={{ objectId: obj.id }}
        skeleton={skinData.skeleton}
      >
        {/* Bones (hierarquia) — adicionados como filhos do skinnedMesh */}
        {skinData.bones
          .filter(b => !b.parent || b.parent.type !== 'Bone')
          .map(bone => <primitive key={bone.uuid} object={bone} />)}
        {isSelected && !isWeightMode && (
          <mesh scale={[1.02, 1.02, 1.02]} geometry={geometry}>
            <meshBasicMaterial
              color="#2f81f7"
              wireframe
              transparent
              opacity={0.3}
              depthTest={false}
            />
          </mesh>
        )}
      </skinnedMesh>
    )
  }

  return (
    <mesh
      ref={(node) => {
        innerRef.current = node
        if (typeof meshRef === 'function') meshRef(node)
        else if (meshRef) meshRef.current = node
      }}
      geometry={geometry}
      material={effectiveMaterial}
      position={obj.position}
      rotation={obj.rotation}
      scale={obj.scale}
      visible={obj.visible !== false}
      onPointerDown={handlePointerDown}
      castShadow
      receiveShadow
      userData={{ objectId: obj.id }}
    >
      {isSelected && !isWeightMode && (
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

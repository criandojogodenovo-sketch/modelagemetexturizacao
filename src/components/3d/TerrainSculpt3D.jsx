/**
 * TerrainSculpt3D — esculpe terreno 3D em tempo real via raycast.
 *
 * Funcionalidades:
 *  - Raycast no terreno 3D para encontrar o ponto de toque
 *  - Cursor 3D (anel/círculo) que segue o rato/dedo sobre o terreno
 *  - Aplica pincéis (raise, lower, smooth, flatten, noise) em tempo real
 *  - Actualiza a geometria 3D imediatamente (não só depois de soltar)
 *  - Desactiva OrbitControls durante o arraste (via onDragStateChange)
 *
 * Uso:
 *   <TerrainSculpt3D terrainMesh={mesh} heightmap={hm} seg={seg}
 *     brushMode='raise' brushSize={8} brushStrength={0.5}
 *     onHeightmapChange={(newHm) => ...}
 *     onDragStateChange={(isDragging) => ...}
 *     isActive />
 */
import { useRef, useState, useMemo, useEffect, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export default function TerrainSculpt3D({
  terrainMesh,
  heightmap,
  seg,
  brushMode,
  brushSize,
  brushStrength,
  falloffType,
  onHeightmapChange,
  onDragStateChange,
  isActive,
}) {
  const { camera, gl, raycaster } = useThree()
  const [cursorPos, setCursorPos] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const cursorRef = useRef()
  const hmRef = useRef(heightmap)
  const lastApplyRef = useRef(0)

  // Actualizar hmRef quando heightmap muda externamente
  useEffect(() => { hmRef.current = heightmap }, [heightmap])

  // Reportar drag state ao parent (para desactivar OrbitControls)
  useEffect(() => {
    if (onDragStateChange) onDragStateChange(isDragging)
  }, [isDragging, onDragStateChange])

  // Actualizar geometria do terreno em tempo real
  const updateGeometry = useCallback(() => {
    if (!terrainMesh || !terrainMesh.geometry) return
    const hm = hmRef.current
    if (!hm) return
    const pos = terrainMesh.geometry.attributes.position
    if (!pos) return
    const heightScale = 5 // mesmo que TerrainMesh usa
    const segLocal = seg

    for (let i = 0; i < pos.count; i++) {
      const z = Math.floor(i / (segLocal + 1))
      const x = i % (segLocal + 1)
      const h = hm[z * (segLocal + 1) + x] || 0
      pos.setY(i, h * heightScale)
    }
    pos.needsUpdate = true
    terrainMesh.geometry.computeVertexNormals()
    if (terrainMesh.geometry.boundingBox) terrainMesh.geometry.computeBoundingBox()
    if (terrainMesh.geometry.boundingSphere) terrainMesh.geometry.computeBoundingSphere()
  }, [terrainMesh, seg])

  // Raycast no terreno
  const raycastTerrain = useCallback((clientX, clientY) => {
    if (!terrainMesh) return null
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObject(terrainMesh, false)
    if (intersects.length === 0) return null
    return intersects[0].point
  }, [terrainMesh, camera, gl, raycaster])

  // Converter ponto 3D para célula do heightmap
  const pointToCell = useCallback((point) => {
    if (!terrainMesh) return null
    // O terreno tem tamanho seg x seg, centrado na origem
    // (em ConectRenderer, PlaneGeometry é centrada na origem antes do rotateX)
    const terrainWidth = 50 // default do TerrainMesh
    const terrainDepth = 50
    // Tentar ler do mesh: usar boundingBox
    let halfW = terrainWidth / 2
    let halfD = terrainDepth / 2
    try {
      const bbox = terrainMesh.geometry.boundingBox
      if (bbox) {
        halfW = (bbox.max.x - bbox.min.x) / 2
        halfD = (bbox.max.z - bbox.min.z) / 2
      }
    } catch {}

    // Aplicar transform do mesh (posição/rotação/escala)
    const localPoint = terrainMesh.worldToLocal(point.clone())
    const x = Math.round(((localPoint.x + halfW) / (halfW * 2)) * seg)
    const z = Math.round(((localPoint.z + halfD) / (halfD * 2)) * seg)
    if (x < 0 || x > seg || z < 0 || z > seg) return null
    return { x, z }
  }, [terrainMesh, seg])

  // Aplicar pincel numa célula do heightmap
  const applyBrush = useCallback((cx, cz) => {
    const hm = hmRef.current
    if (!hm) return
    const radius = brushSize
    const r2 = radius * radius
    const strength = brushStrength

    // Modo smooth precisa de snapshot
    let snapshot = null
    if (brushMode === 'smooth') {
      snapshot = new Float32Array(hm)
    }

    for (let dz = -radius; dz <= radius; dz++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const d2 = dx * dx + dz * dz
        if (d2 > r2) continue
        const px = cx + dx
        const pz = cz + dz
        if (px < 0 || px > seg || pz < 0 || pz > seg) continue
        const dist = Math.sqrt(d2)
        let f
        switch (falloffType) {
          case 'linear': f = 1 - dist / radius; break
          case 'constant': f = 1; break
          case 'sharp': f = 1 - (dist / radius) ** 2; break
          case 'smooth':
          default: f = 0.5 * (Math.cos(Math.PI * dist / radius) + 1)
        }
        const idx = pz * (seg + 1) + px
        const amount = f * strength * 0.2

        switch (brushMode) {
          case 'raise':
            hm[idx] += amount
            break
          case 'lower':
            hm[idx] -= amount
            break
          case 'smooth': {
            let sum = 0, count = 0
            for (let sz = -1; sz <= 1; sz++) {
              for (let sx = -1; sx <= 1; sx++) {
                const nx = px + sx, nz = pz + sz
                if (nx >= 0 && nx <= seg && nz >= 0 && nz <= seg) {
                  sum += snapshot[nz * (seg + 1) + nx]
                  count++
                }
              }
            }
            const avg = sum / count
            hm[idx] += (avg - hm[idx]) * f * strength
            break
          }
          case 'flatten':
            hm[idx] += (0 - hm[idx]) * f * strength
            break
          case 'noise': {
            const n = (Math.random() - 0.5) * 2
            hm[idx] += n * amount
            break
          }
        }
      }
    }
  }, [brushMode, brushSize, brushStrength, falloffType, seg])

  // Mouse handlers — activos só quando isActive
  useEffect(() => {
    if (!isActive || !terrainMesh) return
    const canvas = gl.domElement

    const onPointerMove = (e) => {
      const point = raycastTerrain(e.clientX, e.clientY)
      if (point) {
        setCursorPos(point.clone())
        if (isDragging) {
          const cell = pointToCell(point)
          if (cell) {
            applyBrush(cell.x, cell.z)
            // Throttle: actualizar geometria a cada 16ms (~60fps)
            const now = performance.now()
            if (now - lastApplyRef.current > 16) {
              lastApplyRef.current = now
              updateGeometry()
            }
          }
        }
      } else {
        setCursorPos(null)
      }
    }

    const onPointerDown = (e) => {
      // Só botão esquerdo ou toque
      if (e.button !== undefined && e.button !== 0) return
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(true)
      const point = raycastTerrain(e.clientX, e.clientY)
      if (point) {
        const cell = pointToCell(point)
        if (cell) {
          applyBrush(cell.x, cell.z)
          updateGeometry()
        }
      }
    }

    const onPointerUp = () => {
      if (isDragging) {
        setIsDragging(false)
        // Notificar parent do heightmap final
        if (onHeightmapChange && hmRef.current) {
          onHeightmapChange(new Float32Array(hmRef.current))
        }
      }
    }

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    canvas.style.cursor = 'crosshair'

    return () => {
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      canvas.style.cursor = ''
    }
  }, [isActive, terrainMesh, gl, raycastTerrain, pointToCell, applyBrush, isDragging, onHeightmapChange, updateGeometry])

  // Cursor 3D — anel + preenchimento translúcido
  const cursorGeometry = useMemo(() => {
    const geo = new THREE.RingGeometry(brushSize * 0.85, brushSize, 32)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [brushSize])

  const cursorFillGeometry = useMemo(() => {
    const geo = new THREE.CircleGeometry(brushSize * 0.85, 32)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [brushSize])

  // Cursor color consoante o modo
  const cursorColor = brushMode === 'lower' ? '#ef4444'
    : brushMode === 'smooth' ? '#f59e0b'
    : brushMode === 'flatten' ? '#10b981'
    : brushMode === 'noise' ? '#a855f7'
    : '#3b82f6'

  if (!isActive || !cursorPos) return null

  // Posição do cursor: ligeiramente acima do terreno (em world space)
  // Como o terrainMesh pode ter transform, usamos world position
  return (
    <group position={[cursorPos.x, cursorPos.y + 0.05, cursorPos.z]}>
      <mesh geometry={cursorFillGeometry}>
        <meshBasicMaterial
          color={cursorColor}
          transparent
          opacity={0.15}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh ref={cursorRef} geometry={cursorGeometry}>
        <meshBasicMaterial
          color={cursorColor}
          transparent
          opacity={0.85}
          depthTest={false}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

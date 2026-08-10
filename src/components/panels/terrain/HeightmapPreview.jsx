/**
 * HeightmapPreview — pré-visualização 2D do heightmap com brush cursor,
 * drag painting contínuo e indicação visual do falloff.
 *
 * Funcionalidades (Unity-aligned):
 *  - Renderização top-down com blending de cores por splatmap multi-camada
 *  - Sombreamento por altura (relevo)
 *  - Cursor do pincel a seguir o rato/dedo (mostra raio + falloff)
 *  - Drag painting (não só click) — aplica o pincel continuamente
 *  - Spacing entre stamps para evitar aplicar demasiadas vezes na mesma área
 *  - Marcadores de pontos de rampa
 *  - Marcadores de objetos dispersos (overlay)
 */
import { useRef, useEffect, useState, useCallback } from 'react'
import { falloff as falloffFn, splatToColors, hexToRgb, applyShade, heightmapStats } from '../../../utils/terrain/terrainMath'

export default function HeightmapPreview({
  heightmap,
  splatmap,
  segments,
  textureLayers,
  rampPoints,
  scatteredPoints,
  brush,
  onPaint, // (x, z, isStart) => void
  size = 240,
}) {
  const canvasRef = useRef(null)
  const cursorRef = useRef(null)
  const overlayRef = useRef(null)
  const [isDragging, setIsDragging] = useState(false)
  const lastPaintPos = useRef(null) // para spacing

  // ===== Render do heightmap + splat =====
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !heightmap) return
    const ctx = canvas.getContext('2d')
    const seg = segments
    const cellCount = (seg + 1) * (seg + 1)
    canvas.width = size
    canvas.height = size
    const cellSize = size / (seg + 1)

    const stats = heightmapStats(heightmap)
    const range = stats.range || 1

    // Pré-calcular cores das camadas
    const layerColors = textureLayers.map((l) => hexToRgb(l.color))

    let imgData
    if (splatmap) {
      imgData = new ImageData(new Uint8ClampedArray(splatToColors(splatmap, cellCount, layerColors)), seg + 1, seg + 1)
    } else {
      // Fallback grayscale com verde
      imgData = new ImageData(seg + 1, seg + 1)
      for (let i = 0; i < cellCount; i++) {
        const v = (heightmap[i] - stats.min) / range
        imgData.data[i * 4] = v * 90
        imgData.data[i * 4 + 1] = v * 125
        imgData.data[i * 4 + 2] = v * 58
        imgData.data[i * 4 + 3] = 255
      }
    }

    // Aplicar sombreamento por altura (relevo)
    const shaded = new Uint8ClampedArray(imgData.data)
    for (let z = 0; z <= seg; z++) {
      for (let x = 0; x <= seg; x++) {
        const idx = z * (seg + 1) + x
        const h = (heightmap[idx] - stats.min) / range // 0..1
        // Sombreamento: 0.6 (fundo) .. 1.0 (topo)
        const shade = 0.55 + h * 0.45
        shaded[idx * 4] = imgData.data[idx * 4] * shade
        shaded[idx * 4 + 1] = imgData.data[idx * 4 + 1] * shade
        shaded[idx * 4 + 2] = imgData.data[idx * 4 + 2] * shade
        shaded[idx * 4 + 3] = 255
      }
    }
    imgData.data.set(shaded)

    // Desenhar usando um canvas temporário e escalar (ImageData não escala direto)
    const tmp = document.createElement('canvas')
    tmp.width = seg + 1
    tmp.height = seg + 1
    tmp.getContext('2d').putImageData(imgData, 0, 0)
    ctx.imageSmoothingEnabled = false
    ctx.drawImage(tmp, 0, 0, seg + 1, seg + 1, 0, 0, size, size)
  }, [heightmap, splatmap, segments, textureLayers, size])

  // ===== Render do cursor do pincel + overlays =====
  const drawCursor = useCallback((mouseX, mouseY) => {
    const canvas = overlayRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (mouseX == null) return

    const cellSize = size / (segments + 1)
    const cx = mouseX * cellSize
    const cy = mouseY * cellSize
    const r = brush.size * cellSize

    // Outer ring
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()

    // Inner ring (mostra 50% do falloff)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2)
    ctx.stroke()

    // Ponto central
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
    ctx.beginPath()
    ctx.arc(cx, cy, 2, 0, Math.PI * 2)
    ctx.fill()
  }, [brush.size, segments, size])

  // ===== Render overlays estáticos (ramp points + scatter) =====
  useEffect(() => {
    const canvas = overlayRef.current
    if (!canvas) return
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')

    // Ramp points
    if (rampPoints && rampPoints.length > 0) {
      const cellSize = size / (segments + 1)
      rampPoints.forEach((p, i) => {
        ctx.fillStyle = '#f4a261'
        ctx.strokeStyle = '#000'
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.arc(p[0] * cellSize, p[1] * cellSize, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        ctx.fillStyle = '#fff'
        ctx.font = 'bold 10px sans-serif'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(String(i + 1), p[0] * cellSize, p[1] * cellSize)
      })
      // Linha entre pontos
      if (rampPoints.length === 2) {
        const cellSize = size / (segments + 1)
        ctx.strokeStyle = 'rgba(244, 162, 97, 0.6)'
        ctx.lineWidth = 2
        ctx.setLineDash([4, 4])
        ctx.beginPath()
        ctx.moveTo(rampPoints[0][0] * cellSize, rampPoints[0][1] * cellSize)
        ctx.lineTo(rampPoints[1][0] * cellSize, rampPoints[1][1] * cellSize)
        ctx.stroke()
        ctx.setLineDash([])
      }
    }

    // Scatter markers
    if (scatteredPoints && scatteredPoints.length > 0) {
      const cellSize = size / (segments + 1)
      ctx.fillStyle = 'rgba(58, 200, 100, 0.8)'
      for (const p of scatteredPoints) {
        ctx.beginPath()
        ctx.arc(p[0] * cellSize, p[1] * cellSize, 1.5, 0, Math.PI * 2)
        ctx.fill()
      }
    }
  }, [rampPoints, scatteredPoints, segments, size])

  // ===== Event handlers (mouse + touch) =====
  const getCellPos = (e) => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const x = ((clientX - rect.left) / rect.width) * segments
    const z = ((clientY - rect.top) / rect.height) * segments
    return { x: Math.round(x), z: Math.round(z), rawX: x, rawZ: z }
  }

  const handlePointerMove = (e) => {
    const pos = getCellPos(e)
    if (!pos) return
    drawCursor(pos.rawX, pos.rawZ)

    if (isDragging && brush.mode !== 'ramp') {
      // Verificar spacing — só pinta se estiver longe suficiente do último stamp
      const spacing = brush.spacing * brush.size
      if (!lastPaintPos.current) {
        onPaint(pos.x, pos.z, false)
        lastPaintPos.current = [pos.x, pos.z]
      } else {
        const dx = pos.x - lastPaintPos.current[0]
        const dz = pos.z - lastPaintPos.current[1]
        if (Math.sqrt(dx * dx + dz * dz) >= spacing) {
          onPaint(pos.x, pos.z, false)
          lastPaintPos.current = [pos.x, pos.z]
        }
      }
    }
  }

  const handlePointerDown = (e) => {
    e.preventDefault()
    const pos = getCellPos(e)
    if (!pos) return
    setIsDragging(true)
    lastPaintPos.current = [pos.x, pos.z]
    onPaint(pos.x, pos.z, true)
  }

  const handlePointerUp = () => {
    setIsDragging(false)
    lastPaintPos.current = null
  }

  const handlePointerLeave = () => {
    drawCursor(null, null)
    if (isDragging) handlePointerUp()
  }

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: size,
        aspectRatio: '1',
        margin: '0 auto',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-sm)',
        overflow: 'hidden',
        touchAction: 'none',
        cursor: brush.mode === 'ramp' ? 'crosshair' : 'none',
      }}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      <canvas
        ref={overlayRef}
        onMouseMove={handlePointerMove}
        onMouseDown={handlePointerDown}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerLeave}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          touchAction: 'none',
        }}
      />
    </div>
  )
}

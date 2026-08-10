/**
 * JoystickControl — joystick virtual touch para controlo de movimento no mobile.
 *
 * Renderiza um joystick circular com um "thumb" (polegar) que segue o dedo.
 * Ao soltar, o thumb retorna ao centro com animação suave.
 *
 * Props:
 *  - side: 'left' | 'right' — posiciona no canto inferior esquerdo ou direito
 *  - size: tamanho em px (default 120)
 *  - color: cor do joystick (default #2f81f7)
 *  - deadzone: zona morta 0..0.5 (default 0.1)
 *  - onMove: callback(x, z) onde x e z são -1..1 (z negativo = frente)
 *  - onEnd: callback() chamado ao soltar
 *  - active: se true, mostra o joystick; se false, esconde
 */
import { useRef, useState, useEffect, useCallback } from 'react'

export default function JoystickControl({
  side = 'left',
  size = 120,
  color = '#2f81f7',
  deadzone = 0.1,
  onMove,
  onEnd,
  active = true,
}) {
  const baseRef = useRef(null)
  const [thumbPos, setThumbPos] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const touchIdRef = useRef(null)
  const centerRef = useRef({ x: 0, y: 0 })

  const radius = size / 2
  const thumbRadius = radius * 0.4

  // Calcula posição do centro do joystick quando montado
  useEffect(() => {
    if (!baseRef.current) return
    const updateCenter = () => {
      const r = baseRef.current.getBoundingClientRect()
      centerRef.current = { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    }
    updateCenter()
    window.addEventListener('resize', updateCenter)
    return () => window.removeEventListener('resize', updateCenter)
  }, [side, size])

  const handleStart = useCallback((clientX, clientY, touchId = null) => {
    touchIdRef.current = touchId
    setIsDragging(true)
    updateThumb(clientX, clientY)
  }, [])

  const updateThumb = useCallback((clientX, clientY) => {
    const dx = clientX - centerRef.current.x
    const dy = clientY - centerRef.current.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    const maxDist = radius - thumbRadius
    const clampedDist = Math.min(dist, maxDist)
    const angle = Math.atan2(dy, dx)
    const tx = Math.cos(angle) * clampedDist
    const ty = Math.sin(angle) * clampedDist
    setThumbPos({ x: tx, y: ty })

    // Calcular valores normalizados -1..1
    // x: direita = positivo, esquerda = negativo
    // z: frente (cima no ecrã) = negativo, trás (baixo) = positivo
    const nx = tx / maxDist
    const nz = ty / maxDist // y do ecrã → z do mundo (frente é negativo)

    // Aplicar zona morta
    const magnitude = Math.sqrt(nx * nx + nz * nz)
    if (magnitude < deadzone) {
      onMove?.(0, 0)
    } else {
      onMove?.(nx, nz)
    }
  }, [radius, thumbRadius, deadzone, onMove])

  const handleEnd = useCallback(() => {
    touchIdRef.current = null
    setIsDragging(false)
    setThumbPos({ x: 0, y: 0 })
    onMove?.(0, 0)
    onEnd?.()
  }, [onMove, onEnd])

  // Touch events
  const onTouchStart = (e) => {
    e.preventDefault()
    const touch = e.changedTouches[0]
    handleStart(touch.clientX, touch.clientY, touch.identifier)
  }

  const onTouchMove = (e) => {
    e.preventDefault()
    if (touchIdRef.current === null) return
    for (const touch of e.changedTouches) {
      if (touch.identifier === touchIdRef.current) {
        updateThumb(touch.clientX, touch.clientY)
        break
      }
    }
  }

  const onTouchEnd = (e) => {
    e.preventDefault()
    for (const touch of e.changedTouches) {
      if (touch.identifier === touchIdRef.current) {
        handleEnd()
        break
      }
    }
  }

  // Mouse events (para desktop/testing)
  const onMouseDown = (e) => {
    e.preventDefault()
    handleStart(e.clientX, e.clientY)
    const move = (ev) => updateThumb(ev.clientX, ev.clientY)
    const up = () => {
      handleEnd()
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  if (!active) return null

  const containerStyle = {
    position: 'fixed',
    bottom: 20,
    [side]: 20,
    width: size,
    height: size,
    zIndex: 95,
    touchAction: 'none',
    userSelect: 'none',
  }

  const baseStyle = {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    background: `radial-gradient(circle, ${color}22 0%, ${color}11 70%, transparent 100%)`,
    border: `2px solid ${color}`,
    opacity: isDragging ? 0.9 : 0.6,
    transition: 'opacity 0.15s',
    position: 'relative',
    cursor: 'pointer',
  }

  const thumbStyle = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: thumbRadius * 2,
    height: thumbRadius * 2,
    borderRadius: '50%',
    background: color,
    border: '2px solid #fff',
    transform: `translate(calc(-50% + ${thumbPos.x}px), calc(-50% + ${thumbPos.y}px))`,
    transition: isDragging ? 'none' : 'transform 0.18s ease-out',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  }

  return (
    <div
      ref={baseRef}
      style={containerStyle}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onMouseDown={onMouseDown}
    >
      <div style={baseStyle}>
        <div style={thumbStyle} />
      </div>
    </div>
  )
}

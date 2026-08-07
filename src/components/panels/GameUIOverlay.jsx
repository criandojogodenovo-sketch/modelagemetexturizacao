/**
 * GameUIOverlay — renderiza elementos de UI sobre o canvas 3D.
 *
 * Processa os seguintes tipos de Conects:
 *  - ButtonObject: botão clicável que dispara eventos FlirScript
 *  - JoystickObject: joystick virtual para movimento do PersonalObject
 *  - TextObject: texto na tela
 *  - ImageObject: imagem/ícone
 *  - PanelObject: painel de fundo
 *
 * O overlay é um div com pointer-events: none; os elementos interativos
 * têm pointer-events: auto.
 */
import { useRef, useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'

export default function GameUIOverlay({ conects }) {
  const uiConects = conects.filter((c) =>
    ['ButtonObject', 'JoystickObject', 'TextObject', 'ImageObject', 'PanelObject'].includes(c.type)
  )

  if (uiConects.length === 0) return null

  return (
    <div className="game-ui-overlay">
      {/* Painéis primeiro (fundos) */}
      {uiConects.filter((c) => c.type === 'PanelObject').map((c) => (
        <PanelElement key={c.instanceId} conect={c} />
      ))}
      {/* Depois os outros elementos */}
      {uiConects.filter((c) => c.type !== 'PanelObject').map((c) => {
        switch (c.type) {
          case 'ButtonObject': return <ButtonElement key={c.instanceId} conect={c} />
          case 'JoystickObject': return <JoystickElement key={c.instanceId} conect={c} />
          case 'TextObject': return <TextElement key={c.instanceId} conect={c} />
          case 'ImageObject': return <ImageElement key={c.instanceId} conect={c} />
          default: return null
        }
      })}
    </div>
  )
}

function PanelElement({ conect }) {
  const pos = conect.position || [10, 10]
  const size = conect.size || [200, 100]
  return (
    <div
      style={{
        position: 'absolute',
        left: `${pos[0]}%`,
        top: `${pos[1]}%`,
        width: size[0],
        height: size[1],
        background: conect.color || '#1c2128',
        opacity: conect.opacity ?? 0.8,
        borderRadius: 8,
        pointerEvents: 'auto',
      }}
    />
  )
}

function ButtonElement({ conect }) {
  const pos = conect.position || [10, 10]
  const size = conect.size || [120, 50]
  const [pressed, setPressed] = useState(false)
  return (
    <button
      style={{
        position: 'absolute',
        left: `${pos[0]}%`,
        top: `${pos[1]}%`,
        width: size[0],
        height: size[1],
        background: conect.color || '#2f81f7',
        color: conect.textColor || '#fff',
        fontSize: conect.fontSize || 14,
        border: 'none',
        borderRadius: 6,
        cursor: 'pointer',
        transform: pressed ? 'scale(0.95)' : 'scale(1)',
        transition: 'transform 0.1s',
        pointerEvents: 'auto',
        touchAction: 'manipulation',
      }}
      onPointerDown={() => setPressed(true)}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onClick={() => {
        // Disparar evento OnTouch no FlirScript deste conect
        // (o FlirScriptRunner trata disto via store)
        const scene = useStore.getState().scenes.find((s) => s.id === useStore.getState().activeSceneId)
        const c = scene?.conects?.find((cc) => cc.instanceId === conect.instanceId)
        // Para já, apenas log; o runtime FlirScript pode ser extendido para ouvir eventos de UI
        console.log(`[UI] Button "${conect.label}" clicado`)
      }}
    >
      {conect.label || 'Botão'}
    </button>
  )
}

function JoystickElement({ conect }) {
  const side = conect.side || 'left'
  const size = conect.size || 120
  const [dragging, setDragging] = useState(false)
  const [knob, setKnob] = useState({ x: 0, y: 0 })
  const baseRef = useRef(null)

  const handlePointerDown = (e) => {
    setDragging(true)
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (!dragging || !baseRef.current) return
    const rect = baseRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    let dx = e.clientX - cx
    let dy = e.clientY - cy
    const maxR = size / 2 - 20
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist > maxR) {
      dx = (dx / dist) * maxR
      dy = (dy / dist) * maxR
    }
    setKnob({ x: dx, y: dy })
    // Normalizar para -1..1 e atualizar o joystickRef global
    // (GameRunner lê deste valor)
    const nx = dx / maxR
    const nz = dy / maxR
    window._flirJoystick = {
      x: nx,
      z: nz,
      active: true,
      target: conect.targetPersonal,
    }
  }

  const handlePointerUp = () => {
    setDragging(false)
    setKnob({ x: 0, y: 0 })
    window._flirJoystick = { x: 0, z: 0, active: false, target: conect.targetPersonal }
  }

  const style = {
    position: 'absolute',
    [side]: 20,
    bottom: 80, // acima da bottom bar
    width: size,
    height: size,
    borderRadius: '50%',
    background: `${conect.color || '#2f81f7'}33`,
    border: `2px solid ${conect.color || '#2f81f7'}`,
    pointerEvents: 'auto',
    touchAction: 'none',
  }

  return (
    <div
      ref={baseRef}
      style={style}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: size * 0.4,
          height: size * 0.4,
          marginLeft: -size * 0.2,
          marginTop: -size * 0.2,
          borderRadius: '50%',
          background: conect.color || '#2f81f7',
          transform: `translate(${knob.x}px, ${knob.y}px)`,
          transition: dragging ? 'none' : 'transform 0.15s',
        }}
      />
    </div>
  )
}

function TextElement({ conect }) {
  const pos = conect.position || [50, 5]
  return (
    <div
      style={{
        position: 'absolute',
        left: `${pos[0]}%`,
        top: `${pos[1]}%`,
        transform: 'translate(-50%, -50%)',
        color: conect.color || '#fff',
        fontSize: conect.fontSize || 18,
        textAlign: conect.align || 'center',
        pointerEvents: 'none',
        textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
        fontFamily: '-apple-system, sans-serif',
        fontWeight: 600,
      }}
    >
      {conect.text || ''}
    </div>
  )
}

function ImageElement({ conect }) {
  if (!conect.url) return null
  const pos = conect.position || [50, 50]
  const size = conect.size || [100, 100]
  return (
    <img
      src={conect.url}
      alt=""
      style={{
        position: 'absolute',
        left: `${pos[0]}%`,
        top: `${pos[1]}%`,
        transform: 'translate(-50%, -50%)',
        width: size[0],
        height: size[1],
        pointerEvents: 'auto',
        objectFit: 'contain',
      }}
    />
  )
}

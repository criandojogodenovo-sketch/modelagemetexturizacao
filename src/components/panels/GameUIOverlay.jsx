/**
 * GameUIOverlay — renderiza elementos de UI sobre o canvas 3D durante o jogo.
 *
 * **Fase 6 (corrigido)**: Cada elemento é renderizado diretamente com
 * pointer-events: auto. Botões disparam onClick, inputs disparam onChange.
 * Não há botões invisíveis separados — o próprio elemento é clicável.
 *
 * **Fase 5**: Adiciona JoystickObject rendering — joystick virtual touch
 * que controla o PersonalObject via joystickRef.
 */
import { useStore } from '../../store/useStore'
import { debugLog } from '../../utils/debug/debugStore'
import { getCameraState, applyCameraInput, applyCameraKeyInput } from '../../utils/cameraController'
import JoystickControl from '../ui/JoystickControl'
import { useRef, useEffect, useState, Fragment } from 'react'

// S17: DialogueBox — mostra o diálogo definido por setDialog/showDialog do FlirCode.
// Faz poll a window._flirDialog (mutado pelo gameContext fora do ciclo React).
// O diálogo desaparece sozinho após 4.5s ou quando hideDialog() é chamado.
function DialogueBox() {
  const [dialog, setDialog] = useState(null)
  useEffect(() => {
    const iv = setInterval(() => {
      const d = window._flirDialog
      if (!d) return
      // Auto-hide após 4.5s
      if (d.visible && d.ts && Date.now() - d.ts > 4500) {
        window._flirDialog = { ...d, visible: false }
        setDialog({ ...d, visible: false })
        return
      }
      setDialog((prev) => {
        if (prev && prev.text === d.text && prev.visible === d.visible) return prev
        return { text: d.text, visible: d.visible }
      })
    }, 250)
    return () => clearInterval(iv)
  }, [])
  if (!dialog || !dialog.visible || !dialog.text) return null
  return (
    <div
      style={{
        position: 'absolute',
        left: '50%',
        bottom: '12%',
        transform: 'translateX(-50%)',
        maxWidth: 'min(520px, 86vw)',
        background: 'rgba(13, 17, 23, 0.92)',
        border: '1px solid #2f81f7',
        borderRadius: 10,
        padding: '12px 18px',
        color: '#e6edf3',
        fontSize: 15,
        fontFamily: '-apple-system, sans-serif',
        lineHeight: 1.45,
        pointerEvents: 'none',
        zIndex: 95,
        boxShadow: '0 4px 18px rgba(0,0,0,0.5)',
        textAlign: 'center',
      }}
    >
      {dialog.text}
    </div>
  )
}

export default function GameUIOverlay() {
  const uiScreens = useStore((s) => s.uiScreens)
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const visibleScreens = uiScreens.filter((sc) => sc.visible !== false)

  const activeScene = scenes.find((s) => s.id === activeSceneId)
  // Procurar TODOS os Conects de UI na cena ativa
  const uiConects = (activeScene?.conects || []).filter((c) =>
    c.type === 'ButtonObject' || c.type === 'JoystickObject' ||
    c.type === 'TextObject' || c.type === 'ImageObject' || c.type === 'PanelObject' ||
    c.type === 'CameraTouchZone'
  )
  const joysticks = uiConects.filter((c) => c.type === 'JoystickObject')
  const cameraZones = uiConects.filter((c) => c.type === 'CameraTouchZone')
  const otherUiConects = uiConects.filter((c) =>
    c.type !== 'JoystickObject' && c.type !== 'CameraTouchZone'
  )

  // S17: DialogueBox renderiza mesmo sem ecrãs de UI — não fazer early-return
  if (visibleScreens.length === 0 && uiConects.length === 0 && !window._flirDialog?.visible) {
    return <DialogueBox />
  }

  const handleEvent = (element, eventType, value) => {
    debugLog(`UI Event: ${element.name}.${eventType}`, 'log', 'UI')
    const eventName = element.eventName || eventType
    if (window._flirGameContext?.triggerUIEvent) {
      window._flirGameContext.triggerUIEvent(eventName, { element, value })
    }
  }

  // Joystick move handler — atualiza o joystickRef global
  const handleJoystickMove = (x, z) => {
    if (window._flirJoystick) {
      window._flirJoystick.x = x
      window._flirJoystick.z = z
      window._flirJoystick.active = (x !== 0 || z !== 0)
    }
  }

  const handleJoystickEnd = () => {
    if (window._flirJoystick) {
      window._flirJoystick.x = 0
      window._flirJoystick.z = 0
      window._flirJoystick.active = false
    }
  }

  return (
    <div className="game-ui-overlay" style={{ pointerEvents: 'none' }}>
      {/* S17: caixa de diálogo (setDialog/showDialog do FlirCode) */}
      <DialogueBox />
      {visibleScreens.map((screen) => (
        // S17 fix (P2-23): Fragment com key no map exterior — antes o array aninhado
        // produzia o warning React "Each child in a list should have a unique key"
        <Fragment key={screen.id}>
        {screen.elements.map((element) => {
          const pos = element.position || [50, 50]
          const size = element.size || [120, 40]
          const baseStyle = {
            position: 'absolute',
            left: `${pos[0]}%`,
            top: `${pos[1]}%`,
            width: size[0],
            height: size[1],
            transform: 'translate(-50%, -50%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: element.color || 'transparent',
            color: element.textColor || '#e6edf3',
            fontSize: (element.fontSize || 14) + 'px',
            border: `${element.borderWidth || 0}px solid ${element.borderColor || 'transparent'}`,
            borderRadius: element.borderRadius || 0,
            padding: element.padding || 0,
            opacity: element.opacity ?? 1,
            pointerEvents: 'auto',
            userSelect: 'none',
            fontFamily: '-apple-system, sans-serif',
            boxSizing: 'border-box',
          }

          // Cada tipo de elemento é renderizado de forma diferente
          switch (element.type) {
            case 'Button':
              return (
                <button
                  key={element.id}
                  style={{ ...baseStyle, cursor: 'pointer' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleEvent(element, element.eventName || 'onClick')
                  }}
                >
                  {element.label || 'Botão'}
                </button>
              )

            case 'Label':
            case 'Text':
              return (
                <div key={element.id} style={baseStyle}>
                  {element.text || element.label || ''}
                </div>
              )

            case 'Input':
              return (
                <input
                  key={element.id}
                  type="text"
                  style={baseStyle}
                  placeholder={element.placeholder || ''}
                  value={element.value || ''}
                  onChange={(e) => {
                    useStore.getState().updateUIElement(element.id, { value: e.target.value })
                    handleEvent(element, 'onChange', e.target.value)
                  }}
                />
              )

            case 'Checkbox':
              return (
                <label key={element.id} style={{ ...baseStyle, cursor: 'pointer', gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={element.checked || false}
                    onChange={(e) => {
                      useStore.getState().updateUIElement(element.id, { checked: e.target.checked })
                      handleEvent(element, 'onChange', e.target.checked)
                    }}
                  />
                  {element.label || ''}
                </label>
              )

            case 'Slider':
              return (
                <div key={element.id} style={{ ...baseStyle, flexDirection: 'column' }}>
                  <input
                    type="range"
                    min={element.min || 0}
                    max={element.max || 100}
                    value={element.value || 50}
                    onChange={(e) => {
                      useStore.getState().updateUIElement(element.id, { value: Number(e.target.value) })
                      handleEvent(element, 'onChange', Number(e.target.value))
                    }}
                    style={{ width: '100%' }}
                  />
                  <span style={{ fontSize: 10 }}>{element.value}</span>
                </div>
              )

            case 'Form':
              return (
                <div key={element.id} style={{ ...baseStyle, flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>{element.name || 'Form'}</div>
                  <button
                    style={{ fontSize: 11, padding: '4px 12px', cursor: 'pointer' }}
                    onClick={(e) => { e.stopPropagation(); handleEvent(element, 'onSubmit') }}
                  >
                    {element.submitLabel || 'Enviar'}
                  </button>
                </div>
              )

            case 'Image':
              return (
                <div key={element.id} style={{ ...baseStyle, overflow: 'hidden' }}>
                  {element.url ? (
                    <img src={element.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : null}
                </div>
              )

            case 'Panel':
              return <div key={element.id} style={baseStyle} />

            default:
              return <div key={element.id} style={baseStyle}>{element.name}</div>
          }
        })}
        </Fragment>
      ))}

      {/* Joysticks virtuais — renderizados a partir de JoystickObjects na cena */}
      {joysticks.map((js) => (
        <JoystickControl
          key={js.instanceId}
          side={js.side || 'left'}
          size={js.size || 120}
          color={js.color || '#2f81f7'}
          deadzone={js.deadzone ?? 0.1}
          onMove={handleJoystickMove}
          onEnd={handleJoystickEnd}
        />
      ))}

      {/* CameraTouchZone — zona de toque para rodar câmara (FPS/BR-style) */}
      {cameraZones.map((cz) => (
        <CameraTouchZoneControl
          key={cz.instanceId}
          zone={cz.zone}
          sensitivity={cz.sensitivity ?? 1.0}
          invertY={cz.invertY || false}
          minPitch={cz.minPitch ?? -1.4}
          maxPitch={cz.maxPitch ?? 1.4}
        />
      ))}

      {/* Conects de UI da cena ativa (ButtonObject, TextObject, etc.) */}
      {otherUiConects.map((conect) => {
        const pos = conect.position || [10, 10]
        const size = conect.size || [120, 40]
        const baseStyle = {
          position: 'absolute',
          left: `${pos[0]}%`,
          top: `${pos[1]}%`,
          width: size[0],
          height: size[1],
          transform: 'translate(-50%, -50%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: conect.color || 'transparent',
          color: conect.textColor || '#e6edf3',
          fontSize: (conect.fontSize || 14) + 'px',
          borderRadius: 4,
          padding: 0,
          opacity: conect.opacity ?? 1,
          pointerEvents: 'auto',
          userSelect: 'none',
          fontFamily: '-apple-system, sans-serif',
          boxSizing: 'border-box',
          zIndex: 91,
        }

        switch (conect.type) {
          case 'ButtonObject':
            return (
              <button
                key={conect.instanceId}
                style={{ ...baseStyle, cursor: 'pointer', border: 'none', borderRadius: 6 }}
                onClick={(e) => {
                  e.stopPropagation()
                  e.preventDefault()
                  handleEvent(conect, conect.eventName || 'onClick')
                }}
                onTouchStart={(e) => { e.stopPropagation() }}
              >
                {conect.label || 'Botão'}
              </button>
            )
          case 'TextObject':
            return (
              <div
                key={conect.instanceId}
                style={{
                  ...baseStyle,
                  textAlign: conect.align || 'center',
                  background: 'transparent',
                  width: 'auto',
                  height: 'auto',
                  padding: '4px 8px',
                  textShadow: '0 1px 3px rgba(0,0,0,0.8)',
                }}
              >
                {conect.text || conect.label || ''}
              </div>
            )
          case 'ImageObject':
            return (
              <div key={conect.instanceId} style={{ ...baseStyle, overflow: 'hidden' }}>
                {conect.url ? (
                  <img src={conect.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : null}
              </div>
            )
          case 'PanelObject':
            return <div key={conect.instanceId} style={baseStyle} />
          default:
            return null
        }
      })}
    </div>
  )
}

/**
 * CameraTouchZoneControl — zona de toque para rodar a câmara (pitch/yaw).
 * Estilo COD Mobile / Fortnite: arrastar o dedo nesta zona roda a câmara.
 * Invisível (transparente) mas captura eventos de toque.
 * Usa cameraController (getCameraState + applyCameraInput) — fonte única de verdade.
 */
function CameraTouchZoneControl({ zone, sensitivity, invertY, minPitch, maxPitch }) {
  const touchIdRef = useRef(null)
  const lastPosRef = useRef(null)

  useEffect(() => {
    // Configurar estado da câmara via cameraController
    const camState = getCameraState()
    camState.sensitivity = sensitivity
    camState.invertY = invertY
    camState.minPitch = minPitch
    camState.maxPitch = maxPitch
    camState.enabled = true
    camState.hasTouchZone = true

    // Teclado (setas) — útil em desktop sem rato a arrastar
    const onKeyDown = (e) => {
      const key = e.key.toLowerCase()
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown'].includes(key)) {
        e.preventDefault()
        applyCameraKeyInput(key, getCameraState())
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      const s = getCameraState()
      s.enabled = false
      s.hasTouchZone = false
    }
  }, [sensitivity, invertY, minPitch, maxPitch])

  const z = zone || { x: 50, y: 0, w: 50, h: 100 }
  const zoneStyle = {
    position: 'fixed',
    left: `${z.x}%`,
    top: `${z.y}%`,
    width: `${z.w}%`,
    height: `${z.h}%`,
    zIndex: 88,
    touchAction: 'none',
    background: 'transparent',
    pointerEvents: 'auto',
  }

  const onTouchStart = (e) => {
    const touch = e.changedTouches[0]
    touchIdRef.current = touch.identifier
    lastPosRef.current = { x: touch.clientX, y: touch.clientY }
  }
  const onTouchMove = (e) => {
    if (touchIdRef.current === null) return
    for (const touch of e.changedTouches) {
      if (touch.identifier === touchIdRef.current) {
        const dx = touch.clientX - lastPosRef.current.x
        const dy = touch.clientY - lastPosRef.current.y
        lastPosRef.current = { x: touch.clientX, y: touch.clientY }
        applyCameraInput(dx, dy, getCameraState())
        break
      }
    }
  }
  const onTouchEnd = (e) => {
    for (const touch of e.changedTouches) {
      if (touch.identifier === touchIdRef.current) {
        touchIdRef.current = null
        lastPosRef.current = null
        break
      }
    }
  }

  const onMouseDown = (e) => {
    e.preventDefault()
    lastPosRef.current = { x: e.clientX, y: e.clientY }
    const move = (ev) => {
      const dx = ev.clientX - lastPosRef.current.x
      const dy = ev.clientY - lastPosRef.current.y
      lastPosRef.current = { x: ev.clientX, y: ev.clientY }
      applyCameraInput(dx, dy, getCameraState())
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }

  return (
    <div
      style={zoneStyle}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchEnd}
      onMouseDown={onMouseDown}
    />
  )
}

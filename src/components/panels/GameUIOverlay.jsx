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
import JoystickControl from '../ui/JoystickControl'

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
  const otherUiConects = uiConects.filter((c) => c.type !== 'JoystickObject')

  if (visibleScreens.length === 0 && uiConects.length === 0) return null

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
      {visibleScreens.map((screen) =>
        screen.elements.map((element) => {
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
        })
      )}

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

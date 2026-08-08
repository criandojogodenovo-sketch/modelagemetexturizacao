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
  // Procurar JoystickObjects na cena ativa
  const joysticks = (activeScene?.conects || []).filter((c) => c.type === 'JoystickObject')

  if (visibleScreens.length === 0 && joysticks.length === 0) return null

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

      {/* Sistema 2: Crosshair (mira) quando arma equipada */}
      {window._flirCrosshair && (
        <div style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 24,
          height: 24,
          pointerEvents: 'none',
          zIndex: 90,
        }}>
          <div style={{ position: 'absolute', top: '50%', left: 0, width: 8, height: 2, background: '#fff', transform: 'translateY(-50%)' }} />
          <div style={{ position: 'absolute', top: '50%', right: 0, width: 8, height: 2, background: '#fff', transform: 'translateY(-50%)' }} />
          <div style={{ position: 'absolute', top: 0, left: '50%', width: 2, height: 8, background: '#fff', transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', bottom: 0, left: '50%', width: 2, height: 8, background: '#fff', transform: 'translateX(-50%)' }} />
          <div style={{ position: 'absolute', top: '50%', left: '50%', width: 2, height: 2, background: '#f85149', borderRadius: '50%', transform: 'translate(-50%, -50%)' }} />
        </div>
      )}

      {/* Sistema 3: Painel de inventário (canto superior direito) */}
      {window._flirInventory && Object.keys(window._flirInventory).length > 0 && (
        <div style={{
          position: 'fixed',
          top: 8,
          right: 8,
          background: 'rgba(13, 17, 23, 0.85)',
          border: '1px solid #30363d',
          borderRadius: 6,
          padding: '6px 10px',
          fontSize: 11,
          color: '#e6edf3',
          fontFamily: 'monospace',
          zIndex: 90,
          pointerEvents: 'none',
          minWidth: 120,
        }}>
          <div style={{ fontWeight: 700, marginBottom: 4, color: '#3fb950' }}>🎒 Inventário</div>
          {Object.entries(window._flirInventory).map(([name, qty]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{name}</span>
              <span style={{ color: '#8b949e' }}>x{qty}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

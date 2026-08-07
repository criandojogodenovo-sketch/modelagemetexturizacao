/**
 * GameUIOverlay — renderiza elementos de UI sobre o canvas 3D durante o jogo.
 *
 * **Fase 6**: Usa o MESMO UIElementRenderer do editor, garantindo que
 * o que se vê no editor é exatamente o que aparece no jogo.
 *
 * Renderiza todas as telas de UI visíveis (uiScreens com visible: true).
 * Elementos interativos disparam eventos via FlirCode (onClick, onChange, etc.).
 */
import { useStore } from '../../store/useStore'
import { UIElementRenderer } from './ui-editor/UIEditor'
import { debugLog } from '../../utils/debug/debugStore'

export default function GameUIOverlay() {
  const uiScreens = useStore((s) => s.uiScreens)
  const runtimesRef = window._flirGameContext?.runtimesRef

  // Filtrar telas visíveis
  const visibleScreens = uiScreens.filter((sc) => sc.visible !== false)

  if (visibleScreens.length === 0) return null

  const handleElementEvent = (element, eventType, value) => {
    debugLog(`UI Event: ${element.name}.${eventType}`, 'log', 'UI')
    // Disparar evento no FlirCode runtime
    const eventName = element.eventName || eventType
    // Procurar o runtime ativo (qualquer um — o FlirCode é global por agora)
    if (window._flirGameContext?.triggerUIEvent) {
      window._flirGameContext.triggerUIEvent(eventName, { element, value })
    }
  }

  return (
    <div className="game-ui-overlay">
      {visibleScreens.map((screen) =>
        screen.elements.map((element) => (
          <UIElementRenderer
            key={element.id}
            element={element}
            isSelected={false}
            onSelect={() => {}}
            isEditor={false}
            onUpdate={(patch) => {
              // Atualizar o elemento no store em tempo real
              useStore.getState().updateUIElement(element.id, patch)
              // Disparar evento se for onChange
              if (patch.value !== undefined || patch.checked !== undefined) {
                handleElementEvent(element, 'onChange', patch.value ?? patch.checked)
              }
            }}
          />
        ))
      )}
      {/* Botões disparam onClick via click nativo */}
      {visibleScreens.flatMap((screen) =>
        screen.elements
          .filter((el) => el.type === 'Button' || el.type === 'Form')
          .map((element) => (
            <button
              key={`trigger-${element.id}`}
              style={{
                position: 'absolute',
                left: `${element.position?.[0] || 50}%`,
                top: `${element.position?.[1] || 50}%`,
                width: element.size?.[0] || 120,
                height: element.size?.[1] || 40,
                transform: 'translate(-50%, -50%)',
                opacity: 0,
                pointerEvents: 'auto',
                cursor: 'pointer',
                border: 'none',
                background: 'transparent',
              }}
              onClick={() => handleElementEvent(element, element.eventName || 'onClick')}
            />
          ))
      )}
    </div>
  )
}

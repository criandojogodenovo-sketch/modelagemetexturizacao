/**
 * Viewport — wrapper da Scene3D com overlay de dicas e botões flutuantes.
 *
 * Inclui:
 *  - Scene3D (canvas)
 *  - Dica de controlos (mouse/touch)
 *  - Botões flutuantes de modo de transformação (atalho rápido)
 */
import Scene3D from '../3d/Scene3D'
import { useStore } from '../../store/useStore'
import { HOTKEYS } from '../../hooks/useHotkeys'
import { IconTranslate, IconRotate, IconScale } from '../ui/Icons'

export default function Viewport() {
  const transformMode = useStore((s) => s.transformMode)
  const setTransformMode = useStore((s) => s.setTransformMode)

  return (
    <div className="viewport">
      <Scene3D />

      <div className="viewport-overlay">
        {/* Botões flutuantes de modo de transformação */}
        <div className="viewport-actions">
          <button
            className={transformMode === 'translate' ? 'active' : ''}
            onClick={() => setTransformMode('translate')}
            title={`Mover (${HOTKEYS.translate})`}
          >
            <IconTranslate width={18} height={18} />
          </button>
          <button
            className={transformMode === 'rotate' ? 'active' : ''}
            onClick={() => setTransformMode('rotate')}
            title={`Rodar (${HOTKEYS.rotate})`}
          >
            <IconRotate width={18} height={18} />
          </button>
          <button
            className={transformMode === 'scale' ? 'active' : ''}
            onClick={() => setTransformMode('scale')}
            title={`Escalar (${HOTKEYS.scale})`}
          >
            <IconScale width={18} height={18} />
          </button>
        </div>

        {/* Dica de controlos */}
        <div className="viewport-hint">
          <strong>Controlos:</strong>
          <br />
          <kbd>Rato Esq.</kbd> Orbitar · <kbd>Rato Dir.</kbd> Pan · <kbd>Roda</kbd> Zoom
          <br />
          <kbd>1 Dedo</kbd> Orbitar · <kbd>2 Dedos</kbd> Pan/Zoom
          <br />
          <kbd>G</kbd>/<kbd>R</kbd>/<kbd>S</kbd> Modo · <kbd>Del</kbd> Apagar ·{' '}
          <kbd>{HOTKEYS.undo}</kbd> Desfazer
        </div>
      </div>
    </div>
  )
}

/**
 * BottomBar — barra de ferramentas principal fixa em baixo (mobile).
 *
 * Contém no máximo 6 ícones sempre visíveis (os mais usados):
 *  1. Menu (abre drawer lateral esquerdo)
 *  2. Adicionar (cubo rápido)
 *  3. Mover / Rodar / Escalar (ciclo de transform mode)
 *  4. Edit mode (toggle)
 *  5. Mais ferramentas (abre grelha em ecrã cheia)
 *  6. Propriedades (abre drawer lateral direito)
 *
 * Em desktop, esta barra fica escondida — usa-se os painéis laterais.
 */
import { useStore } from '../../store/useStore'
import {
  IconMenu,
  IconCube,
  IconTranslate,
  IconRotate,
  IconScale,
  IconEdit,
  IconMoreGrid,
  IconSettings,
} from './Icons'

export default function BottomBar() {
  const toggleLeftDrawer = useStore((s) => s.toggleLeftDrawer)
  const toggleRightDrawer = useStore((s) => s.toggleRightDrawer)
  const toggleMoreTools = useStore((s) => s.toggleMoreTools)
  const addObject = useStore((s) => s.addObject)
  const transformMode = useStore((s) => s.transformMode)
  const setTransformMode = useStore((s) => s.setTransformMode)
  const mode = useStore((s) => s.mode)
  const setMode = useStore((s) => s.setMode)

  // Cicla entre translate → rotate → scale
  const cycleTransform = () => {
    const order = ['translate', 'rotate', 'scale']
    const idx = order.indexOf(transformMode)
    setTransformMode(order[(idx + 1) % order.length])
  }

  const TransformIcon = transformMode === 'translate' ? IconTranslate
                      : transformMode === 'rotate' ? IconRotate
                      : IconScale

  return (
    <div className="bottom-bar">
      <button
        className="bb-btn"
        onClick={toggleLeftDrawer}
        title="Menu"
      >
        <IconMenu width={20} height={20} />
        <span className="bb-label">Menu</span>
      </button>

      <button
        className="bb-btn"
        onClick={() => addObject('cube')}
        title="Adicionar cubo"
      >
        <IconCube width={20} height={20} />
        <span className="bb-label">Cubo</span>
      </button>

      <button
        className="bb-btn active"
        onClick={cycleTransform}
        title={`Modo: ${transformMode}`}
      >
        <TransformIcon width={20} height={20} />
        <span className="bb-label">
          {transformMode === 'translate' ? 'Mover' : transformMode === 'rotate' ? 'Rodar' : 'Escalar'}
        </span>
      </button>

      <button
        className={`bb-btn ${mode === 'edit' ? 'active' : ''}`}
        onClick={() => setMode(mode === 'edit' ? 'object' : 'edit')}
        title="Modo edição"
      >
        <IconEdit width={20} height={20} />
        <span className="bb-label">Editar</span>
      </button>

      <button
        className="bb-btn"
        onClick={toggleMoreTools}
        title="Mais ferramentas"
      >
        <IconMoreGrid width={20} height={20} />
        <span className="bb-label">Mais</span>
      </button>

      <button
        className="bb-btn"
        onClick={toggleRightDrawer}
        title="Propriedades"
      >
        <IconSettings width={20} height={20} />
        <span className="bb-label">Props</span>
      </button>
    </div>
  )
}

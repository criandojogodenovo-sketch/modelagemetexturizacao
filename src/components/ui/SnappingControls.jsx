/**
 * SnappingControls — botão de snapping no TopBar (estilo Blender/Unreal).
 *
 * C2: Expandido com:
 *  - Tipo de snap: grade, vértice, face
 *  - Tamanho da grade (0.1, 0.25, 0.5, 1, 2, 5)
 *  - Step de rotação (1, 5, 15, 30, 45, 90°)
 *  - Aplicado a position/rotation/scale via store.snapValue()
 */
import { useStore } from '../../store/useStore'
import { IconUnwrap } from '../ui/Icons'

const SNAP_SIZES = [0.1, 0.25, 0.5, 1, 2, 5]
const SNAP_ROTATION_STEPS = [1, 5, 15, 30, 45, 90]

export default function SnappingControls() {
  const snapEnabled = useStore((s) => s.snapEnabled)
  const snapSize = useStore((s) => s.snapSize)
  const snapRotationStep = useStore((s) => s.snapRotationStep)
  const snapType = useStore((s) => s.snapType) || 'grid'
  const toggleSnap = useStore((s) => s.toggleSnap)
  const setSnapSize = useStore((s) => s.setSnapSize)
  const setSnapRotationStep = useStore((s) => s.setSnapRotationStep)
  const setSnapType = useStore((s) => s.setSnapType) || (() => {})

  return (
    <div className="snapping-controls" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        className={`icon ${snapEnabled ? 'active' : ''}`}
        onClick={toggleSnap}
        title={snapEnabled ? `Snapping ativo (${snapType}, grade ${snapSize})` : 'Snapping desativado'}
        style={{
          background: snapEnabled ? 'var(--accent)' : 'transparent',
          color: snapEnabled ? 'white' : 'inherit',
        }}
      >
        <IconUnwrap width={16} height={16} />
      </button>
      {snapEnabled && (
        <>
          <select
            value={snapType}
            onChange={(e) => setSnapType(e.target.value)}
            title="Tipo de snap"
            style={{ width: 70, height: 28, fontSize: 11 }}
          >
            <option value="grid">Grade</option>
            <option value="vertex">Vértice</option>
            <option value="face">Face</option>
          </select>
          <select
            value={snapSize}
            onChange={(e) => setSnapSize(Number(e.target.value))}
            title="Tamanho da grade"
            style={{ width: 50, height: 28, fontSize: 11 }}
          >
            {SNAP_SIZES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={snapRotationStep}
            onChange={(e) => setSnapRotationStep(Number(e.target.value))}
            title="Step de rotação (°)"
            style={{ width: 50, height: 28, fontSize: 11 }}
          >
            {SNAP_ROTATION_STEPS.map((s) => (
              <option key={s} value={s}>{s}°</option>
            ))}
          </select>
        </>
      )}
    </div>
  )
}

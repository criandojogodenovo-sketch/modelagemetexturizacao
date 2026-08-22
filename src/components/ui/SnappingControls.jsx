/**
 * SnappingControls — botão de snapping no TopBar (estilo Blender/Unreal).
 *
 * Permite ativar/desativar snapping e escolher o tamanho da grade.
 */
import { useStore } from '../../store/useStore'
import { IconUnwrap } from '../ui/Icons'

const SNAP_SIZES = [0.1, 0.25, 0.5, 1, 2, 5]

export default function SnappingControls() {
  const snapEnabled = useStore((s) => s.snapEnabled)
  const snapSize = useStore((s) => s.snapSize)
  const toggleSnap = useStore((s) => s.toggleSnap)
  const setSnapSize = useStore((s) => s.setSnapSize)

  return (
    <div className="snapping-controls" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button
        className={`icon ${snapEnabled ? 'active' : ''}`}
        onClick={toggleSnap}
        title={snapEnabled ? `Snapping ativo (grade ${snapSize})` : 'Snapping desativado'}
        style={{
          background: snapEnabled ? 'var(--accent)' : 'transparent',
          color: snapEnabled ? 'white' : 'inherit',
        }}
      >
        <IconUnwrap width={16} height={16} />
      </button>
      {snapEnabled && (
        <select
          value={snapSize}
          onChange={(e) => setSnapSize(Number(e.target.value))}
          title="Tamanho da grade de snapping"
          style={{ width: 60, height: 28 }}
        >
          {SNAP_SIZES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      )}
    </div>
  )
}

/**
 * HotkeyToolbar — toolbar flutuante no viewport (estilo Blender).
 *
 * Botões rápidos para as ferramentas mais usadas:
 *  [Mover] [Rodar] [Escalar] | [Extrude] [Inset] [Bevel] | [Snap] [Grid]
 *
 * Visível apenas em modo Modelagem (não em Cena/Play).
 */
import { useStore } from '../../store/useStore'
import {
  IconTranslate,
  IconRotate,
  IconScale,
  IconExtrude,
  IconSubdivide,
  IconMirror,
  IconUnwrap,
} from './Icons'

export default function HotkeyToolbar() {
  const transformMode = useStore((s) => s.transformMode)
  const setTransformMode = useStore((s) => s.setTransformMode)
  const selectedId = useStore((s) => s.selectedId)
  const applyMeshOp = useStore((s) => s.applyMeshOp)
  const snapEnabled = useStore((s) => s.snapEnabled)
  const toggleSnap = useStore((s) => s.toggleSnap)
  const grid = useStore((s) => s.grid)
  const setGrid = useStore((s) => s.setGrid)
  const toast = useStore((s) => s.toast)
  const appMode = useStore((s) => s.appMode)
  const scenePreviewOpen = useStore((s) => s.scenePreviewOpen)

  // Não mostrar em modo Cena ou Play
  if (appMode === 'scene' || scenePreviewOpen || appMode === 'flirscript' || appMode === 'ui') return null

  const handleMeshOp = (op, params) => () => {
    if (!selectedId) {
      toast('Selecione um objeto primeiro', 'error')
      return
    }
    applyMeshOp(selectedId, op, params)
  }

  return (
    <div className="hotkey-toolbar" style={{
      position: 'fixed',
      bottom: 80, // acima do BottomBar
      left: '50%',
      transform: 'translateX(-50%)',
      display: 'flex',
      gap: 4,
      padding: '4px 8px',
      background: 'rgba(22, 27, 34, 0.92)',
      backdropFilter: 'blur(8px)',
      borderRadius: 8,
      border: '1px solid #30363d',
      boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      zIndex: 50,
      pointerEvents: 'auto',
    }}>
      {/* Transform */}
      <ToolbarButton
        active={transformMode === 'translate'}
        onClick={() => setTransformMode('translate')}
        title="Mover (G)"
      >
        <IconTranslate width={18} height={18} />
      </ToolbarButton>
      <ToolbarButton
        active={transformMode === 'rotate'}
        onClick={() => setTransformMode('rotate')}
        title="Rodar (R)"
      >
        <IconRotate width={18} height={18} />
      </ToolbarButton>
      <ToolbarButton
        active={transformMode === 'scale'}
        onClick={() => setTransformMode('scale')}
        title="Escalar (S)"
      >
        <IconScale width={18} height={18} />
      </ToolbarButton>

      <Divider />

      {/* Mesh ops */}
      <ToolbarButton
        onClick={handleMeshOp('extrude', { amount: 0.3 })}
        title="Extrude"
        disabled={!selectedId}
      >
        <IconExtrude width={18} height={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={handleMeshOp('inset', { amount: 0.2 })}
        title="Inset"
        disabled={!selectedId}
      >
        <IconSubdivide width={18} height={18} />
      </ToolbarButton>
      <ToolbarButton
        onClick={handleMeshOp('bevel', { radius: 0.04 })}
        title="Bevel"
        disabled={!selectedId}
      >
        <IconMirror width={18} height={18} />
      </ToolbarButton>

      <Divider />

      {/* Snap + Grid */}
      <ToolbarButton
        active={snapEnabled}
        onClick={toggleSnap}
        title={snapEnabled ? 'Snapping ativo' : 'Snapping desativado'}
      >
        <IconUnwrap width={18} height={18} />
      </ToolbarButton>
      <ToolbarButton
        active={grid.visible}
        onClick={() => setGrid({ visible: !grid.visible })}
        title="Toggle grelha"
      >
        <span style={{ fontSize: 14, fontWeight: 'bold' }}>⊞</span>
      </ToolbarButton>
    </div>
  )
}

function ToolbarButton({ children, active, disabled, onClick, title }) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'var(--accent, #2f81f7)' : 'transparent',
        color: active ? 'white' : 'inherit',
        border: 'none',
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}

function Divider() {
  return <div style={{ width: 1, background: '#30363d', margin: '0 2px' }} />
}

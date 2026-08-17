/**
 * EditModePanel — ferramentas para o modo de edição de malha.
 *
 * Permite:
 *  - Alternar modo de seleção (vertex/edge/face)
 *  - Aplicar operações: extrude, inset, bevel, loop cut, merge, subdivide
 *
 * As operações são aplicadas ao objeto selecionado e guardadas em customGeometry.
 */
import { useStore, useSelectedObject, EDIT_SELECTION_MODES } from '../../store/useStore'
import {
  IconVertex,
  IconEdge,
  IconFace,
  IconExtrude,
  IconSubdivide,
  IconMirror,
  IconUnwrap,
  IconTrash,
} from '../ui/Icons'

const SELECTION_ICONS = {
  vertex: IconVertex,
  edge: IconEdge,
  face: IconFace,
}

const SELECTION_LABELS = {
  vertex: 'Vértices',
  edge: 'Arestas',
  face: 'Faces',
}

export default function EditModePanel() {
  const selected = useSelectedObject()
  const editSelectionMode = useStore((s) => s.editSelectionMode)
  const setEditModeSelection = useStore((s) => s.setEditModeSelection)
  const applyMeshOp = useStore((s) => s.applyMeshOp)
  const toast = useStore((s) => s.toast)

  if (!selected) {
    return (
      <div className="empty-state">
        <div>Selecione um objeto para editar a sua malha.</div>
      </div>
    )
  }

  return (
    <>
      <div className="panel-section">
        <h4>Modo de Seleção</h4>
        <div className="mode-row">
          {EDIT_SELECTION_MODES.map((mode) => {
            const Icon = SELECTION_ICONS[mode]
            return (
              <button
                key={mode}
                className={editSelectionMode === mode ? 'active' : ''}
                onClick={() => setEditModeSelection(mode)}
                title={SELECTION_LABELS[mode]}
              >
                {Icon && <Icon width={16} height={16} />}
                <span style={{ fontSize: 10 }}>{SELECTION_LABELS[mode]}</span>
              </button>
            )
          })}
        </div>
        <div className="small muted">
          Dica: clique na malha para selecionar {SELECTION_LABELS[editSelectionMode]}.
        </div>
      </div>

      <div className="panel-section">
        <h4>Operações de Malha</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          <button
            onClick={() => applyMeshOp(selected.id, 'extrude', { amount: 0.3 })}
            title="Extrude faces"
          >
            <IconExtrude width={14} height={14} /> Extrude
          </button>
          <button
            onClick={() => applyMeshOp(selected.id, 'inset', { amount: 0.15 })}
            title="Inset faces"
          >
            <IconSubdivide width={14} height={14} /> Inset
          </button>
          <button
            onClick={() => applyMeshOp(selected.id, 'bevel', { radius: 0.04, segments: 2 })}
            title="Bevel (chanfro)"
          >
            <IconMirror width={14} height={14} /> Bevel
          </button>
          <button
            onClick={() => applyMeshOp(selected.id, 'subdivide', { levels: 1 })}
            title="Subdividir"
          >
            <IconSubdivide width={14} height={14} /> Subdivide
          </button>
          <button
            onClick={() => applyMeshOp(selected.id, 'loopCut', { axis: 'y' })}
            title="Loop cut"
          >
            <IconMirror width={14} height={14} /> Loop Cut
          </button>
          <button
            onClick={() => applyMeshOp(selected.id, 'merge', { threshold: 0.001 })}
            title="Merge de vértices próximos"
          >
            <IconVertex width={14} height={14} /> Merge
          </button>
        </div>
      </div>

      <div className="panel-section">
        <h4>UVs</h4>
        <button
          onClick={() => applyMeshOp(selected.id, 'unwrap', { method: 'planar' })}
          title="Unwrap planar"
          style={{ width: '100%' }}
        >
          <IconUnwrap width={14} height={14} /> Unwrap Automático (Planar)
        </button>
        <button
          onClick={() => applyMeshOp(selected.id, 'unwrap', { method: 'box' })}
          title="Unwrap box projection"
          style={{ width: '100%', marginTop: 6 }}
        >
          <IconUnwrap width={14} height={14} /> Unwrap Box Projection
        </button>
      </div>

      <div className="panel-section">
        <h4>Estado da Malha</h4>
        <div className="small muted">
          {selected.customGeometry ? (
            <>
              <div>Geometria editada: <strong>{(selected.customGeometry.positions?.length / 3).toFixed(0)}</strong> vértices</div>
              {/* Fase 7 — Info adicional: triângulos estimados */}
              <div>Triângulos: <strong>{Math.floor((selected.customGeometry.positions?.length / 3) / 3)}</strong></div>
              <div className="mt-2 small">
                A geometria original da primitiva foi substituída pela malha editada.
              </div>
            </>
          ) : (
            <>Geometria original da primitiva (não editada).</>
          )}
        </div>
      </div>

      {/* Fase 7 — Atalhos rápidos de modelagem */}
      <div className="panel-section">
        <h4>Atalhos</h4>
        <div className="small muted" style={{ lineHeight: 1.6 }}>
          <div><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> — Vértice / Aresta / Face</div>
          <div><kbd>E</kbd> — Extrude</div>
          <div><kbd>I</kbd> — Inset</div>
          <div><kbd>B</kbd> — Bevel</div>
          <div><kbd>S</kbd> — Subdivide</div>
          <div><kbd>M</kbd> — Merge</div>
          <div><kbd>Ctrl+Z</kbd> — Desfazer</div>
        </div>
      </div>
    </>
  )
}

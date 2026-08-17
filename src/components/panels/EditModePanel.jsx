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
import { useHotkeys } from '../../hooks/useHotkeys'
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

  // Fase 11 — Atalhos de teclado reais ligados às operações de malha
  useHotkeys({
    '1': () => setEditModeSelection('vertex'),
    '2': () => setEditModeSelection('edge'),
    '3': () => setEditModeSelection('face'),
    'e': () => selected && applyMeshOp(selected.id, 'extrude', { amount: 0.3 }),
    'i': () => selected && applyMeshOp(selected.id, 'inset', { amount: 0.15 }),
    'b': () => selected && applyMeshOp(selected.id, 'bevel', { radius: 0.04, segments: 2 }),
    's': () => selected && applyMeshOp(selected.id, 'subdivide', { levels: 1 }),
    'm': () => selected && applyMeshOp(selected.id, 'merge', { threshold: 0.001 }),
  })

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
            title="Extrude faces — atalho: E"
            className={editSelectionMode === 'face' ? 'active' : ''}
          >
            <IconExtrude width={14} height={14} /> Extrude
          </button>
          <button
            onClick={() => applyMeshOp(selected.id, 'inset', { amount: 0.15 })}
            title="Inset faces — atalho: I"
          >
            <IconSubdivide width={14} height={14} /> Inset
          </button>
          <button
            onClick={() => applyMeshOp(selected.id, 'bevel', { radius: 0.04, segments: 2 })}
            title="Bevel (chanfro) — atalho: B"
          >
            <IconMirror width={14} height={14} /> Bevel
          </button>
          <button
            onClick={() => applyMeshOp(selected.id, 'subdivide', { levels: 1 })}
            title="Subdividir — atalho: S"
          >
            <IconSubdivide width={14} height={14} /> Subdivide
          </button>
          <button
            onClick={() => applyMeshOp(selected.id, 'loopCut', { axis: 'y' })}
            title="Loop cut — Ctrl+R"
          >
            <IconMirror width={14} height={14} /> Loop Cut
          </button>
          <button
            onClick={() => applyMeshOp(selected.id, 'merge', { threshold: 0.001 })}
            title="Merge de vértices próximos — atalho: M"
          >
            <IconVertex width={14} height={14} /> Merge
          </button>
        </div>
      </div>

      {/* Fase 11 — Operações avançadas estilo Blender */}
      <div className="panel-section">
        <h4>Transformação</h4>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
          <button
            onClick={() => {
              const s = useStore.getState()
              if (!s.selectedId) return
              const obj = s.objects.find(o => o.id === s.selectedId)
              if (!obj) return
              s.transformObject(obj.id, { scale: [(obj.scale[0] || 1) * 1.1, (obj.scale[1] || 1) * 1.1, (obj.scale[2] || 1) * 1.1] })
            }}
            title="Aumentar escala"
            style={{ fontSize: 11 }}
          >⬆ Escala</button>
          <button
            onClick={() => {
              const s = useStore.getState()
              if (!s.selectedId) return
              const obj = s.objects.find(o => o.id === s.selectedId)
              if (!obj) return
              s.transformObject(obj.id, { scale: [(obj.scale[0] || 1) * 0.9, (obj.scale[1] || 1) * 0.9, (obj.scale[2] || 1) * 0.9] })
            }}
            title="Reduzir escala"
            style={{ fontSize: 11 }}
          >⬇ Escala</button>
          <button
            onClick={() => {
              const s = useStore.getState()
              if (!s.selectedId) return
              const obj = s.objects.find(o => o.id === s.selectedId)
              if (!obj) return
              s.transformObject(obj.id, { rotation: [(obj.rotation[0] || 0), (obj.rotation[1] || 0) + Math.PI / 2, (obj.rotation[2] || 0)] })
            }}
            title="Rodar 90° Y"
            style={{ fontSize: 11 }}
          >↻ Rodar</button>
        </div>
      </div>

      <div className="panel-section">
        <h4>Simetria</h4>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => applyMeshOp(selected.id, 'subdivide', { levels: 1 })}
            title="Espelhar em X"
            style={{ flex: 1, fontSize: 11 }}
          >Espelhar X</button>
          <button
            onClick={() => applyMeshOp(selected.id, 'subdivide', { levels: 1 })}
            title="Espelhar em Y"
            style={{ flex: 1, fontSize: 11 }}
          >Espelhar Y</button>
          <button
            onClick={() => applyMeshOp(selected.id, 'subdivide', { levels: 1 })}
            title="Espelhar em Z"
            style={{ flex: 1, fontSize: 11 }}
          >Espelhar Z</button>
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

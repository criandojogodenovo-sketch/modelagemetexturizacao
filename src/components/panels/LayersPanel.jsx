/**
 * LayersPanel — painel lateral para gerir layers (estilo Godot).
 *
 * C3: Permite:
 *  - Ver todas as layers (world, gameplay, ui, effects, audio)
 *  - Ocultar/mostrar layers (checkbox)
 *  - Bloquear/desbloquear layers (cadeado)
 *  - Filtrar conects por layer no SceneEditorPanel
 *  - Atribuir layer a conect selecionado
 *
 * Acessível via Menu Principal → Layers, ou botão no VerticalRail.
 */
import { useStore } from '../../store/useStore'
import { IconClose } from '../ui/Icons'

const LAYERS = [
  { id: 'world', label: 'Mundo', icon: '🌍', color: '#3fb950', desc: 'Terreno, casas, árvores, obstáculos' },
  { id: 'gameplay', label: 'Gameplay', icon: '🎮', color: '#2f81f7', desc: 'NPCs, items, checkpoints, portais' },
  { id: 'ui', label: 'UI', icon: '📱', color: '#d29922', desc: 'Botões, texto, painéis, HUD' },
  { id: 'effects', label: 'Efeitos', icon: '✨', color: '#a855f7', desc: 'Partículas, trails, pós-processamento' },
  { id: 'audio', label: 'Áudio', icon: '🔊', color: '#f85149', desc: 'Sons, música' },
]

export default function LayersPanel({ onClose }) {
  const hiddenLayers = useStore((s) => s.hiddenLayers)
  const lockedLayers = useStore((s) => s.lockedLayers)
  const toggleLayerVisibility = useStore((s) => s.toggleLayerVisibility)
  const toggleLayerLock = useStore((s) => s.toggleLayerLock)
  const activeLayer = useStore((s) => s.activeLayer)
  const setActiveLayer = useStore((s) => s.setActiveLayer)
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const selectedConectId = useStore((s) => s.selectedConectId)
  const updateConect = useStore((s) => s.updateConect)
  const toast = useStore((s) => s.toast)

  const activeScene = scenes.find((s) => s.id === activeSceneId)
  const conects = activeScene?.conects || []

  // Contar conects por layer
  const layerCounts = {}
  for (const c of conects) {
    const layer = c.layer || 'world'
    layerCounts[layer] = (layerCounts[layer] || 0) + 1
  }

  const selectedConect = conects.find((c) => c.instanceId === selectedConectId)

  const handleSetLayer = (layerId) => {
    if (!selectedConect) {
      toast('Seleciona um conect primeiro', 'error')
      return
    }
    updateConect(selectedConect.instanceId, { layer: layerId })
    toast(`Conect "${selectedConect.name}" movido para layer "${layerId}"`, 'success')
  }

  return (
    <>
      <div className="drawer-backdrop show" onClick={onClose} />
      <aside className="panel left open" style={{ width: 320 }}>
        <div className="panel-header">
          <span>Layers</span>
          <button className="icon" onClick={onClose}><IconClose width={14} height={14} /></button>
        </div>

        <div className="panel-body">
          <div className="small muted mb-2">
            Organiza conects por categoria. Oculta/mostra layers no viewport, bloqueia para edição.
          </div>

          {/* Lista de layers */}
          {LAYERS.map((layer) => {
            const isHidden = hiddenLayers.includes(layer.id)
            const isLocked = lockedLayers.includes(layer.id)
            const isActive = activeLayer === layer.id
            const count = layerCounts[layer.id] || 0

            return (
              <div
                key={layer.id}
                className="layer-card"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  marginBottom: 4,
                  borderRadius: 6,
                  border: `1px solid ${isActive ? layer.color : 'var(--border)'}`,
                  background: isActive ? `${layer.color}11` : 'transparent',
                  cursor: 'pointer',
                }}
                onClick={() => setActiveLayer(isActive ? 'all' : layer.id)}
              >
                {/* Ícone da layer */}
                <span style={{ fontSize: 18 }}>{layer.icon}</span>

                {/* Info da layer */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: layer.color }}>{layer.label}</div>
                  <div className="small muted" style={{ fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {layer.desc}
                  </div>
                </div>

                {/* Contador */}
                <span
                  style={{
                    background: 'var(--bg-elevated)',
                    borderRadius: 10,
                    padding: '2px 8px',
                    fontSize: 11,
                    color: count > 0 ? layer.color : 'var(--text-muted)',
                    fontWeight: 600,
                  }}
                >
                  {count}
                </span>

                {/* Botão de visibilidade */}
                <button
                  className="icon"
                  onClick={(e) => { e.stopPropagation(); toggleLayerVisibility(layer.id) }}
                  title={isHidden ? 'Mostrar layer' : 'Ocultar layer'}
                  style={{
                    opacity: isHidden ? 0.4 : 1,
                    color: isHidden ? 'var(--text-muted)' : layer.color,
                  }}
                >
                  {isHidden ? '🚫' : '👁'}
                </button>

                {/* Botão de bloqueio */}
                <button
                  className="icon"
                  onClick={(e) => { e.stopPropagation(); toggleLayerLock(layer.id) }}
                  title={isLocked ? 'Desbloquear layer' : 'Bloquear layer'}
                  style={{
                    opacity: isLocked ? 1 : 0.4,
                    color: isLocked ? '#f85149' : 'var(--text-muted)',
                  }}
                >
                  {isLocked ? '🔒' : '🔓'}
                </button>
              </div>
            )
          })}

          {/* Atribuir layer ao conect selecionado */}
          {selectedConect && (
            <div className="panel-section mt-3">
              <h4>Atribuir Layer</h4>
              <div className="small muted mb-2">
                Conect selecionado: <strong>{selectedConect.name}</strong>
              </div>
              <select
                value={selectedConect.layer || 'world'}
                onChange={(e) => handleSetLayer(e.target.value)}
                style={{ width: '100%' }}
              >
                {LAYERS.map((l) => (
                  <option key={l.id} value={l.id}>{l.icon} {l.label}</option>
                ))}
              </select>
            </div>
          )}

          {/* Resumo */}
          <div className="panel-section mt-3">
            <h4>Resumo</h4>
            <div className="small muted">
              <div>Total conects: <strong>{conects.length}</strong></div>
              <div>Layers visíveis: <strong>{LAYERS.length - hiddenLayers.length}</strong></div>
              <div>Layers bloqueadas: <strong>{lockedLayers.length}</strong></div>
              <div>Filtro ativo: <strong>{activeLayer === 'all' ? 'Todas' : LAYERS.find(l => l.id === activeLayer)?.label}</strong></div>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

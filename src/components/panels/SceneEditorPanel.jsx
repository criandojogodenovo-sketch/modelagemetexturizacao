/**
 * SceneEditorPanel — painel para o editor de cenas/níveis.
 *
 * Contém 3 secções:
 *  1. Lista de cenas do projeto (criar, duplicar, apagar, reordenar)
 *  2. Catálogo de objetos disponíveis (arrastar para a cena)
 *  3. Lista de instâncias na cena ativa (selecionar, marcar como jogador, remover)
 *
 * O drag-and-drop usa HTML5 DnD nativo:
 *  - Os itens do catálogo são draggable
 *  - O viewport (SceneLevel3D) aceita drop
 */
import { useState } from 'react'
import { useStore } from '../../store/useStore'
import {
  IconPlus,
  IconDuplicate,
  IconTrash,
  IconCube,
  IconClose,
} from '../ui/Icons'

export default function SceneEditorPanel({ onClose }) {
  const scenes = useStore((s) => s.scenes)
  const activeSceneId = useStore((s) => s.activeSceneId)
  const objects = useStore((s) => s.objects)
  const createScene = useStore((s) => s.createScene)
  const duplicateScene = useStore((s) => s.duplicateScene)
  const deleteScene = useStore((s) => s.deleteScene)
  const renameScene = useStore((s) => s.renameScene)
  const setActiveScene = useStore((s) => s.setActiveScene)
  const addObjectToScene = useStore((s) => s.addObjectToScene)
  const removeObjectFromScene = useStore((s) => s.removeObjectFromScene)
  const markAsPlayer = useStore((s) => s.markAsPlayer)
  const updateGameCamera = useStore((s) => s.updateGameCamera)
  const openScenePreview = useStore((s) => s.openScenePreview)
  const setFlirScriptTarget = useStore((s) => s.setFlirScriptTarget)
  const toast = useStore((s) => s.toast)

  const activeScene = scenes.find((s) => s.id === activeSceneId)

  const handleDragStart = (e, objectId) => {
    e.dataTransfer.setData('text/objectId', objectId)
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <>
      {onClose && (
        <div className="drawer-backdrop show" onClick={onClose} />
      )}
      <aside className={`panel left scene-editor-panel ${onClose ? 'open' : ''}`}>
        <div className="panel-header">
          <span>Editor de Cenas</span>
          {onClose && (
            <button className="icon drawer-toggle" onClick={onClose} title="Fechar">
              <IconClose width={14} height={14} />
            </button>
          )}
        </div>

        <div className="panel-body">
          {/* Botão de preview */}
          <div className="panel-section">
            <button
              onClick={openScenePreview}
              className="primary"
              style={{ width: '100%' }}
              disabled={!activeScene || activeScene.objects.length === 0}
              title="Pré-visualizar cena em ecrã cheio"
            >
              ▶ Pré-visualizar Cena
            </button>
          </div>

          {/* 1. Lista de cenas */}
          <div className="panel-section">
            <h4>Cenas ({scenes.length})</h4>
            <div style={{ marginBottom: 8 }}>
              <button
                onClick={() => createScene(`Nível ${scenes.length + 1}`)}
                style={{ width: '100%' }}
              >
                <IconPlus width={14} height={14} /> Nova Cena
              </button>
            </div>
            <div className="outliner">
              {scenes.length === 0 ? (
                <div className="empty-state small">Sem cenas. Cria uma acima.</div>
              ) : (
                scenes.map((scene, idx) => (
                  <SceneListItem
                    key={scene.id}
                    scene={scene}
                    isActive={scene.id === activeSceneId}
                    onSelect={() => setActiveScene(scene.id)}
                    onDuplicate={() => duplicateScene(scene.id)}
                    onDelete={() => deleteScene(scene.id)}
                    onRename={(name) => renameScene(scene.id, name)}
                    onMoveUp={idx > 0 ? () => useStore.getState().reorderScenes(idx, idx - 1) : null}
                    onMoveDown={idx < scenes.length - 1 ? () => useStore.getState().reorderScenes(idx, idx + 1) : null}
                  />
                ))
              )}
            </div>
          </div>

          {/* 2. Catálogo de objetos */}
          <div className="panel-section">
            <h4>Catálogo ({objects.length})</h4>
            {objects.length === 0 ? (
              <div className="empty-state small">
                Sem objetos no catálogo. Cria objetos no Modo Modelagem primeiro.
              </div>
            ) : (
              <div className="scene-object-catalog">
                {objects.map((obj) => (
                  <div
                    key={obj.id}
                    className="catalog-item"
                    draggable
                    onDragStart={(e) => handleDragStart(e, obj.id)}
                    onDoubleClick={() => addObjectToScene(obj.id)}
                    title="Arrasta para a cena ou duplo-clique para adicionar"
                  >
                    <IconCube width={14} height={14} />
                    <span style={{ flex: 1 }}>{obj.name}</span>
                    <button
                      className="icon"
                      style={{ padding: '2px 4px' }}
                      onClick={(e) => {
                        e.stopPropagation()
                        addObjectToScene(obj.id)
                      }}
                      title="Adicionar à cena ativa"
                    >
                      <IconPlus width={12} height={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3. Instâncias na cena ativa */}
          {activeScene && (
            <div className="panel-section">
              <h4>Objetos em "{activeScene.name}" ({activeScene.objects.length})</h4>
              {activeScene.objects.length === 0 ? (
                <div className="empty-state small">
                  Cena vazia. Arrasta objetos do catálogo acima para a viewport.
                </div>
              ) : (
                <div className="outliner">
                  {activeScene.objects.map((instance) => {
                    const obj = objects.find((o) => o.id === instance.objectId)
                    const isPlayer = instance.instanceId === activeScene.playerObjectId
                    return (
                      <div
                        key={instance.instanceId}
                        className="outliner-item"
                      >
                        <span
                          className="icon-dot"
                          style={{ background: isPlayer ? '#3fb950' : 'var(--text-muted)' }}
                        />
                        <span
                          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={obj?.name || '—'}
                        >
                          {obj?.name || '—'}
                          {isPlayer && <span className="tag accent" style={{ marginLeft: 4 }}>JOGADOR</span>}
                        </span>
                        <div className="actions">
                          {!isPlayer && (
                            <button
                              onClick={() => markAsPlayer(instance.instanceId)}
                              title="Marcar como Jogador"
                              style={{ fontSize: 10 }}
                            >
                              ⭐
                            </button>
                          )}
                          <button
                            onClick={() => setFlirScriptTarget(activeSceneId, instance.instanceId)}
                            title="Editar FlirScript (lógica do objeto)"
                            style={{
                              padding: '2px 6px',
                              fontSize: 10,
                              background: instance.flirScript ? 'var(--accent-soft)' : undefined,
                              borderColor: instance.flirScript ? 'var(--accent)' : undefined,
                              color: instance.flirScript ? 'var(--accent)' : undefined,
                            }}
                          >
                            🧩 {instance.flirScript ? '✓' : ''}
                          </button>
                          <button
                            className="danger"
                            onClick={() => removeObjectFromScene(instance.instanceId)}
                            title="Remover da cena"
                            style={{ padding: '2px 4px' }}
                          >
                            <IconTrash width={12} height={12} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* 4. Configuração da câmara de jogo */}
          {activeScene && (
            <GameCameraEditor scene={activeScene} onUpdate={updateGameCamera} />
          )}
        </div>
      </aside>
    </>
  )
}

// Item de lista de cena
function SceneListItem({ scene, isActive, onSelect, onDuplicate, onDelete, onRename, onMoveUp, onMoveDown }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(scene.name)

  const commit = () => {
    setEditing(false)
    if (name.trim() && name !== scene.name) onRename(name.trim())
    else setName(scene.name)
  }

  return (
    <div
      className={`outliner-item ${isActive ? 'selected' : ''}`}
      onClick={onSelect}
    >
      {editing ? (
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') { setName(scene.name); setEditing(false) }
          }}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          style={{ flex: 1 }}
        />
      ) : (
        <span
          onDoubleClick={(e) => { e.stopPropagation(); setEditing(true) }}
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={scene.name}
        >
          🎬 {scene.name} <span className="small muted">({scene.objects.length})</span>
        </span>
      )}
      <div className="actions">
        {onMoveUp && <button onClick={(e) => { e.stopPropagation(); onMoveUp() }} title="Mover para cima" style={{ padding: '2px 4px' }}>↑</button>}
        {onMoveDown && <button onClick={(e) => { e.stopPropagation(); onMoveDown() }} title="Mover para baixo" style={{ padding: '2px 4px' }}>↓</button>}
        <button onClick={(e) => { e.stopPropagation(); onDuplicate() }} title="Duplicar cena" style={{ padding: '2px 4px' }}>
          <IconDuplicate width={11} height={11} />
        </button>
        <button className="danger" onClick={(e) => { e.stopPropagation(); onDelete() }} title="Apagar cena" style={{ padding: '2px 4px' }}>
          <IconTrash width={11} height={11} />
        </button>
      </div>
    </div>
  )
}

// Editor da câmara de jogo
function GameCameraEditor({ scene, onUpdate }) {
  const cam = scene.gameCamera
  return (
    <div className="panel-section">
      <h4>Câmara de Jogo</h4>
      <div className="prop-row">
        <label>Tipo</label>
        <select
          value={cam.type}
          onChange={(e) => onUpdate({ type: e.target.value })}
        >
          <option value="perspective">Perspetiva</option>
          <option value="orthographic">Ortográfica</option>
        </select>
      </div>
      {cam.type === 'perspective' ? (
        <div className="prop-row">
          <label>FOV: {cam.fov}°</label>
          <input
            type="range"
            min="20"
            max="100"
            step="1"
            value={cam.fov}
            onChange={(e) => onUpdate({ fov: Number(e.target.value) })}
          />
        </div>
      ) : (
        <div className="prop-row">
          <label>Tamanho Ortográfico: {cam.orthoSize}</label>
          <input
            type="range"
            min="1"
            max="20"
            step="0.5"
            value={cam.orthoSize}
            onChange={(e) => onUpdate({ orthoSize: Number(e.target.value) })}
          />
        </div>
      )}
      <div className="prop-row">
        <label>Posição</label>
        <div className="vec3-input">
          <div className="axis x" data-axis="X">
            <input type="number" step="0.5" value={cam.position[0]}
              onChange={(e) => onUpdate({ position: [Number(e.target.value), cam.position[1], cam.position[2]] })} />
          </div>
          <div className="axis y" data-axis="Y">
            <input type="number" step="0.5" value={cam.position[1]}
              onChange={(e) => onUpdate({ position: [cam.position[0], Number(e.target.value), cam.position[2]] })} />
          </div>
          <div className="axis z" data-axis="Z">
            <input type="number" step="0.5" value={cam.position[2]}
              onChange={(e) => onUpdate({ position: [cam.position[0], cam.position[1], Number(e.target.value)] })} />
          </div>
        </div>
      </div>
      <div className="small muted mt-2">
        A câmara de jogo é mostrada como wireframe laranja no viewport.
        Em "Pré-visualizar Cena", a vista usa esta câmara.
      </div>
    </div>
  )
}

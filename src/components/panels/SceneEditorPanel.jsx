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
import ConectContextMenu from '../ui/ConectContextMenu'

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
  const toggleConectsWindow = useStore((s) => s.toggleConectsWindow)
  const openGameExport = useStore((s) => s.openGameExport)
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
          {/* Botões de ação principais */}
          <div className="panel-section">
            <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
              <button
                onClick={openScenePreview}
                className="primary"
                style={{ flex: 1 }}
                disabled={!activeScene}
                title="Executar jogo (física + FlirScript + UI)"
              >
                ▶ Executar Jogo
              </button>
              <button
                onClick={openGameExport}
                title="Exportar jogo (build standalone)"
                disabled={!activeScene}
              >
                🎮 Exportar
              </button>
            </div>
            <button
              onClick={toggleConectsWindow}
              style={{ width: '100%' }}
              title="Abrir janela de Conects (física, visual, UI, etc.)"
            >
              🧩 Conects
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

          {/* 4. Conects na cena ativa */}
          {activeScene && (
            <ConectsList scene={activeScene} />
          )}

          {/* 4b. Gestão de Camadas (Layers) */}
          {activeScene && (
            <LayersPanel />
          )}

          {/* 4c. Data Assets (ScriptableObjects + Autoloads) */}
          {activeScene && (
            <DataAssetsPanel />
          )}

          {/* 5. Configuração da câmara de jogo */}
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
// ===== Painel de Gestão de Camadas (Layers) =====
function LayersPanel() {
  const layers = useStore((s) => s.layers)
  const addLayer = useStore((s) => s.addLayer)
  const removeLayer = useStore((s) => s.removeLayer)
  const updateLayer = useStore((s) => s.updateLayer)
  const toggleLayerVisible = useStore((s) => s.toggleLayerVisible)
  const toggleLayerLocked = useStore((s) => s.toggleLayerLocked)

  return (
    <div className="panel-section">
      <h4>Camadas ({layers.length})</h4>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        <button style={{ flex: 1, fontSize: 11 }} onClick={() => addLayer(prompt('Nome da camada:') || `Camada ${layers.length + 1}`)}>
          + Nova Camada
        </button>
      </div>
      {layers.map((layer) => (
        <div key={layer.id} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 6px', marginBottom: 2,
          background: 'var(--bg-panel-2)', borderRadius: 'var(--radius-sm)',
          fontSize: 11,
        }}>
          {/* Cor identificadora */}
          <input
            type="color"
            value={layer.color}
            onChange={(e) => updateLayer(layer.id, { color: e.target.value })}
            style={{ width: 20, height: 20, border: 'none', padding: 0, cursor: 'pointer' }}
            title="Cor da camada"
          />
          {/* Visível */}
          <button
            onClick={() => toggleLayerVisible(layer.id)}
            style={{ padding: '2px 4px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}
            title={layer.visible ? 'Esconder' : 'Mostrar'}
          >
            {layer.visible ? '👁️' : '🚫'}
          </button>
          {/* Bloqueado */}
          <button
            onClick={() => toggleLayerLocked(layer.id)}
            style={{ padding: '2px 4px', fontSize: 12, background: 'none', border: 'none', cursor: 'pointer' }}
            title={layer.locked ? 'Desbloquear' : 'Bloquear'}
          >
            {layer.locked ? '🔒' : '🔓'}
          </button>
          {/* Nome */}
          <input
            type="text"
            value={layer.name}
            onChange={(e) => updateLayer(layer.id, { name: e.target.value })}
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text)', fontSize: 11 }}
          />
          {/* Apagar (não permitir apagar a default) */}
          {layer.id !== 'layer_default' && (
            <button
              className="danger"
              style={{ padding: '2px 4px' }}
              onClick={() => { if (confirm(`Apagar camada "${layer.name}"? Os objetos voltam à camada Padrão.`)) removeLayer(layer.id) }}
              title="Apagar camada"
            >
              <IconTrash width={11} height={11} />
            </button>
          )}
        </div>
      ))}
      <div className="small muted mt-2">
        💡 Usa camadas para organizar e mostrar/esconder grupos de objetos.
        Define a camada de cada Conect nas suas propriedades.
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

// Lista de Conects na cena ativa
function ConectsList({ scene }) {
  const selectedConectId = useStore((s) => s.selectedConectId)
  const selectConect = useStore((s) => s.selectConect)
  const removeConectFromScene = useStore((s) => s.removeConectFromScene)
  const duplicateConect = useStore((s) => s.duplicateConect)
  const updateConect = useStore((s) => s.updateConect)
  const setFlirScriptTarget = useStore((s) => s.setFlirScriptTarget)
  const conects = scene.conects || []

  return (
    <div className="panel-section">
      <h4>Conects na Cena ({conects.length})</h4>
      {conects.length === 0 ? (
        <div className="empty-state small">
          Sem conects. Clica em "🧩 Conects" para adicionar.
        </div>
      ) : (
        <div className="outliner">
          {/* Render hierárquico: raiz primeiro, depois filhos indentados */}
          {conects.filter(c => !c.parentId).map((conect) => (
            <ConectOutlinerItem
              key={conect.instanceId}
              conect={conect}
              conects={conects}
              selectedConectId={selectedConectId}
              selectConect={selectConect}
              sceneId={scene.id}
              setFlirScriptTarget={setFlirScriptTarget}
              duplicateConect={duplicateConect}
              removeConectFromScene={removeConectFromScene}
              updateConect={updateConect}
              depth={0}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ===== Componente: item do outliner com suporte a hierarquia e drag-and-drop =====
function ConectOutlinerItem({ conect, conects, selectedConectId, selectConect, sceneId, setFlirScriptTarget, duplicateConect, removeConectFromScene, updateConect, depth }) {
  const isSelected = conect.instanceId === selectedConectId
  const children = conects.filter(c => c.parentId === conect.instanceId)
  const [expanded, setExpanded] = useState(true)

  // Drag-and-drop para reassociação (reparent)
  const handleDragStart = (e) => {
    e.dataTransfer.setData('text/conectInstanceId', conect.instanceId)
    e.dataTransfer.effectAllowed = 'move'
  }
  const handleDragOver = (e) => {
    // Permitir drop se o tipo estiver disponível
    if (!e.dataTransfer.types.includes('text/conectinstanceid')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }
  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const childId = e.dataTransfer.getData('text/conectInstanceId')
    if (!childId || childId === conect.instanceId) return
    // Evitar ciclos: não permitir tornar-se filho de um descendente
    let parent = conect
    while (parent) {
      if (parent.instanceId === childId) return
      parent = conects.find(c => c.instanceId === parent.parentId)
    }
    updateConect(childId, { parentId: conect.instanceId })
  }

  return (
    <>
      <div
        className={`outliner-item ${isSelected ? 'selected' : ''}`}
        onClick={() => selectConect(conect.instanceId)}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        style={{ marginLeft: depth * 16 }}
      >
        {children.length > 0 ? (
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }}
            style={{ padding: '0 2px', fontSize: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            title={expanded ? 'Colapsar' : 'Expandir'}
          >
            {expanded ? '▼' : '▶'}
          </button>
        ) : (
          <span style={{ width: 16, display: 'inline-block' }} />
        )}
        <span className="icon-dot" style={{ background: isSelected ? 'var(--accent)' : 'var(--text-muted)' }} />
        <span
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={`${conect.type} — ${conect.name}`}
        >
          {conect.name}
          {conect.parentId && <span style={{ color: 'var(--text-muted)', fontSize: 9, marginLeft: 4 }}>↳ filho</span>}
          {conect.flirScript && <span className="tag accent" style={{ marginLeft: 4 }}>script</span>}
          {conect.sourceObjectId && <span className="tag" style={{ marginLeft: 4, background: 'var(--accent-soft)' }}>modelo</span>}
        </span>
        <div className="actions">
          <ConectContextMenu conect={conect} sceneId={sceneId} />
          <button
            onClick={(e) => { e.stopPropagation(); setFlirScriptTarget(sceneId, conect.instanceId) }}
            title="FlirScript"
            style={{ padding: '2px 4px', fontSize: 10 }}
          >
            🧩
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); duplicateConect(conect.instanceId) }}
            title="Duplicar"
            style={{ padding: '2px 4px' }}
          >
            <IconDuplicate width={11} height={11} />
          </button>
          <button
            className="danger"
            onClick={(e) => { e.stopPropagation(); removeConectFromScene(conect.instanceId) }}
            title="Apagar"
            style={{ padding: '2px 4px' }}
          >
            <IconTrash width={11} height={11} />
          </button>
        </div>
      </div>
      {expanded && children.map((child) => (
        <ConectOutlinerItem
          key={child.instanceId}
          conect={child}
          conects={conects}
          selectedConectId={selectedConectId}
          selectConect={selectConect}
          sceneId={sceneId}
          setFlirScriptTarget={setFlirScriptTarget}
          duplicateConect={duplicateConect}
          removeConectFromScene={removeConectFromScene}
          updateConect={updateConect}
          depth={depth + 1}
        />
      ))}
    </>
  )
}

// ===== Painel de Data Assets (ScriptableObjects + Autoloads) =====
function DataAssetsPanel() {
  const scriptableObjects = useStore((s) => s.scriptableObjects)
  const createScriptableObject = useStore((s) => s.createScriptableObject)
  const updateScriptableObject = useStore((s) => s.updateScriptableObject)
  const updateScriptableObjectData = useStore((s) => s.updateScriptableObjectData)
  const removeScriptableObject = useStore((s) => s.removeScriptableObject)
  const autoloads = useStore((s) => s.autoloads)
  const createAutoload = useStore((s) => s.createAutoload)
  const updateAutoload = useStore((s) => s.updateAutoload)
  const removeAutoload = useStore((s) => s.removeAutoload)
  const [expandedSO, setExpandedSO] = useState(null)
  const [newDataKey, setNewDataKey] = useState('')

  return (
    <div className="panel-section">
      <h4>📦 Data Assets ({scriptableObjects.length})</h4>
      <div className="small muted mb-2">
        Dados reutilizáveis partilhados entre Conects (estilo Unity ScriptableObject)
      </div>
      <button style={{ width: '100%', marginBottom: 8 }} onClick={() => {
        const name = prompt('Nome do Data Asset (ex: "Arma Pistola", "Inimigo Básico"):')
        if (name) createScriptableObject(name, { dano: 10, velocidade: 5, nome: name })
      }}>
        + Novo Data Asset
      </button>
      {scriptableObjects.map((so) => (
        <div key={so.id} style={{
          marginBottom: 4,
          padding: '4px 6px',
          background: 'var(--bg-panel-2)',
          borderRadius: 'var(--radius-sm)',
          fontSize: 11,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setExpandedSO(expandedSO === so.id ? null : so.id)}
              style={{ padding: '0 4px', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {expandedSO === so.id ? '▼' : '▶'}
            </button>
            <input
              type="text"
              value={so.name}
              onChange={(e) => updateScriptableObject(so.id, { name: e.target.value })}
              style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text)', fontSize: 11 }}
            />
            <button className="danger" style={{ padding: '2px 4px' }} onClick={() => removeScriptableObject(so.id)}>
              <IconTrash width={11} height={11} />
            </button>
          </div>
          {expandedSO === so.id && (
            <div style={{ marginLeft: 16, marginTop: 4 }}>
              {Object.entries(so.data).map(([key, value]) => (
                <div key={key} style={{ display: 'flex', gap: 4, marginBottom: 2 }}>
                  <span style={{ minWidth: 60, color: 'var(--text-muted)' }}>{key}:</span>
                  <input
                    type="text"
                    value={String(value)}
                    onChange={(e) => {
                      let v = e.target.value
                      if (!isNaN(v) && v !== '') v = Number(v)
                      if (v === 'true') v = true
                      if (v === 'false') v = false
                      updateScriptableObjectData(so.id, key, v)
                    }}
                    style={{ flex: 1, fontSize: 10, padding: '1px 4px' }}
                  />
                  <button className="danger" style={{ padding: '1px 2px', fontSize: 9 }}
                    onClick={() => {
                      const newData = { ...so.data }
                      delete newData[key]
                      updateScriptableObject(so.id, { data: newData })
                    }}
                  >✕</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <input
                  type="text"
                  placeholder="nova chave"
                  value={newDataKey}
                  onChange={(e) => setNewDataKey(e.target.value)}
                  style={{ flex: 1, fontSize: 10, padding: '1px 4px' }}
                />
                <button style={{ fontSize: 10, padding: '1px 6px' }} onClick={() => {
                  if (newDataKey) {
                    updateScriptableObjectData(so.id, newDataKey, 0)
                    setNewDataKey('')
                  }
                }}>+ Campo</button>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Autoloads */}
      <h4 style={{ marginTop: 12 }}>🌐 Autoloads ({autoloads.length})</h4>
      <div className="small muted mb-2">
        Scripts globais sempre acessíveis via getAutoload("nome") em FlirCode
      </div>
      <button style={{ width: '100%', marginBottom: 8 }} onClick={() => {
        const name = prompt('Nome do Autoload (ex: "GameManager", "AudioManager"):')
        if (name) createAutoload(name)
      }}>
        + Novo Autoload
      </button>
      {autoloads.map((al) => (
        <div key={al.id} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          marginBottom: 4, padding: '4px 6px',
          background: 'var(--bg-panel-2)', borderRadius: 'var(--radius-sm)', fontSize: 11,
        }}>
          <span style={{ color: '#8957e5' }}>⚡</span>
          <input
            type="text"
            value={al.name}
            onChange={(e) => updateAutoload(al.id, { name: e.target.value })}
            style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text)', fontSize: 11 }}
          />
          <button className="danger" style={{ padding: '2px 4px' }} onClick={() => removeAutoload(al.id)}>
            <IconTrash width={11} height={11} />
          </button>
        </div>
      ))}
      <div className="small muted mt-2">
        💡 Usa <code>getDataAsset("nome")</code> e <code>getAutoload("nome")</code> no FlirCode.
      </div>
    </div>
  )
}

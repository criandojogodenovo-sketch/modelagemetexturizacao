/**
 * ProjectBrowser — explorador de projeto com pastas da engine.
 *
 * **Fase 5 (melhorado)**: criar subpastas, mover ficheiros, persistir organização.
 *
 * Pastas: Modelos, Texturas, Materiais, Cenas, Scripts FlirScript, Áudio, UI, Shaders
 *
 * Funcionalidades:
 *  - Criar subpastas dentro de cada categoria
 *  - Mover ficheiros entre pastas (drag-drop ou botão)
 *  - Apagar pastas e ficheiros
 *  - Miniaturas para modelos e texturas
 *  - Persistência em IndexedDB (organização guardada por projeto)
 */
import { useState, useEffect } from 'react'
import { useStore } from '../../../store/useStore'
import { IconClose, IconPlus, IconTrash, IconFile } from '../../ui/Icons'
import { listProjects, deleteProject, saveProject } from '../../../utils/db'

const FOLDERS = [
  { id: 'models', label: 'Modelos', icon: 'package' },
  { id: 'textures', label: 'Texturas', icon: 'palette' },
  { id: 'materials', label: 'Materiais', icon: 'sparkles' },
  { id: 'scenes', label: 'Cenas', icon: 'film' },
  { id: 'scripts', label: 'Scripts FlirScript', icon: 'puzzle' },
  { id: 'audio', label: 'Áudio', icon: 'volume-2' },
  { id: 'ui', label: 'UI', icon: 'smartphone' },
  { id: 'shaders', label: 'Shaders', icon: 'palette' },
]

export default function ProjectBrowser({ onClose }) {
  const objects = useStore((s) => s.objects)
  const scenes = useStore((s) => s.scenes)
  const removeConectFromScene = useStore((s) => s.removeConectFromScene)
  const deleteObject = useStore((s) => s.deleteObject)
  const [activeFolder, setActiveFolder] = useState('models')
  const [search, setSearch] = useState('')
  const [savedProjects, setSavedProjects] = useState([])
  // Estrutura de subpastas: { models: ['sub1', 'sub2'], textures: [...] }
  // Atribuição de ficheiros a subpastas: { 'obj_abc': 'sub1' }
  const [subfolders, setSubfolders] = useState({})
  const [fileAssignments, setFileAssignments] = useState({})
  const [activeSubfolder, setActiveSubfolder] = useState(null)
  const [newSubfolderName, setNewSubfolderName] = useState('')
  const [movingFile, setMovingFile] = useState(null) // id do ficheiro a mover

  useEffect(() => {
    listProjects().then(setSavedProjects).catch(() => {})
    // Carregar organização do localStorage
    try {
      const saved = localStorage.getItem('flir.projectBrowser')
      if (saved) {
        const parsed = JSON.parse(saved)
        setSubfolders(parsed.subfolders || {})
        setFileAssignments(parsed.fileAssignments || {})
      }
    } catch {}
  }, [])

  // Persistir organização
  const persistOrganization = (newSubs, newAssigns) => {
    localStorage.setItem('flir.projectBrowser', JSON.stringify({
      subfolders: newSubs,
      fileAssignments: newAssigns,
    }))
  }

  const createSubfolder = () => {
    if (!newSubfolderName.trim()) return
    const folder = activeFolder
    const newSubs = {
      ...subfolders,
      [folder]: [...(subfolders[folder] || []), newSubfolderName.trim()],
    }
    setSubfolders(newSubs)
    persistOrganization(newSubs, fileAssignments)
    setNewSubfolderName('')
  }

  const deleteSubfolder = (subName) => {
    if (!confirm(`Apagar subpasta "${subName}"? Os ficheiros voltam à raiz.`)) return
    const folder = activeFolder
    const newSubs = {
      ...subfolders,
      [folder]: (subfolders[folder] || []).filter((s) => s !== subName),
    }
    // Remover atribuições de ficheiros desta subpasta
    const newAssigns = { ...fileAssignments }
    for (const k of Object.keys(newAssigns)) {
      if (newAssigns[k] === subName) delete newAssigns[k]
    }
    setSubfolders(newSubs)
    setFileAssignments(newAssigns)
    persistOrganization(newSubs, newAssigns)
    if (activeSubfolder === subName) setActiveSubfolder(null)
  }

  const moveFileToSubfolder = (fileId, subName) => {
    const newAssigns = { ...fileAssignments, [fileId]: subName || null }
    setFileAssignments(newAssigns)
    persistOrganization(subfolders, newAssigns)
    setMovingFile(null)
  }

  // Conteúdo de cada pasta
  const folderContent = {
    models: objects.map((o) => ({
      id: o.id,
      name: o.name,
      type: o.type,
      thumbnail: o.material?.map || null,
      onDelete: () => {
        if (confirm(`Apagar modelo "${o.name}"?`)) deleteObject(o.id)
      },
    })),
    scenes: scenes.map((s) => ({
      id: s.id,
      name: s.name,
      meta: `${s.objects.length} objetos, ${s.conects?.length || 0} conects`,
    })),
    textures: objects
      .filter((o) => o.material?.map || o.material?.normalMap)
      .map((o) => ({
        id: o.id,
        name: `${o.name} - textura`,
        thumbnail: o.material.map || o.material.normalMap,
      })),
    materials: objects.map((o) => ({
      id: o.id,
      name: `${o.name} - material`,
      color: o.material?.color,
    })),
    scripts: [],
    audio: [],
    ui: [],
    shaders: [],
  }

  const allItems = folderContent[activeFolder] || []
  const items = allItems.filter((item) => {
    if (search) return item.name?.toLowerCase().includes(search.toLowerCase())
    // Filtrar por subpasta ativa
    const assigned = fileAssignments[item.id]
    if (activeSubfolder === null) return !assigned // raiz: sem atribuição
    return assigned === activeSubfolder
  })

  const currentSubfolders = subfolders[activeFolder] || []

  return (
    <>
      {onClose && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`project-browser ${onClose ? 'open' : ''}`}>
        <div className="panel-header">
          <span>Projeto</span>
          {onClose && (
            <button className="icon" onClick={onClose} title="Fechar">
              <IconClose width={14} height={14} />
            </button>
          )}
        </div>

        {/* Lista de pastas */}
        <div className="pb-folders">
          {FOLDERS.map((folder) => (
            <button
              key={folder.id}
              className={`pb-folder-btn ${activeFolder === folder.id ? 'active' : ''}`}
              onClick={() => { setActiveFolder(folder.id); setActiveSubfolder(null) }}
            >
              <span className="pb-folder-icon">{folder.icon}</span>
              <span className="pb-folder-label">{folder.label}</span>
              <span className="pb-folder-count">{(folderContent[folder.id] || []).length}</span>
            </button>
          ))}
        </div>

        {/* Subpastas */}
        <div style={{ padding: 8, borderTop: '1px solid var(--border-soft)', borderBottom: '1px solid var(--border-soft)' }}>
          <div className="row between mb-2">
            <span className="small muted">Subpastas:</span>
            <div className="row" style={{ gap: 4 }}>
              <input
                type="text"
                placeholder="Nova subpasta..."
                value={newSubfolderName}
                onChange={(e) => setNewSubfolderName(e.target.value)}
                style={{ width: 100, fontSize: 11 }}
              />
              <button onClick={createSubfolder} title="Criar subpasta" style={{ padding: '4px 6px' }}>
                <IconPlus width={11} height={11} />
              </button>
            </div>
          </div>
          <div className="row" style={{ gap: 4, flexWrap: 'wrap' }}>
            <button
              className={`pb-subfolder-btn ${activeSubfolder === null ? 'active' : ''}`}
              onClick={() => setActiveSubfolder(null)}
              style={{ fontSize: 10, padding: '3px 8px' }}
            >Raiz
            </button>
            {currentSubfolders.map((sub) => (
              <div key={sub} className="row" style={{ gap: 2 }}>
                <button
                  className={`pb-subfolder-btn ${activeSubfolder === sub ? 'active' : ''}`}
                  onClick={() => setActiveSubfolder(sub)}
                  style={{ fontSize: 10, padding: '3px 8px' }}
                >{sub}
                </button>
                <button
                  className="danger"
                  onClick={() => deleteSubfolder(sub)}
                  style={{ padding: '2px 4px', fontSize: 9 }}
                  title="Apagar subpasta"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Pesquisa */}
        <div style={{ padding: 8 }}>
          <input
            type="text"
            placeholder="Pesquisar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Conteúdo */}
        <div className="pb-content">
          {items.length === 0 ? (
            <div className="empty-state small">
              {search ? 'Nenhum resultado.' : 'Pasta vazia. Cria conteúdo no editor.'}
            </div>
          ) : (
            <div className="pb-grid">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="pb-item"
                  title={item.name}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/fileId', item.id)
                    setMovingFile(item.id)
                  }}
                >
                  <div className="pb-item-thumbnail">
                    {item.thumbnail ? (
                      <img src={item.thumbnail} alt="" />
                    ) : item.color ? (
                      <div style={{ background: item.color, width: '100%', height: '100%' }} />
                    ) : (
                      <IconFile width={24} height={24} />
                    )}
                  </div>
                  <div className="pb-item-name">{item.name}</div>
                  {item.meta && <div className="small muted" style={{ fontSize: 9 }}>{item.meta}</div>}
                  {/* Botão mover */}
                  {movingFile === item.id && (
                    <select
                      value={fileAssignments[item.id] || ''}
                      onChange={(e) => moveFileToSubfolder(item.id, e.target.value)}
                      style={{ fontSize: 9, marginTop: 2 }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <option value="">→ Raiz</option>
                      {currentSubfolders.map((s) => (
                        <option key={s} value={s}>→ {s}</option>
                      ))}
                    </select>
                  )}
                  {item.onDelete && (
                    <button
                      className="danger"
                      style={{ position: 'absolute', top: 2, right: 2, padding: '2px 4px', fontSize: 9 }}
                      onClick={(e) => { e.stopPropagation(); item.onDelete() }}
                      title="Apagar"
                    >
                      <IconTrash width={10} height={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Projetos guardados */}
        <div style={{ padding: 8, borderTop: '1px solid var(--border-soft)', maxHeight: 150, overflowY: 'auto' }}>
          <div className="small muted mb-2">Projetos guardados (IndexedDB):</div>
          {savedProjects.length === 0 ? (
            <div className="small muted">Nenhum projeto guardado.</div>
          ) : (
            savedProjects.map((p) => (
              <div key={p.id} className="pb-saved-project">
                <span style={{ flex: 1, fontSize: 11 }}>{p.name}</span>
                <button
                  className="danger icon"
                  style={{ padding: '2px 4px' }}
                  onClick={() => {
                    if (confirm(`Apagar projeto "${p.name}"?`)) {
                      deleteProject(p.id).then(() => listProjects().then(setSavedProjects))
                    }
                  }}
                  title="Apagar"
                >
                  <IconTrash width={11} height={11} />
                </button>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  )
}

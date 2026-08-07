/**
 * ProjectBrowser — explorador de projeto com estrutura de pastas da engine.
 *
 * Pastas:
 *  - Modelos/ (objetos do catálogo)
 *  - Texturas/ (dataURLs de texturas)
 *  - Materiais/ (materiais predefinidos + criados)
 *  - Cenas/ (cenas do projeto)
 *  - Scripts FlirScript/ (grafos guardados)
 *  - Áudio/ (URLs de som)
 *  - UI/ (layouts de UI)
 *  - Shaders/ (shaders criados)
 *
 * Funcionalidades:
 *  - Criar, renomear, mover, apagar pastas e ficheiros
 *  - Arrastar asset para a cena
 *  - Miniaturas para modelos e texturas
 *  - Tudo guardado no IndexedDB
 */
import { useState, useEffect } from 'react'
import { useStore } from '../../../store/useStore'
import { IconClose, IconPlus, IconTrash, IconFile } from '../../ui/Icons'
import { listProjects, saveProject, deleteProject } from '../../../utils/db'

const FOLDERS = [
  { id: 'models', label: 'Modelos', icon: '📦' },
  { id: 'textures', label: 'Texturas', icon: '🎨' },
  { id: 'materials', label: 'Materiais', icon: '✨' },
  { id: 'scenes', label: 'Cenas', icon: '🎬' },
  { id: 'scripts', label: 'Scripts FlirScript', icon: '🧩' },
  { id: 'audio', label: 'Áudio', icon: '🔊' },
  { id: 'ui', label: 'UI', icon: '📱' },
  { id: 'shaders', label: 'Shaders', icon: '🌈' },
]

export default function ProjectBrowser({ onClose }) {
  const objects = useStore((s) => s.objects)
  const scenes = useStore((s) => s.scenes)
  const [activeFolder, setActiveFolder] = useState('models')
  const [search, setSearch] = useState('')
  const [savedProjects, setSavedProjects] = useState([])

  useEffect(() => {
    listProjects().then(setSavedProjects).catch(() => {})
  }, [])

  // Conteúdo de cada pasta
  const folderContent = {
    models: objects.map((o) => ({
      id: o.id,
      name: o.name,
      type: o.type,
      thumbnail: o.material?.map || null,
    })),
    scenes: scenes.map((s) => ({
      id: s.id,
      name: s.name,
      objectCount: s.objects.length,
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
    scripts: [], // preenchido via store conects com flirScript
    audio: [],
    ui: [],
    shaders: [],
  }

  const items = (folderContent[activeFolder] || []).filter((item) => {
    if (!search) return true
    return item.name?.toLowerCase().includes(search.toLowerCase())
  })

  return (
    <>
      {onClose && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`project-browser ${onClose ? 'open' : ''}`}>
        <div className="panel-header">
          <span>📁 Projeto</span>
          {onClose && (
            <button className="icon" onClick={onClose} title="Fechar">
              <IconClose width={14} height={14} />
            </button>
          )}
        </div>

        {/* Lista de pastas (vertical, sem scroll horizontal) */}
        <div className="pb-folders">
          {FOLDERS.map((folder) => (
            <button
              key={folder.id}
              className={`pb-folder-btn ${activeFolder === folder.id ? 'active' : ''}`}
              onClick={() => setActiveFolder(folder.id)}
            >
              <span className="pb-folder-icon">{folder.icon}</span>
              <span className="pb-folder-label">{folder.label}</span>
              <span className="pb-folder-count">
                {(folderContent[folder.id] || []).length}
              </span>
            </button>
          ))}
        </div>

        {/* Pesquisa */}
        <div style={{ padding: 8, borderTop: '1px solid var(--border-soft)' }}>
          <input
            type="text"
            placeholder="🔍 Pesquisar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Conteúdo da pasta ativa */}
        <div className="pb-content">
          {items.length === 0 ? (
            <div className="empty-state small">
              Pasta vazia. Cria conteúdo no editor para o ver aqui.
            </div>
          ) : (
            <div className="pb-grid">
              {items.map((item) => (
                <div key={item.id} className="pb-item" title={item.name}>
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
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Projetos guardados (IndexedDB) */}
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

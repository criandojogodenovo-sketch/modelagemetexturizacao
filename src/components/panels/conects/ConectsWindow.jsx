/**
 * ConectsWindow — janela dedicada para pesquisar e arrastar Conects.
 *
 * Acessível a partir do editor de cenas (botão "Conects" na barra lateral).
 *
 * Funcionalidades:
 *  - Campo de pesquisa por texto no topo
 *  - Conects organizados por categorias expansíveis/colapsáveis
 *  - Cada Conect mostra ícone + nome + descrição
 *  - Click = adicionar à cena ativa na posição atual
 *  - Drag-and-drop para o viewport (HTML5 DnD)
 *
 * Em mobile, abre como drawer em ecrã cheio.
 */
import { useState } from 'react'
import { useStore } from '../../../store/useStore'
import { CONECT_CATEGORIES, CONECT_TAXONOMY } from '../../../utils/conects/taxonomy'
import { IconClose } from '../../ui/Icons'

export default function ConectsWindow({ onClose }) {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState({})
  const addConectToScene = useStore((s) => s.addConectToScene)

  const handleDragStart = (e, type) => {
    e.dataTransfer.setData('text/conectType', type)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleAdd = (type) => {
    addConectToScene(type)
    if (onClose) onClose()
  }

  const toggleCategory = (catId) => {
    setCollapsed((c) => ({ ...c, [catId]: !c[catId] }))
  }

  // Filtrar por pesquisa
  const filteredBySearch = (conect) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      conect.label.toLowerCase().includes(q) ||
      conect.description.toLowerCase().includes(q) ||
      conect.type.toLowerCase().includes(q)
    )
  }

  return (
    <>
      {onClose && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`conects-window ${onClose ? 'open' : ''}`}>
        <div className="panel-header">
          <span>🧩 Conects</span>
          {onClose && (
            <button className="icon" onClick={onClose} title="Fechar">
              <IconClose width={14} height={14} />
            </button>
          )}
        </div>

        {/* Pesquisa */}
        <div style={{ padding: 10, borderBottom: '1px solid var(--border-soft)' }}>
          <input
            type="text"
            placeholder="🔍 Pesquisar Conect..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>

        <div className="conects-list">
          {CONECT_CATEGORIES.map((cat) => {
            const conects = CONECT_TAXONOMY.filter(
              (c) => c.category === cat.id && filteredBySearch(c)
            )
            if (conects.length === 0) return null
            const isCollapsed = collapsed[cat.id] && !search
            return (
              <div key={cat.id} className="conect-category">
                <button
                  className="conect-category-header"
                  onClick={() => toggleCategory(cat.id)}
                  style={{ borderLeftColor: cat.color }}
                >
                  <span className="cat-icon">{cat.icon}</span>
                  <span className="cat-label">{cat.label}</span>
                  <span className="cat-count">{conects.length}</span>
                  <span className="cat-chevron">{isCollapsed ? '▶' : '▼'}</span>
                </button>
                {!isCollapsed && (
                  <div className="conect-items">
                    {conects.map((conect) => (
                      <div
                        key={conect.type}
                        className="conect-item"
                        draggable
                        onDragStart={(e) => handleDragStart(e, conect.type)}
                        onClick={() => handleAdd(conect.type)}
                        title={conect.description}
                      >
                        <span className="conect-icon" style={{ color: cat.color }}>
                          {conect.icon}
                        </span>
                        <div className="conect-info">
                          <div className="conect-label">{conect.label}</div>
                          <div className="conect-desc small muted">{conect.description}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {CONECT_TAXONOMY.filter(filteredBySearch).length === 0 && (
            <div className="empty-state small">
              Nenhum Conect encontrado para "{search}".
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

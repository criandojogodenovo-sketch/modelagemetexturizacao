/**
 * Outliner — lista de objetos da cena com nomes editáveis.
 *
 * Funcionalidades:
 *  - Pesquisa por texto no topo (sempre visível)
 *  - Click para selecionar
 *  - Duplo-click para editar nome inline
 *  - Botões rápidos: visibilidade (eye), duplicar, apagar
 *  - Indentação para hierarquia (filhos recuados)
 */
import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { IconVisible, IconHidden, IconDuplicate, IconTrash } from '../ui/Icons'
import { Icon } from '../ui/iconMap'

export default function Outliner() {
  const objects = useStore((s) => s.objects)
  const selectedId = useStore((s) => s.selectedId)
  const selectObject = useStore((s) => s.selectObject)
  const renameObject = useStore((s) => s.renameObject)
  const duplicateObject = useStore((s) => s.duplicateObject)
  const deleteObject = useStore((s) => s.deleteObject)
  const toggleVisibility = useStore((s) => s.toggleVisibility)
  const [search, setSearch] = useState('')

  const filtered = search.trim()
    ? objects.filter((o) => o.name?.toLowerCase().includes(search.toLowerCase()))
    : objects

  if (objects.length === 0) {
    return (
      <div className="empty-state">
        <div>Nenhum objeto na cena.</div>
        <div className="small mt-2">Use as ferramentas acima para adicionar formas.</div>
      </div>
    )
  }

  return (
    <div>
      {/* Pesquisa sempre visível no topo */}
      <div className="outliner-search">
        <input
          type="text"
          placeholder="Pesquisar objetos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="outliner">
        {filtered.length === 0 ? (
          <div className="empty-state small" style={{ padding: '12px 8px' }}>
            Nenhum resultado para "{search}"
          </div>
        ) : (
          filtered.map((obj) => (
            <OutlinerItem
              key={obj.id}
              obj={obj}
              isSelected={obj.id === selectedId}
              onSelect={() => selectObject(obj.id)}
              onRename={(name) => renameObject(obj.id, name)}
              onDuplicate={() => duplicateObject(obj.id)}
              onDelete={() => deleteObject(obj.id)}
              onToggleVisibility={() => toggleVisibility(obj.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}

function OutlinerItem({ obj, isSelected, onSelect, onRename, onDuplicate, onDelete, onToggleVisibility }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(obj.name)
  const inputRef = useRef()

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [editing])

  useEffect(() => {
    setName(obj.name)
  }, [obj.name])

  const commitRename = () => {
    setEditing(false)
    if (name.trim() && name !== obj.name) {
      onRename(name.trim())
    } else {
      setName(obj.name)
    }
  }

  return (
    <div
      className={`outliner-item ${isSelected ? 'selected' : ''}`}
      onClick={onSelect}
    >
      <span className="icon-dot" style={{ background: isSelected ? 'var(--accent)' : 'var(--text-muted)' }} />
      {editing ? (
        <input
          ref={inputRef}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commitRename()
            if (e.key === 'Escape') {
              setName(obj.name)
              setEditing(false)
            }
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          onDoubleClick={(e) => {
            e.stopPropagation()
            setEditing(true)
          }}
          style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={obj.name}
        >
          {obj.name}
        </span>
      )}
      <div className="outliner-actions">
        <button
          className="outliner-action-btn"
          onClick={(e) => { e.stopPropagation(); onToggleVisibility() }}
          title={obj.visible !== false ? 'Ocultar' : 'Mostrar'}
        >
          {obj.visible !== false ? <IconVisible width={12} height={12} /> : <IconHidden width={12} height={12} />}
        </button>
        <button
          className="outliner-action-btn"
          onClick={(e) => { e.stopPropagation(); onDuplicate() }}
          title="Duplicar"
        >
          <IconDuplicate width={12} height={12} />
        </button>
        <button
          className="outliner-action-btn"
          onClick={(e) => { e.stopPropagation(); onDelete() }}
          title="Apagar"
          style={{ color: 'var(--danger)' }}
        >
          <IconTrash width={12} height={12} />
        </button>
      </div>
    </div>
  )
}

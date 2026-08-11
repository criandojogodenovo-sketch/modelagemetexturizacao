/**
 * ClassesPanel — painel para gerir classes FlirCode (Sistema 2).
 *
 * Permite:
 *  - Criar nova classe (com ou sem extends)
 *  - Editar código fonte da classe
 *  - Apagar classe
 *
 * As classes ficam guardadas no store (flirCodeClasses) e são persistidas
 * com o projeto. Aparecem no Explorador de Projeto numa pasta Classes/.
 */
import { useState } from 'react'
import { useStore } from '../../store/useStore'
import { IconClose, IconPlus, IconTrash } from '../ui/Icons'

export default function ClassesPanel({ onClose }) {
  const flirCodeClasses = useStore((s) => s.flirCodeClasses)
  const createFlirCodeClass = useStore((s) => s.createFlirCodeClass)
  const updateFlirCodeClass = useStore((s) => s.updateFlirCodeClass)
  const deleteFlirCodeClass = useStore((s) => s.deleteFlirCodeClass)
  const toast = useStore((s) => s.toast)

  const [selectedId, setSelectedId] = useState(null)
  const [newClassName, setNewClassName] = useState('')
  const [newClassExtends, setNewClassExtends] = useState('')

  const selected = flirCodeClasses.find((c) => c.id === selectedId)

  const handleCreate = () => {
    if (!newClassName.trim()) {
      toast('Indica o nome da classe', 'error')
      return
    }
    const source = `class ${newClassName}${newClassExtends ? ` extends ${newClassExtends}` : ''} begincode\n    $$ Variáveis e funções da classe\n\n    fun onStart() begincode\n        print("${newClassName} iniciado")\n    endcode\nendcode\n`
    createFlirCodeClass(newClassName, source, newClassExtends || null)
    toast(`Classe "${newClassName}" criada`, 'success')
    setNewClassName('')
    setNewClassExtends('')
  }

  const handleSaveSource = (newSource) => {
    if (!selected) return
    // Extrair nome e extends do código
    const m = newSource.match(/^class\s+(\w+)(?:\s+extends\s+(\w+))?\s*begincode/)
    const name = m ? m[1] : selected.name
    const ext = m ? (m[2] || null) : selected.extends
    updateFlirCodeClass(selected.id, { source: newSource, name, extends: ext })
  }

  const handleDelete = (classId) => {
    if (!confirm('Apagar esta classe? Os Conects que a usam deixam de ter o comportamento.')) return
    deleteFlirCodeClass(classId)
    if (selectedId === classId) setSelectedId(null)
    toast('Classe apagada', 'info')
  }

  return (
    <>
      <div className="drawer-backdrop show" onClick={onClose} />
      <aside className="classes-panel open">
        <div className="panel-header">
          <span>Classes FlirCode</span>
          <button className="icon" onClick={onClose} title="Fechar">
            <IconClose width={14} height={14} />
          </button>
        </div>

        <div className="panel-body">
          <div className="small muted mb-2">
            Classes reutilizáveis com herança. Atribui uma classe a um Conect
            no painel de propriedades para herdar variáveis e funções.
          </div>

          {/* Criar nova classe */}
          <div className="panel-section">
            <h4>Nova Classe</h4>
            <div className="prop-row">
              <label>Nome</label>
              <input
                type="text"
                value={newClassName}
                onChange={(e) => setNewClassName(e.target.value)}
                placeholder="Inimigo"
              />
            </div>
            <div className="prop-row">
              <label>Extends (opcional)</label>
              <select
                value={newClassExtends}
                onChange={(e) => setNewClassExtends(e.target.value)}
              >
                <option value="">— Nenhuma (classe base) —</option>
                {flirCodeClasses.map((cls) => (
                  <option key={cls.id} value={cls.name}>{cls.name}</option>
                ))}
              </select>
            </div>
            <button className="primary" style={{ width: '100%' }} onClick={handleCreate}>
              <IconPlus width={14} height={14} /> Criar Classe
            </button>
          </div>

          {/* Lista de classes */}
          <div className="panel-section">
            <h4>Classes ({flirCodeClasses.length})</h4>
            {flirCodeClasses.length === 0 ? (
              <div className="empty-state small">Sem classes. Cria uma acima.</div>
            ) : (
              <div className="outliner">
                {flirCodeClasses.map((cls) => (
                  <div
                    key={cls.id}
                    className={`outliner-item ${selectedId === cls.id ? 'selected' : ''}`}
                    onClick={() => setSelectedId(cls.id)}
                  >
                    <span className="icon-dot" style={{ background: '#8957e5' }} />
                    <span style={{ flex: 1 }}>{cls.name}</span>
                    {cls.extends && <span className="small muted">extends {cls.extends}</span>}
                    <button
                      className="icon danger"
                      onClick={(e) => { e.stopPropagation(); handleDelete(cls.id) }}
                      title="Apagar"
                      style={{ padding: '2px 4px', minWidth: 'auto' }}
                    >
                      <IconTrash width={12} height={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Editor da classe selecionada */}
          {selected && (
            <div className="panel-section">
              <h4>Editar: {selected.name}</h4>
              <textarea
                value={selected.source}
                onChange={(e) => handleSaveSource(e.target.value)}
                spellCheck="false"
                style={{
                  width: '100%',
                  minHeight: 300,
                  fontFamily: 'Monaco, Menlo, "Courier New", monospace',
                  fontSize: 12,
                  lineHeight: 1.5,
                  tabSize: 4,
                  whiteSpace: 'pre',
                }}
                placeholder="class Nome begincode ... endcode"
              />
              <div className="small muted mt-1">
                Sintaxe: <code>class Nome extends Base begincode ... endcode</code>
                <br />Variáveis: <code>var nome = valor</code>
                <br />Métodos: <code>fun nome(params) begincode ... endcode</code>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}

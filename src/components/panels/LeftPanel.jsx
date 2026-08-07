/**
 * LeftPanel — painel lateral esquerdo.
 *
 * Contém:
 *  - Ferramentas de primitivas (adicionar cubo, esfera, etc.)
 *  - Modo de transformação (translate / rotate / scale)
 *  - Operações (duplicar, apagar, extrude, visibilidade)
 *  - Outliner (lista de objetos da cena com nomes editáveis)
 *  - Configurações de cena (fundo, grelha, luzes)
 */
import { useStore } from '../../store/useStore'
import { PRIMITIVE_LIST } from '../../utils/primitives'
import {
  PRIMITIVE_ICONS,
  IconTranslate,
  IconRotate,
  IconScale,
  IconDuplicate,
  IconTrash,
  IconExtrude,
  IconVisible,
  IconHidden,
  IconLayers,
  IconSettings,
  IconClose,
} from '../ui/Icons'
import Outliner from './Outliner'
import SceneSettings from './SceneSettings'

export default function LeftPanel({ open, onClose }) {
  const addObject = useStore((s) => s.addObject)
  const transformMode = useStore((s) => s.transformMode)
  const setTransformMode = useStore((s) => s.setTransformMode)
  const selectedId = useStore((s) => s.selectedId)
  const duplicateObject = useStore((s) => s.duplicateObject)
  const deleteObject = useStore((s) => s.deleteObject)
  const toggleVisibility = useStore((s) => s.toggleVisibility)
  const extrudeObject = useStore((s) => s.extrudeObject)
  const objects = useStore((s) => s.objects)
  const [activeTab, setTab] = useTabState()

  const selectedObj = objects.find((o) => o.id === selectedId)

  return (
    <>
      {open && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`panel left ${open ? 'open' : ''}`}>
        <div className="panel-header">
          <span>Ferramentas</span>
          <button className="icon drawer-toggle" onClick={onClose} title="Fechar painel">
            <IconClose width={14} height={14} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border-soft)' }}>
          <TabButton active={activeTab === 'add'} onClick={() => setTab('add')} icon={<IconLayers width={14} height={14} />} label="Adicionar" />
          <TabButton active={activeTab === 'scene'} onClick={() => setTab('scene')} icon={<IconSettings width={14} height={14} />} label="Cena" />
        </div>

        <div className="panel-body">
          {activeTab === 'add' && (
            <>
              {/* Primitivas */}
              <div className="panel-section">
                <h4>Formas</h4>
                <div className="tool-grid">
                  {PRIMITIVE_LIST.map(({ key, label }) => {
                    const Icon = PRIMITIVE_ICONS[key]
                    return (
                      <button
                        key={key}
                        onClick={() => addObject(key)}
                        title={`Adicionar ${label.toLowerCase()}`}
                      >
                        {Icon && <Icon />}
                        <span>{label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Modo de transformação */}
              <div className="panel-section">
                <h4>Transformação</h4>
                <div className="mode-row">
                  <button
                    className={transformMode === 'translate' ? 'active' : ''}
                    onClick={() => setTransformMode('translate')}
                    title="Mover (G)"
                  >
                    <IconTranslate width={16} height={16} />
                    <span style={{ fontSize: 10 }}>Mover</span>
                  </button>
                  <button
                    className={transformMode === 'rotate' ? 'active' : ''}
                    onClick={() => setTransformMode('rotate')}
                    title="Rodar (R)"
                  >
                    <IconRotate width={16} height={16} />
                    <span style={{ fontSize: 10 }}>Rodar</span>
                  </button>
                  <button
                    className={transformMode === 'scale' ? 'active' : ''}
                    onClick={() => setTransformMode('scale')}
                    title="Escalar (S)"
                  >
                    <IconScale width={16} height={16} />
                    <span style={{ fontSize: 10 }}>Escalar</span>
                  </button>
                </div>
              </div>

              {/* Operações */}
              {selectedObj && (
                <div className="panel-section">
                  <h4>Operações</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    <button
                      onClick={() => duplicateObject(selectedObj.id)}
                      title="Duplicar"
                    >
                      <IconDuplicate width={14} height={14} /> Duplicar
                    </button>
                    <button
                      onClick={() => toggleVisibility(selectedObj.id)}
                      title="Alternar visibilidade"
                    >
                      {selectedObj.visible !== false ? (
                        <>
                          <IconVisible width={14} height={14} /> Visível
                        </>
                      ) : (
                        <>
                          <IconHidden width={14} height={14} /> Oculto
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => extrudeObject(selectedObj.id, 0.5)}
                      title="Extrude simples"
                    >
                      <IconExtrude width={14} height={14} /> Extrude
                    </button>
                    <button
                      className="danger"
                      onClick={() => deleteObject(selectedObj.id)}
                      title="Apagar"
                    >
                      <IconTrash width={14} height={14} /> Apagar
                    </button>
                  </div>
                </div>
              )}

              {/* Outliner */}
              <div className="panel-section">
                <h4>Objetos na Cena ({objects.length})</h4>
                <Outliner />
              </div>
            </>
          )}

          {activeTab === 'scene' && <SceneSettings />}
        </div>
      </aside>
    </>
  )
}

function TabButton({ active, onClick, icon, label }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        borderRadius: 0,
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        background: active ? 'var(--bg-active)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        padding: '8px 4px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        fontSize: 11,
      }}
    >
      {icon}
      {label}
    </button>
  )
}

// Hook simples para tabs (estado local ao painel — não persistido)
import { useState } from 'react'
function useTabState() {
  const [tab, setTab] = useState('add')
  return [tab, setTab]
}

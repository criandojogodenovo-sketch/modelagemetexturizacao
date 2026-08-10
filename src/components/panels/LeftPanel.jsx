/**
 * LeftPanel — painel lateral esquerdo.
 *
 * Tabs (cada uma com sub-painel próprio):
 *  - Ferramentas: primitivas + transformação + operações básicas + outliner
 *  - Editar: edit mode (vertex/edge/face + operações de malha)
 *  - Modificadores: stack de modificadores não destrutivos
 *  - Booleanas: operações entre objetos
 *  - Esculpir: pincel de esculpir
 *  - Materiais: biblioteca de materiais predefinidos
 *  - Animação: skeleton, keyframes, clips
 *  - Cena: fundo, grelha, luzes
 *
 * Em mobile, o painel é um drawer lateral.
 */
import { useState } from 'react'
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
  IconEdit,
  IconSubdivide,
  IconBoolean,
  IconSculpt,
  IconLibrary,
  IconAnimation,
  IconGroup,
} from '../ui/Icons'
import Outliner from './Outliner'
import SceneSettings from './SceneSettings'
import EditModePanel from './EditModePanel'
import ModifiersPanel from './ModifiersPanel'
import BooleansPanel from './BooleansPanel'
import SculptPanel from './SculptPanel'
import MaterialLibraryPanel from './MaterialLibraryPanel'
import AnimationPanel from './AnimationPanel'

const TABS = [
  { id: 'tools', label: 'Ferramentas', icon: IconLayers },
  { id: 'edit', label: 'Editar', icon: IconEdit },
  { id: 'modifiers', label: 'Modificadores', icon: IconSubdivide },
  { id: 'boolean', label: 'Booleanas', icon: IconBoolean },
  { id: 'sculpt', label: 'Escanpir', icon: IconSculpt },
  { id: 'materials', label: 'Materiais', icon: IconLibrary },
  { id: 'animation', label: 'Animação', icon: IconAnimation },
  { id: 'scene', label: 'Cena', icon: IconSettings },
]

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
  const setParent = useStore((s) => s.setParent)
  const [activeTab, setTab] = useState('tools')

  const selectedObj = objects.find((o) => o.id === selectedId)

  // Lista de candidatos a parent (todos exceto o próprio selecionado)
  const parentCandidates = objects.filter((o) => o.id !== selectedId)

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

        {/* Tabs — scroll horizontal NUNCA; em vez disso, grelha 4 colunas que ajusta */}
        <div className="tabs-grid">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => setTab(tab.id)}
                title={tab.label}
              >
                <Icon width={14} height={14} />
                <span>{tab.label}</span>
              </button>
            )
          })}
        </div>

        <div className="panel-body">
          {activeTab === 'tools' && (
            <>
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

              {/* Agrupar (parent) */}
              {selectedObj && parentCandidates.length > 0 && (
                <div className="panel-section">
                  <h4>Agrupar (Parent)</h4>
                  <div className="prop-row">
                    <label>Parent de "{selectedObj.name}"</label>
                    <select
                      value={selectedObj.parentId || ''}
                      onChange={(e) => setParent(selectedObj.id, e.target.value || null)}
                    >
                      <option value="">— Nenhum (topo) —</option>
                      {parentCandidates.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="panel-section">
                <h4>Objetos na Cena ({objects.length})</h4>
                <Outliner />
              </div>
            </>
          )}

          {activeTab === 'edit' && <EditModePanel />}
          {activeTab === 'modifiers' && <ModifiersPanel />}
          {activeTab === 'boolean' && <BooleansPanel />}
          {activeTab === 'sculpt' && <SculptPanel />}
          {activeTab === 'materials' && <MaterialLibraryPanel />}
          {activeTab === 'animation' && <AnimationPanel />}
          {activeTab === 'scene' && <SceneSettings />}
        </div>
      </aside>
    </>
  )
}

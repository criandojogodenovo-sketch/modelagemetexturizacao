/**
 * MoreToolsGrid — grelha de ferramentas secundárias em ecrã cheia (modal).
 *
 * Em mobile, em vez de esconder ferramentas atrás de scroll horizontal,
 * mostramos um botão "mais" que abre esta grelha organizada por categorias.
 *
 * Click numa ferramenta executa a ação e fecha a grelha.
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
  IconEdit,
  IconSubdivide,
  IconBoolean,
  IconSculpt,
  IconLibrary,
  IconAnimation,
  IconUV,
  IconUnwrap,
  IconBone,
  IconMirror,
  IconArray,
  IconSolidify,
  IconClose,
} from './Icons'

// Ícone "Construtores" — usa IconLibrary como fallback visual
const IconBuilders = IconLibrary

export default function MoreToolsGrid({ onClose }) {
  const addObject = useStore((s) => s.addObject)
  const setTransformMode = useStore((s) => s.setTransformMode)
  const selectedId = useStore((s) => s.selectedId)
  const duplicateObject = useStore((s) => s.duplicateObject)
  const deleteObject = useStore((s) => s.deleteObject)
  const toggleVisibility = useStore((s) => s.toggleVisibility)
  const extrudeObject = useStore((s) => s.extrudeObject)
  const setMode = useStore((s) => s.setMode)
  const applyMeshOp = useStore((s) => s.applyMeshOp)
  const setActivePanel = useStore((s) => s.setActivePanel)
  const addModifier = useStore((s) => s.addModifier)
  const addBone = useStore((s) => s.addBone)
  const openBuildersPanel = useStore((s) => s.openBuildersPanel)
  const openUVEditor = useStore((s) => s.openUVEditor)
  const toast = useStore((s) => s.toast)

  const handle = (fn) => () => {
    fn()
    onClose()
  }

  const requireSelection = (fn) => () => {
    if (!selectedId) {
      toast('Selecione um objeto primeiro', 'error')
      return
    }
    fn()
    onClose()
  }

  return (
    <div className="more-tools-backdrop" onClick={onClose}>
      <div className="more-tools-modal" onClick={(e) => e.stopPropagation()}>
        <div className="more-tools-header">
          <h3>Mais Ferramentas</h3>
          <button className="icon" onClick={onClose} title="Fechar">
            <IconClose width={16} height={16} />
          </button>
        </div>

        <div className="more-tools-body">
          {/* Primitivas */}
          <Category title="Formas">
            {PRIMITIVE_LIST.map(({ key, label }) => {
              const Icon = PRIMITIVE_ICONS[key]
              return (
                <ToolButton
                  key={key}
                  icon={Icon && <Icon />}
                  label={label}
                  onClick={handle(() => addObject(key))}
                />
              )
            })}
          </Category>

          {/* Transformação */}
          <Category title="Transformação">
            <ToolButton
              icon={<IconTranslate width={20} height={20} />}
              label="Mover"
              onClick={handle(() => setTransformMode('translate'))}
            />
            <ToolButton
              icon={<IconRotate width={20} height={20} />}
              label="Rodar"
              onClick={handle(() => setTransformMode('rotate'))}
            />
            <ToolButton
              icon={<IconScale width={20} height={20} />}
              label="Escalar"
              onClick={handle(() => setTransformMode('scale'))}
            />
          </Category>

          {/* Operações */}
          <Category title="Operações">
            <ToolButton
              icon={<IconDuplicate width={20} height={20} />}
              label="Duplicar"
              onClick={requireSelection(() => duplicateObject(selectedId))}
            />
            <ToolButton
              icon={<IconExtrude width={20} height={20} />}
              label="Extrude"
              onClick={requireSelection(() => extrudeObject(selectedId, 0.5))}
            />
            <ToolButton
              icon={<IconVisible width={20} height={20} />}
              label="Visível"
              onClick={requireSelection(() => toggleVisibility(selectedId))}
            />
            <ToolButton
              icon={<IconTrash width={20} height={20} />}
              label="Apagar"
              onClick={requireSelection(() => deleteObject(selectedId))}
              danger
            />
          </Category>

          {/* Modos */}
          <Category title="Modos">
            <ToolButton
              icon={<IconEdit width={20} height={20} />}
              label="Editar"
              onClick={handle(() => setMode('edit'))}
            />
            <ToolButton
              icon={<IconSculpt width={20} height={20} />}
              label="Escanpir"
              onClick={handle(() => setMode('sculpt'))}
            />
            <ToolButton
              icon={<IconUV width={20} height={20} />}
              label="UV/Pintura"
              onClick={handle(() => setMode('paint'))}
            />
            <ToolButton
              icon={<IconAnimation width={20} height={20} />}
              label="Animar"
              onClick={handle(() => setMode('animate'))}
            />
          </Category>

          {/* Operações de malha */}
          <Category title="Malha">
            <ToolButton
              icon={<IconSubdivide width={20} height={20} />}
              label="Subdivide"
              onClick={requireSelection(() => applyMeshOp(selectedId, 'subdivide', { levels: 1 }))}
            />
            <ToolButton
              icon={<IconExtrude width={20} height={20} />}
              label="Extrude Face"
              onClick={requireSelection(() => applyMeshOp(selectedId, 'extrude', { amount: 0.3 }))}
            />
            <ToolButton
              icon={<IconMirror width={20} height={20} />}
              label="Bevel"
              onClick={requireSelection(() => applyMeshOp(selectedId, 'bevel', { radius: 0.04 }))}
            />
            <ToolButton
              icon={<IconUnwrap width={20} height={20} />}
              label="Unwrap UV"
              onClick={requireSelection(() => applyMeshOp(selectedId, 'unwrap', { method: 'box' }))}
            />
          </Category>

          {/* Modificadores */}
          <Category title="Modificadores">
            <ToolButton
              icon={<IconSubdivide width={20} height={20} />}
              label="Subdivision"
              onClick={requireSelection(() => addModifier(selectedId, 'subdivision'))}
            />
            <ToolButton
              icon={<IconMirror width={20} height={20} />}
              label="Mirror"
              onClick={requireSelection(() => addModifier(selectedId, 'mirror'))}
            />
            <ToolButton
              icon={<IconArray width={20} height={20} />}
              label="Array"
              onClick={requireSelection(() => addModifier(selectedId, 'array'))}
            />
            <ToolButton
              icon={<IconSolidify width={20} height={20} />}
              label="Solidify"
              onClick={requireSelection(() => addModifier(selectedId, 'solidify'))}
            />
          </Category>

          {/* Animação */}
          <Category title="Rigging">
            <ToolButton
              icon={<IconBone width={20} height={20} />}
              label="Adicionar Osso"
              onClick={requireSelection(() => addBone(selectedId, [0, 0.5, 0]))}
            />
          </Category>

          {/* Painéis */}
          <Category title="Painéis">
            <ToolButton
              icon={<IconLibrary width={20} height={20} />}
              label="Materiais"
              onClick={handle(() => setActivePanel('materials'))}
            />
            <ToolButton
              icon={<IconBoolean width={20} height={20} />}
              label="Booleanas"
              onClick={handle(() => setActivePanel('boolean'))}
            />
            <ToolButton
              icon={<IconBuilders width={20} height={20} />}
              label="Construtores"
              onClick={handle(() => openBuildersPanel())}
            />
            <ToolButton
              icon={<IconUV width={20} height={20} />}
              label="UV Editor"
              onClick={requireSelection(() => openUVEditor())}
            />
          </Category>
        </div>
      </div>
    </div>
  )
}

function Category({ title, children }) {
  return (
    <div className="more-tools-category">
      <h5>{title}</h5>
      <div className="more-tools-grid">
        {children}
      </div>
    </div>
  )
}

function ToolButton({ icon, label, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`more-tool-btn ${danger ? 'danger' : ''}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

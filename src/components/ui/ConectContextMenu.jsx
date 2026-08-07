/**
 * ConectContextMenu — menu de 3 pontos (⋯) para cada Conect.
 *
 * Opções:
 *  - Reagrupar (mover para outro GroupObject ou cena)
 *  - Criar Conect filho (parent-child)
 *  - Adicionar objeto ao Conect (para GroupObject)
 *  - FlirScript (abrir editor)
 *  - Material (abrir editor de material)
 *  - Conectar a outro Conect (joint, path follow, etc.)
 *  - Controlador de Animação (para PersonalObject/NpcObject)
 *  - Duplicar
 *  - Apagar
 */
import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import AnimationControllerEditor from '../panels/AnimationControllerEditor'

export default function ConectContextMenu({ conect, sceneId }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)
  const setFlirScriptTarget = useStore((s) => s.setFlirScriptTarget)
  const duplicateConect = useStore((s) => s.duplicateConect)
  const removeConectFromScene = useStore((s) => s.removeConectFromScene)
  const addConectToScene = useStore((s) => s.addConectToScene)
  const updateConect = useStore((s) => s.updateConect)
  const scenes = useStore((s) => s.scenes)
  const toast = useStore((s) => s.toast)
  const [showAnimEditor, setShowAnimEditor] = useState(false)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleAction = (action) => {
    setOpen(false)
    switch (action) {
      case 'flirscript':
        setFlirScriptTarget(sceneId, conect.instanceId)
        break
      case 'duplicate':
        duplicateConect(conect.instanceId)
        break
      case 'delete':
        removeConectFromScene(conect.instanceId)
        break
      case 'child':
        const child = addConectToScene('GroupObject', [
          conect.position[0] + 0.5,
          conect.position[1],
          conect.position[2] + 0.5,
        ])
        if (child) {
          updateConect(child.instanceId, { parentId: conect.instanceId })
          toast('Conect filho criado', 'success')
        }
        break
      case 'connect':
        toast('Seleciona outro Conect para conectar (funcionalidade em desenvolvimento)', 'info')
        break
      case 'material':
        toast('Editor de material: abre no painel direito (propriedades do Conect)', 'info')
        break
      case 'anim':
        setShowAnimEditor(true)
        break
      case 'regroup':
        toast('Reagrupar: seleciona outro GroupObject na lista (em desenvolvimento)', 'info')
        break
    }
  }

  const isCharacter = conect.type === 'PersonalObject' || conect.type === 'NpcObject'

  return (
    <>
      <div className="conect-context-wrap" ref={menuRef}>
        <button
          className="conect-context-btn"
          onClick={(e) => { e.stopPropagation(); setOpen(!open) }}
          title="Opções do Conect"
        >
          ⋯
        </button>
        {open && (
          <div className="conect-context-menu">
            <button onClick={() => handleAction('flirscript')}>
              🧩 FlirScript
            </button>
            {isCharacter && (
              <button onClick={() => handleAction('anim')}>
                🏃 Controlador de Animação
              </button>
            )}
            <button onClick={() => handleAction('material')}>
              🎨 Material
            </button>
            <button onClick={() => handleAction('child')}>
              ➕ Criar Conect filho
            </button>
            <button onClick={() => handleAction('connect')}>
              🔗 Conectar a outro Conect
            </button>
            <button onClick={() => handleAction('regroup')}>
              📁 Reagrupar
            </button>
            <div className="conect-context-divider" />
            <button onClick={() => handleAction('duplicate')}>
              📋 Duplicar
            </button>
            <button className="danger" onClick={() => handleAction('delete')}>
              🗑️ Apagar
            </button>
          </div>
        )}
      </div>
      {showAnimEditor && (
        <div className="modal-backdrop" onClick={() => setShowAnimEditor(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <AnimationControllerEditor
              onClose={() => setShowAnimEditor(false)}
              targetConectId={conect.instanceId}
            />
          </div>
        </div>
      )}
    </>
  )
}

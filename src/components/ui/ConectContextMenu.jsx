/**
 * ConectContextMenu — menu de 3 pontos (⋯) para cada Conect.
 *
 * Opções funcionais (todas abrem algo visível):
 *  - FlirScript: abre o editor FlirScript para este Conect
 *  - Controlador de Animação: abre o editor de máquina de estados (PersonalObject/NpcObject)
 *  - Material: seleciona o Conect e abre o painel de propriedades à direita
 *  - Criar Conect filho: cria um GroupObject filho
 *  - Adicionar objeto da cena como filho: lista objetos para escolher um filho
 *  - Conectar a outro Conect: cria um JointObject entre este e outro
 *  - Reagrupar: move para outra cena (lista de cenas)
 *  - Duplicar
 *  - Apagar
 */
import { useState, useRef, useEffect } from 'react'
import { useStore } from '../../store/useStore'

export default function ConectContextMenu({ conect, sceneId }) {
  const [open, setOpen] = useState(false)
  const [subMenu, setSubMenu] = useState(null) // 'addChild' | 'connect' | 'regroup'
  const menuRef = useRef(null)

  const setFlirScriptTarget = useStore((s) => s.setFlirScriptTarget)
  const duplicateConect = useStore((s) => s.duplicateConect)
  const removeConectFromScene = useStore((s) => s.removeConectFromScene)
  const addConectToScene = useStore((s) => s.addConectToScene)
  const updateConect = useStore((s) => s.updateConect)
  const selectConect = useStore((s) => s.selectConect)
  const openAnimController = useStore((s) => s.openAnimController)
  const toggleRightDrawer = useStore((s) => s.toggleRightDrawer)
  const setUI = useStore((s) => s.setUI)
  const scenes = useStore((s) => s.scenes)
  const setActiveScene = useStore((s) => s.setActiveScene)
  const toast = useStore((s) => s.toast)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false)
        setSubMenu(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleAction = (action) => {
    switch (action) {
      case 'flirscript':
        setOpen(false)
        setFlirScriptTarget(sceneId, conect.instanceId)
        toast(`A abrir FlirScript para "${conect.name}"`, 'info', 1500)
        break
      case 'anim':
        setOpen(false)
        openAnimController(conect.instanceId)
        break
      case 'material':
        setOpen(false)
        selectConect(conect.instanceId)
        // Abrir painel direito em mobile
        setUI({ rightDrawerOpen: true })
        toast('Propriedades abertas no painel direito', 'info', 1500)
        break
      case 'child':
        setOpen(false)
        const child = addConectToScene('GroupObject', [
          conect.position[0] + 0.5,
          conect.position[1],
          conect.position[2] + 0.5,
        ])
        if (child) {
          updateConect(child.instanceId, { parentId: conect.instanceId })
          toast(`Conect filho criado sob "${conect.name}"`, 'success')
        }
        break
      case 'addChild':
        setSubMenu(subMenu === 'addChild' ? null : 'addChild')
        break
      case 'connect':
        setSubMenu(subMenu === 'connect' ? null : 'connect')
        break
      case 'regroup':
        setSubMenu(subMenu === 'regroup' ? null : 'regroup')
        break
      case 'duplicate':
        setOpen(false)
        duplicateConect(conect.instanceId)
        break
      case 'delete':
        setOpen(false)
        removeConectFromScene(conect.instanceId)
        break
    }
  }

  // Adicionar um objeto existente da cena como filho
  const addExistingAsChild = (otherInstanceId) => {
    updateConect(otherInstanceId, { parentId: conect.instanceId })
    toast('Objeto adicionado como filho', 'success')
    setSubMenu(null)
    setOpen(false)
  }

  // Conectar a outro Conect (cria um JointObject)
  const connectTo = (otherInstanceId) => {
    const joint = addConectToScene('JointObject', [
      conect.position[0],
      conect.position[1] + 1,
      conect.position[2],
    ])
    if (joint) {
      updateConect(joint.instanceId, {
        targetA: conect.instanceId,
        targetB: otherInstanceId,
      })
      toast('Conectado! JointObject criado entre os dois', 'success')
    }
    setSubMenu(null)
    setOpen(false)
  }

  // Mover para outra cena
  const moveToScene = (targetSceneId) => {
    const targetScene = scenes.find((s) => s.id === targetSceneId)
    if (!targetScene) return
    // Remover da cena atual e adicionar à target
    useStore.setState((s) => ({
      scenes: s.scenes.map((sc) => {
        if (sc.id === sceneId) {
          return { ...sc, conects: (sc.conects || []).filter((c) => c.instanceId !== conect.instanceId) }
        }
        if (sc.id === targetSceneId) {
          return { ...sc, conects: [...(sc.conects || []), conect] }
        }
        return sc
      }),
    }))
    toast(`Movido para a cena "${targetScene.name}"`, 'success')
    setSubMenu(null)
    setOpen(false)
  }

  const isCharacter = conect.type === 'PersonalObject' || conect.type === 'NpcObject'

  // Listar outros conects na mesma cena para addChild/connect
  const currentScene = scenes.find((s) => s.id === sceneId)
  const otherConects = (currentScene?.conects || []).filter((c) => c.instanceId !== conect.instanceId)

  return (
    <div className="conect-context-wrap" ref={menuRef}>
      <button
        className="conect-context-btn"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); setSubMenu(null) }}
        title="Opções do Conect"
      >
        ⋯
      </button>
      {open && (
        <div className="conect-context-menu">
          <button onClick={() => handleAction('flirscript')}>FlirScript
          </button>
          {isCharacter && (
            <button onClick={() => handleAction('anim')}>Controlador de Animação
            </button>
          )}
          <button onClick={() => handleAction('material')}>Material / Propriedades
          </button>
          <button onClick={() => handleAction('child')}>
            ➕ Criar Conect filho
          </button>
          {otherConects.length > 0 && (
            <button onClick={() => handleAction('addChild')}>
              🔗 Adicionar objeto como filho
              {subMenu === 'addChild' ? ' ▲' : ' ▼'}
            </button>
          )}
          {subMenu === 'addChild' && (
            <div className="conect-context-submenu">
              {otherConects.map((c) => (
                <button
                  key={c.instanceId}
                  className="submenu-item"
                  onClick={(e) => { e.stopPropagation(); addExistingAsChild(c.instanceId) }}
                  title={c.type}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          {otherConects.length > 0 && (
            <button onClick={() => handleAction('connect')}>
              🔗 Conectar a outro Conect
              {subMenu === 'connect' ? ' ▲' : ' ▼'}
            </button>
          )}
          {subMenu === 'connect' && (
            <div className="conect-context-submenu">
              {otherConects.map((c) => (
                <button
                  key={c.instanceId}
                  className="submenu-item"
                  onClick={(e) => { e.stopPropagation(); connectTo(c.instanceId) }}
                  title={c.type}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
          <button onClick={() => handleAction('regroup')}>Mover para outra cena
            {subMenu === 'regroup' ? ' ▲' : ' ▼'}
          </button>
          {subMenu === 'regroup' && (
            <div className="conect-context-submenu">
              {scenes.filter((s) => s.id !== sceneId).map((s) => (
                <button
                  key={s.id}
                  className="submenu-item"
                  onClick={(e) => { e.stopPropagation(); moveToScene(s.id) }}
                >
                  {s.name}
                </button>
              ))}
              {scenes.length <= 1 && (
                <div className="submenu-empty">Sem outras cenas</div>
              )}
            </div>
          )}
          <div className="conect-context-divider" />
          <button onClick={() => handleAction('duplicate')}>Duplicar
          </button>
          <button className="danger" onClick={() => handleAction('delete')}>
            🗑️ Apagar
          </button>
        </div>
      )}
    </div>
  )
}

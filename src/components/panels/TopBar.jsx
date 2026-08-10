/**
 * TopBar — barra superior da aplicação.
 *
 * Contém:
 *  - Logo + nome da app
 *  - Botões de drawer (mobile)
 *  - Novo projeto
 *  - Importar (GLB/GLTF/OBJ/JSON)
 *  - Exportar (GLB/OBJ/JSON)
 *  - Guardar / Carregar projeto (localStorage)
 *  - Undo / Redo
 */
import { useRef, useState } from 'react'
import { useStore } from '../../store/useStore'
import { HOTKEYS } from '../../hooks/useHotkeys'
import { exportSceneAsGLB, exportSceneAsOBJ, importGLB, importGLTF, importOBJ, importFBX } from '../../utils/exporters'
import { importFBXViaWorker } from '../../utils/fbxImportWorkerClient'
import { Icon } from '../ui/iconMap'
import {
  IconMenu,
  IconUndo,
  IconRedo,
  IconFile,
  IconImport,
  IconExport,
  IconSave,
  IconSettings,
} from '../ui/Icons'
import AppModeSwitch from '../ui/AppModeSwitch'

export default function TopBar() {
  const fileInputRef = useRef()
  const [importType, setImportType] = useState('glb')
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)

  const toggleLeftDrawer = useStore((s) => s.toggleLeftDrawer)
  const toggleRightDrawer = useStore((s) => s.toggleRightDrawer)
  const toggleMainMenu = useStore((s) => s.toggleMainMenu)
  const showHome = useStore((s) => s.showHome)
  const openTerrainEditor = useStore((s) => s.openTerrainEditor)
  const openAnimStudio = useStore((s) => s.openAnimStudio)

  const newProject = useStore((s) => s.newProject)
  const undo = useStore((s) => s.undo)
  const redo = useStore((s) => s.redo)
  const past = useStore((s) => s.past)
  const future = useStore((s) => s.future)
  const exportProjectJSON = useStore((s) => s.exportProjectJSON)
  const loadProjectJSON = useStore((s) => s.loadProjectJSON)
  const toast = useStore((s) => s.toast)
  const setUI = useStore((s) => s.setUI)
  const addImportedObject = useStore((s) => s.addImportedObject)
  const setObjects = useStore((s) => s.setObjects)
  const objects = useStore((s) => s.objects)

  // Diálogo de export (modal)
  const [exportOpen, setExportOpen] = useState(false)

  // ----- Ações de ficheiro -----
  const handleSave = () => {
    const json = exportProjectJSON()
    localStorage.setItem('me3d.project.snapshot', json)
    toast('Projeto guardado no navegador', 'success')
  }

  // Guardar como ficheiro .flirengine
  const handleSaveFlirEngine = () => {
    const json = exportProjectJSON()
    const blob = new Blob([json], { type: 'application/octet-stream' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `projeto-${Date.now()}.flirengine`
    a.click()
    URL.revokeObjectURL(url)
    toast('Projeto guardado como .flirengine', 'success')
  }

  // Abrir ficheiro .flirengine
  const handleOpenFlirEngine = () => {
    fileInputRef.current.setAttribute('accept', '.flirengine,.json')
    setImportType('flirengine')
    setTimeout(() => fileInputRef.current?.click(), 0)
  }

  const handleLoadSnapshot = () => {
    const json = localStorage.getItem('me3d.project.snapshot')
    if (!json) {
      toast('Nenhum snapshot guardado encontrado', 'error')
      return
    }
    loadProjectJSON(json)
  }

  const handleExportJSON = () => {
    const json = exportProjectJSON()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `projeto-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExportOpen(false)
    toast('Projeto exportado (JSON)', 'success')
  }

  const handleExportGLB = async () => {
    setUI({ loading: true, loadingMessage: 'A exportar GLB...' })
    try {
      await exportSceneAsGLB(objects)
      toast('Cena exportada (GLB)', 'success')
    } catch (err) {
      toast('Erro ao exportar GLB: ' + err.message, 'error')
    } finally {
      setUI({ loading: false })
      setExportOpen(false)
    }
  }

  const handleExportOBJ = async () => {
    setUI({ loading: true, loadingMessage: 'A exportar OBJ...' })
    try {
      await exportSceneAsOBJ(objects)
      toast('Cena exportada (OBJ)', 'success')
    } catch (err) {
      toast('Erro ao exportar OBJ: ' + err.message, 'error')
    } finally {
      setUI({ loading: false })
      setExportOpen(false)
    }
  }

  const handleImportClick = (type) => {
    setImportType(type)
    setTimeout(() => fileInputRef.current?.click(), 0)
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Feedback de progresso com mensagens faseadas
    const fileSizeMB = (file.size / 1024 / 1024).toFixed(1)
    setUI({ loading: true, loadingMessage: `A ler ficheiro ${importType.toUpperCase()} (${fileSizeMB} MB)...` })

    // Timeout: se demorar mais de 30 segundos, abortar
    let timeoutId
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error('Timeout: a importação demorou demasiado (>30s). O ficheiro pode ser demasiado complexo para este dispositivo.'))
      }, 30000)
    })

    // Progresso faseado (atualiza mensagem a cada 3 segundos)
    let progressPhase = 0
    const progressMessages = importType === 'fbx'
      ? ['A ler ficheiro FBX...', 'A processar geometria...', 'A processar esqueleto...', 'A processar animações...', 'A finalizar importação...']
      : ['A processar modelo...', 'A extrair meshes...', 'A finalizar importação...']
    const progressInterval = setInterval(() => {
      progressPhase = Math.min(progressPhase + 1, progressMessages.length - 1)
      setUI({ loading: true, loadingMessage: progressMessages[progressPhase] })
    }, 3000)

    try {
      let importedObjects = []
      const importPromise = (async () => {
        if (importType === 'glb') {
          // Ceder controlo para a UI atualizar antes do parse síncrono
          await new Promise(r => setTimeout(r, 50))
          setUI({ loading: true, loadingMessage: 'A processar GLB...' })
          return await importGLB(file)
        } else if (importType === 'gltf') {
          await new Promise(r => setTimeout(r, 50))
          setUI({ loading: true, loadingMessage: 'A processar GLTF...' })
          return await importGLTF(file)
        } else if (importType === 'obj') {
          await new Promise(r => setTimeout(r, 50))
          setUI({ loading: true, loadingMessage: 'A processar OBJ...' })
          return await importOBJ(file)
        } else if (importType === 'fbx') {
          // FBX agora via Web Worker — NÃO bloqueia a main thread
          // O progresso é reportado por mensagens REAIS do worker (não setTimeout)
          setUI({ loading: true, loadingMessage: 'A iniciar worker FBX...' })
          return await importFBXViaWorker(file, (phase) => {
            setUI({ loading: true, loadingMessage: phase })
          })
        } else if (importType === 'json' || importType === 'flirengine') {
          const text = await file.text()
          loadProjectJSON(text)
          toast('Projeto .flirengine carregado', 'success')
          setUI({ loading: false })
          e.target.value = ''
          return null
        }
      })()

      const result = await Promise.race([importPromise, timeoutPromise])
      if (result === null) return // já tratado (flirengine)

      importedObjects = result
      importedObjects.forEach((obj) => addImportedObject(obj))
      toast(`${importedObjects.length} objeto(s) importado(s)`, 'success')
    } catch (err) {
      toast('Erro ao importar: ' + err.message, 'error')
      console.error('Erro de importação:', err)
    } finally {
      clearTimeout(timeoutId)
      clearInterval(progressInterval)
      setUI({ loading: false })
      e.target.value = ''
    }
  }

  const canUndo = past.length > 0
  const canRedo = future.length > 0

  return (
    <header className="topbar">
      <button
        className="icon drawer-toggle"
        onClick={toggleLeftDrawer}
        title="Ferramentas"
        style={{ marginRight: 4 }}
      >
        <IconMenu width={18} height={18} />
      </button>

      <div className="brand">
        <span className="logo">M</span>
        <span className="drawer-toggle" style={{ display: 'none' }}> </span>
        <span className="brand-text">Modelagem 3D</span>
      </div>

      <button
        onClick={showHome}
        title="Página principal (projetos + ebook)"
        className="icon topbar-hide-mobile"
      >
        <Icon name="home" size={16} />
      </button>
      <button
        onClick={openTerrainEditor}
        title="Editor de Terrenos"
        className="icon topbar-hide-mobile"
      >
        <Icon name="mountain" size={16} />
      </button>
      <button
        onClick={openAnimStudio}
        title="Estúdio de Animação (keyframes, FBX, controlador)"
        className="icon topbar-hide-mobile"
      >
        <Icon name="film" size={16} />
      </button>

      {/* Seletor de modo: Modelagem vs Cena */}
      <AppModeSwitch />

      <div className="group topbar-hide-mobile">
        <button onClick={newProject} title="Novo projeto" className="icon">
          <IconFile width={14} height={14} />
          <span className="hide-mobile">Novo</span>
        </button>
      </div>

      <div className="group topbar-hide-mobile">
        <button
          onClick={() => handleImportClick('glb')}
          title="Importar GLB"
          className="icon"
        >
          <IconImport width={14} height={14} />
          <span className="hide-mobile">GLB</span>
        </button>
        <button
          onClick={() => handleImportClick('gltf')}
          title="Importar GLTF"
          className="icon topbar-hide-narrow"
        >
          <span className="hide-mobile">GLTF</span>
        </button>
        <button
          onClick={() => handleImportClick('obj')}
          title="Importar OBJ"
          className="icon topbar-hide-narrow"
        >
          <span className="hide-mobile">OBJ</span>
        </button>
        <button
          onClick={() => handleImportClick('fbx')}
          title="Importar FBX (com animações e esqueleto)"
          className="icon topbar-hide-narrow"
        >
          <span className="hide-mobile">FBX</span>
        </button>
        <button
          onClick={() => handleImportClick('json')}
          title="Importar projeto JSON"
          className="icon topbar-hide-narrow"
        >
          <span className="hide-mobile">JSON</span>
        </button>
      </div>

      <div className="group">
        <button onClick={() => setExportOpen(true)} title="Exportar" className="icon primary">
          <IconExport width={14} height={14} />
          <span className="hide-mobile">Exportar</span>
        </button>
      </div>

      <div className="group topbar-hide-mobile">
        <button onClick={handleSave} title="Guardar no navegador" className="icon">
          <IconSave width={14} height={14} />
          <span className="hide-mobile">Guardar</span>
        </button>
        <button onClick={handleLoadSnapshot} title="Carregar do navegador" className="icon topbar-hide-narrow">
          <IconImport width={14} height={14} />
          <span className="hide-mobile">Carregar</span>
        </button>
      </div>

      <div className="group topbar-hide-mobile">
        <button onClick={handleSaveFlirEngine} title="Guardar como .flirengine" className="icon">
          <Icon name="save" size={14} />
          <span className="hide-mobile">.flirengine</span>
        </button>
        <button onClick={handleOpenFlirEngine} title="Abrir .flirengine" className="icon topbar-hide-narrow">
          <Icon name="folder-open" size={14} />
          <span className="hide-mobile">Abrir</span>
        </button>
      </div>

      <div className="spacer" />

      <div className="group">
        <button onClick={undo} disabled={!canUndo} title={`Desfazer (${HOTKEYS.undo})`} className="icon">
          <IconUndo width={14} height={14} />
        </button>
        <button onClick={redo} disabled={!canRedo} title={`Refazer (${HOTKEYS.redo})`} className="icon">
          <IconRedo width={14} height={14} />
        </button>
      </div>

      {/* Botão "Mais" — visível só em mobile, abre menu overflow com todas as ações escondidas */}
      <button
        className="icon drawer-toggle topbar-more-btn"
        onClick={() => setMoreMenuOpen(true)}
        title="Mais ações (Guardar, Importar, Abrir...)"
      >
        <Icon name="more-horizontal" size={16} />
      </button>
      {moreMenuOpen && (
        <MoreActionsMenu
          onClose={() => setMoreMenuOpen(false)}
          actions={{
            newProject,
            handleSave,
            handleLoadSnapshot,
            handleSaveFlirEngine,
            handleOpenFlirEngine,
            handleImportClick,
            showHome,
            openTerrainEditor,
            openAnimStudio,
          }}
        />
      )}

      <button
        onClick={toggleMainMenu}
        title="Menu principal (UI, Shaders, Projeto, Debug...)"
        className="icon"
      ></button>

      <button
        className="icon drawer-toggle"
        onClick={toggleRightDrawer}
        title="Propriedades"
      >
        <IconSettings width={18} height={18} />
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept={
          importType === 'glb' ? '.glb,model/gltf-binary' :
          importType === 'gltf' ? '.gltf,model/gltf+json' :
          importType === 'obj' ? '.obj' :
          importType === 'fbx' ? '.fbx' :
          '.json,application/json'
        }
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {exportOpen && (
        <ExportModal
          onClose={() => setExportOpen(false)}
          onJSON={handleExportJSON}
          onGLB={handleExportGLB}
          onOBJ={handleExportOBJ}
        />
      )}
    </header>
  )
}

// Menu overflow para mobile — mostra ações escondidas da topbar
function MoreActionsMenu({ onClose, actions }) {
  return (
    <>
      <div className="drawer-backdrop show" onClick={onClose} />
      <aside className="more-actions-menu open">
        <div className="panel-header">
          <span>Mais ações</span>
          <button className="icon" onClick={onClose} title="Fechar"><Icon name="close" size={14} /></button>
        </div>
        <div className="more-actions-body">
          <button className="mm-item" onClick={() => { actions.showHome(); onClose() }}>
            <span className="mm-icon"><Icon name="home" size={18} /></span>
            <div><div className="mm-label">Página principal</div></div>
          </button>
          <button className="mm-item" onClick={() => { actions.newProject(); onClose() }}>
            <span className="mm-icon"><Icon name="file" size={18} /></span>
            <div><div className="mm-label">Novo projeto</div></div>
          </button>
          <button className="mm-item" onClick={() => { actions.openTerrainEditor(); onClose() }}>
            <span className="mm-icon"><Icon name="mountain" size={18} /></span>
            <div><div className="mm-label">Editor de Terrenos</div></div>
          </button>
          <button className="mm-item" onClick={() => { actions.openAnimStudio(); onClose() }}>
            <span className="mm-icon"><Icon name="film" size={18} /></span>
            <div><div className="mm-label">Estúdio de Animação</div></div>
          </button>
          <div className="mm-divider" />
          <button className="mm-item" onClick={() => { actions.handleSave(); onClose() }}>
            <span className="mm-icon"><Icon name="save" size={18} /></span>
            <div><div className="mm-label">Guardar no navegador</div></div>
          </button>
          <button className="mm-item" onClick={() => { actions.handleLoadSnapshot(); onClose() }}>
            <span className="mm-icon"><Icon name="folder-open" size={18} /></span>
            <div><div className="mm-label">Carregar do navegador</div></div>
          </button>
          <button className="mm-item" onClick={() => { actions.handleSaveFlirEngine(); onClose() }}>
            <span className="mm-icon"><Icon name="save" size={18} /></span>
            <div><div className="mm-label">Guardar .flirengine</div></div>
          </button>
          <button className="mm-item" onClick={() => { actions.handleOpenFlirEngine(); onClose() }}>
            <span className="mm-icon"><Icon name="folder-open" size={18} /></span>
            <div><div className="mm-label">Abrir .flirengine</div></div>
          </button>
          <div className="mm-divider" />
          <button className="mm-item" onClick={() => { actions.handleImportClick('glb'); onClose() }}>
            <span className="mm-icon"><Icon name="package" size={18} /></span>
            <div><div className="mm-label">Importar GLB</div></div>
          </button>
          <button className="mm-item" onClick={() => { actions.handleImportClick('gltf'); onClose() }}>
            <span className="mm-icon"><Icon name="package" size={18} /></span>
            <div><div className="mm-label">Importar GLTF</div></div>
          </button>
          <button className="mm-item" onClick={() => { actions.handleImportClick('obj'); onClose() }}>
            <span className="mm-icon"><Icon name="package" size={18} /></span>
            <div><div className="mm-label">Importar OBJ</div></div>
          </button>
          <button className="mm-item" onClick={() => { actions.handleImportClick('fbx'); onClose() }}>
            <span className="mm-icon"><Icon name="package" size={18} /></span>
            <div><div className="mm-label">Importar FBX (animações)</div></div>
          </button>
          <button className="mm-item" onClick={() => { actions.handleImportClick('json'); onClose() }}>
            <span className="mm-icon"><Icon name="file" size={18} /></span>
            <div><div className="mm-label">Importar JSON</div></div>
          </button>
        </div>
      </aside>
    </>
  )
}

function ExportModal({ onClose, onJSON, onGLB, onOBJ }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Exportar Cena</h3>
        <p className="muted small mb-2">
          Escolhe o formato de exportação. GLB e OBJ incluem geometrias e materiais;
          JSON guarda todo o estado do projeto (incluindo texturas em base64).
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={onGLB} className="primary">
            <IconExport width={14} height={14} /> Exportar como GLB (.glb)
          </button>
          <button onClick={onOBJ}>
            <IconExport width={14} height={14} /> Exportar como OBJ (.obj + .mtl)
          </button>
          <button onClick={onJSON}>
            <IconSave width={14} height={14} /> Guardar projeto (JSON)
          </button>
        </div>
        <div className="actions">
          <button onClick={onClose}>Cancelar</button>
        </div>
      </div>
    </div>
  )
}

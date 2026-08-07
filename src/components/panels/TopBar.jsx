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
import { exportSceneAsGLB, exportSceneAsOBJ, importGLB, importGLTF, importOBJ } from '../../utils/exporters'
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
    setUI({ loading: true, loadingMessage: 'A importar modelo...' })
    try {
      let importedObjects = []
      if (importType === 'glb') {
        importedObjects = await importGLB(file)
      } else if (importType === 'gltf') {
        importedObjects = await importGLTF(file)
      } else if (importType === 'obj') {
        importedObjects = await importOBJ(file)
      } else if (importType === 'json') {
        const text = await file.text()
        loadProjectJSON(text)
        setUI({ loading: false })
        e.target.value = ''
        return
      }

      // Adiciona cada objeto importado à cena
      importedObjects.forEach((obj) => addImportedObject(obj))
      toast(`${importedObjects.length} objeto(s) importado(s)`, 'success')
    } catch (err) {
      toast('Erro ao importar: ' + err.message, 'error')
    } finally {
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
        className="icon"
      >
        🏠
      </button>
      <button
        onClick={openTerrainEditor}
        title="Editor de Terrenos"
        className="icon"
      >
        ⛰️
      </button>
      <button
        onClick={openAnimStudio}
        title="Estúdio de Animação (keyframes, FBX, controlador)"
        className="icon"
      >
        🏃
      </button>

      {/* Seletor de modo: Modelagem vs Cena */}
      <AppModeSwitch />

      <div className="group">
        <button onClick={newProject} title="Novo projeto" className="icon">
          <IconFile width={14} height={14} />
          <span className="hide-mobile">Novo</span>
        </button>
      </div>

      <div className="group">
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
          className="icon"
        >
          <span className="hide-mobile">GLTF</span>
        </button>
        <button
          onClick={() => handleImportClick('obj')}
          title="Importar OBJ"
          className="icon"
        >
          <span className="hide-mobile">OBJ</span>
        </button>
        <button
          onClick={() => handleImportClick('json')}
          title="Importar projeto JSON"
          className="icon"
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

      <div className="group">
        <button onClick={handleSave} title="Guardar no navegador" className="icon">
          <IconSave width={14} height={14} />
          <span className="hide-mobile">Guardar</span>
        </button>
        <button onClick={handleLoadSnapshot} title="Carregar do navegador" className="icon">
          <IconImport width={14} height={14} />
          <span className="hide-mobile">Carregar</span>
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

      <button
        onClick={toggleMainMenu}
        title="Menu principal (UI, Shaders, Projeto, Debug...)"
        className="icon"
      >
        📋
      </button>

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

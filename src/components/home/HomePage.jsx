/**
 * HomePage — página principal com projetos do utilizador + ebook interativo.
 *
 * Funcionalidades:
 *  - Lista de projetos guardados (em IndexedDB)
 *  - Criar novo projeto / abrir projeto / apagar
 *  - Ebook interativo com tudo sobre a engine (com imagens e ilustrações)
 *  - Download do ebook
 *
 * Acessível quando o utilizador abre a app (primeira vista) ou via botão Home.
 */
import { useState, useEffect, useRef } from 'react'
import { useStore } from '../../store/useStore'
import { listProjects, loadProject, deleteProject } from '../../utils/db'
import Ebook from './Ebook'

export default function HomePage({ onOpenProject }) {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showEbook, setShowEbook] = useState(false)
  const newProject = useStore((s) => s.newProject)
  const loadProjectJSON = useStore((s) => s.loadProjectJSON)
  const toast = useStore((s) => s.toast)
  const fileInputRef = useRef(null)

  useEffect(() => {
    listProjects()
      .then((p) => setProjects(p))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const handleNew = () => {
    newProject()
    onOpenProject?.()
  }

  // Abrir projeto .flirengine do disco
  const handleOpenFlirEngine = () => {
    fileInputRef.current?.setAttribute('accept', '.flirengine,.json')
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      loadProjectJSON(text)
      toast(`Projeto "${file.name}" carregado`, 'success')
      onOpenProject?.()
    } catch (err) {
      toast('Erro ao abrir projeto: ' + err.message, 'error')
    }
    e.target.value = ''
  }

  const handleOpen = async (projectId) => {
    const data = await loadProject(projectId)
    if (data?.data) {
      const json = JSON.stringify({
        version: 3,
        scene: {
          objects: data.data.objects || [],
          background: data.data.background,
          grid: data.data.grid,
          lights: data.data.lights,
        },
        scenes: data.data.scenes || [],
        activeSceneId: data.data.activeSceneId,
        appMode: data.data.appMode || 'modeling',
      })
      loadProjectJSON(json)
      toast(`Projeto "${data.name}" carregado`, 'success')
      onOpenProject?.()
    }
  }

  const handleDelete = async (projectId) => {
    if (!confirm('Apagar este projeto?')) return
    await deleteProject(projectId)
    setProjects(projects.filter((p) => p.id !== projectId))
    toast('Projeto apagado', 'info')
  }

  if (showEbook) {
    return <Ebook onClose={() => setShowEbook(false)} />
  }

  return (
    <div className="home-page">
      <header className="home-header">
        <div className="home-logo">
          <span className="home-logo-icon"></span>
          <div>
            <h1>FlirScript Engine</h1>
            <p className="muted">Cria jogos 3D mobile no navegador — sem instalar nada</p>
          </div>
        </div>
        <button className="home-ebook-btn" onClick={() => setShowEbook(true)}>Ebook Interativo
        </button>
      </header>

      <div className="home-content">
        <section className="home-section">
          <div className="home-section-header">
            <h2>Os meus projetos</h2>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={handleOpenFlirEngine} title="Abrir projeto .flirengine">Abrir
              </button>
              <button className="primary" onClick={handleNew}>
                + Novo Projeto
              </button>
            </div>
          </div>

          {loading ? (
            <div className="home-loading">A carregar projetos...</div>
          ) : projects.length === 0 ? (
            <div className="home-empty">
              <div className="home-empty-icon"></div>
              <h3>Sem projetos ainda</h3>
              <p className="muted">Cria o teu primeiro jogo 3D mobile.</p>
              <button className="primary" onClick={handleNew}>Criar agora</button>
            </div>
          ) : (
            <div className="projects-grid">
              {projects.map((p) => (
                <div key={p.id} className="project-card">
                  <div className="project-card-thumb" onClick={() => handleOpen(p.id)}>
                    <span className="project-card-icon"></span>
                  </div>
                  <div className="project-card-info">
                    <div className="project-card-name" onClick={() => handleOpen(p.id)}>
                      {p.name}
                    </div>
                    <div className="project-card-meta small muted">
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </div>
                    <button
                      className="danger project-card-delete"
                      onClick={() => handleDelete(p.id)}
                      title="Apagar"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="home-section">
          <h2>Começa aqui</h2>
          <div className="home-features">
            <div className="feature-card">
              <span className="feature-icon">🧊</span>
              <h3>Modelagem</h3>
              <p>Cria formas 3D, edita vértices, aplica texturas e materiais.</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon"></span>
              <h3>Cenas</h3>
              <p>Monta níveis com objetos, iluminação, física e câmaras.</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon"></span>
              <h3>FlirScript</h3>
              <p>Programa lógica de jogo com nós visuais (estilo Blueprints).</p>
            </div>
            <div className="feature-card">
              <span className="feature-icon"></span>
              <h3>Exportar</h3>
              <p>Gera um jogo standalone jogável em qualquer browser ou APK.</p>
            </div>
          </div>
        </section>

        <section className="home-section">
          <div className="ebook-banner" onClick={() => setShowEbook(true)}>
            <div className="ebook-banner-content">
              <span className="ebook-banner-icon"></span>
              <div>
                <h3>Ebook Interativo da Engine</h3>
                <p className="muted">Aprende tudo sobre a engine com guias visuais e exemplos.</p>
              </div>
            </div>
            <span className="ebook-banner-cta">Abrir →</span>
          </div>
        </section>
      </div>

      {/* Input hidden para abrir .flirengine */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".flirengine,.json"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  )
}

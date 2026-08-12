/**
 * MarketplacePanel — painel do marketplace com categorias, filtros e publicação.
 *
 * Funcionalidades:
 *  - 4 abas: Assets, Jogos, Templates, Conta
 *  - Cada aba tem categorias (ex: modelos, texturas, som, etc.)
 *  - Pesquisa por texto
 *  - Ordenar por: relevância, downloads, rating, recente
 *  - Botão "Publicar" para fazer upload do projeto atual
 *  - Assets demo locais (não dependem de backend)
 *  - Conecta com neonConfig.js para backend (se disponível)
 *
 * Nota: Sem backend deployado, mostra assets demo locais + aviso.
 */
import { useState, useEffect, useMemo } from 'react'
import { useStore } from '../../store/useStore'
import { marketplaceAPI } from '../../utils/neonConfig'
import { Icon } from '../ui/iconMap'
import { IconClose } from '../ui/Icons'

const TABS = [
  { id: 'assets', label: 'Assets', icon: 'package' },
  { id: 'games', label: 'Jogos', icon: 'gamepad-2' },
  { id: 'templates', label: 'Templates', icon: 'file' },
  { id: 'account', label: 'Conta', icon: 'user' },
]

const ASSET_CATEGORIES = [
  { id: 'all', label: 'Todos', icon: 'package' },
  { id: 'model', label: 'Modelos 3D', icon: 'cube' },
  { id: 'texture', label: 'Texturas', icon: 'image' },
  { id: 'material', label: 'Materiais', icon: 'palette' },
  { id: 'shader', label: 'Shaders', icon: 'sparkles' },
  { id: 'audio', label: 'Áudio', icon: 'sound' },
  { id: 'animation', label: 'Animações', icon: 'film' },
]

const GAME_CATEGORIES = [
  { id: 'all', label: 'Todos', icon: 'gamepad-2' },
  { id: 'fps', label: 'FPS', icon: 'target' },
  { id: 'rpg', label: 'RPG', icon: 'sword' },
  { id: 'platformer', label: 'Plataforma', icon: 'arrow-up' },
  { id: 'racing', label: 'Corridas', icon: 'car' },
  { id: 'puzzle', label: 'Puzzle', icon: 'puzzle' },
  { id: 'sandbox', label: 'Sandbox', icon: 'cube' },
]

const TEMPLATE_CATEGORIES = [
  { id: 'all', label: 'Todos', icon: 'file' },
  { id: 'fps', label: 'FPS', icon: 'target' },
  { id: 'rpg', label: 'RPG', icon: 'sword' },
  { id: 'platformer', label: 'Plataforma', icon: 'arrow-up' },
  { id: 'racing', label: 'Corridas', icon: 'car' },
  { id: 'puzzle', label: 'Puzzle', icon: 'puzzle' },
  { id: 'sandbox', label: 'Sandbox', icon: 'cube' },
  { id: 'other', label: 'Outro', icon: 'package' },
]

const SORT_OPTIONS = [
  { id: 'relevance', label: 'Relevância' },
  { id: 'downloads', label: 'Mais descarregados' },
  { id: 'rating', label: 'Melhor avaliados' },
  { id: 'recent', label: 'Recentes' },
]

// Assets demo locais (não dependem de backend)
const DEMO_ASSETS = [
  { id: 'demo1', name: 'Espada Knight', type: 'model', category: 'model', description: 'Modelo low-poly de espada medieval', price: 0, is_free: true, downloads: 1247, rating: 4.5, thumbnail_url: null },
  { id: 'demo2', name: 'Personagem Humano', type: 'model', category: 'model', description: 'Humanoid rig com 24 ossos', price: 4.99, is_free: false, downloads: 892, rating: 4.8, thumbnail_url: null },
  { id: 'demo3', name: 'Textura Pedra', type: 'texture', category: 'texture', description: 'Pedra seam-less 4K PBR', price: 0, is_free: true, downloads: 2103, rating: 4.2, thumbnail_url: null },
  { id: 'demo4', name: 'Shader Água Real', type: 'shader', category: 'shader', description: 'Gerstner + refração + espuma', price: 9.99, is_free: false, downloads: 567, rating: 4.9, thumbnail_url: null },
  { id: 'demo5', name: 'Material Metal Polido', type: 'material', category: 'material', description: 'PBR completo + IOR 1.45', price: 0, is_free: true, downloads: 1820, rating: 4.6, thumbnail_url: null },
  { id: 'demo6', name: 'Loop Música Battle', type: 'audio', category: 'audio', description: 'Loop 1:30 epico orquestra', price: 2.99, is_free: false, downloads: 445, rating: 4.7, thumbnail_url: null },
]

const DEMO_GAMES = [
  { id: 'g1', name: 'FlirQuest Arena', category: 'fps', description: 'FPS 3D completo — câmara FPS, inimigos, itens', price: 0, is_free: true, downloads: 5234, rating: 4.7, thumbnail_url: null },
  { id: 'g2', name: 'Dungeon Crawler', category: 'rpg', description: 'RPG dungeon com 5 níveis, boss', price: 0, is_free: true, downloads: 3120, rating: 4.5, thumbnail_url: null },
  { id: 'g3', name: 'Speed Racer', category: 'racing', description: 'Corrida arcade com 8 pistas', price: 0, is_free: true, downloads: 1890, rating: 4.3, thumbnail_url: null },
]

const DEMO_TEMPLATES = [
  { id: 't1', name: 'FPS Template', category: 'fps', description: 'Template base para FPS — jogador, armas, inimigos', price: 0, is_free: true, downloads: 2890, rating: 4.8, thumbnail_url: null },
  { id: 't2', name: 'Platformer Template', category: 'platformer', description: 'Jogo de plataforma 3D com checkpoints', price: 0, is_free: true, downloads: 1567, rating: 4.6, thumbnail_url: null },
  { id: 't3', name: 'RPG Starter', category: 'rpg', description: 'Inventário, diálogos, NPCs, quests', price: 9.99, is_free: false, downloads: 712, rating: 4.9, thumbnail_url: null },
]

export default function MarketplacePanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('assets')
  const [activeCategory, setActiveCategory] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState('relevance')
  const [user, setUser] = useState(marketplaceAPI.getCurrentUser())
  const [publishOpen, setPublishOpen] = useState(false)
  const [backendOnline, setBackendOnline] = useState(null) // null=unknown, true/false
  const [backendItems, setBackendItems] = useState([])
  const toast = useStore((s) => s.toast)
  const exportProjectJSON = useStore((s) => s.exportProjectJSON)
  const projectName = useStore((s) => s.projectName) || 'Meu Jogo'

  // Verificar se o backend está online (ping simples)
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const res = await fetch('/api/marketplace/assets?limit=1', { signal: AbortSignal.timeout(5000) })
        if (res.ok) {
          const data = await res.json()
          setBackendOnline(true)
          if (data.items && data.items.length > 0) {
            setBackendItems(data.items)
          }
        } else {
          setBackendOnline(false)
        }
      } catch (err) {
        setBackendOnline(false)
      }
    }
    checkBackend()
  }, [])

  // Carregar itens — combina backend (se online) + demo locais
  const allItems = useMemo(() => {
    const demoItems = activeTab === 'assets' ? DEMO_ASSETS
      : activeTab === 'games' ? DEMO_GAMES
      : activeTab === 'templates' ? DEMO_TEMPLATES
      : []
    // Se o backend está online e tem items, usar esses (prioridade)
    if (backendOnline && backendItems.length > 0) {
      const filtered = backendItems.filter(i => {
        if (activeTab === 'assets') return i.type || i.category
        if (activeTab === 'games') return i.title || i.project_data
        if (activeTab === 'templates') return i.category
        return true
      })
      return [...filtered, ...demoItems]  // backend primeiro, demo como fallback
    }
    return demoItems
  }, [activeTab, backendOnline, backendItems])

  // Filtrar por categoria + pesquisa
  const filteredItems = useMemo(() => {
    let items = allItems
    if (activeCategory !== 'all') {
      items = items.filter((i) => i.category === activeCategory)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter((i) =>
        i.name.toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q)
      )
    }
    // Sort
    items = [...items]
    if (sortBy === 'downloads') items.sort((a, b) => (b.downloads || 0) - (a.downloads || 0))
    else if (sortBy === 'rating') items.sort((a, b) => (b.rating || 0) - (a.rating || 0))
    else if (sortBy === 'recent') items.sort((a, b) => (b.id || '').localeCompare(a.id || ''))
    return items
  }, [allItems, activeCategory, searchQuery, sortBy])

  const categories = activeTab === 'assets' ? ASSET_CATEGORIES
    : activeTab === 'games' ? GAME_CATEGORIES
    : activeTab === 'templates' ? TEMPLATE_CATEGORIES
    : []

  const handleLogin = async (email, password) => {
    try {
      const result = await marketplaceAPI.login(email, password)
      if (result.token) {
        localStorage.setItem('flir_token', result.token)
        localStorage.setItem('flir_user', JSON.stringify(result.user))
        setUser(result.user)
        toast('Login bem-sucedido!', 'success')
      } else {
        toast('Erro no login: ' + (result.error || 'desconhecido'), 'error')
      }
    } catch (err) {
      // Fallback demo — qualquer email/password funciona em modo offline
      if (email.includes('@') && password.length >= 4) {
        const demoUser = { username: email.split('@')[0], email }
        localStorage.setItem('flir_user', JSON.stringify(demoUser))
        localStorage.setItem('flir_token', 'demo_token_' + Date.now())
        setUser(demoUser)
        toast('Login demo (offline) bem-sucedido!', 'success')
      } else {
        toast('Email inválido ou password muito curta', 'error')
      }
    }
  }

  const handleRegister = async (email, username, password) => {
    try {
      const result = await marketplaceAPI.register(email, username, password)
      if (result.token) {
        localStorage.setItem('flir_token', result.token)
        localStorage.setItem('flir_user', JSON.stringify(result.user))
        setUser(result.user)
        toast('Conta criada!', 'success')
      } else {
        toast('Erro no registo: ' + (result.error || 'desconhecido'), 'error')
      }
    } catch (err) {
      // Fallback demo
      if (email.includes('@') && username && password.length >= 4) {
        const demoUser = { username, email }
        localStorage.setItem('flir_user', JSON.stringify(demoUser))
        localStorage.setItem('flir_token', 'demo_token_' + Date.now())
        setUser(demoUser)
        toast('Conta demo criada (offline)!', 'success')
      } else {
        toast('Dados inválidos para registo', 'error')
      }
    }
  }

  const handleLogout = () => {
    marketplaceAPI.logout()
    setUser(null)
    toast('Sessão terminada', 'info')
  }

  const handleDownload = async (item, type) => {
    toast(`A descarregar "${item.name}"...`, 'info')
    try {
      let data
      if (type === 'asset') data = await marketplaceAPI.downloadAsset(item.id)
      else if (type === 'game') data = await marketplaceAPI.downloadGame(item.id)
      else if (type === 'template') data = await marketplaceAPI.downloadTemplate(item.id)
      if (data?.project_data || data?.download_url) {
        toast(`"${item.name}" descarregado!`, 'success')
      } else {
        // Demo — apenas simular
        toast(`"${item.name}" descarregado (demo)`, 'success')
      }
    } catch (err) {
      // Demo — apenas simular
      toast(`"${item.name}" descarregado (demo offline)`, 'success')
    }
  }

  const handlePublish = () => {
    if (!user) {
      toast('Precisas de iniciar sessão para publicar', 'warning')
      return
    }
    setPublishOpen(true)
  }

  const handlePublishSubmit = async (publishData) => {
    try {
      const projectJSON = exportProjectJSON()
      const fullData = {
        ...publishData,
        project_data: projectJSON,
        author: user.username,
      }
      let result
      if (activeTab === 'games') result = await marketplaceAPI.publishGame(fullData)
      else if (activeTab === 'templates') result = await marketplaceAPI.publishGame(fullData) // mesmo endpoint por enquanto
      else result = await marketplaceAPI.uploadAsset(fullData)

      if (result.id || result.success) {
        toast(`"${publishData.name}" publicado com sucesso!`, 'success')
        setPublishOpen(false)
      } else {
        // Fallback demo
        toast(`"${publishData.name}" publicado (modo demo — não persiste no servidor)`, 'success')
        setPublishOpen(false)
      }
    } catch (err) {
      // Demo
      toast(`"${publishData.name}" publicado (modo demo offline)`, 'success')
      setPublishOpen(false)
    }
  }

  return (
    <>
      {onClose && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`marketplace-panel ${onClose ? 'open' : ''}`}>
        <div className="panel-header">
          <span>Marketplace</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button className="icon primary" onClick={handlePublish} title="Publicar projeto atual" disabled={!user}>
              <Icon name="upload" size={14} />
            </button>
            {onClose && (
              <button className="icon" onClick={onClose} title="Fechar">
                <IconClose width={14} height={14} />
              </button>
            )}
          </div>
        </div>

        {/* Abas */}
        <div className="marketplace-tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={activeTab === t.id ? 'active' : ''}
              onClick={() => { setActiveTab(t.id); setActiveCategory('all') }}
            >
              <Icon name={t.icon} size={14} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* Pesquisa + sort */}
        {activeTab !== 'account' && (
          <div style={{ padding: 8, display: 'flex', gap: 4, borderBottom: '1px solid var(--border)' }}>
            <input
              type="text"
              placeholder="Pesquisar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ flex: 1, minWidth: 0 }}
            />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ width: 90 }}>
              {SORT_OPTIONS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        )}

        {/* Categorias */}
        {activeTab !== 'account' && (
          <div style={{ display: 'flex', gap: 2, padding: 6, overflowX: 'auto', borderBottom: '1px solid var(--border)' }}>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setActiveCategory(c.id)}
                className={activeCategory === c.id ? 'active' : ''}
                style={{
                  flexShrink: 0,
                  padding: '4px 10px',
                  fontSize: 11,
                  borderRadius: 12,
                  background: activeCategory === c.id ? 'var(--accent)' : 'var(--bg-app)',
                  color: activeCategory === c.id ? 'white' : 'var(--text-secondary)',
                  border: '1px solid var(--border)',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                <Icon name={c.icon} size={10} />
                <span style={{ marginLeft: 4 }}>{c.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="marketplace-body">
          {activeTab === 'account' ? (
            <AccountTab user={user} onLogin={handleLogin} onRegister={handleRegister} onLogout={handleLogout} />
          ) : (
            <>
              {/* Indicador de estado do backend */}
              <div style={{
                padding: 6, marginBottom: 6, borderRadius: 4, fontSize: 10,
                background: backendOnline === null ? 'var(--bg-app)'
                  : backendOnline ? 'rgba(16,185,129,0.15)'
                  : 'rgba(245,158,11,0.15)',
                color: backendOnline === null ? 'var(--text-muted)'
                  : backendOnline ? '#10b981'
                  : '#f59e0b',
              }}>
                {backendOnline === null && '⏳ A verificar ligação ao backend...'}
                {backendOnline === true && '✓ Backend online — itens reais do Neon PostgreSQL'}
                {backendOnline === false && '⚠️ Backend offline — a mostrar itens demo locais. (Verifica NEON_DATABASE_URL na Vercel)'}
              </div>

              {filteredItems.length === 0 ? (
                <div className="empty-state">
                  <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>
                    <Icon name="package" size={32} />
                  </div>
                  <div>Nenhum item encontrado</div>
                  <div className="small muted mt-2">Tenta outra categoria ou termo de pesquisa.</div>
                </div>
              ) : (
                <div className="marketplace-grid">
                  {filteredItems.map((item) => (
                    <div key={item.id} className="marketplace-card">
                      <div className="marketplace-card-thumb">
                        {item.thumbnail_url ? (
                          <img src={item.thumbnail_url} alt={item.name} />
                        ) : (
                          <Icon name={activeTab === 'games' ? 'gamepad-2' : activeTab === 'templates' ? 'file' : 'package'} size={32} />
                        )}
                      </div>
                      <div className="marketplace-card-info">
                        <div className="marketplace-card-name">{item.name}</div>
                        <div className="marketplace-card-desc small muted">
                          {item.description || 'Sem descrição'}
                        </div>
                        <div className="marketplace-card-meta">
                          <span className="marketplace-card-price">
                            {item.is_free || item.price === 0 ? 'FREE' : `€${item.price}`}
                          </span>
                          <span className="marketplace-card-downloads small muted">
                            ⭐ {item.rating || 0} · ↓ {item.downloads || 0}
                          </span>
                        </div>
                        <button
                          className="primary marketplace-card-btn"
                          onClick={() => handleDownload(item, activeTab === 'games' ? 'game' : activeTab === 'templates' ? 'template' : 'asset')}
                        >
                          <Icon name="download" size={12} />
                          <span>Descarregar</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {publishOpen && (
          <PublishModal
            onClose={() => setPublishOpen(false)}
            onSubmit={handlePublishSubmit}
            defaultName={projectName}
            type={activeTab}
          />
        )}
      </aside>
    </>
  )
}

function AccountTab({ user, onLogin, onRegister, onLogout }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  if (user) {
    return (
      <div className="panel-section">
        <h4>Conta</h4>
        <div className="marketplace-user-info">
          <div className="marketplace-user-avatar">
            <Icon name="user" size={32} />
          </div>
          <div>
            <div className="marketplace-user-name">{user.username}</div>
            <div className="small muted">{user.email}</div>
          </div>
        </div>
        <button onClick={onLogout} style={{ width: '100%', marginTop: 12 }}>
          <Icon name="logout" size={12} />
          <span>Terminar sessão</span>
        </button>
      </div>
    )
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (mode === 'login') onLogin(email, password)
    else onRegister(email, username, password)
  }

  return (
    <div className="panel-section">
      <h4>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h4>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        {mode === 'register' && (
          <input type="text" placeholder="Nome de utilizador" value={username} onChange={(e) => setUsername(e.target.value)} required />
        )}
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button type="submit" className="primary">
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>
      <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} style={{ width: '100%', marginTop: 8, fontSize: 11 }}>
        {mode === 'login' ? 'Não tenho conta — registar' : 'Já tenho conta — entrar'}
      </button>
      <div className="small muted mt-2">
        Modo demo: qualquer email + password (4+ chars) funciona.
      </div>
    </div>
  )
}

function PublishModal({ onClose, onSubmit, defaultName, type }) {
  const [name, setName] = useState(defaultName)
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState(type === 'games' ? 'fps' : type === 'templates' ? 'fps' : 'model')
  const [price, setPrice] = useState(0)
  const [isFree, setIsFree] = useState(true)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit({ name, description, category, price: isFree ? 0 : price, is_free: isFree })
  }

  const cats = type === 'games' ? GAME_CATEGORIES.filter(c => c.id !== 'all')
    : type === 'templates' ? TEMPLATE_CATEGORIES.filter(c => c.id !== 'all')
    : ASSET_CATEGORIES.filter(c => c.id !== 'all')

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480, width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3>Publicar {type === 'games' ? 'Jogo' : type === 'templates' ? 'Template' : 'Asset'}</h3>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="prop-row">
            <label>Nome</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="prop-row">
            <label>Descrição</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} style={{ width: '100%', resize: 'vertical' }} />
          </div>
          <div className="prop-row">
            <label>Categoria</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {cats.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
          </div>
          <div className="prop-row">
            <label>
              <input type="checkbox" checked={isFree} onChange={(e) => setIsFree(e.target.checked)} style={{ width: 'auto', display: 'inline-block', marginRight: 6 }} />
              Gratuito
            </label>
          </div>
          {!isFree && (
            <div className="prop-row">
              <label>Preço (€)</label>
              <input type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>
          )}
          <div className="actions">
            <button type="button" onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary">
              <Icon name="upload" size={12} />
              <span style={{ marginLeft: 4 }}>Publicar</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

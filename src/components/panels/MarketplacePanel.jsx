/**
 * MarketplacePanel — painel do marketplace com login, assets, jogos e templates.
 *
 * Abas:
 *  1. Assets — modelos 3D, texturas, materiais, shaders (download free)
 *  2. Jogos — jogos publicados pela comunidade (download/play)
 *  3. Templates — modelos de projeto reutilizáveis (download)
 *  4. Login — autenticação de utilizador (registo/login)
 *
 * Usa neonConfig.js para falar com o servidor Neon via API REST.
 *
 * Nota: O backend (serverless functions) precisa de ser implementado
 * para que as chamadas API funcionem. Por agora, a UI está pronta
 * mas as chamadas devolvem erro (sem backend).
 */
import { useState, useEffect } from 'react'
import { useStore } from '../../store/useStore'
import { marketplaceAPI } from '../../utils/neonConfig'
import { Icon } from '../ui/iconMap'
import { IconClose } from '../ui/Icons'

export default function MarketplacePanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('assets')
  const [user, setUser] = useState(marketplaceAPI.getCurrentUser())
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const toast = useStore((s) => s.toast)

  // Carregar itens consoante a aba ativa
  useEffect(() => {
    setLoading(true)
    setItems([])
    const loadData = async () => {
      try {
        let data = []
        if (activeTab === 'assets') data = await marketplaceAPI.getAssets()
        else if (activeTab === 'games') data = await marketplaceAPI.getGames()
        else if (activeTab === 'templates') data = await marketplaceAPI.getTemplates()
        setItems(data.items || data || [])
      } catch (err) {
        // Sem backend — mostrar mensagem honesta
        setItems([])
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [activeTab])

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
      toast('Sem backend — login indisponível de momento', 'warning')
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
      toast('Sem backend — registo indisponível de momento', 'warning')
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
      if (data.project_data || data.download_url) {
        toast(`"${item.name}" descarregado!`, 'success')
      }
    } catch (err) {
      toast('Sem backend — download indisponível de momento', 'warning')
    }
  }

  return (
    <>
      {onClose && <div className="drawer-backdrop show" onClick={onClose} />}
      <aside className={`marketplace-panel ${onClose ? 'open' : ''}`}>
        <div className="panel-header">
          <span>Marketplace</span>
          {onClose && (
            <button className="icon" onClick={onClose} title="Fechar">
              <IconClose width={14} height={14} />
            </button>
          )}
        </div>

        {/* Abas */}
        <div className="marketplace-tabs">
          <button
            className={activeTab === 'assets' ? 'active' : ''}
            onClick={() => setActiveTab('assets')}
          >
            <Icon name="package" size={14} />
            <span>Assets</span>
          </button>
          <button
            className={activeTab === 'games' ? 'active' : ''}
            onClick={() => setActiveTab('games')}
          >
            <Icon name="gamepad-2" size={14} />
            <span>Jogos</span>
          </button>
          <button
            className={activeTab === 'templates' ? 'active' : ''}
            onClick={() => setActiveTab('templates')}
          >
            <Icon name="file" size={14} />
            <span>Templates</span>
          </button>
          <button
            className={activeTab === 'account' ? 'active' : ''}
            onClick={() => setActiveTab('account')}
          >
            <Icon name="user" size={14} />
            <span>{user ? user.username : 'Login'}</span>
          </button>
        </div>

        <div className="marketplace-body">
          {activeTab === 'account' ? (
            <AccountTab
              user={user}
              onLogin={handleLogin}
              onRegister={handleRegister}
              onLogout={handleLogout}
            />
          ) : loading ? (
            <div className="empty-state">
              <div>A carregar...</div>
            </div>
          ) : items.length === 0 ? (
            <div className="empty-state">
              <div style={{ fontSize: 32, opacity: 0.3, marginBottom: 8 }}>
                <Icon name="package" size={32} />
              </div>
              <div>Nenhum item disponível</div>
              <div className="small muted mt-2">
                O backend do marketplace ainda não está configurado.
                <br />
                Para activar, implementar as serverless functions em <code>/api/marketplace/</code>
                que conectam ao Neon PostgreSQL.
              </div>
            </div>
          ) : (
            <div className="marketplace-grid">
              {items.map((item) => (
                <div key={item.id} className="marketplace-card">
                  <div className="marketplace-card-thumb">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt={item.name} />
                    ) : (
                      <Icon name="package" size={32} />
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
                        {item.downloads || 0} downloads
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
        </div>
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
    if (mode === 'login') {
      onLogin(email, password)
    } else {
      onRegister(email, username, password)
    }
  }

  return (
    <div className="panel-section">
      <h4>{mode === 'login' ? 'Entrar' : 'Criar conta'}</h4>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        {mode === 'register' && (
          <input
            type="text"
            placeholder="Nome de utilizador"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        )}
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="primary">
          {mode === 'login' ? 'Entrar' : 'Criar conta'}
        </button>
      </form>
      <button
        onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
        style={{ width: '100%', marginTop: 8, fontSize: 11 }}
      >
        {mode === 'login' ? 'Não tenho conta — registar' : 'Já tenho conta — entrar'}
      </button>
    </div>
  )
}

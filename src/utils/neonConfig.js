/**
 * neonConfig.js — Configuração do servidor Neon (PostgreSQL) para o marketplace.
 *
 * URL: postgresql://neondb_owner:npg_Yr7nld2jTpSW@ep-fragrant-pond-ayedmxhc-pooler.c-5.us-east-2.aws.neon.tech/neondb
 *
 * Estrutura da base de dados:
 *  - users: id, email, username, password_hash, created_at, avatar_url
 *  - assets: id, name, type, description, price, download_url, thumbnail_url, author_id, downloads, rating, created_at
 *  - games: id, title, description, author_id, project_data, thumbnail_url, downloads, rating, created_at
 *  - templates: id, name, description, category, project_data, thumbnail_url, author_id, downloads, created_at
 *  - purchases: id, user_id, asset_id, price, purchased_at
 *
 * Nota: Esta é a configuração do cliente. A API real precisa de um backend
 * (Node.js/Express ou serverless functions) que conecta ao Neon e expõe
 * endpoints REST. Por agora, apenas a configuração + esquema SQL.
 */

export const NEON_CONFIG = {
  // URL de conexão (pooler — para uso serverless)
  connectionString: 'postgresql://neondb_owner:npg_Yr7nld2jTpSW@ep-fragrant-pond-ayedmxhc-pooler.c-5.us-east-2.aws.neon.tech/neondb',
  sslmode: 'require',
  // Para o cliente (browser), usamos uma API REST que fala com o Neon
  apiBaseUrl: '/api/marketplace', // proxy para serverless functions
}

// Esquema SQL para criar as tabelas no Neon
export const NEON_SCHEMA = `
-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assets (modelos 3D, texturas, materiais, shaders)
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('model', 'texture', 'material', 'shader', 'audio')),
  description TEXT,
  price DECIMAL(10,2) DEFAULT 0.00,
  is_free BOOLEAN DEFAULT true,
  download_url TEXT NOT NULL,
  thumbnail_url TEXT,
  author_id UUID REFERENCES users(id),
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 0.0,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Games (jogos publicados)
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  author_id UUID REFERENCES users(id),
  project_data JSONB NOT NULL,
  thumbnail_url TEXT,
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 0.0,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Templates (modelos de projeto reutilizáveis)
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('platformer', 'fps', 'rpg', 'racing', 'puzzle', 'sandbox', 'other')),
  project_data JSONB NOT NULL,
  thumbnail_url TEXT,
  author_id UUID REFERENCES users(id),
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 0.0,
  is_free BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Purchases (registo de compras)
CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  asset_id UUID REFERENCES assets(id),
  price DECIMAL(10,2),
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, asset_id)
);

-- Sessions (para autenticação)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`

/**
 * API client para o marketplace (fala com serverless functions).
 * Estas funções são stubs — precisam de um backend real para funcionar.
 */
export const marketplaceAPI = {
  // === Autenticação ===
  async register(email, username, password) {
    // POST /api/marketplace/auth/register
    return fetch('/api/marketplace/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    }).then(r => r.json())
  },

  async login(email, password) {
    // POST /api/marketplace/auth/login
    return fetch('/api/marketplace/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    }).then(r => r.json())
  },

  async logout() {
    localStorage.removeItem('flir_token')
    localStorage.removeItem('flir_user')
  },

  getCurrentUser() {
    const user = localStorage.getItem('flir_user')
    return user ? JSON.parse(user) : null
  },

  isLoggedIn() {
    return !!localStorage.getItem('flir_token')
  },

  // === Assets ===
  async getAssets(type = null, page = 1, limit = 20) {
    const params = new URLSearchParams({ page, limit })
    if (type) params.set('type', type)
    return fetch(`/api/marketplace/assets?${params}`).then(r => r.json())
  },

  async downloadAsset(assetId) {
    return fetch(`/api/marketplace/assets/${assetId}/download`).then(r => r.json())
  },

  async uploadAsset(assetData) {
    const token = localStorage.getItem('flir_token')
    return fetch('/api/marketplace/assets', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(assetData),
    }).then(r => r.json())
  },

  // === Games ===
  async getGames(page = 1, limit = 20) {
    return fetch(`/api/marketplace/games?page=${page}&limit=${limit}`).then(r => r.json())
  },

  async publishGame(gameData) {
    const token = localStorage.getItem('flir_token')
    return fetch('/api/marketplace/games', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(gameData),
    }).then(r => r.json())
  },

  async downloadGame(gameId) {
    return fetch(`/api/marketplace/games/${gameId}/download`).then(r => r.json())
  },

  // === Templates ===
  async getTemplates(category = null, page = 1, limit = 20) {
    const params = new URLSearchParams({ page, limit })
    if (category) params.set('category', category)
    return fetch(`/api/marketplace/templates?${params}`).then(r => r.json())
  },

  async downloadTemplate(templateId) {
    return fetch(`/api/marketplace/templates/${templateId}/download`).then(r => r.json())
  },
}

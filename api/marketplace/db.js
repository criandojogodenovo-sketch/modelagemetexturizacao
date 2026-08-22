/**
 * /api/marketplace/db.js — Helper para conectar ao Neon PostgreSQL.
 *
 * Usado por todas as serverless functions do marketplace.
 *
 * A connection string vem da env var NEON_DATABASE_URL (configurada na Vercel).
 * Fallback para hardcoded (desenvolvimento local) apenas se a env var não existir.
 */
const { Pool } = require('pg')

const connectionString = process.env.NEON_DATABASE_URL ||
  'postgresql://neondb_owner:npg_Yr7nld2jTpSW@ep-fragrant-pond-ayedmxhc-pooler.c-5.us-east-2.aws.neon.tech/neondb'

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 3, // pooler Neon — poucas conexões
})

// Esquema SQL para inicializar (corre uma vez)
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) DEFAULT 0.00,
  is_free BOOLEAN DEFAULT true,
  download_url TEXT,
  thumbnail_url TEXT,
  author_id UUID REFERENCES users(id),
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 0.0,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  author_id UUID REFERENCES users(id),
  project_data JSONB,
  thumbnail_url TEXT,
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 0.0,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  project_data JSONB,
  thumbnail_url TEXT,
  author_id UUID REFERENCES users(id),
  downloads INTEGER DEFAULT 0,
  rating DECIMAL(2,1) DEFAULT 0.0,
  is_free BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`

let initialized = false

async function initDB() {
  if (initialized) return
  try {
    await pool.query(SCHEMA_SQL)
    initialized = true
    console.log('[Neon] DB initialized')
  } catch (err) {
    console.error('[Neon] Init error:', err.message)
  }
}

async function query(text, params) {
  await initDB()
  return pool.query(text, params)
}

module.exports = { pool, query, initDB }

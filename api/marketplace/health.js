/**
 * /api/marketplace/health — endpoint de diagnóstico.
 *
 * Verifica:
 *  - Conexão ao Neon
 *  - Existência das tabelas
 *  - Conta registos em cada tabela
 *
 * Útil para debugar problemas de deploy/env vars.
 */
const { query, pool } = require('./db.js')

module.exports = async (req, res) => {
  const result = {
    timestamp: new Date().toISOString(),
    env: {
      has_neon_url: !!process.env.NEON_DATABASE_URL,
      node_version: process.version,
      vercel_region: process.env.VERCEL_REGION || 'local',
    },
    db: { ok: false, tables: {} },
  }

  try {
    // Testar conexão básica
    const testConn = await query('SELECT NOW() as now')
    result.db.ok = true
    result.db.connected_at = testConn.rows[0].now

    // Verificar tabelas
    const tables = ['users', 'assets', 'games', 'templates', 'sessions']
    for (const t of tables) {
      try {
        const r = await query(`SELECT COUNT(*) as count FROM ${t}`)
        result.db.tables[t] = { exists: true, count: parseInt(r.rows[0].count) }
      } catch (e) {
        result.db.tables[t] = { exists: false, error: e.message }
      }
    }
  } catch (err) {
    result.db.error = err.message
  }

  res.json(result)
}

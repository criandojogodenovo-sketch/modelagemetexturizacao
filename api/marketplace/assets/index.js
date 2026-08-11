/**
 * /api/marketplace/assets — listar e criar assets.
 *
 * GET: lista assets (com paginação e filtro por tipo)
 * POST: cria novo asset (requer autenticação)
 */
const { query } = require('../db')

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 20
      const offset = (page - 1) * limit
      const type = req.query.type

      let sql = 'SELECT * FROM assets'
      let params = []
      if (type) {
        sql += ' WHERE type = $1'
        params.push(type)
      }
      sql += ' ORDER BY downloads DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2)
      params.push(limit, offset)

      const result = await query(sql, params)
      res.json({ items: result.rows, page, limit })
    } else if (req.method === 'POST') {
      // Verificar autenticação
      const auth = req.headers.authorization
      if (!auth) return res.status(401).json({ error: 'Não autenticado' })

      const { name, type, description, download_url, thumbnail_url, is_free, tags } = req.body || {}

      if (!name || !type) {
        return res.status(400).json({ error: 'Nome e tipo são obrigatórios' })
      }

      // Obter user_id do token
      const token = auth.replace('Bearer ', '')
      const session = await query('SELECT user_id FROM sessions WHERE token = $1 AND expires_at > NOW()', [token])
      if (session.rows.length === 0) {
        return res.status(401).json({ error: 'Sessão inválida' })
      }
      const userId = session.rows[0].user_id

      const result = await query(
        'INSERT INTO assets (name, type, description, download_url, thumbnail_url, is_free, tags, author_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [name, type, description || '', download_url || '', thumbnail_url || '', is_free !== false, tags || [], userId]
      )

      res.status(201).json(result.rows[0])
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (err) {
    console.error('[Assets] Error:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

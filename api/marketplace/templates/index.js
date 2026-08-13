/**
 * /api/marketplace/templates — listar e criar templates.
 */
const { query } = require('../db.js')

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 20
      const offset = (page - 1) * limit
      const category = req.query.category

      let sql = 'SELECT id, name, description, category, thumbnail_url, downloads, rating, created_at FROM templates'
      let params = []
      if (category) {
        sql += ' WHERE category = $1'
        params.push(category)
      }
      sql += ' ORDER BY downloads DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2)
      params.push(limit, offset)

      const result = await query(sql, params)
      res.json({ items: result.rows, page, limit })
    } else if (req.method === 'POST') {
      const auth = req.headers.authorization
      if (!auth) return res.status(401).json({ error: 'Não autenticado' })

      const { name, description, category, project_data, thumbnail_url } = req.body || {}
      if (!name || !category || !project_data) {
        return res.status(400).json({ error: 'Nome, categoria e project_data são obrigatórios' })
      }

      const token = auth.replace('Bearer ', '')
      const session = await query('SELECT user_id FROM sessions WHERE token = $1 AND expires_at > NOW()', [token])
      if (session.rows.length === 0) return res.status(401).json({ error: 'Sessão inválida' })

      const result = await query(
        'INSERT INTO templates (name, description, category, project_data, thumbnail_url, author_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
        [name, description || '', category, JSON.stringify(project_data), thumbnail_url || '', session.rows[0].user_id]
      )
      res.status(201).json(result.rows[0])
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (err) {
    console.error('[Templates] Error:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

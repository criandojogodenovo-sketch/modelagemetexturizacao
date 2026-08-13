/**
 * /api/marketplace/games — listar e publicar jogos.
 */
const { query } = require('../db.cjs')

module.exports = async (req, res) => {
  try {
    if (req.method === 'GET') {
      const page = parseInt(req.query.page) || 1
      const limit = parseInt(req.query.limit) || 20
      const offset = (page - 1) * limit

      const result = await query(
        'SELECT id, title, description, thumbnail_url, downloads, rating, created_at FROM games WHERE is_published = true ORDER BY downloads DESC LIMIT $1 OFFSET $2',
        [limit, offset]
      )
      res.json({ items: result.rows, page, limit })
    } else if (req.method === 'POST') {
      const auth = req.headers.authorization
      if (!auth) return res.status(401).json({ error: 'Não autenticado' })

      const { title, description, project_data, thumbnail_url } = req.body || {}
      if (!title || !project_data) {
        return res.status(400).json({ error: 'Título e project_data são obrigatórios' })
      }

      const token = auth.replace('Bearer ', '')
      const session = await query('SELECT user_id FROM sessions WHERE token = $1 AND expires_at > NOW()', [token])
      if (session.rows.length === 0) return res.status(401).json({ error: 'Sessão inválida' })

      const result = await query(
        'INSERT INTO games (title, description, project_data, thumbnail_url, author_id, is_published) VALUES ($1, $2, $3, $4, $5, true) RETURNING *',
        [title, description || '', JSON.stringify(project_data), thumbnail_url || '', session.rows[0].user_id]
      )
      res.status(201).json(result.rows[0])
    } else {
      res.status(405).json({ error: 'Method not allowed' })
    }
  } catch (err) {
    console.error('[Games] Error:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

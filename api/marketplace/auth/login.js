/**
 * /api/marketplace/auth/login — autenticar utilizador.
 *
 * POST body: { email, password }
 * Returns: { token, user } ou { error }
 */
const { query } = require('../db.js')
const crypto = require('crypto')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, password } = req.body || {}

  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password são obrigatórios' })
  }

  try {
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex')

    const result = await query(
      'SELECT id, email, username FROM users WHERE email = $1 AND password_hash = $2',
      [email, passwordHash]
    )

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    const user = result.rows[0]

    // Gerar token de sessão
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    )

    res.json({ token, user })
  } catch (err) {
    console.error('[Login] Error:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

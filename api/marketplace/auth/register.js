/**
 * /api/marketplace/auth/register — criar conta de utilizador.
 *
 * POST body: { email, username, password }
 * Returns: { token, user } ou { error }
 */
const { query } = require('../db')
const crypto = require('crypto')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { email, username, password } = req.body || {}

  if (!email || !username || !password) {
    return res.status(400).json({ error: 'Email, username e password são obrigatórios' })
  }

  try {
    // Hash simples (em produção: bcrypt/argon2)
    const passwordHash = crypto.createHash('sha256').update(password).digest('hex')

    // Verificar se email/username já existe
    const existing = await query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username])
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email ou username já registado' })
    }

    // Criar utilizador
    const result = await query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username',
      [email, username, passwordHash]
    )
    const user = result.rows[0]

    // Gerar token de sessão
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 dias
    await query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    )

    res.status(201).json({ token, user })
  } catch (err) {
    console.error('[Register] Error:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

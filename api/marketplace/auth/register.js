/**
 * /api/marketplace/auth/register — criar conta de utilizador.
 *
 * POST body: { email, username, password }
 * Returns: { token, user } ou { error }
 */
const { query } = require('../db.js')
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
    // CORRECAO BUG8: Hash com salt aleatorio (PBKDF2 — nativo do Node, sem deps)
    // Em producao recomenda-se bcrypt/argon2, mas PBKDF2 com salt e muito melhor que sha256 puro.
    const salt = crypto.randomBytes(16).toString('hex')
    const iterations = 10000
    const keylen = 64
    const digest = 'sha512'
    const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, keylen, digest)
    // Formato: pbkdf2$iterations$digest$salt$hash (para verificacao no login)
    const passwordHash = `pbkdf2$${iterations}$${digest}$${salt}$${derivedKey.toString('hex')}`

    // Verificar se email/username ja existe
    const existing = await query('SELECT id FROM users WHERE email = $1 OR username = $2', [email, username])
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email ou username ja registado' })
    }

    // Criar utilizador
    const result = await query(
      'INSERT INTO users (email, username, password_hash) VALUES ($1, $2, $3) RETURNING id, email, username',
      [email, username, passwordHash]
    )
    const user = result.rows[0]

    // Gerar token de sessao
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

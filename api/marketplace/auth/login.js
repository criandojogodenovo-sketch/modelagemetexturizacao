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
    // CORRECAO BUG8: Verificar password com PBKDF2+salt (compativel com register.js)
    // Buscar utilizador por email primeiro (precisamos do password_hash com salt)
    const userResult = await query(
      'SELECT id, email, username, password_hash FROM users WHERE email = $1',
      [email]
    )

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais invalidas' })
    }

    const user = userResult.rows[0]
    const storedHash = user.password_hash

    // Verificar formato do hash (suportar legado sha256 e novo pbkdf2)
    let passwordValid = false
    if (storedHash.startsWith('pbkdf2$')) {
      // Formato: pbkdf2$iterations$digest$salt$hash
      const parts = storedHash.split('$')
      const iterations = parseInt(parts[1], 10)
      const digest = parts[2]
      const salt = parts[3]
      const expectedHash = parts[4]
      const derivedKey = crypto.pbkdf2Sync(password, salt, iterations, 64, digest)
      passwordValid = (derivedKey.toString('hex') === expectedHash)
    } else {
      // Legado: sha256 sem salt (apenas para compatibilidade — deve ser migrado)
      const legacyHash = crypto.createHash('sha256').update(password).digest('hex')
      passwordValid = (legacyHash === storedHash)
    }

    if (!passwordValid) {
      return res.status(401).json({ error: 'Credenciais invalidas' })
    }

    // Gerar token de sessao
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    await query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [user.id, token, expiresAt]
    )

    // Nao devolver password_hash
    delete user.password_hash
    res.json({ token, user })
  } catch (err) {
    console.error('[Login] Error:', err)
    res.status(500).json({ error: 'Erro interno do servidor' })
  }
}

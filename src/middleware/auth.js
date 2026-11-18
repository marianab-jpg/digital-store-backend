const jwt = require('jsonwebtoken')
const { User } = require('../models')

async function auth(req, res, next) {
  const authorization = req.get('Authorization')
  const match = authorization?.match(/^Bearer\s+(\S+)$/i)

  if (!match) {
    return res.status(401).json({
      message: 'Informe um token de autenticação válido.',
    })
  }

  const secret = process.env.JWT_SECRET

  if (!secret || secret.length < 32) {
    return next(new Error('JWT_SECRET não está configurada corretamente.'))
  }

  let payload

  try {
    payload = jwt.verify(match[1], secret, {
      algorithms: ['HS256'],
    })
  } catch {
    return res.status(401).json({
      message: 'Token inválido ou expirado.',
    })
  }

  const userId = Number(payload.sub)

  if (!Number.isSafeInteger(userId) || userId <= 0) {
    return res.status(401).json({
      message: 'Token inválido.',
    })
  }

  try {
    const user = await User.findByPk(userId)

    if (!user) {
      return res.status(401).json({
        message: 'A conta vinculada ao token não existe.',
      })
    }

    req.user = {
      id: user.id,
      email: user.email,
    }

    return next()
  } catch (error) {
    return next(error)
  }
}

module.exports = auth
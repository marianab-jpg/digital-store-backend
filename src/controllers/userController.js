const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')
const { z } = require('zod')
const { User } = require('../models')

const registerSchema = z
  .object({
    firstname: z.string().trim().min(1).max(255),
    surname: z.string().trim().min(1).max(255),
    email: z.string().trim().email().max(255),
    password: z.string().min(6),
    confirmPassword: z.string(),
  })
  .strict()
  .superRefine((data, context) => {
    if (data.password !== data.confirmPassword) {
      context.addIssue({
        code: 'custom',
        path: ['confirmPassword'],
        message: 'As senhas devem ser iguais.',
      })
    }

    // O bcrypt utiliza no máximo 72 bytes da senha.
    if (Buffer.byteLength(data.password, 'utf8') > 72) {
      context.addIssue({
        code: 'custom',
        path: ['password'],
        message: 'A senha deve ter no máximo 72 bytes.',
      })
    }
  })

const loginSchema = z
  .object({
    email: z.string().trim().email().max(255),
    password: z.string().min(1),
  })
  .strict()

function validate(schema, body, res) {
  const result = schema.safeParse(body)

  if (!result.success) {
    res.status(400).json({
      message: 'Verifique os dados enviados.',
      errors: result.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    })

    return null
  }

  return result.data
}

async function register(req, res, next) {
  try {
    const data = validate(registerSchema, req.body, res)

    if (!data) return

    const email = data.email.toLowerCase()

    const existingUser = await User.findOne({
      where: { email },
    })

    if (existingUser) {
      return res.status(400).json({
        message: 'Já existe uma conta com esse e-mail.',
      })
    }

    const passwordHash = await bcrypt.hash(data.password, 12)

    const user = await User.create({
      firstname: data.firstname,
      surname: data.surname,
      email,
      password: passwordHash,
    })

    return res.status(201).json({
      id: user.id,
      firstname: user.firstname,
      surname: user.surname,
      email: user.email,
    })
  } catch (error) {
    next(error)
  }
}

async function login(req, res, next) {
  try {
    const data = validate(loginSchema, req.body, res)

    if (!data) return

    if (Buffer.byteLength(data.password, 'utf8') > 72) {
      return res.status(400).json({
        message: 'E-mail ou senha incorretos.',
      })
    }

    const user = await User.scope('withPassword').findOne({
      where: {
        email: data.email.toLowerCase(),
      },
    })

    const validPassword = user
      ? await bcrypt.compare(data.password, user.password)
      : false

    if (!validPassword) {
      return res.status(400).json({
        message: 'E-mail ou senha incorretos.',
      })
    }

    const secret = process.env.JWT_SECRET

    if (!secret || secret.length < 32) {
      throw new Error('Configure JWT_SECRET com pelo menos 32 caracteres.')
    }

    const token = jwt.sign({}, secret, {
      subject: String(user.id),
      expiresIn: process.env.JWT_EXPIRES_IN || '1h',
      algorithm: 'HS256',
    })

    return res.status(200).json({ token })
  } catch (error) {
    next(error)
  }
}

module.exports = {
  register,
  login,
}
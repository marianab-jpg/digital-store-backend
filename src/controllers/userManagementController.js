const { z } = require('zod')
const { User } = require('../models')

const updateSchema = z
  .object({
    firstname: z.string().trim().min(1).max(255),
    surname: z.string().trim().min(1).max(255),
    email: z.string().trim().email().max(255),
  })
  .strict()

function readId(req, res) {
  const value = req.params.id

  if (!/^[1-9]\d*$/.test(value)) {
    res.status(400).json({
      message: 'O ID deve ser um número inteiro positivo.',
    })

    return null
  }

  const id = Number(value)

  if (!Number.isSafeInteger(id)) {
    res.status(400).json({
      message: 'ID inválido.',
    })

    return null
  }

  return id
}

function canManage(req, res, id) {
  if (req.user.id !== id) {
    res.status(403).json({
      message: 'Você só pode alterar ou excluir a própria conta.',
    })

    return false
  }

  return true
}

async function getById(req, res, next) {
  try {
    const id = readId(req, res)

    if (id === null) return

    const user = await User.findByPk(id, {
      attributes: ['id', 'firstname', 'surname', 'email'],
    })

    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.',
      })
    }

    return res.status(200).json(user)
  } catch (error) {
    return next(error)
  }
}

async function update(req, res, next) {
  try {
    const id = readId(req, res)

    if (id === null) return
    if (!canManage(req, res, id)) return

    const result = updateSchema.safeParse(req.body)

    if (!result.success) {
      return res.status(400).json({
        message: 'Verifique os dados enviados.',
        errors: result.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      })
    }

    const user = await User.findByPk(id)

    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.',
      })
    }

    await user.update({
      firstname: result.data.firstname,
      surname: result.data.surname,
      email: result.data.email.toLowerCase(),
    })

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}

async function remove(req, res, next) {
  try {
    const id = readId(req, res)

    if (id === null) return
    if (!canManage(req, res, id)) return

    const user = await User.findByPk(id)

    if (!user) {
      return res.status(404).json({
        message: 'Usuário não encontrado.',
      })
    }

    await user.destroy()

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  getById,
  update,
  remove,
}
const { z } = require('zod')
const { Category } = require('../models')

const fields = ['id', 'name', 'slug', 'use_in_menu']

const categorySchema = z
  .object({
    name: z.string().trim().min(1).max(255),
    slug: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        'Use letras minúsculas, números e hífens no slug.',
      ),
    use_in_menu: z.boolean().optional(),
  })
  .strict()

function readId(req, res) {
  const value = req.params.id

  if (!/^[1-9]\d*$/.test(value) || !Number.isSafeInteger(Number(value))) {
    res.status(400).json({
      message: 'O ID deve ser um número inteiro positivo.',
    })

    return null
  }

  return Number(value)
}

function readBody(req, res) {
  const result = categorySchema.safeParse(req.body)

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

function readSearch(query) {
  const allowedParams = ['limit', 'page', 'fields', 'use_in_menu']

  for (const key of Object.keys(query)) {
    if (!allowedParams.includes(key)) {
      throw new Error(`Parâmetro desconhecido: ${key}`)
    }

    if (typeof query[key] !== 'string') {
      throw new Error(`Informe apenas um valor para ${key}.`)
    }
  }

  const limitText = query.limit ?? '12'

  if (!/^(?:-1|[1-9]\d*)$/.test(limitText)) {
    throw new Error('limit deve ser -1 ou um inteiro positivo.')
  }

  const limit = Number(limitText)

  if (!Number.isSafeInteger(limit)) {
    throw new Error('limit inválido.')
  }

  let page = 1

  // Com limit=-1, a paginação não interfere na busca.
  if (limit !== -1 && query.page !== undefined) {
    if (!/^[1-9]\d*$/.test(query.page)) {
      throw new Error('page deve ser um inteiro positivo.')
    }

    page = Number(query.page)

    if (!Number.isSafeInteger(page)) {
      throw new Error('page inválida.')
    }
  }

  const offset = limit === -1 ? 0 : (page - 1) * limit

  if (!Number.isSafeInteger(offset)) {
    throw new Error('A paginação excede o limite permitido.')
  }

  let attributes = fields

  if (query.fields !== undefined) {
    attributes = [...new Set(query.fields.split(',').map((field) => field.trim()))]

    if (
      attributes.length === 0 ||
      attributes.some((field) => !fields.includes(field))
    ) {
      throw new Error(
        'fields aceita somente: id, name, slug e use_in_menu.',
      )
    }
  }

  const where = {}

  if (query.use_in_menu !== undefined) {
    if (!['true', 'false'].includes(query.use_in_menu)) {
      throw new Error('use_in_menu deve ser true ou false.')
    }

    where.use_in_menu = query.use_in_menu === 'true'
  }

  return {
    limit,
    page,
    offset,
    attributes,
    where,
  }
}

async function search(req, res, next) {
  let options

  try {
    options = readSearch(req.query)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }

  try {
    const { count, rows } = await Category.findAndCountAll({
      attributes: options.attributes,
      where: options.where,
      order: [['id', 'ASC']],
      ...(options.limit === -1
        ? {}
        : {
            limit: options.limit,
            offset: options.offset,
          }),
    })

    return res.status(200).json({
      data: rows,
      total: count,
      limit: options.limit,
      page: options.page,
    })
  } catch (error) {
    return next(error)
  }
}

async function getById(req, res, next) {
  try {
    const id = readId(req, res)

    if (id === null) return

    const category = await Category.findByPk(id, {
      attributes: fields,
    })

    if (!category) {
      return res.status(404).json({
        message: 'Categoria não encontrada.',
      })
    }

    return res.status(200).json(category)
  } catch (error) {
    return next(error)
  }
}

async function create(req, res, next) {
  try {
    const data = readBody(req, res)

    if (!data) return

    const category = await Category.create(data)

    return res.status(201).json({
      id: category.id,
      name: category.name,
      slug: category.slug,
      use_in_menu: category.use_in_menu,
    })
  } catch (error) {
    return next(error)
  }
}

async function update(req, res, next) {
  try {
    const id = readId(req, res)

    if (id === null) return

    const data = readBody(req, res)

    if (!data) return

    const category = await Category.findByPk(id)

    if (!category) {
      return res.status(404).json({
        message: 'Categoria não encontrada.',
      })
    }

    await category.update(data)

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}

async function remove(req, res, next) {
  try {
    const id = readId(req, res)

    if (id === null) return

    const category = await Category.findByPk(id)

    if (!category) {
      return res.status(404).json({
        message: 'Categoria não encontrada.',
      })
    }

    await category.destroy()

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  search,
  getById,
  create,
  update,
  remove,
}
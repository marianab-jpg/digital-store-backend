const { Op } = require('sequelize')
const {
  Product,
  Category,
  ProductImage,
  ProductOption,
  ProductCategory,
} = require('../models')

const allowedFields = [
  'id',
  'enabled',
  'name',
  'slug',
  'use_in_menu',
  'stock',
  'description',
  'price',
  'price_with_discount',
  'category_ids',
  'images',
  'options',
]

function positiveInteger(value, name) {
  if (
    !/^[1-9]\d*$/.test(value) ||
    !Number.isSafeInteger(Number(value))
  ) {
    throw new Error(`${name} deve ser um inteiro positivo.`)
  }

  return Number(value)
}

function parseQuery(query) {
  const normalParams = [
    'limit',
    'page',
    'fields',
    'match',
    'category_ids',
    'price-range',
  ]

  const optionFilters = []

  for (const [key, value] of Object.entries(query)) {
    const optionMatch = key.match(/^option\[([1-9]\d*)\]$/)

    if (!normalParams.includes(key) && !optionMatch) {
      throw new Error(`Parâmetro desconhecido: ${key}`)
    }

    if (typeof value !== 'string') {
      throw new Error(`Informe apenas um valor para ${key}.`)
    }

    if (optionMatch) {
      const values = value.split(',').map((item) => item.trim())

      if (values.some((item) => item.length === 0)) {
        throw new Error(`Informe valores válidos para ${key}.`)
      }

      optionFilters.push({
        id: positiveInteger(optionMatch[1], 'ID da opção'),
        values,
      })
    }
  }

  const limit = query.limit === '-1'
    ? -1
    : positiveInteger(query.limit ?? '12', 'limit')

  const page = limit === -1
    ? 1
    : positiveInteger(query.page ?? '1', 'page')

  const offset = limit === -1 ? 0 : (page - 1) * limit

  if (!Number.isSafeInteger(offset)) {
    throw new Error('A paginação excede o limite permitido.')
  }

  const fields = query.fields === undefined
    ? allowedFields
    : [...new Set(query.fields.split(',').map((field) => field.trim()))]

  if (fields.some((field) => !allowedFields.includes(field))) {
    throw new Error(`fields aceita: ${allowedFields.join(', ')}.`)
  }

  const categoryIds = query.category_ids === undefined
    ? []
    : [
        ...new Set(
          query.category_ids
            .split(',')
            .map((id) => positiveInteger(id.trim(), 'category_ids')),
        ),
      ]

  let priceRange

  if (query['price-range'] !== undefined) {
    const match = query['price-range'].match(
      /^(\d+(?:\.\d+)?)-(\d+(?:\.\d+)?)$/,
    )

    if (!match) {
      throw new Error('price-range deve seguir o formato 100-200.')
    }

    priceRange = [Number(match[1]), Number(match[2])]

    if (
      priceRange.some((price) => !Number.isFinite(price)) ||
      priceRange[0] > priceRange[1]
    ) {
      throw new Error('Intervalo de preços inválido.')
    }
  }

  return {
    limit,
    page,
    offset,
    fields,
    categoryIds,
    priceRange,
    match: query.match?.trim(),
    optionFilters,
  }
}

function serialize(product, fields) {
  const data = product.get({ plain: true })

  const result = {
    id: data.id,
    enabled: data.enabled,
    name: data.name,
    slug: data.slug,
    use_in_menu: data.use_in_menu,
    stock: data.stock,
    description: data.description,
    price: data.price,
    price_with_discount: data.price_with_discount,
    category_ids: (data.categories || [])
      .map((category) => category.id)
      .sort((a, b) => a - b),
    images: (data.images || [])
      .map((image) => ({
        id: image.id,
        content: image.path,
      }))
      .sort((a, b) => a.id - b.id),
    options: (data.options || [])
      .map((option) => ({
        id: option.id,
        title: option.title,
        shape: option.shape,
        radius: option.radius,
        type: option.type,
        values: option.values.split(','),
      }))
      .sort((a, b) => a.id - b.id),
  }

  return Object.fromEntries(
    fields.map((field) => [field, result[field]]),
  )
}

async function search(req, res, next) {
  let parameters

  try {
    parameters = parseQuery(req.query)
  } catch (error) {
    return res.status(400).json({
      message: error.message,
    })
  }

  try {
    const conditions = []

    if (parameters.match) {
      conditions.push({
        [Op.or]: [
          { name: { [Op.substring]: parameters.match } },
          { description: { [Op.substring]: parameters.match } },
        ],
      })
    }

    if (parameters.priceRange) {
      conditions.push({
        price: {
          [Op.between]: parameters.priceRange,
        },
      })
    }

    if (parameters.categoryIds.length > 0) {
      const relations = await ProductCategory.findAll({
        attributes: ['product_id'],
        where: {
          category_id: {
            [Op.in]: parameters.categoryIds,
          },
        },
        raw: true,
      })

      conditions.push({
        id: {
          [Op.in]: [...new Set(relations.map((item) => item.product_id))],
        },
      })
    }

    // Busca as opções dos filtros em uma única consulta.
    const filterOptions = parameters.optionFilters.length === 0
      ? []
      : await ProductOption.findAll({
          where: {
            id: {
              [Op.in]: parameters.optionFilters.map((filter) => filter.id),
            },
          },
          attributes: ['id', 'product_id', 'values'],
          raw: true,
        })

    const optionsById = new Map(
      filterOptions.map((option) => [option.id, option]),
    )

    // Valores da mesma opção usam OU; filtros de opções distintas usam E.
    for (const filter of parameters.optionFilters) {
      const option = optionsById.get(filter.id)

      const matches = option && filter.values.some(
        (value) => option.values.split(',').includes(value),
      )

      conditions.push({
        id: {
          [Op.in]: matches ? [option.product_id] : [],
        },
      })
    }

    const include = []

    if (parameters.fields.includes('category_ids')) {
      include.push({
        model: Category,
        as: 'categories',
        attributes: ['id'],
        through: {
          attributes: [],
        },
      })
    }

    if (parameters.fields.includes('images')) {
      include.push({
        model: ProductImage,
        as: 'images',
        attributes: ['id', 'path'],
        separate: true,
        order: [['id', 'ASC']],
      })
    }

    if (parameters.fields.includes('options')) {
      include.push({
        model: ProductOption,
        as: 'options',
        attributes: ['id', 'title', 'shape', 'radius', 'type', 'values'],
        separate: true,
        order: [['id', 'ASC']],
      })
    }

    const attributes = parameters.fields.filter(
      (field) => !['category_ids', 'images', 'options'].includes(field),
    )

    // O ID permite ao Sequelize associar as relações, mesmo se não for exibido.
    if (!attributes.includes('id')) attributes.unshift('id')

    const { count, rows } = await Product.findAndCountAll({
      attributes,
      where: conditions.length > 0
        ? { [Op.and]: conditions }
        : {},
      include,
      distinct: parameters.fields.includes('category_ids'),
      order: [['id', 'ASC']],
      ...(parameters.limit === -1
        ? {}
        : {
            limit: parameters.limit,
            offset: parameters.offset,
          }),
    })

    return res.status(200).json({
      data: rows.map((product) => serialize(product, parameters.fields)),
      total: count,
      limit: parameters.limit,
      page: parameters.page,
    })
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  search,
}
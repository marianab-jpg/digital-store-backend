const {
  sequelize,
  Product,
  Category,
  ProductImage,
  ProductOption,
} = require('../models')

const {
  productSchema,
  applyRelations,
  cleanupFiles,
} = require('../services/productRelations')

const includes = [
  {
    model: Category,
    as: 'categories',
    attributes: ['id'],
    through: {
      attributes: [],
    },
  },
  {
    model: ProductImage,
    as: 'images',
    attributes: ['id', 'path'],
  },
  {
    model: ProductOption,
    as: 'options',
    attributes: ['id', 'title', 'shape', 'radius', 'type', 'values'],
  },
]

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
  const result = productSchema.safeParse(req.body)

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

function serializeProduct(product) {
  const data = product.get({ plain: true })

  return {
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
        ...option,
        values: option.values.split(','),
      }))
      .sort((a, b) => a.id - b.id),
  }
}

async function writeProduct(req, res, next, creating) {
  const state = {
    createdFiles: [],
    removedFiles: [],
  }

  let committed = false

  try {
    const id = creating ? null : readId(req, res)

    if (!creating && id === null) return

    const data = readBody(req, res)

    if (!data) return

    const result = await sequelize.transaction(async (transaction) => {
      const {
        category_ids,
        options,
        images,
        ...attributes
      } = data

      const product = creating
        ? await Product.create(attributes, { transaction })
        : await Product.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          })

      if (!product) return null

      if (!creating) {
        await product.update(attributes, { transaction })
      }

      await applyRelations(
        product,
        { category_ids, options, images },
        transaction,
        state,
        creating,
      )

      if (!creating) return true

      const completeProduct = await Product.findByPk(product.id, {
        include: includes,
        transaction,
      })

      return serializeProduct(completeProduct)
    })

    committed = true

    await cleanupFiles(state.removedFiles)

    if (result === null) {
      return res.status(404).json({
        message: 'Produto não encontrado.',
      })
    }

    if (creating) {
      return res.status(201).json(result)
    }

    return res.status(204).send()
  } catch (error) {
    // Se o banco desfizer a operação, removemos os novos arquivos.
    if (!committed) {
      await cleanupFiles(state.createdFiles)
    }

    if (error.status === 400) {
      return res.status(400).json({
        message: error.message,
      })
    }

    return next(error)
  }
}

async function create(req, res, next) {
  return writeProduct(req, res, next, true)
}

async function update(req, res, next) {
  return writeProduct(req, res, next, false)
}

async function getById(req, res, next) {
  try {
    const id = readId(req, res)

    if (id === null) return

    const product = await Product.findByPk(id, {
      include: includes,
    })

    if (!product) {
      return res.status(404).json({
        message: 'Produto não encontrado.',
      })
    }

    return res.status(200).json(serializeProduct(product))
  } catch (error) {
    return next(error)
  }
}

async function remove(req, res, next) {
  try {
    const id = readId(req, res)

    if (id === null) return

    const result = await sequelize.transaction(async (transaction) => {
      const product = await Product.findByPk(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      })

      if (!product) return null

      const images = await ProductImage.findAll({
        where: { product_id: id },
        attributes: ['path'],
        transaction,
      })

      await product.destroy({ transaction })

      return images.map((image) => image.path)
    })

    if (result === null) {
      return res.status(404).json({
        message: 'Produto não encontrado.',
      })
    }

    await cleanupFiles(result)

    return res.status(204).send()
  } catch (error) {
    return next(error)
  }
}

module.exports = {
  create,
  getById,
  update,
  remove,
}
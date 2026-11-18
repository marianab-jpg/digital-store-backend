const fs = require('node:fs/promises')
const path = require('node:path')
const crypto = require('node:crypto')
const { z } = require('zod')
const {
  Category,
  ProductImage,
  ProductOption,
} = require('../models')

const uploadsDirectory = path.resolve(__dirname, '../../uploads')

function badRequest(message) {
  const error = new Error(message)
  error.status = 400
  return error
}

const radiusSchema = z.preprocess(
  (value) => {
    if (typeof value === 'string' && /^\d+px$/.test(value)) {
      return Number(value.slice(0, -2))
    }

    return value
  },
  z.number().int().nonnegative(),
)

const valuesSchema = z
  .array(
    z.string().trim().min(1).refine(
      (value) => !value.includes(','),
      'Cada valor deve ser informado sem vírgulas.',
    ),
  )
  .min(1)
  .refine(
    (values) => values.join(',').length <= 255,
    'Os valores excedem 255 caracteres.',
  )

const optionSchema = z
  .object({
    id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
    deleted: z.boolean().optional(),
    title: z.string().trim().min(1).max(255).optional(),
    shape: z.enum(['square', 'circle']).optional(),
    radius: radiusSchema.optional(),
    type: z.enum(['text', 'color']).optional(),
    values: valuesSchema.optional(),
    value: valuesSchema.optional(),
  })
  .strict()

const imageSchema = z
  .object({
    id: z.number().int().positive().max(Number.MAX_SAFE_INTEGER).optional(),
    deleted: z.boolean().optional(),
    type: z.enum(['image/png', 'image/jpeg', 'image/jpg']).optional(),
    content: z.string().min(1).optional(),
  })
  .strict()

const productSchema = z
  .object({
    enabled: z.boolean().optional(),
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
    stock: z.number().int().nonnegative().optional(),
    description: z.string().max(255).nullable().optional(),
    price: z.number().finite().nonnegative(),
    price_with_discount: z.number().finite().nonnegative(),
    category_ids: z
      .array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
      .optional(),
    options: z.array(optionSchema).max(100).optional(),
    images: z.array(imageSchema).max(20).optional(),
  })
  .strict()
  .refine(
    (product) => product.price_with_discount <= product.price,
    {
      message: 'O preço com desconto não pode superar o preço original.',
      path: ['price_with_discount'],
    },
  )

function checkRepeatedIds(items, name) {
  const ids = items
    .filter((item) => item.id !== undefined)
    .map((item) => item.id)

  if (new Set(ids).size !== ids.length) {
    throw badRequest(`Existem IDs repetidos em ${name}.`)
  }
}

async function saveImage(content, type, state) {
  if (
    !content ||
    content.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(content)
  ) {
    throw badRequest('Envie o conteúdo da imagem em Base64 válido.')
  }

  const buffer = Buffer.from(content, 'base64')

  if (buffer.toString('base64') !== content) {
    throw badRequest('O conteúdo Base64 da imagem é inválido.')
  }

  if (buffer.length > 5 * 1024 * 1024) {
    throw badRequest('Cada imagem pode ter no máximo 5 MB.')
  }

  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ])

  const isPng = buffer.subarray(0, 8).equals(pngSignature)
  const isJpeg = buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff

  const extension = isPng ? 'png' : isJpeg ? 'jpg' : null

  if (!extension) {
    throw badRequest('A imagem deve ser um arquivo PNG ou JPEG.')
  }

  if (
    type &&
    (
      (type === 'image/png' && !isPng) ||
      (['image/jpeg', 'image/jpg'].includes(type) && !isJpeg)
    )
  ) {
    throw badRequest('O tipo informado não corresponde à imagem.')
  }

  await fs.mkdir(uploadsDirectory, { recursive: true })

  const filename = `${crypto.randomUUID()}.${extension}`
  const publicPath = `/uploads/${filename}`

  state.createdFiles.push(publicPath)

  await fs.writeFile(
    path.join(uploadsDirectory, filename),
    buffer,
    { flag: 'wx' },
  )

  return publicPath
}

async function cleanupFiles(paths) {
  for (const publicPath of new Set(paths)) {
    // Apenas arquivos gerados pela aplicação podem ser removidos.
    if (!/^\/uploads\/[a-f0-9-]{36}\.(png|jpg)$/.test(publicPath)) {
      continue
    }

    try {
      await fs.unlink(
        path.join(uploadsDirectory, path.basename(publicPath)),
      )
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Não foi possível remover uma imagem:', error.message)
      }
    }
  }
}

async function applyRelations(product, data, transaction, state, creating) {
  if (data.category_ids !== undefined) {
    const ids = [...new Set(data.category_ids)]

    const count = ids.length === 0
      ? 0
      : await Category.count({
          where: { id: ids },
          transaction,
        })

    if (count !== ids.length) {
      throw badRequest('Uma ou mais categorias não existem.')
    }

    await product.setCategories(ids, { transaction })
  }

  const options = data.options || []
  checkRepeatedIds(options, 'options')

  for (const input of options) {
    if (creating && (input.id !== undefined || input.deleted)) {
      throw badRequest('Novas opções não devem conter id ou deleted=true.')
    }

    if (input.values !== undefined && input.value !== undefined) {
      throw badRequest('Use apenas values ou value na opção.')
    }

    const values = input.values ?? input.value

    if (input.id !== undefined) {
      const option = await ProductOption.findOne({
        where: {
          id: input.id,
          product_id: product.id,
        },
        transaction,
      })

      if (!option) {
        throw badRequest('Uma opção não pertence ao produto informado.')
      }

      if (input.deleted) {
        await option.destroy({ transaction })
        continue
      }

      const attributes = {}

      for (const key of ['title', 'shape', 'radius', 'type']) {
        if (input[key] !== undefined) {
          attributes[key] = input[key]
        }
      }

      if (values !== undefined) {
        attributes.values = values.join(',')
      }

      await option.update(attributes, { transaction })
    } else {
      if (input.deleted || !input.title || !values) {
        throw badRequest('Uma nova opção precisa de title e values.')
      }

      await ProductOption.create(
        {
          product_id: product.id,
          title: input.title,
          shape: input.shape ?? 'square',
          radius: input.radius ?? 0,
          type: input.type ?? 'text',
          values: values.join(','),
        },
        { transaction },
      )
    }
  }

  const images = data.images || []
  checkRepeatedIds(images, 'images')

  for (const input of images) {
    if (creating && (input.id !== undefined || input.deleted)) {
      throw badRequest('Novas imagens não devem conter id ou deleted=true.')
    }

    if (input.id !== undefined) {
      const image = await ProductImage.findOne({
        where: {
          id: input.id,
          product_id: product.id,
        },
        transaction,
      })

      if (!image) {
        throw badRequest('Uma imagem não pertence ao produto informado.')
      }

      if (input.deleted) {
        state.removedFiles.push(image.path)
        await image.destroy({ transaction })
        continue
      }

      // Reenviar o caminho atual mantém a imagem existente.
      if (input.content !== undefined && input.content !== image.path) {
        const newPath = await saveImage(input.content, input.type, state)

        state.removedFiles.push(image.path)

        await image.update(
          { path: newPath, enabled: true },
          { transaction },
        )
      }
    } else {
      if (input.deleted || !input.content || !input.type) {
        throw badRequest('Uma nova imagem precisa de type e content.')
      }

      const imagePath = await saveImage(input.content, input.type, state)

      await ProductImage.create(
        {
          product_id: product.id,
          path: imagePath,
          enabled: true,
        },
        { transaction },
      )
    }
  }
}

module.exports = {
  productSchema,
  applyRelations,
  cleanupFiles,
}
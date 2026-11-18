process.env.NODE_ENV = 'test'

const { Op } = require('sequelize')
const {
  sequelize,
  Product,
  ProductImage,
  ProductOption,
} = require('../src/models')

const { applyRelations } = require('../src/services/productRelations')
const { search } = require('../src/controllers/productSearchController')

afterEach(() => {
  jest.restoreAllMocks()
})

afterAll(async () => {
  await sequelize.close()
})

test.each([
  '/uploads/imagem.png',
  'http://localhost:3000/uploads/imagem.png',
  'https://loja.example/uploads/imagem.png?v=2',
])('preserva a imagem existente com a referência %s', async (content) => {
  const image = {
    path: '/uploads/imagem.png',
    update: jest.fn(),
    destroy: jest.fn(),
  }

  jest.spyOn(ProductImage, 'findOne').mockResolvedValue(image)

  const state = {
    createdFiles: [],
    removedFiles: [],
  }

  await applyRelations(
    { id: 1 },
    { images: [{ id: 10, content }] },
    {},
    state,
    false,
  )

  expect(image.update).not.toHaveBeenCalled()
  expect(image.destroy).not.toHaveBeenCalled()
  expect(state).toEqual({
    createdFiles: [],
    removedFiles: [],
  })
})

test('rejeita URL que não aponta para o caminho da imagem existente', async () => {
  jest.spyOn(ProductImage, 'findOne').mockResolvedValue({
    path: '/uploads/imagem.png',
  })

  await expect(applyRelations(
    { id: 1 },
    {
      images: [
        {
          id: 10,
          content: 'https://loja.example/outra.png',
        },
      ],
    },
    {},
    { createdFiles: [], removedFiles: [] },
    false,
  )).rejects.toMatchObject({ status: 400 })
})

test('consulta somente os campos escalares solicitados, sem relações', async () => {
  const query = jest.spyOn(Product, 'findAndCountAll').mockResolvedValue({
    count: 1,
    rows: [
      {
        get: () => ({
          id: 1,
          name: 'Tênis',
          price: 200,
        }),
      },
    ],
  })

  const optionQuery = jest.spyOn(ProductOption, 'findAll')
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }
  const next = jest.fn()

  await search(
    { query: { fields: 'id,name,price' } },
    res,
    next,
  )

  expect(next).not.toHaveBeenCalled()
  expect(query.mock.calls[0][0].attributes)
    .toEqual(['id', 'name', 'price'])
  expect(query.mock.calls[0][0].include).toEqual([])
  expect(optionQuery).not.toHaveBeenCalled()
  expect(res.json.mock.calls[0][0].data).toEqual([
    { id: 1, name: 'Tênis', price: 200 },
  ])
})

test('consulta os filtros de opções em lote e mantém a combinação E', async () => {
  const optionQuery = jest.spyOn(ProductOption, 'findAll').mockResolvedValue([
    { id: 10, product_id: 1, values: '40,41' },
    { id: 11, product_id: 1, values: '#000000' },
  ])

  const productQuery = jest.spyOn(Product, 'findAndCountAll').mockResolvedValue({
    count: 0,
    rows: [],
  })

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }
  const next = jest.fn()

  await search(
    {
      query: {
        fields: 'images',
        'option[10]': '40',
        'option[11]': '#000000',
      },
    },
    res,
    next,
  )

  expect(next).not.toHaveBeenCalled()
  expect(optionQuery).toHaveBeenCalledTimes(1)

  const options = productQuery.mock.calls[0][0]

  expect(options.attributes).toEqual(['id'])
  expect(options.include.map((relation) => relation.as))
    .toEqual(['images'])
  expect(options.include[0].separate).toBe(true)
  expect(options.where[Op.and].map((condition) => condition.id[Op.in]))
    .toEqual([[1], [1]])
})
process.env.NODE_ENV = 'test'

const crypto = require('node:crypto')
const request = require('supertest')
const bcrypt = require('bcrypt')

const app = require('../src/app')
const {
  sequelize,
  User,
  Category,
  Product,
  ProductImage,
} = require('../src/models')
const { cleanupFiles } = require('../src/services/productRelations')

jest.setTimeout(30000)

const suffix = crypto.randomUUID()
const email = `teste-${suffix}@example.com`
const password = 'Teste@123'

let token
let userId
let categoryId

const productIds = []
const extraUserIds = []

const pngBase64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII='

function authorized(method, url) {
  return request(app)[method](url)
    .set('Authorization', `Bearer ${token}`)
}

function productPayload(overrides = {}) {
  return {
    enabled: true,
    name: 'Produto automatizado',
    slug: `produto-${crypto.randomUUID()}`,
    stock: 10,
    price: 200,
    price_with_discount: 150,
    category_ids: [categoryId],
    options: [
      {
        title: 'Tamanho',
        type: 'text',
        shape: 'square',
        values: ['39', '40'],
      },
    ],
    ...overrides,
  }
}

beforeAll(async () => {
  // Impede que os testes usem o banco de desenvolvimento.
  if (
    sequelize.config.database !== 'digital_store_test' ||
    sequelize.config.database === process.env.DB_NAME
  ) {
    throw new Error('Os testes exigem o banco separado digital_store_test.')
  }

  await sequelize.authenticate()

  const registration = await request(app)
    .post('/v1/user')
    .send({
      firstname: 'Conta',
      surname: 'Automatizada',
      email,
      password,
      confirmPassword: password,
    })

  expect(registration.status).toBe(201)
  expect(registration.body).not.toHaveProperty('password')
  userId = registration.body.id

  const login = await request(app)
    .post('/v1/user/token')
    .send({ email, password })

  expect(login.status).toBe(200)
  expect(typeof login.body.token).toBe('string')
  token = login.body.token

  const category = await authorized('post', '/v1/category')
    .send({
      name: 'Categoria automatizada',
      slug: `categoria-${suffix}`,
      use_in_menu: true,
    })

  expect(category.status).toBe(201)
  categoryId = category.body.id
})

afterAll(async () => {
  try {
    if (productIds.length > 0) {
      const images = await ProductImage.findAll({
        where: { product_id: productIds },
        attributes: ['path'],
      })

      await Product.destroy({
        where: { id: productIds },
      })

      await cleanupFiles(images.map((image) => image.path))
    }

    if (categoryId) {
      await Category.destroy({ where: { id: categoryId } })
    }

    const usersToDelete = [...extraUserIds]

    if (userId) usersToDelete.push(userId)

    if (usersToDelete.length > 0) {
      await User.destroy({ where: { id: usersToDelete } })
    }
  } finally {
    await sequelize.close()
  }
})

test('conecta ao banco de testes', async () => {
  const response = await request(app).get('/health')

  expect(response.status).toBe(200)
  expect(response.body.database).toBe('connected')
})

test('armazena a senha como hash e não a expõe na consulta', async () => {
  const user = await User.scope('withPassword').findByPk(userId)

  expect(user.password).not.toBe(password)
  expect(await bcrypt.compare(password, user.password)).toBe(true)

  const response = await request(app).get(`/v1/user/${userId}`)

  expect(response.status).toBe(200)
  expect(response.body.email).toBe(email)
  expect(response.body).not.toHaveProperty('password')
})

test('rejeita senha incorreta no login', async () => {
  const response = await request(app)
    .post('/v1/user/token')
    .send({
      email,
      password: 'SenhaErrada@123',
    })

  expect(response.status).toBe(400)
  expect(response.body).not.toHaveProperty('token')
})

test('rejeita cadastro com confirmação de senha diferente', async () => {
  const response = await request(app)
    .post('/v1/user')
    .send({
      firstname: 'Teste',
      surname: 'Invalido',
      email: `invalido-${suffix}@example.com`,
      password,
      confirmPassword: 'OutraSenha@123',
    })

  expect(response.status).toBe(400)
})

test('protege criação de categorias sem token ou com token inválido', async () => {
  const payload = {
    name: 'Categoria protegida',
    slug: `protegida-${suffix}`,
  }

  const missing = await request(app)
    .post('/v1/category')
    .send(payload)

  const invalid = await request(app)
    .post('/v1/category')
    .set('Authorization', 'Bearer token-invalido')
    .send(payload)

  expect(missing.status).toBe(401)
  expect(invalid.status).toBe(401)
})

test('atualiza os próprios dados e retorna 204 sem corpo', async () => {
  const response = await authorized('put', `/v1/user/${userId}`)
    .send({
      firstname: 'Conta',
      surname: 'Atualizada',
      email,
    })

  expect(response.status).toBe(204)
  expect(response.text).toBe('')

  const consultation = await request(app).get(`/v1/user/${userId}`)

  expect(consultation.body.surname).toBe('Atualizada')
})

test('impede alteração da conta de outro usuário', async () => {
  const registration = await request(app)
    .post('/v1/user')
    .send({
      firstname: 'Outra',
      surname: 'Conta',
      email: `outra-${suffix}@example.com`,
      password,
      confirmPassword: password,
    })

  expect(registration.status).toBe(201)
  extraUserIds.push(registration.body.id)

  const response = await authorized(
    'put',
    `/v1/user/${registration.body.id}`,
  ).send({
    firstname: 'Alteracao',
    surname: 'Indevida',
    email: `outra-${suffix}@example.com`,
  })

  expect(response.status).toBe(403)
})

test('filtra categorias e seleciona campos', async () => {
  const response = await request(app)
    .get('/v1/category/search')
    .query({
      limit: -1,
      use_in_menu: true,
      fields: 'id,name',
    })

  expect(response.status).toBe(200)
  expect(response.body.limit).toBe(-1)

  const category = response.body.data.find(
    (item) => item.id === categoryId,
  )

  expect(category).toEqual({
    id: categoryId,
    name: 'Categoria automatizada',
  })
})

test('cria produto com imagem, filtra, atualiza e exclui relações', async () => {
  const creation = await authorized('post', '/v1/product')
    .send(productPayload({
      images: [
        {
          type: 'image/png',
          content: pngBase64,
        },
      ],
    }))

  if (creation.status === 201) {
    productIds.push(creation.body.id)
  }

  expect(creation.status).toBe(201)

  const product = creation.body

  expect(product.category_ids).toEqual([categoryId])
  expect(product.images).toHaveLength(1)
  expect(product.options).toHaveLength(1)

  const image = await request(app).get(product.images[0].content)

  expect(image.status).toBe(200)
  expect(image.headers['content-type']).toMatch(/image\/png/)

  const search = await request(app)
    .get('/v1/product/search')
    .query({
      match: 'Produto automatizado',
      category_ids: String(categoryId),
      'price-range': '100-250',
      [`option[${product.options[0].id}]`]: '40',
      fields: 'id,name,price',
      limit: 1,
      page: 1,
    })

  expect(search.status).toBe(200)
  expect(search.body.total).toBe(1)
  expect(search.body.data).toEqual([
    {
      id: product.id,
      name: product.name,
      price: 200,
    },
  ])

  const update = await authorized('put', `/v1/product/${product.id}`)
    .send({
      name: product.name,
      slug: product.slug,
      price: product.price,
      price_with_discount: product.price_with_discount,
      options: [
        {
          id: product.options[0].id,
          radius: '6px',
          values: ['40', '41', '42'],
        },
      ],
    })

  expect(update.status).toBe(204)
  expect(update.text).toBe('')

  const updated = await request(app).get(`/v1/product/${product.id}`)

  expect(updated.body.options[0].id).toBe(product.options[0].id)
  expect(updated.body.options[0].radius).toBe(6)
  expect(updated.body.options[0].values).toEqual(['40', '41', '42'])
  expect(updated.body.images).toHaveLength(1)

  const removeRelations = await authorized(
    'put',
    `/v1/product/${product.id}`,
  ).send({
    name: product.name,
    slug: product.slug,
    price: product.price,
    price_with_discount: product.price_with_discount,
    options: [{ id: product.options[0].id, deleted: true }],
    images: [{ id: product.images[0].id, deleted: true }],
  })

  expect(removeRelations.status).toBe(204)

  const finalProduct = await request(app).get(`/v1/product/${product.id}`)
  expect(finalProduct.body.options).toEqual([])
  expect(finalProduct.body.images).toEqual([])

  const deletedImage = await request(app).get(product.images[0].content)
  expect(deletedImage.status).toBe(404)

  const deletion = await authorized(
    'delete',
    `/v1/product/${product.id}`,
  )

  expect(deletion.status).toBe(204)
  expect(deletion.text).toBe('')

  const missingProduct = await request(app).get(`/v1/product/${product.id}`)
  expect(missingProduct.status).toBe(404)
})

test('desfaz o cadastro inteiro quando uma opção é inválida', async () => {
  const slug = `rollback-${crypto.randomUUID()}`

  const response = await authorized('post', '/v1/product')
    .send(productPayload({
      slug,
      options: [
        { title: 'Opcao sem valores' },
      ],
    }))

  expect(response.status).toBe(400)

  const product = await Product.findOne({ where: { slug } })
  expect(product).toBeNull()
})

test('rejeita paginação e imagem inválidas', async () => {
  const search = await request(app)
    .get('/v1/product/search')
    .query({ limit: 0 })

  expect(search.status).toBe(400)

  const creation = await authorized('post', '/v1/product')
    .send(productPayload({
      images: [
        {
          type: 'image/png',
          content: Buffer.from('Isto nao e uma imagem').toString('base64'),
        },
      ],
    }))

  expect(creation.status).toBe(400)
})

test('rejeita JSON malformado e retorna 404 para rota inexistente', async () => {
  const malformed = await request(app)
    .post('/v1/user')
    .set('Content-Type', 'application/json')
    .send('{"firstname":')

  expect(malformed.status).toBe(400)

  const missing = await request(app).get('/rota-inexistente')
  expect(missing.status).toBe(404)
})

test('exclui categoria e usuário com respostas 204', async () => {
  const category = await authorized('post', '/v1/category')
    .send({
      name: 'Categoria descartavel',
      slug: `descartavel-${suffix}`,
    })

  expect(category.status).toBe(201)

  const categoryDeletion = await authorized(
    'delete',
    `/v1/category/${category.body.id}`,
  )

  expect(categoryDeletion.status).toBe(204)
  expect(categoryDeletion.text).toBe('')

  const missingCategory = await request(app)
    .get(`/v1/category/${category.body.id}`)

  expect(missingCategory.status).toBe(404)

  const registration = await request(app)
    .post('/v1/user')
    .send({
      firstname: 'Usuario',
      surname: 'Descartavel',
      email: `descartavel-${suffix}@example.com`,
      password,
      confirmPassword: password,
    })

  expect(registration.status).toBe(201)
  extraUserIds.push(registration.body.id)

  const login = await request(app)
    .post('/v1/user/token')
    .send({
      email: `descartavel-${suffix}@example.com`,
      password,
    })

  expect(login.status).toBe(200)

  const userDeletion = await request(app)
    .delete(`/v1/user/${registration.body.id}`)
    .set('Authorization', `Bearer ${login.body.token}`)

  expect(userDeletion.status).toBe(204)
  expect(userDeletion.text).toBe('')

  const missingUser = await request(app)
    .get(`/v1/user/${registration.body.id}`)

  expect(missingUser.status).toBe(404)

  const revoked = await request(app)
    .post('/v1/category')
    .set('Authorization', `Bearer ${login.body.token}`)
    .send({
      name: 'Sem acesso',
      slug: `sem-acesso-${suffix}`,
    })

  expect(revoked.status).toBe(401)
})
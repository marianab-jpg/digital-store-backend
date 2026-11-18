const path = require('node:path')
const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const swaggerUi = require('swagger-ui-express')

const { sequelize } = require('./models')
const openapi = require('./docs/openapi')
const userRoutes = require('./routes/userRoutes')
const categoryRoutes = require('./routes/categoryRoutes')
const productRoutes = require('./routes/productRoutes')

const app = express()

app.disable('x-powered-by')
app.use(helmet())
app.use(cors())
app.use(express.json({ limit: '10mb' }))

app.get('/openapi.json', (req, res) => {
  res.json(openapi)
})

app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi))

app.use(
  '/uploads',
  express.static(path.resolve(__dirname, '../uploads'), {
    dotfiles: 'deny',
    index: false,
    setHeaders(res) {
      res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')
    },
  }),
)

app.get('/health', async (req, res, next) => {
  try {
    await sequelize.authenticate()

    res.status(200).json({
      status: 'ok',
      database: 'connected',
    })
  } catch (error) {
    next(error)
  }
})

app.use('/v1/user', userRoutes)
app.use('/v1/category', categoryRoutes)
app.use('/v1/product', productRoutes)

app.use((req, res) => {
  res.status(404).json({
    message: 'Rota não encontrada.',
  })
})

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error)
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      message: 'O corpo da requisição deve conter um JSON válido.',
    })
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      message: 'O corpo da requisição excede o limite permitido.',
    })
  }

  if (error.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({
      message: 'Já existe um registro com esses dados únicos.',
    })
  }

  if (error.name === 'SequelizeValidationError') {
    return res.status(400).json({
      message: 'Os dados enviados não são válidos.',
    })
  }

  if (error.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      message: 'Uma referência enviada não existe ou impede essa operação.',
    })
  }

  console.error(error)

  return res.status(500).json({
    message: 'Erro interno do servidor.',
  })
})

module.exports = app
const app = require('./app')
const { sequelize } = require('./models')

const port = Number(process.env.PORT || 3000)

async function start() {
  try {
    await sequelize.authenticate()

    app.listen(port, () => {
      console.log(`API disponível em http://localhost:${port}`)
      console.log(`Verificar conexão: http://localhost:${port}/health`)
    })
  } catch (error) {
    console.error('Não foi possível iniciar a API:', error.message)
    await sequelize.close()
    process.exitCode = 1
  }
}

start()
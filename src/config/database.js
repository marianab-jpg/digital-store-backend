const path = require('node:path')

require('dotenv').config({
  path: path.resolve(__dirname, '../../.env'),
  quiet: true,
})

function configuration(database) {
  return {
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database,
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    dialect: 'mysql',
    logging: false,
    define: {
      timestamps: true,
      underscored: true,
    },
  }
}

module.exports = {
  development: configuration(process.env.DB_NAME || 'digital_store'),
  test: configuration(process.env.DB_TEST_NAME || 'digital_store_test'),
  production: configuration(process.env.DB_NAME || 'digital_store'),
}
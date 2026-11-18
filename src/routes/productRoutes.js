const express = require('express')
const productController = require('../controllers/productController')
const productSearchController = require('../controllers/productSearchController')
const auth = require('../middleware/auth')

const router = express.Router()

// A busca deve ser registrada antes da rota com :id.
router.get('/search', productSearchController.search)
router.get('/:id', productController.getById)

router.post('/', auth, productController.create)
router.put('/:id', auth, productController.update)
router.delete('/:id', auth, productController.remove)

module.exports = router
const express = require('express')
const userController = require('../controllers/userController')
const userManagementController = require('../controllers/userManagementController')
const auth = require('../middleware/auth')

const router = express.Router()

router.post('/token', userController.login)
router.post('/', userController.register)

router.get('/:id', userManagementController.getById)
router.put('/:id', auth, userManagementController.update)
router.delete('/:id', auth, userManagementController.remove)

module.exports = router
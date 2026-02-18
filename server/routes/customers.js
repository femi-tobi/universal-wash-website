const express = require('express');
const router = express.Router();
const customersController = require('../controllers/customersController');
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// All customer routes require admin access
router.use(authMiddleware);
router.use(roleCheck('admin'));

router.get('/', customersController.getAllCustomers);
router.get('/:id/history', customersController.getCustomerHistory);

module.exports = router;

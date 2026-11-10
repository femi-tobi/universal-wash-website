const express = require('express');
const router = express.Router();
const customersController = require('../controllers/customersController');
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// All customer routes require authentication. Some routes are admin-only.
router.use(authMiddleware);

// Lookup by phone (accessible to any authenticated user)
router.get('/lookup', customersController.lookupByPhone);

// Admin-only routes
router.use(roleCheck('admin'));
router.get('/', customersController.getAllCustomers);
router.get('/:id/history', customersController.getCustomerHistory);

module.exports = router;

const express = require('express');
const router = express.Router();
const salesController = require('../controllers/salesController');
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// All sales routes require authentication
router.use(authMiddleware);

// Staff and Admin can access these routes
router.post('/', salesController.createSale);
router.get('/daily', salesController.getDailySales);
router.get('/:id', salesController.getSaleDetails);
router.put('/:id/payment', salesController.updatePaymentStatus);

module.exports = router;

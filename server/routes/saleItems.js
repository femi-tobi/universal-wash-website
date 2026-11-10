const express = require('express');
const router = express.Router();
const saleItemsController = require('../controllers/saleItemsController');
const authMiddleware = require('../middleware/auth');

// All sale-items routes require authentication
router.use(authMiddleware);

// PATCH /api/sale_items/:id -> update description
router.patch('/:id', saleItemsController.updateDescription);

module.exports = router;

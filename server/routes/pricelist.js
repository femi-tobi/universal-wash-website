const express = require('express');
const router = express.Router();
const pricelistController = require('../controllers/pricelistController');
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(authMiddleware);

// Staff and Admin can read the price list
router.get('/', pricelistController.getPricelist);

// Only Admin can update the price list
router.put('/', roleCheck('admin'), pricelistController.updatePricelist);

module.exports = router;

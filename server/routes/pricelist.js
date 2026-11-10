const express = require('express');
const router = express.Router();
const pricelistController = require('../controllers/pricelistController');
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(authMiddleware);

// Base pricelist routes
router.get('/', pricelistController.getPricelist);
router.put('/', roleCheck('admin'), pricelistController.updatePricelist);

// Staff price approval workflow
router.post('/request', pricelistController.submitPriceRequest);
router.get('/my-requests', pricelistController.getMyPriceRequests);
router.get('/my-pending-count', pricelistController.getMyPendingCount);

// Admin price approvals workflow
router.get('/requests/pending-count', roleCheck('admin'), pricelistController.getPendingRequestsCount);
router.get('/requests', roleCheck('admin'), pricelistController.getAllPriceRequests);
router.get('/requests/:id', pricelistController.getPriceRequestDetails);
router.post('/requests/:id/approve', roleCheck('admin'), pricelistController.approvePriceRequest);
router.post('/requests/:id/reject', roleCheck('admin'), pricelistController.rejectPriceRequest);

module.exports = router;

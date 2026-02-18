const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// All dashboard routes require admin access
router.use(authMiddleware);
router.use(roleCheck('admin'));

router.get('/revenue/daily', dashboardController.getDailyRevenue);
router.get('/revenue/weekly', dashboardController.getWeeklyRevenue);
router.get('/revenue/monthly', dashboardController.getMonthlyRevenue);
router.get('/sales-by-service', dashboardController.getSalesByService);
router.get('/outstanding', dashboardController.getOutstandingPayments);

module.exports = router;

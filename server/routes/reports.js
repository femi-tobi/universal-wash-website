const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reportsController');
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.use(authMiddleware);
router.use(roleCheck('admin')); // All report actions are admin only

router.get('/config', reportsController.getConfig);
router.post('/test-smtp', reportsController.testSmtp);
router.get('/preview-weekly', reportsController.previewWeeklyReport);
router.post('/send-weekly', reportsController.sendWeeklyReport);

module.exports = router;

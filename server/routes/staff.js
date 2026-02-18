const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// All staff management routes require admin access
router.use(authMiddleware);
router.use(roleCheck('admin'));

router.get('/', staffController.getAllStaff);
router.post('/', staffController.addStaff);
router.put('/:id', staffController.updateStaff);
router.delete('/:id', staffController.deleteStaff);

module.exports = router;

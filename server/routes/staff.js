const express = require('express');
const router = express.Router();
const staffController = require('../controllers/staffController');
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');


// All staff management routes require authentication
router.use(authMiddleware);

// Admin-only routes
router.get('/', roleCheck('admin'), staffController.getAllStaff);
router.post('/', roleCheck('admin'), staffController.addStaff);
router.delete('/:id', roleCheck('admin'), staffController.deleteStaff);

// Routes accessible to the staff themselves or admin
router.get('/:id', staffController.getStaffById);
router.put('/:id', staffController.updateStaff);

module.exports = router;

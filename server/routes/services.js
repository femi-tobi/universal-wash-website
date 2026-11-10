const express = require('express');
const router = express.Router();
const servicesController = require('../controllers/servicesController');
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// All routes require authentication
router.use(authMiddleware);

// Staff and Admin can view services
router.get('/', servicesController.getAllServices);

// Only Admin can manage services
router.post('/', roleCheck('admin'), servicesController.createService);
router.put('/:id', roleCheck('admin'), servicesController.updateService);
router.delete('/:id', roleCheck('admin'), servicesController.deleteService);

module.exports = router;

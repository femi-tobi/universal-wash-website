const express = require('express');
const router = express.Router();
const migrateController = require('../controllers/migrateController');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Only admin can run migrations via API
router.post('/', auth, roleCheck('admin'), migrateController.runMigrations);

module.exports = router;

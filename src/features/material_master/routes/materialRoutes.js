// File: Daily-Report-backend/src/routes/materialRoutes.js
// Material Routes

const express = require('express');
const router = express.Router();
// const materialController = require('../../material_master/controllers/materialController');
const materialController = require("../controllers/materialController");
const { authenticateToken } = require('../../../middleware/authMiddleware');

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * Material CRUD Operations
 */

// Get statistics
router.get('/stats', materialController.getInventoryStats);

// Get all materials (with pagination, filtering, search)
router.get('/', materialController.getAllMaterials);

// Export materials to CSV
router.get('/export', materialController.exportMaterials);

// Validate material code uniqueness
router.get('/validate/code', materialController.validateMaterialCode);

// Get low stock items
// router.get('/low-stock', materialController.getLowStockItems);

// Get materials by brand
router.get('/brand/:brand', materialController.getMaterialsByBrand);

// Get single material by ID
router.get('/:id', materialController.getMaterialById);

// Create new material
router.post('/', materialController.createMaterial);

// Update material
router.put('/:id',materialController.updateMaterial);

// Delete single material
router.delete('/:id', materialController.deleteMaterial);

// Bulk delete materials
router.delete('/bulk/delete', materialController.bulkDeleteMaterials);

// Import materials from CSV/Excel
router.post('/import', materialController.importMaterials);

module.exports = router;

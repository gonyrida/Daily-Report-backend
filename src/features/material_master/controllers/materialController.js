// File: Daily-Report-backend/src/controllers/materialController.js
// Material Controller - CRUD operations

const Material = require('../models/materialModel');
const User = require("../../../models/userModel");

/**
 * @desc    Get all materials with pagination, filtering, and search
 * @route   GET /api/materials
 * @access  Private
 */
exports.getAllMaterials = async (req, res) => {
  const {
    page = 1,
    limit = 10,
    search,
    brand,
    unit,
    status,
    minPrice,
    maxPrice,
    sortBy = '-updatedAt'
  } = req.query;

  // Build filter object
  const filter = {};
  
  if (status) {
    filter.status = status;
  }
  
  if (brand) {
    filter.brand = brand;
  }
  
  if (unit) {
    filter.unit = unit;
  }
  
  if (minPrice || maxPrice) {
    filter.$expr = {};
  }

  // Search by code, description, or brand
  if (search) {
    filter.$or = [
      { code: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { brand: { $regex: search, $options: 'i' } }
    ];
  }

  // Price range filter
  if (minPrice || maxPrice) {
    filter.$expr = {
      $and: [
        minPrice ? { $gte: ['$unitPrice', parseFloat(minPrice)] } : {},
        maxPrice ? { $lte: ['$unitPrice', parseFloat(maxPrice)] } : {}
      ].filter(condition => Object.keys(condition).length > 0)
    };
  }

  try {
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const [items, total] = await Promise.all([
      Material.find(filter)
        .sort(sortBy)
        .skip(skip)
        .limit(parseInt(limit))
        .populate('createdBy', 'name email')
        .populate('lastModifiedBy', 'name email'),
      Material.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(total / parseInt(limit));

    res.status(200).json({
      success: true,
      items,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages,
      hasNextPage: parseInt(page) < totalPages,
      hasPrevPage: parseInt(page) > 1
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching materials',
      error: error.message
    });
  }
};

/**
 * @desc    Get single material by ID
 * @route   GET /api/materials/:id
 * @access  Private
 */
exports.getMaterialById = async (req, res) => {
  const material = await Material.findById(req.params.id)
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  if (!material) {
    return res.status(404).json({
      success: false,
      message: 'Material not found'
    });
  }

  res.status(200).json({
    success: true,
    data: material
  });
};

/**
 * @desc    Create new material
 * @route   POST /api/materials
 * @access  Private
 */
exports.createMaterial = async (req, res) => {
  const { code, description, reference, unit, unitPrice, brand, status } = req.body;

  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  } else if (user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "User not authorized"
    }); 
  }

  // Validation
  if (!code || !description || !unit || !unitPrice || !brand) {
    return res.status(400).json({
      success: false,
      message: 'Missing required fields: code, description, unit, unitPrice, brand'
    });
  }

  // Check for duplicate code
  const existingMaterial = await Material.findOne({ code });
  if (existingMaterial) {
    return res.status(409).json({
      success: false,
      message: `Material with code ${code} already exists`
    });
  }

  const material = new Material({
    code,
    description,
    reference: reference || '#file:placeholder.png',
    unit,
    unitPrice,
    brand,
    status: status || 'active',
    createdBy: req.user.id,
    lastModifiedBy: req.user.id
  });

  const savedMaterial = await material.save();
  await savedMaterial.populate('createdBy', 'name email');
  await savedMaterial.populate('lastModifiedBy', 'name email');

  res.status(201).json({
    success: true,
    message: 'Material created successfully',
    data: savedMaterial
  });
};

/**
 * @desc    Update material
 * @route   PUT /api/materials/:id
 * @access  Private
 */
exports.updateMaterial = async (req, res) => {
  const { code, description, reference, unit, unitPrice, brand, status } = req.body;

  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  } else if (user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "User not authorized"
    }); 
  }

  const material = await Material.findById(req.params.id);
  if (!material) {
    return res.status(404).json({
      success: false,
      message: 'Material not found'
    });
  }

  // Check for duplicate code if updating code
  if (code && code !== material.code) {
    const existingMaterial = await Material.findOne({ code });
    if (existingMaterial) {
      return res.status(409).json({
        success: false,
        message: `Material with code ${code} already exists`
      });
    }
  }

  // Update fields
  if (code) material.code = code;
  if (description) material.description = description;
  if (reference) material.reference = reference;
  if (unit) material.unit = unit;
  if (unitPrice !== undefined) material.unitPrice = unitPrice;
  if (brand) material.brand = brand;
  if (status) material.status = status;

  material.lastModifiedBy = req.user.id;

  const updatedMaterial = await material.save();
  await updatedMaterial.populate('createdBy', 'name email');
  await updatedMaterial.populate('lastModifiedBy', 'name email');

  res.status(200).json({
    success: true,
    message: 'Material updated successfully',
    data: updatedMaterial
  });
};

/**
 * @desc    Delete material
 * @route   DELETE /api/materials/:id
 * @access  Private
 */
exports.deleteMaterial = async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  } else if (user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "User not authorized"
    }); 
  }

  const material = await Material.findById(req.params.id);
  if (!material) {
    return res.status(404).json({
      success: false,
      message: 'Material not found'
    });
  }

  await Material.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    message: 'Material deleted successfully'
  });
};

/**
 * @desc    Bulk delete materials
 * @route   DELETE /api/materials/bulk/delete
 * @access  Private
 */
exports.bulkDeleteMaterials = async (req, res) => {
  const user = await User.findById(req.user.userId);
  if (!user) {
    return res.status(404).json({
      success: false,
      message: "User not found"
    });
  } else if (user.role !== "admin") {
    return res.status(403).json({
      success: false,
      message: "User not authorized"
    }); 
  }

  const { ids } = req.body;

  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Please provide an array of material IDs'
    });
  }

  const result = await Material.deleteMany({
    _id: { $in: ids }
  });

  res.status(200).json({
    success: true,
    message: `${result.deletedCount} materials deleted successfully`,
    deleted: result.deletedCount
  });
};

/**
 * @desc    Bulk import materials from CSV/Excel
 * @route   POST /api/materials/import
 * @access  Private
 */
exports.importMaterials = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: 'No file uploaded'
    });
  }

  // TODO: Parse CSV/Excel file and validate data
  // This requires implementing CSV parsing logic

  res.status(200).json({
    success: true,
    message: 'Import functionality to be implemented',
    imported: 0,
    errors: []
  });
};

/**
 * @desc    Export materials to CSV
 * @route   GET /api/materials/export
 * @access  Private
 */
exports.exportMaterials = async (req, res) => {
  const { search, brand, unit, status } = req.query;

  // Build filter (same as getAllMaterials)
  const filter = {};
  if (status) filter.status = status;
  if (brand) filter.brand = brand;
  if (unit) filter.unit = unit;
  if (search) {
    filter.$or = [
      { code: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
      { brand: { $regex: search, $options: 'i' } }
    ];
  }

  const materials = await Material.find(filter);

  // TODO: Implement CSV export
  // This requires CSV library integration

  res.status(200).json({
    success: true,
    message: 'Export functionality to be implemented'
  });
};

/**
 * @desc    Validate material code uniqueness
 * @route   GET /api/materials/validate/code
 * @access  Private
 */
exports.validateMaterialCode = async (req, res) => {
  const { code, excludeId } = req.query;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Code is required for validation'
    });
  }

  const query = { code };
  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  const existingMaterial = await Material.findOne(query);

  res.status(200).json({
    success: true,
    valid: !existingMaterial
  });
};

/**
 * @desc    Get materials by brand
 * @route   GET /api/materials/brand/:brand
 * @access  Private
 */
exports.getMaterialsByBrand = async (req, res) => {
  const { brand } = req.params;

  const materials = await Material.find({ brand })
    .populate('createdBy', 'name email')
    .populate('lastModifiedBy', 'name email');

  res.status(200).json({
    success: true,
    count: materials.length,
    data: materials
  });
};

// /**
//  * @desc    Get low stock items
//  * @route   GET /api/materials/low-stock
//  * @access  Private
//  */
// exports.getLowStockItems = async (req, res) => {
//   const { warningLevel = 10 } = req.query;

//   const materials = await Material.find({
//     quantity: { $lte: parseInt(warningLevel) }
//   })
//     .populate('createdBy', 'name email')
//     .populate('lastModifiedBy', 'name email');

//   res.status(200).json({
//     success: true,
//     count: materials.length,
//     warningLevel: parseInt(warningLevel),
//     data: materials
//   });
// };

/**
 * @desc    Get inventory statistics
 * @route   GET /api/materials/stats
 * @access  Private
 */
exports.getInventoryStats = async (req, res) => {
  const totalMaterials = await Material.countDocuments();
  const activeMaterials = await Material.countDocuments({ status: 'active' });
  const inactiveMaterials = await Material.countDocuments({ status: 'inactive' });

  const unitBreakdown = await Material.aggregate([
    { $group: { _id: '$unit', count: { $sum: 1 } } }
  ]);

  res.status(200).json({
    success: true,
    stats: {
      totalMaterials,
      activeMaterials,
      inactiveMaterials,
      unitBreakdown
    }
  });
};

module.exports = exports;

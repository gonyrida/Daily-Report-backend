const Item = require('../models/dailyReportDropdownModels/itemModel');
const Role = require('../models/dailyReportDropdownModels/roleModel');
const Unit = require('../models/dailyReportDropdownModels/unitModel');

const dailyReportDropdownService = require("../services/dailyReportDropdownService");

// Get all options (item, unit, and role)
const getAllOptions = async (req, res) => {
  try {
    const categorizedData = await dailyReportDropdownService.getAllOptions();
    
    res.status(200).json({
      success: true,
      data: categorizedData
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Bulk upsert for all dropdown options (items, units, roles)
const bulkUpsertAll = async (req, res) => {
  try {
    const { items, roles } = req.body;

    if (!items || !Array.isArray(items)) {
      return res.status(400).json({ error: "Invalid items array" });
    }

    const result = await dailyReportDropdownService.bulkUpsertAll(items, roles);

    res.status(200).json({
      message: "Sync successful",
      upsertedCount: result.upsertedCount,
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// Item Controllers
const renameItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type } = req.body;

    const updated = await dailyReportDropdownService.renameItem(id, { name, type });
    
    if (!updated) return res.status(404).json({ error: "Item not found" });

    res.status(200).json({ message: "Item updated", data: updated });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const removeItem = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await dailyReportDropdownService.removeItem(id);
    
    if (!deleted) return res.status(404).json({ error: "Item not found" });

    res.status(200).json({ message: "Item removed successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Unit Controllers
const renameUnit = async (req, res) => {
  try {
    const { id } = req.params;
    const { newLabel } = req.body;

    const updatedUnit = await dailyReportDropdownService.renameUnit(id, newLabel);
    
    if (!updatedUnit) return res.status(404).json({ error: "Unit not found" });

    res.status(200).json({ message: "Unit renamed", data: updatedUnit });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const removeUnit = async (req, res) => {
  try {
    const { id } = req.params;
    await dailyReportDropdownService.removeUnit(id);
    res.status(200).json({ message: "Unit removed successfully" });
  } catch (error) {
    // If our service threw the "In Use" error, it catches here
    res.status(400).json({ error: error.message });
  }
};

// Role Controllers
const renameRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { newRole } = req.body;

    const updatedRole = await dailyReportDropdownService.renameRole(id, newRole);
    
    if (!updatedRole) return res.status(404).json({ error: "Role not found" });

    res.status(200).json({ message: "Role renamed", data: updatedRole });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const removeRole = async (req, res) => {
  try {
    const { id } = req.params;
    await dailyReportDropdownService.removeRole(id);
    res.status(200).json({ message: "Role removed successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  getAllOptions,
  bulkUpsertAll,
  renameItem,
  removeItem,
  renameUnit,
  removeUnit,
  renameRole,
  removeRole
}
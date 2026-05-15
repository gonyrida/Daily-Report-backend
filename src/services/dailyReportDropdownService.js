const Item = require('../models/dailyReportDropdownModels/itemModel');
const Role = require('../models/dailyReportDropdownModels/roleModel');
const Unit = require('../models/dailyReportDropdownModels/unitModel');

// Get alll dropdown options for items, roles, and units
const getAllOptions = async () => {
  const [items, allUnits, allRoles] = await Promise.all([
    Item.find().populate('unit'),
    Unit.find(),
    Role.find()
  ]);

  // 1. Group Items by type (material, equipment)
  const groupedItems = items.reduce((acc, item) => {
    const type = item.type;
    const formattedItem = {
      id: item._id,
      name: item.name,
      unit: item.unit ? item.unit.name : 'N/A',
      unitId: item.unit?._id || null,
    };

    if (acc[type]) acc[type].push(formattedItem);
    return acc;
  }, { material: [], equipment: [] });

  // 2. Group Roles by type (working, management, etc.)
  const groupedRoles = allRoles.reduce((acc, role) => {
    const type = role.type;
    const formattedRole = {
      id: role._id,
      name: role.name,
      type: role.type
    };

    if (acc[type]) acc[type].push(formattedRole);
    return acc;
  }, {management: [], working: []});

  return {
    items: groupedItems,
    units: allUnits.map(u => ({ id: u._id, name: u.name })),
    roles: groupedRoles // Now returns an object grouped by type
  };
};

// Helper function to sync auxiliary collections (Units and Roles)
const syncAuxiliaryCollection = async (Model, items, isUnit = false) => {
  console.log("This is items ", items)
  // 1. Handle Uniqueness for Objects
  // We stringify or create a composite key to ensure we don't have duplicates
  const seen = new Set();
  const uniqueItems = items.filter(item => {
    const identifier = isUnit ? item.trim().toLowerCase() : `${item.type}-${item.name}`;
    if (seen.has(identifier)) return false;
    seen.add(identifier);
    return true;
  });

  const ops = uniqueItems.map(item => {
    // If it's a unit, it's still a string. If it's a role, it's an object {type, name}
    const filter = isUnit 
      ? { normalizedLabel: item.trim().toLowerCase() } 
      : { name: item.name, type: item.type };

    const update = isUnit 
      ? { name: item.trim(), normalizedLabel: item.trim().toLowerCase() } 
      : { name: item.name, type: item.type };
      
    return {
      updateOne: { filter, update, upsert: true }
    };
  });

  if (ops.length > 0) await Model.bulkWrite(ops);

  const docs = await Model.find();
  return docs.reduce((map, doc) => {
    // 2. Mapping Logic
    // For roles, we create a composite key so bulkUpsertAll can find the ID
    const key = isUnit ? doc.normalizedLabel : `${doc.type}-${doc.name}`;
    map[key] = doc._id;
    return map;
  }, {});
};

// Bulk upsert for all dropdown options (items, units, roles)
const bulkUpsertAll = async (itemsData, rolesData) => {
  // 1. Sync Units (extracted from items) and Roles (from separate list) in parallel
  const unitLabels = itemsData.map(i => i.unit);
  
  const [unitMap, roleMap] = await Promise.all([
    syncAuxiliaryCollection(Unit, unitLabels, true),
    syncAuxiliaryCollection(Role, rolesData, false)
  ]);

  // 2. Prepare Item bulk operations
  const itemOps = itemsData.map(item => ({
    updateOne: {
      filter: { name: item.name.trim(), type: item.type },
      update: {
        name: item.name.trim(),
        type: item.type,
        unit: unitMap[item.unit.trim().toLowerCase()]
      },
      upsert: true
    }
  }));

  const itemResult = await Item.bulkWrite(itemOps);

  return {
    itemResult,
    roleCount: Object.keys(roleMap).length,
    unitCount: Object.keys(unitMap).length
  };
};

// Item Service Functions
const renameItem = async (itemId, updateData) => {
  // If renaming, check if the new name is already taken by ANOTHER item
  if (updateData.name) {
    const existing = await Item.findOne({ 
      name: updateData.name.trim(), 
      type: updateData.type,
      _id: { $ne: itemId }
    });
    
    if (existing) {
      throw new Error("An item with this name and type already exists.");
    }
  }

  return await Item.findByIdAndUpdate(
    itemId,
    { ...updateData, name: updateData.name?.trim() },
    { new: true, runValidators: true }
  );
};

const removeItem = async (itemId) => {
  // Strategy: Hard delete for now, but in a production app 
  // you might just set isActive: false to preserve report history.
  return await Item.findByIdAndDelete(itemId);
};

// Unit Service Functions
const renameUnit = async (unitId, newLabel) => {
  const normalized = newLabel.trim().toLowerCase();
  
  return await Unit.findByIdAndUpdate(
    unitId,
    { name: newLabel.trim(), normalizedLabel: normalized },
    { new: true, runValidators: true }
  );
};

const removeUnit = async (unitId) => {
  // Check if any items are still linked to this unit
  const inUse = await Item.exists({ unit: unitId });
  
  if (inUse) {
    throw new Error("Cannot remove unit: It is currently linked to existing items.");
  }

  return await Unit.findByIdAndDelete(unitId);
};

// Role Service Functions
const renameRole = async (roleId, newRole) => {
  return await Role.findByIdAndUpdate(
    roleId,
    { name: newRole.trim()},
    { new: true, runValidators: true }
  );
};

const removeRole = async (roleId) => {
  return await Role.findByIdAndDelete(roleId);
};

module.exports = {
  getAllOptions,
  bulkUpsertAll,
  renameItem,
  removeItem,
  renameUnit,
  removeUnit,
  renameRole,
  removeRole,
};
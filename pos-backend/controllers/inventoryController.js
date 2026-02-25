const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const InventoryItem = require("../models/inventoryItemModel");
const { getMenuItemEntries, normalizeMenuItemName } = require("../utils/orderPricing");
const { normalizeLocationId, applyOutOfStockFlag } = require("../utils/inventoryService");
const { queueInventoryAvailabilitySyncTasks } = require("../utils/inventoryChannelSync");
const { logAuditEvent } = require("../utils/auditLogger");

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 100);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 100,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const upsertInventoryItem = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    const displayName = `${req.body.displayName || ""}`.trim();
    const itemCode = normalizeMenuItemName(req.body.itemCode || displayName);
    const availableQuantity = Number(req.body.availableQuantity ?? 0);
    const lowStockThreshold = Number(req.body.lowStockThreshold ?? 5);
    const unit = `${req.body.unit || "portion"}`.trim();

    if (!displayName) {
      return next(createHttpError(400, "displayName is required."));
    }

    if (!itemCode) {
      return next(createHttpError(400, "itemCode could not be derived."));
    }

    if (!Number.isFinite(availableQuantity) || availableQuantity < 0) {
      return next(createHttpError(400, "availableQuantity must be >= 0."));
    }

    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
      return next(createHttpError(400, "lowStockThreshold must be >= 0."));
    }

    const existing = await InventoryItem.findOne({ locationId, itemCode });
    const previousOutOfStock = existing ? Boolean(existing.isOutOfStock) : null;

    const updateData = {
      locationId,
      itemCode,
      displayName,
      availableQuantity,
      lowStockThreshold,
      unit,
      autoDisableOnOutOfStock: req.body.autoDisableOnOutOfStock ?? true,
      autoDisabledByStock: req.body.autoDisabledByStock ?? false,
      status: req.body.status || "active",
      isOutOfStock: availableQuantity <= 0,
      metadata: req.body.metadata,
      lastMovementAt: new Date(),
    };

    const item = await InventoryItem.findOneAndUpdate(
      { locationId, itemCode },
      { $set: updateData },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    await applyOutOfStockFlag(item);

    if (previousOutOfStock === null || previousOutOfStock !== Boolean(item.isOutOfStock)) {
      await queueInventoryAvailabilitySyncTasks({ item });
    }

    await logAuditEvent({
      req,
      action: "INVENTORY_ITEM_UPSERTED",
      resourceType: "InventoryItem",
      resourceId: item._id,
      statusCode: 200,
      metadata: {
        locationId: item.locationId,
        itemCode: item.itemCode,
        availableQuantity: item.availableQuantity,
      },
    });

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    return next(error);
  }
};

const listInventoryItems = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.locationId) {
      query.locationId = normalizeLocationId(req.query.locationId);
    }

    if (req.query.status) {
      query.status = `${req.query.status}`.trim();
    }

    if (req.query.onlyLowStock === "true") {
      query.$expr = { $lte: ["$availableQuantity", "$lowStockThreshold"] };
    }

    if (req.query.search) {
      const escaped = `${req.query.search}`.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { displayName: { $regex: escaped, $options: "i" } },
        { itemCode: { $regex: escaped, $options: "i" } },
      ];
    }

    const [rows, total] = await Promise.all([
      InventoryItem.find(query).sort({ updatedAt: -1 }).skip(offset).limit(limit),
      InventoryItem.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: { limit, offset, total },
    });
  } catch (error) {
    return next(error);
  }
};

const adjustInventoryItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid inventory item id."));
    }

    const delta = Number(req.body.delta);
    const reason = `${req.body.reason || ""}`.trim();

    if (!Number.isFinite(delta) || delta === 0) {
      return next(createHttpError(400, "delta must be a non-zero number."));
    }

    const item = await InventoryItem.findById(id);
    if (!item) {
      return next(createHttpError(404, "Inventory item not found."));
    }

    const previousOutOfStock = Boolean(item.isOutOfStock);
    const nextQuantity = item.availableQuantity + delta;
    if (nextQuantity < 0) {
      return next(createHttpError(409, "Inventory cannot go below zero."));
    }

    item.availableQuantity = nextQuantity;
    item.lastMovementAt = new Date();
    await item.save();
    await applyOutOfStockFlag(item);

    if (previousOutOfStock !== Boolean(item.isOutOfStock)) {
      await queueInventoryAvailabilitySyncTasks({ item });
    }

    await logAuditEvent({
      req,
      action: "INVENTORY_ITEM_ADJUSTED",
      resourceType: "InventoryItem",
      resourceId: item._id,
      statusCode: 200,
      metadata: {
        locationId: item.locationId,
        itemCode: item.itemCode,
        delta,
        reason,
        availableQuantity: item.availableQuantity,
      },
    });

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    return next(error);
  }
};

const bootstrapInventoryFromMenu = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    const defaultQuantity = Number(req.body.defaultQuantity ?? 0);
    const lowStockThreshold = Number(req.body.lowStockThreshold ?? 5);

    if (!Number.isFinite(defaultQuantity) || defaultQuantity < 0) {
      return next(createHttpError(400, "defaultQuantity must be >= 0."));
    }

    if (!Number.isFinite(lowStockThreshold) || lowStockThreshold < 0) {
      return next(createHttpError(400, "lowStockThreshold must be >= 0."));
    }

    const menuItems = getMenuItemEntries();
    const operations = menuItems.map((entry) => {
      const displayName = entry.name
        .split(" ")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

      return InventoryItem.updateOne(
        { locationId, itemCode: entry.name },
        {
          $setOnInsert: {
            locationId,
            itemCode: entry.name,
            displayName,
            availableQuantity: defaultQuantity,
            lowStockThreshold,
            isOutOfStock: defaultQuantity <= 0,
            status: "active",
            unit: "portion",
            autoDisableOnOutOfStock: true,
            autoDisabledByStock: false,
            lastMovementAt: new Date(),
          },
        },
        { upsert: true }
      );
    });

    await Promise.all(operations);

    await logAuditEvent({
      req,
      action: "INVENTORY_BOOTSTRAPPED",
      resourceType: "InventoryItem",
      statusCode: 200,
      metadata: {
        locationId,
        totalItems: menuItems.length,
        defaultQuantity,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Inventory bootstrap completed.",
      totalItems: menuItems.length,
      locationId,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  upsertInventoryItem,
  listInventoryItems,
  adjustInventoryItem,
  bootstrapInventoryFromMenu,
};

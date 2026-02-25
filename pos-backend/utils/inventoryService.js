const createHttpError = require("http-errors");
const InventoryItem = require("../models/inventoryItemModel");
const config = require("../config/config");
const { normalizeMenuItemName } = require("./orderPricing");

const DEFAULT_LOCATION_ID = "default";

const normalizeLocationId = (locationId) => `${locationId || ""}`.trim() || DEFAULT_LOCATION_ID;

const applyOutOfStockFlag = async (inventoryItem) => {
  if (!inventoryItem) {
    return inventoryItem;
  }

  const shouldBeOutOfStock = inventoryItem.availableQuantity <= 0;
  let hasChanges = false;

  if (inventoryItem.isOutOfStock !== shouldBeOutOfStock) {
    inventoryItem.isOutOfStock = shouldBeOutOfStock;
    hasChanges = true;
  }

  if (inventoryItem.autoDisableOnOutOfStock) {
    if (shouldBeOutOfStock && inventoryItem.status !== "inactive") {
      inventoryItem.status = "inactive";
      inventoryItem.autoDisabledByStock = true;
      hasChanges = true;
    }

    if (!shouldBeOutOfStock && inventoryItem.autoDisabledByStock && inventoryItem.status === "inactive") {
      inventoryItem.status = "active";
      inventoryItem.autoDisabledByStock = false;
      hasChanges = true;
    }
  } else if (inventoryItem.autoDisabledByStock) {
    inventoryItem.autoDisabledByStock = false;
    hasChanges = true;
  }

  if (hasChanges) {
    await inventoryItem.save();
  }

  return inventoryItem;
};

const reserveInventoryForOrder = async ({ locationId, items }) => {
  const normalizedLocationId = normalizeLocationId(locationId);
  const reservations = [];

  for (const item of items || []) {
    const quantity = Number(item?.quantity);
    const itemCode = normalizeMenuItemName(item?.name || "");

    if (!itemCode || !Number.isInteger(quantity) || quantity < 1) {
      throw createHttpError(400, "Invalid order item for inventory reservation.");
    }

    const updated = await InventoryItem.findOneAndUpdate(
      {
        locationId: normalizedLocationId,
        itemCode,
        status: "active",
        availableQuantity: { $gte: quantity },
      },
      {
        $inc: { availableQuantity: -quantity },
        $set: { lastMovementAt: new Date() },
      },
      { new: true }
    );

    if (!updated) {
      const existing = await InventoryItem.findOne({
        locationId: normalizedLocationId,
        itemCode,
      });

      if (!existing) {
        if (config.inventoryEnforced) {
          throw createHttpError(409, `Inventory is not configured for item: ${item.name}`);
        }
        continue;
      }

      if (existing.status !== "active") {
        throw createHttpError(409, `Inventory item is inactive: ${item.name}`);
      }

      if (existing.isOutOfStock || existing.availableQuantity < quantity) {
        throw createHttpError(409, `Out of stock: ${item.name}`);
      }

      throw createHttpError(409, `Inventory conflict for item: ${item.name}`);
    }

    await applyOutOfStockFlag(updated);
    reservations.push({ itemId: updated._id, quantity });
  }

  return reservations;
};

const releaseInventoryReservations = async (reservations = []) => {
  for (const entry of reservations) {
    const quantity = Number(entry?.quantity);
    if (!entry?.itemId || !Number.isInteger(quantity) || quantity <= 0) {
      continue;
    }

    const updated = await InventoryItem.findByIdAndUpdate(
      entry.itemId,
      {
        $inc: { availableQuantity: quantity },
        $set: { lastMovementAt: new Date() },
      },
      { new: true }
    );

    if (updated) {
      await applyOutOfStockFlag(updated);
    }
  }
};

module.exports = {
  DEFAULT_LOCATION_ID,
  normalizeLocationId,
  applyOutOfStockFlag,
  reserveInventoryForOrder,
  releaseInventoryReservations,
};

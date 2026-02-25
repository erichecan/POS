const InventoryChannelSyncTask = require("../models/inventoryChannelSyncTaskModel");
const StoreChannelConnection = require("../models/storeChannelConnectionModel");
const ChannelProvider = require("../models/channelProviderModel");

const normalizeLocationId = (value) => `${value || ""}`.trim() || "default";
const normalizeCode = (value) => `${value || ""}`.trim().toUpperCase();

const resolveTargetAvailability = ({ isOutOfStock }) =>
  isOutOfStock ? "UNAVAILABLE" : "AVAILABLE";

const queueInventoryAvailabilitySyncTasks = async ({ item }) => {
  if (!item) {
    return [];
  }

  const locationId = normalizeLocationId(item.locationId);
  const providerCodes = await StoreChannelConnection.find({ locationId, enabled: true }).distinct(
    "providerCode"
  );

  if (!providerCodes.length) {
    return [];
  }

  const availabilityProviders = await ChannelProvider.find({
    providerCode: { $in: providerCodes.map((code) => normalizeCode(code)) },
    status: "active",
    "capabilities.availability": true,
  }).select("providerCode");

  const targetAvailability = resolveTargetAvailability({ isOutOfStock: item.isOutOfStock });

  const tasks = [];
  for (const provider of availabilityProviders) {
    const providerCode = normalizeCode(provider.providerCode);

    const task = await InventoryChannelSyncTask.findOneAndUpdate(
      {
        locationId,
        providerCode,
        itemCode: item.itemCode,
        targetAvailability,
        status: "PENDING",
      },
      {
        $setOnInsert: {
          locationId,
          providerCode,
          itemCode: item.itemCode,
          displayName: item.displayName,
          targetAvailability,
          status: "PENDING",
          attempts: 0,
          metadata: {
            triggeredByStock: true,
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    tasks.push(task);
  }

  return tasks;
};

module.exports = {
  normalizeLocationId,
  normalizeCode,
  resolveTargetAvailability,
  queueInventoryAvailabilitySyncTasks,
};

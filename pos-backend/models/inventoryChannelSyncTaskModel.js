const mongoose = require("mongoose");

const inventoryChannelSyncTaskSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, index: true },
    providerCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    itemCode: { type: String, required: true, trim: true, lowercase: true, index: true },
    displayName: { type: String, trim: true },
    targetAvailability: { type: String, enum: ["AVAILABLE", "UNAVAILABLE"], required: true },
    status: { type: String, enum: ["PENDING", "SYNCED", "FAILED"], default: "PENDING", index: true },
    attempts: { type: Number, default: 0, min: 0 },
    lastAttemptAt: { type: Date },
    lastError: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

inventoryChannelSyncTaskSchema.index(
  {
    locationId: 1,
    providerCode: 1,
    itemCode: 1,
    targetAvailability: 1,
    status: 1,
  },
  { unique: true, partialFilterExpression: { status: "PENDING" } }
);

inventoryChannelSyncTaskSchema.index({ locationId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model("InventoryChannelSyncTask", inventoryChannelSyncTaskSchema);

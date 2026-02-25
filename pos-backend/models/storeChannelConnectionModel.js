const mongoose = require("mongoose");

const SYNC_MODES = ["pull", "push", "hybrid"];

const storeChannelConnectionSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true },
    providerCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    externalStoreId: { type: String, required: true, trim: true },
    credentialRef: { type: String, required: true, trim: true },
    menuMappingPolicy: {
      type: String,
      enum: ["manual", "auto", "hybrid"],
      default: "manual",
    },
    statusMappingPolicy: { type: String, trim: true, default: "default" },
    enabled: { type: Boolean, default: true },
    syncMode: { type: String, enum: SYNC_MODES, default: "hybrid" },
    retryPolicy: {
      maxRetries: { type: Number, default: 5, min: 0, max: 20 },
      baseDelayMs: { type: Number, default: 500, min: 0, max: 60000 },
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

storeChannelConnectionSchema.index(
  { locationId: 1, providerCode: 1, externalStoreId: 1 },
  { unique: true }
);
storeChannelConnectionSchema.index({ locationId: 1, providerCode: 1, enabled: 1 });

module.exports = mongoose.model("StoreChannelConnection", storeChannelConnectionSchema);

const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    regionId: { type: mongoose.Schema.Types.ObjectId, ref: "Region", required: true, index: true },
    locationId: { type: String, required: true, trim: true, unique: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
    timezone: { type: String, trim: true },
    channelSet: { type: [String], default: [] },
    overrideSettings: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

storeSchema.index({ organizationId: 1, regionId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("Store", storeSchema);

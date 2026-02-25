const mongoose = require("mongoose");

const storeVerticalProfileSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, unique: true, index: true },
    countryCode: { type: String, required: true, trim: true, uppercase: true, default: "US" },
    templateCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    templateVersion: { type: String, trim: true },
    profileStatus: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
    overrides: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

storeVerticalProfileSchema.index({ countryCode: 1, templateCode: 1, profileStatus: 1, updatedAt: -1 });

module.exports = mongoose.model("StoreVerticalProfile", storeVerticalProfileSchema);

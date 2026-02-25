const mongoose = require("mongoose");

const hardwareSelectionSchema = new mongoose.Schema(
  {
    roleKey: { type: String, required: true, trim: true, uppercase: true },
    providerCode: { type: String, required: true, trim: true, uppercase: true },
    modelCode: { type: String, required: true, trim: true, uppercase: true },
    quantity: { type: Number, required: true, min: 1, max: 200, default: 1 },
    zone: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    resolvedDisplayName: { type: String, trim: true },
    resolvedDeviceClass: { type: String, trim: true, uppercase: true },
    capabilityTags: { type: [String], default: [] },
  },
  { _id: false }
);

const storeHardwareProfileSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, unique: true, index: true },
    countryCode: { type: String, required: true, trim: true, uppercase: true, default: "US" },
    businessType: { type: String, trim: true, uppercase: true },
    profileStatus: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
    providerPriority: { type: [String], default: [] },
    capabilityTargets: { type: [String], default: [] },
    selections: { type: [hardwareSelectionSchema], default: [] },
    validationWarnings: { type: [String], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

storeHardwareProfileSchema.index({ countryCode: 1, profileStatus: 1, updatedAt: -1 });
storeHardwareProfileSchema.index({ businessType: 1, profileStatus: 1, updatedAt: -1 });

module.exports = mongoose.model("StoreHardwareProfile", storeHardwareProfileSchema);

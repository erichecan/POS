const mongoose = require("mongoose");

const compliancePolicyPackSchema = new mongoose.Schema(
  {
    countryCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    name: { type: String, required: true, trim: true },
    version: { type: String, required: true, trim: true },
    status: { type: String, enum: ["DRAFT", "ACTIVE", "ARCHIVED"], default: "DRAFT", index: true },
    rules: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

compliancePolicyPackSchema.index({ countryCode: 1, version: 1 }, { unique: true });

module.exports = mongoose.model("CompliancePolicyPack", compliancePolicyPackSchema);

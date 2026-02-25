const mongoose = require("mongoose");

const regionSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    code: { type: String, required: true, trim: true, uppercase: true },
    name: { type: String, required: true, trim: true },
    countryCode: { type: String, trim: true, uppercase: true },
    currency: { type: String, trim: true, uppercase: true, default: "EUR" },
    timezone: { type: String, trim: true, default: "UTC" },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
    defaultSettings: { type: mongoose.Schema.Types.Mixed, default: {} },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

regionSchema.index({ organizationId: 1, code: 1 }, { unique: true });

module.exports = mongoose.model("Region", regionSchema);

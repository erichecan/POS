const mongoose = require("mongoose");

const DELIVERY_MODES = ["platform_delivery", "store_delivery", "pickup", "mixed"];

const marketProfileSchema = new mongoose.Schema(
  {
    countryCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    name: { type: String, required: true, trim: true },
    currency: { type: String, required: true, trim: true, uppercase: true },
    timezone: { type: String, required: true, trim: true },
    defaultTaxPolicy: {
      mode: {
        type: String,
        enum: ["inclusive", "exclusive", "none"],
        default: "exclusive",
      },
      rate: { type: Number, default: 0, min: 0, max: 100 },
    },
    defaultDeliveryMode: {
      type: String,
      enum: DELIVERY_MODES,
      default: "platform_delivery",
    },
    defaultChannelSet: {
      type: [String],
      default: [],
      set: (providers = []) =>
        providers.map((provider) => `${provider}`.trim().toUpperCase()).filter(Boolean),
    },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

marketProfileSchema.index({ status: 1, countryCode: 1 });

module.exports = mongoose.model("MarketProfile", marketProfileSchema);

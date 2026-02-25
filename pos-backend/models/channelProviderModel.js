const mongoose = require("mongoose");

const CHANNEL_TYPES = ["marketplace", "first_party", "dispatch", "social", "other"];
const AUTH_TYPES = ["oauth", "api_key", "jwt", "signature", "custom"];

const channelProviderSchema = new mongoose.Schema(
  {
    providerCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    displayName: { type: String, required: true, trim: true },
    channelType: {
      type: String,
      enum: CHANNEL_TYPES,
      default: "marketplace",
      required: true,
    },
    authType: {
      type: String,
      enum: AUTH_TYPES,
      default: "oauth",
      required: true,
    },
    capabilities: {
      orders: { type: Boolean, default: true },
      menu: { type: Boolean, default: false },
      status: { type: Boolean, default: true },
      refund: { type: Boolean, default: false },
      webhook: { type: Boolean, default: true },
      availability: { type: Boolean, default: false },
    },
    regionSupport: {
      type: [String],
      default: [],
      set: (regions = []) =>
        regions.map((region) => `${region}`.trim().toUpperCase()).filter(Boolean),
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

channelProviderSchema.index({ status: 1, providerCode: 1 });

module.exports = mongoose.model("ChannelProvider", channelProviderSchema);

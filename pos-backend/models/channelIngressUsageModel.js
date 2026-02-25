const mongoose = require("mongoose");

const channelIngressUsageSchema = new mongoose.Schema(
  {
    providerCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    locationId: { type: String, required: true, trim: true, index: true },
    bucketMinute: { type: String, required: true, trim: true, index: true },
    requestCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

channelIngressUsageSchema.index(
  { providerCode: 1, locationId: 1, bucketMinute: 1 },
  { unique: true }
);
channelIngressUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("ChannelIngressUsage", channelIngressUsageSchema);

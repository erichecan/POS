const mongoose = require("mongoose");

const developerApiUsageSchema = new mongoose.Schema(
  {
    apiKeyId: { type: mongoose.Schema.Types.ObjectId, ref: "DeveloperApiKey", required: true, index: true },
    bucketMinute: { type: String, required: true, index: true },
    requestCount: { type: Number, default: 0, min: 0 },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

developerApiUsageSchema.index({ apiKeyId: 1, bucketMinute: 1 }, { unique: true });
developerApiUsageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("DeveloperApiUsage", developerApiUsageSchema);

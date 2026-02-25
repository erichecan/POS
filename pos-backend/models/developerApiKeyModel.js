const mongoose = require("mongoose");

const developerApiKeySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    keyPrefix: { type: String, required: true, trim: true, index: true },
    keyHash: { type: String, required: true, trim: true, unique: true, index: true },
    status: { type: String, enum: ["ACTIVE", "DISABLED"], default: "ACTIVE", index: true },
    scopes: {
      type: [String],
      default: ["orders:read"],
      set: (scopes = []) =>
        Array.from(new Set(scopes.map((scope) => `${scope}`.trim().toLowerCase()).filter(Boolean))),
    },
    rateLimitPerMinute: { type: Number, default: 120, min: 1, max: 10000 },
    allowedIps: { type: [String], default: [] },
    sandboxOnly: { type: Boolean, default: false },
    lastUsedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

developerApiKeySchema.index({ status: 1, updatedAt: -1 });

module.exports = mongoose.model("DeveloperApiKey", developerApiKeySchema);

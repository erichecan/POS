const mongoose = require("mongoose");

const memberAccountSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    memberCode: { type: String, required: true, trim: true, uppercase: true, unique: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    tier: {
      type: String,
      enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM"],
      default: "BRONZE",
      index: true,
    },
    pointsBalance: { type: Number, default: 0, min: 0 },
    walletBalance: { type: Number, default: 0, min: 0 },
    lifetimeSpend: { type: Number, default: 0, min: 0 },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    tags: { type: [String], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

memberAccountSchema.index({ locationId: 1, phone: 1 }, { unique: true, sparse: true });
memberAccountSchema.index({ locationId: 1, email: 1 }, { unique: true, sparse: true });
memberAccountSchema.index({ locationId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model("MemberAccount", memberAccountSchema);

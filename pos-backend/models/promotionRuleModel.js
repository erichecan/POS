const mongoose = require("mongoose");

const promotionRuleSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
    discountType: { type: String, enum: ["PERCENT", "FIXED"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    maxDiscountAmount: { type: Number, min: 0 },
    stackable: { type: Boolean, default: false },
    autoApply: { type: Boolean, default: false },
    appliesToChannels: { type: [String], default: ["ALL"] },
    startAt: { type: Date },
    endAt: { type: Date },
    usageLimit: { type: Number, min: 1 },
    usageCount: { type: Number, default: 0, min: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

promotionRuleSchema.index({ locationId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model("PromotionRule", promotionRuleSchema);

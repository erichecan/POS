const mongoose = require("mongoose");

const promotionCouponSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, trim: true, uppercase: true, unique: true, index: true },
    promotionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PromotionRule",
      required: true,
      index: true,
    },
    memberId: { type: mongoose.Schema.Types.ObjectId, ref: "MemberAccount", index: true },
    status: { type: String, enum: ["ACTIVE", "DISABLED"], default: "ACTIVE", index: true },
    usageLimit: { type: Number, min: 1, default: 1 },
    usageCount: { type: Number, min: 0, default: 0 },
    expiresAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

promotionCouponSchema.index({ status: 1, expiresAt: 1 });

module.exports = mongoose.model("PromotionCoupon", promotionCouponSchema);

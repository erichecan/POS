/**
 * PromotionCouponRedemption - 核销流水 PRD 7.11.5
 * 2026-02-28T16:05:00+08:00
 */
const mongoose = require("mongoose");

const promotionCouponRedemptionSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    couponId: { type: mongoose.Schema.Types.ObjectId, ref: "PromotionCoupon", index: true },
    promotionId: { type: mongoose.Schema.Types.ObjectId, ref: "PromotionRule", required: true, index: true },
    code: { type: String, required: true, trim: true },
    sourceType: { type: String, enum: ["COUPON", "RULE"], default: "RULE" },
    discountAmount: { type: Number, required: true, min: 0 },
    redeemedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    locationId: { type: String, trim: true, default: "default", index: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

promotionCouponRedemptionSchema.index({ orderId: 1, couponId: 1 });
promotionCouponRedemptionSchema.index({ createdAt: -1 });

module.exports = mongoose.model("PromotionCouponRedemption", promotionCouponRedemptionSchema);

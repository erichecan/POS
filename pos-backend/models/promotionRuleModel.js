/**
 * PromotionRule - PRD 7.11 M11 优惠营销
 * 2026-02-28T16:00:00+08:00: 扩展 promoType/tiers/BOGO/菜品级
 */
const mongoose = require("mongoose");

const tierSchema = new mongoose.Schema(
  {
    threshold: { type: Number, required: true, min: 0 },
    discountType: { type: String, enum: ["PERCENT", "FIXED"], required: true },
    discountValue: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const promotionRuleSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    code: { type: String, required: true, trim: true, uppercase: true, unique: true },
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE", index: true },
    promoType: { type: String, enum: ["ORDER_DISCOUNT", "TIERED_OFF", "BOGO", "ITEM_DISCOUNT"], default: "ORDER_DISCOUNT", index: true },
    discountType: { type: String, enum: ["PERCENT", "FIXED"] },
    discountValue: { type: Number, min: 0 },
    minOrderAmount: { type: Number, default: 0, min: 0 },
    maxDiscountAmount: { type: Number, min: 0 },
    tiers: { type: [tierSchema], default: undefined },
    buyQuantity: { type: Number, min: 1 },
    getQuantity: { type: Number, min: 0 },
    appliesToCategoryIds: { type: [mongoose.Schema.Types.ObjectId], default: undefined },
    appliesToItemIds: { type: [mongoose.Schema.Types.ObjectId], default: undefined },
    priority: { type: Number, default: 0 },
    stackGroup: { type: String, trim: true },
    stackable: { type: Boolean, default: false },
    autoApply: { type: Boolean, default: false },
    appliesToChannels: { type: [String], default: ["ALL"] },
    startAt: { type: Date },
    endAt: { type: Date },
    usageLimit: { type: Number, min: 1 },
    usageCount: { type: Number, default: 0, min: 0 },
    maxPerOrder: { type: Number, min: 1 },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

promotionRuleSchema.index({ locationId: 1, status: 1, updatedAt: -1 });

module.exports = mongoose.model("PromotionRule", promotionRuleSchema);

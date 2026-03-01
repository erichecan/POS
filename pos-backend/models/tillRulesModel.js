/**
 * Till Rules - 收银与费用配置 PRD 7.24 M22
 * 2026-02-28T15:00:00+08:00
 */
const mongoose = require("mongoose");

const tillRulesSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default", unique: true, index: true },
    tipOptions: { type: [Number], default: [0, 10, 15, 18, 20, 25] },
    tipCustomAllowed: { type: Boolean, default: true },
    tipCalcBase: { type: String, enum: ["SUBTOTAL", "AFTER_TAX"], default: "SUBTOTAL" },
    tipRoundRule: { type: String, enum: ["FLOOR", "CEIL", "ROUND"], default: "ROUND" },
    tipShowOnReceipt: { type: Boolean, default: true },
    tipShowNoTipOption: { type: Boolean, default: true },
    ccServiceFeeRate: { type: Number, default: 0, min: 0, max: 100 },
    ccServiceFeeFixed: { type: Number, default: 0, min: 0 },
    debitServiceFeeRate: { type: Number, default: 0, min: 0, max: 100 },
    otherPaymentFeeRate: { type: Number, default: 0, min: 0, max: 100 },
    showServiceFeeSeparately: { type: Boolean, default: false },
    ccMinOrderAmount: { type: Number, default: 0, min: 0 },
    defaultTaxRate: { type: Number, default: 0, min: 0, max: 100 },
    taxRates: { type: mongoose.Schema.Types.Mixed, default: {} },
    taxInclusive: { type: Boolean, default: false },
    deliveryFeeBase: { type: Number, default: 0, min: 0 },
    packagingFee: { type: Number, default: 0, min: 0 },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

module.exports = mongoose.model("TillRules", tillRulesSchema);

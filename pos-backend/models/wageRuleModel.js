/**
 * 工资规则 - 时薪、加班倍率
 * 2026-02-28: 团队管理 Phase 1
 */
const mongoose = require("mongoose");

const wageRuleSchema = new mongoose.Schema(
  {
    positionId: { type: mongoose.Schema.Types.ObjectId, ref: "Position" },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date },
    baseHourlyRate: { type: Number, required: true, min: 0 },
    overtimeMultiplier: { type: Number, min: 1, default: 1.5 },
    tipShareRule: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

wageRuleSchema.index({ locationId: 1, effectiveFrom: 1 });
wageRuleSchema.index({ userId: 1, effectiveFrom: 1 });

module.exports = mongoose.model("WageRule", wageRuleSchema);

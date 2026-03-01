/**
 * 岗位模型 - 团队管理 Phase 1
 * 2026-02-28: 岗位定义，含 scopeType/scopeConfig/默认时薪
 */
const mongoose = require("mongoose");

const scopeConfigSchema = new mongoose.Schema(
  {
    tables: [{ type: Number }],
    tableRange: { from: { type: Number }, to: { type: Number } },
    stationCode: { type: String, trim: true },
  },
  { _id: false }
);

const positionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, index: true },
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    scopeType: {
      type: String,
      required: true,
      enum: ["TABLES", "BAR", "KITCHEN", "RUNNER", "TAKEOUT", "CASHIER", "MANAGER"],
    },
    scopeConfig: { type: scopeConfigSchema, default: () => ({}) },
    defaultHourlyRate: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

positionSchema.index({ locationId: 1, code: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Position", positionSchema);

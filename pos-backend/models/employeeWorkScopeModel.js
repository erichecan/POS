/**
 * 员工工作范围 - 岗位职责/管理范围
 * 2026-02-28: 服务员 A 管桌 1-4，服务员 B 管吧台 等
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

const employeeWorkScopeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    positionId: { type: mongoose.Schema.Types.ObjectId, ref: "Position" },
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    scopeType: {
      type: String,
      enum: ["TABLES", "BAR", "KITCHEN", "RUNNER", "TAKEOUT", "CASHIER", "MANAGER"],
    },
    scopeConfig: { type: scopeConfigSchema, default: () => ({}) },
    validFrom: { type: Date },
    validTo: { type: Date },
    scheduleOverride: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

employeeWorkScopeSchema.index({ userId: 1, locationId: 1 });

module.exports = mongoose.model("EmployeeWorkScope", employeeWorkScopeSchema);

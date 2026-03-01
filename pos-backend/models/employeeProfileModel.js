/**
 * 员工档案 - 关联 User 与 positionId/locationId
 * 2026-02-28: 团队管理 Phase 1，扩展 User 的岗位与门店信息
 */
const mongoose = require("mongoose");

const employeeProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    positionId: { type: mongoose.Schema.Types.ObjectId, ref: "Position" },
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    employeeNo: { type: String, trim: true },
    validFrom: { type: Date },
    validTo: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

employeeProfileSchema.index({ locationId: 1, userId: 1 });

module.exports = mongoose.model("EmployeeProfile", employeeProfileSchema);

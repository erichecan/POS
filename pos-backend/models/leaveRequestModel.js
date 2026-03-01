/**
 * 请假申请
 * 2026-02-28: 团队管理 Phase 1
 */
const mongoose = require("mongoose");

const leaveRequestSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["SICK", "PERSONAL", "OTHER"], default: "PERSONAL" },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    reason: { type: String, trim: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
      index: true,
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    replacementUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ userId: 1, startDate: 1 });

module.exports = mongoose.model("LeaveRequest", leaveRequestSchema);

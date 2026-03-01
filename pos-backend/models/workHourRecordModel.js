/**
 * 工时记录 - 签到/签出，对接打卡机或手工补录
 * 2026-02-28: 团队管理 Phase 1
 */
const mongoose = require("mongoose");

const workHourRecordSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    scheduleSlotId: { type: mongoose.Schema.Types.ObjectId, ref: "ScheduleSlot" },
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    date: { type: Date, required: true, index: true },
    clockInAt: { type: Date },
    clockOutAt: { type: Date },
    source: {
      type: String,
      enum: ["MANUAL", "PUNCH_CLOCK", "APP"],
      default: "MANUAL",
    },
    status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN", index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

workHourRecordSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model("WorkHourRecord", workHourRecordSchema);

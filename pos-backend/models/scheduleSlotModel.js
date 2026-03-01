/**
 * 排班槽位 - 某员工某日某时段的排班
 * 2026-02-28: 团队管理 Phase 1
 */
const mongoose = require("mongoose");

const scheduleSlotSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    shiftTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: "ShiftTemplate" },
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    date: { type: Date, required: true, index: true },
    plannedStart: { type: Date, required: true },
    plannedEnd: { type: Date, required: true },
    status: {
      type: String,
      enum: ["DRAFT", "CONFIRMED", "CANCELLED"],
      default: "DRAFT",
      index: true,
    },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

scheduleSlotSchema.index({ locationId: 1, date: 1 });
scheduleSlotSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model("ScheduleSlot", scheduleSlotSchema);

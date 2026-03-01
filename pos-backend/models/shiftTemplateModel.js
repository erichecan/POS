/**
 * 班次模板 - 早班/午班/晚班等
 * 2026-02-28: 团队管理 Phase 1
 */
const mongoose = require("mongoose");

const shiftTemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    startTime: { type: String, required: true, trim: true }, // "09:00"
    endTime: { type: String, required: true, trim: true },   // "17:00"
    breakMinutes: { type: Number, min: 0, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

shiftTemplateSchema.index({ locationId: 1, code: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("ShiftTemplate", shiftTemplateSchema);

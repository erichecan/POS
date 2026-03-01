/**
 * Signage Device - 广告屏配置
 * PRD 7.23.3 2026-02-28
 */
const mongoose = require("mongoose");

const signageDeviceSchema = new mongoose.Schema(
  {
    deviceCode: { type: String, required: true, trim: true, index: true },
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    physicalLocation: { type: String, trim: true, default: "", maxlength: 80 },
    resolution: { type: String, trim: true, default: "1920x1080", maxlength: 20 },
    contentType: {
      type: String,
      enum: ["MENU", "QUEUE", "AD_LOOP", "MIXED"],
      default: "AD_LOOP",
      index: true,
    },
    priority: { type: Number, default: 1 },
    materialIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "AdMaterial" }],
    scheduleConfig: {
      businessHoursContent: { type: String, default: "AD_LOOP" },
      offHoursContent: { type: String, default: "STANDBY" },
    },
    status: { type: String, enum: ["ACTIVE", "INACTIVE", "OFFLINE"], default: "ACTIVE", index: true },
    lastHeartbeatAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

signageDeviceSchema.index({ locationId: 1, deviceCode: 1 }, { unique: true });

module.exports = mongoose.model("SignageDevice", signageDeviceSchema);

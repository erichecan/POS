const mongoose = require("mongoose");

const deviceRegistrationSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    deviceCode: { type: String, required: true, trim: true, uppercase: true },
    deviceType: {
      type: String,
      enum: ["PRINTER", "KDS", "SCANNER", "CUSTOMER_DISPLAY", "PDA", "OTHER"],
      required: true,
      index: true,
    },
    status: { type: String, enum: ["ONLINE", "OFFLINE", "DISABLED"], default: "ONLINE", index: true },
    firmwareVersion: { type: String, trim: true },
    ipAddress: { type: String, trim: true },
    lastHeartbeatAt: { type: Date, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

deviceRegistrationSchema.index({ locationId: 1, deviceCode: 1 }, { unique: true });

deviceRegistrationSchema.index({ locationId: 1, status: 1, lastHeartbeatAt: -1 });

module.exports = mongoose.model("DeviceRegistration", deviceRegistrationSchema);

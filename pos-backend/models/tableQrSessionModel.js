const mongoose = require("mongoose");

const tableQrSessionSchema = new mongoose.Schema(
  {
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: "Table", required: true, index: true },
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    token: { type: String, required: true, trim: true, unique: true, index: true },
    status: { type: String, enum: ["ACTIVE", "EXPIRED", "DISABLED"], default: "ACTIVE", index: true },
    expiresAt: { type: Date, required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

tableQrSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

tableQrSessionSchema.index({ tableId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("TableQrSession", tableQrSessionSchema);

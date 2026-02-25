const mongoose = require("mongoose");

const offlineOperationSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    operationType: { type: String, required: true, trim: true, index: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["PENDING", "REPLAYED", "FAILED"], default: "PENDING", index: true },
    attempts: { type: Number, default: 0, min: 0 },
    lastError: { type: String, trim: true },
    replayedAt: { type: Date },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true }
);

offlineOperationSchema.index({ locationId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("OfflineOperation", offlineOperationSchema);

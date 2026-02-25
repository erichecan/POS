const mongoose = require("mongoose");

const cashMovementSchema = new mongoose.Schema(
  {
    shiftId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CashShift",
      required: true,
      index: true,
    },
    locationId: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ["SALE", "REFUND", "PAID_IN", "PAID_OUT", "ADJUSTMENT"],
      required: true,
    },
    direction: { type: String, enum: ["IN", "OUT"], required: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

cashMovementSchema.index({ shiftId: 1, createdAt: -1 });

module.exports = mongoose.model("CashMovement", cashMovementSchema);

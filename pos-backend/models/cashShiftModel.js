const mongoose = require("mongoose");

const cashShiftSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default" },
    status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN" },
    openingFloat: { type: Number, required: true, min: 0, default: 0 },
    cashSalesTotal: { type: Number, required: true, min: 0, default: 0 },
    cashRefundTotal: { type: Number, required: true, min: 0, default: 0 },
    paidInTotal: { type: Number, required: true, min: 0, default: 0 },
    paidOutTotal: { type: Number, required: true, min: 0, default: 0 },
    closingExpected: { type: Number, min: 0 },
    closingCounted: { type: Number, min: 0 },
    variance: { type: Number, default: 0 },
    openedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    closedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

cashShiftSchema.index(
  { locationId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "OPEN" } }
);
cashShiftSchema.index({ locationId: 1, openedAt: -1 });

module.exports = mongoose.model("CashShift", cashShiftSchema);

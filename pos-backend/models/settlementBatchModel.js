const mongoose = require("mongoose");

const settlementBatchSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    currency: { type: String, trim: true, uppercase: true, default: "EUR" },
    status: { type: String, enum: ["GENERATED", "EXPORTED"], default: "GENERATED", index: true },
    metrics: {
      orderCount: { type: Number, default: 0 },
      paymentCount: { type: Number, default: 0 },
      grossSales: { type: Number, default: 0 },
      discountTotal: { type: Number, default: 0 },
      taxTotal: { type: Number, default: 0 },
      netSales: { type: Number, default: 0 },
      cashSales: { type: Number, default: 0 },
      onlineSales: { type: Number, default: 0 },
      refundTotal: { type: Number, default: 0 },
      reconciliationGapCount: { type: Number, default: 0 },
    },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    exportedAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

settlementBatchSchema.index({ locationId: 1, startAt: 1, endAt: 1 }, { unique: true });

module.exports = mongoose.model("SettlementBatch", settlementBatchSchema);

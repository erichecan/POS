const mongoose = require("mongoose");

const memberLedgerEntrySchema = new mongoose.Schema(
  {
    memberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MemberAccount",
      required: true,
      index: true,
    },
    locationId: { type: String, required: true, trim: true, index: true },
    type: {
      type: String,
      required: true,
      enum: [
        "POINT_EARN",
        "POINT_REDEEM",
        "WALLET_TOPUP",
        "WALLET_DEBIT",
        "ADJUSTMENT",
      ],
    },
    pointsDelta: { type: Number, default: 0 },
    walletDelta: { type: Number, default: 0 },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    reference: { type: String, trim: true },
    reason: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

memberLedgerEntrySchema.index({ memberId: 1, createdAt: -1 });
memberLedgerEntrySchema.index({ locationId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model("MemberLedgerEntry", memberLedgerEntrySchema);

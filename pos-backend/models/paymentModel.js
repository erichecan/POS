const mongoose = require("mongoose");

const refundSchema = new mongoose.Schema(
  {
    refundId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "EUR" },
    status: { type: String, required: true },
    reason: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const refundApprovalActorSchema = new mongoose.Schema(
  {
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    approverRole: { type: String, trim: true },
    approvedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const refundApprovalSchema = new mongoose.Schema(
  {
    approvalId: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "EUR" },
    reason: { type: String, trim: true },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED_EXECUTED", "REJECTED", "CANCELLED"],
      default: "PENDING",
    },
    requiredApprovals: { type: Number, min: 1, default: 2 },
    requestedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    requestedByRole: { type: String, trim: true },
    requestedAt: { type: Date, default: Date.now },
    approvals: { type: [refundApprovalActorSchema], default: [] },
    rejectedById: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedByRole: { type: String, trim: true },
    rejectedAt: { type: Date },
    rejectedReason: { type: String, trim: true },
    executedRefundId: { type: String, trim: true },
    executedAt: { type: Date },
  },
  { _id: false }
);

const paymentSchema = new mongoose.Schema(
  {
    paymentId: { type: String, required: true, unique: true, index: true },
    orderId: { type: String, required: true, index: true },
    chargeId: { type: String, index: true },
    gatewayCode: { type: String, trim: true, uppercase: true, default: "STRIPE", index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, default: "EUR" },
    status: { type: String, required: true },
    method: { type: String },
    email: { type: String },
    contact: { type: String },
    verified: { type: Boolean, default: false },
    usedForOrder: { type: Boolean, default: false },
    orderDbId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    refundAmountTotal: { type: Number, default: 0, min: 0 },
    refundStatus: {
      type: String,
      enum: ["NONE", "PARTIAL", "FULL"],
      default: "NONE",
    },
    refunds: { type: [refundSchema], default: [] },
    refundApprovals: { type: [refundApprovalSchema], default: [] },
    source: {
      type: String,
      enum: ["verify_endpoint", "webhook"],
      default: "verify_endpoint",
    },
    paymentCapturedAt: { type: Date },
  },
  { timestamps: true }
);

paymentSchema.index({ "refundApprovals.approvalId": 1 });

const Payment = mongoose.model("Payment", paymentSchema);
module.exports = Payment;

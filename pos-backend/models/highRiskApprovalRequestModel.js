const mongoose = require("mongoose");

const approvalActorSchema = new mongoose.Schema(
  {
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    approverRole: { type: String, trim: true },
    approvedAt: { type: Date, default: Date.now },
    note: { type: String, trim: true },
  },
  { _id: false }
);

const highRiskApprovalRequestSchema = new mongoose.Schema(
  {
    policyId: { type: mongoose.Schema.Types.ObjectId, ref: "HighRiskApprovalPolicy", required: true, index: true },
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    actionType: { type: String, required: true, trim: true, index: true },
    resourceType: { type: String, trim: true },
    resourceId: { type: String, trim: true },
    amount: { type: Number, min: 0 },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
      default: "PENDING",
      index: true,
    },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    requestedRole: { type: String, trim: true },
    approvals: { type: [approvalActorSchema], default: [] },
    requiredApprovals: { type: Number, min: 1, default: 2 },
    approvedAt: { type: Date },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    rejectedAt: { type: Date },
    rejectionReason: { type: String, trim: true },
    consumedAt: { type: Date, index: true },
    consumedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    consumedByRole: { type: String, trim: true },
    consumedActionType: { type: String, trim: true },
    consumedResourceType: { type: String, trim: true },
    consumedResourceId: { type: String, trim: true },
    consumedRoute: { type: String, trim: true },
    payload: { type: mongoose.Schema.Types.Mixed },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

highRiskApprovalRequestSchema.index({ locationId: 1, status: 1, createdAt: -1 });
highRiskApprovalRequestSchema.index({ status: 1, consumedAt: 1, updatedAt: -1 });

module.exports = mongoose.model("HighRiskApprovalRequest", highRiskApprovalRequestSchema);

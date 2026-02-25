const mongoose = require("mongoose");

const highRiskApprovalPolicySchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    policyCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    name: { type: String, required: true, trim: true },
    actionType: { type: String, required: true, trim: true, index: true },
    resourceType: { type: String, trim: true },
    thresholdAmount: { type: Number, min: 0 },
    requiredApprovals: { type: Number, min: 1, default: 2 },
    allowedRoles: { type: [String], default: ["Admin"] },
    enabled: { type: Boolean, default: true, index: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

highRiskApprovalPolicySchema.index({ locationId: 1, policyCode: 1 }, { unique: true });

module.exports = mongoose.model("HighRiskApprovalPolicy", highRiskApprovalPolicySchema);

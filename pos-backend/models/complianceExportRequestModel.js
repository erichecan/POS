const mongoose = require("mongoose");

const complianceExportRequestSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    requestType: {
      type: String,
      enum: ["PII_EXPORT", "PII_DELETE", "AUDIT_EXPORT"],
      required: true,
      index: true,
    },
    subjectType: { type: String, enum: ["MEMBER", "USER", "ORDER", "OTHER"], default: "OTHER" },
    subjectId: { type: String, trim: true },
    status: { type: String, enum: ["REQUESTED", "APPROVED", "REJECTED", "COMPLETED"], default: "REQUESTED", index: true },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
    completedAt: { type: Date },
    reason: { type: String, trim: true },
    notes: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

complianceExportRequestSchema.index({ locationId: 1, status: 1, createdAt: -1 });

module.exports = mongoose.model("ComplianceExportRequest", complianceExportRequestSchema);

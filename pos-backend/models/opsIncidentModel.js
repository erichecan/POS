const mongoose = require("mongoose");

const escalationEntrySchema = new mongoose.Schema(
  {
    level: { type: Number, required: true, min: 1, max: 3 },
    targetRole: { type: String, required: true, enum: ["Admin", "Cashier", "Waiter"] },
    escalatedAt: { type: Date, default: Date.now },
    reason: { type: String, trim: true },
  },
  { _id: false }
);

const opsIncidentSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    alertCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    category: { type: String, required: true, trim: true },
    severity: { type: String, required: true, enum: ["WARN", "CRITICAL"] },
    title: { type: String, required: true, trim: true },
    message: { type: String, trim: true },
    value: { type: Number, default: 0 },
    threshold: { type: Number, default: 0 },
    unit: { type: String, trim: true },
    status: { type: String, enum: ["OPEN", "ACKED", "RESOLVED"], default: "OPEN", index: true },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now },
    acknowledgedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    acknowledgedAt: { type: Date },
    ackNote: { type: String, trim: true },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    resolutionNote: { type: String, trim: true },
    autoResolved: { type: Boolean, default: false },
    escalationLevel: { type: Number, min: 1, max: 3, default: 1 },
    currentTargetRole: { type: String, enum: ["Admin", "Cashier", "Waiter"], default: "Cashier" },
    escalationHistory: { type: [escalationEntrySchema], default: [] },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

opsIncidentSchema.index({ locationId: 1, status: 1, updatedAt: -1 });
opsIncidentSchema.index({ locationId: 1, alertCode: 1, status: 1 });

module.exports = mongoose.model("OpsIncident", opsIncidentSchema);

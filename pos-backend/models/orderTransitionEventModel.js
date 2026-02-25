const mongoose = require("mongoose");

const orderTransitionEventSchema = new mongoose.Schema(
  {
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    fromStatus: { type: String, trim: true },
    toStatus: { type: String, trim: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorRole: { type: String, trim: true },
    source: { type: String, trim: true, default: "api" },
    reason: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
    conflict: {
      type: {
        type: String,
        enum: ["NONE", "VERSION_MISMATCH", "INVALID_TRANSITION", "ALREADY_FINAL"],
        default: "NONE",
      },
      detail: { type: String, trim: true },
      resolved: { type: Boolean, default: false },
      resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      resolvedAt: { type: Date },
      resolutionNote: { type: String, trim: true },
    },
  },
  { timestamps: true }
);

orderTransitionEventSchema.index({ orderId: 1, createdAt: -1 });
orderTransitionEventSchema.index({ "conflict.type": 1, createdAt: -1 });

module.exports = mongoose.model("OrderTransitionEvent", orderTransitionEventSchema);

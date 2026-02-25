const mongoose = require("mongoose");

const channelDeadLetterEventSchema = new mongoose.Schema(
  {
    providerCode: { type: String, required: true, trim: true, uppercase: true, index: true },
    locationId: { type: String, required: true, trim: true, index: true },
    externalOrderId: { type: String, trim: true, index: true },
    eventType: { type: String, trim: true, default: "ORDER_INGEST" },
    status: {
      type: String,
      enum: ["OPEN", "REPLAYED", "DISCARDED"],
      default: "OPEN",
      index: true,
    },
    failureCode: { type: String, trim: true },
    failureCategory: { type: String, trim: true, uppercase: true, index: true },
    failureMessage: { type: String, trim: true },
    payload: { type: mongoose.Schema.Types.Mixed, required: true },
    replayCount: { type: Number, default: 0, min: 0 },
    lastReplayAt: { type: Date },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
    notes: { type: String, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

channelDeadLetterEventSchema.index({ providerCode: 1, locationId: 1, createdAt: -1 });

module.exports = mongoose.model("ChannelDeadLetterEvent", channelDeadLetterEventSchema);

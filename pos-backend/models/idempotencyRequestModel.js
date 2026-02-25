const mongoose = require("mongoose");
const config = require("../config/config");

const ttlHours = Math.max(Number(config.idempotencyTtlHours) || 24, 1);

const idempotencyRequestSchema = new mongoose.Schema(
  {
    actorScope: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    method: { type: String, required: true, uppercase: true },
    path: { type: String, required: true, trim: true },
    requestHash: { type: String, required: true, trim: true },
    statusCode: { type: Number },
    responseBody: { type: mongoose.Schema.Types.Mixed },
    inProgress: { type: Boolean, default: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + ttlHours * 60 * 60 * 1000),
    },
  },
  { timestamps: true }
);

idempotencyRequestSchema.index(
  { actorScope: 1, key: 1, method: 1, path: 1 },
  { unique: true }
);
idempotencyRequestSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("IdempotencyRequest", idempotencyRequestSchema);

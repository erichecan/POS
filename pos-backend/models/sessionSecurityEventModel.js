const mongoose = require("mongoose");

const sessionSecurityEventSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    type: {
      type: String,
      required: true,
      enum: [
        "LOGIN_SUCCESS",
        "LOGIN_FINGERPRINT_CHANGED",
        "TOKEN_INVALID",
        "TOKEN_MISSING",
        "SCOPE_DENIED",
        "PERMISSION_DENIED",
      ],
      index: true,
    },
    ip: { type: String, trim: true },
    userAgent: { type: String, trim: true },
    fingerprint: { type: String, trim: true },
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

sessionSecurityEventSchema.index({ createdAt: -1, type: 1 });

module.exports = mongoose.model("SessionSecurityEvent", sessionSecurityEventSchema);

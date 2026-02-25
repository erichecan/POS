const mongoose = require("mongoose");

const normalizeFields = (values = []) =>
  Array.from(new Set(values.map((value) => `${value}`.trim()).filter(Boolean)));

const fieldAccessPolicySchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ["Admin", "Cashier", "Waiter"],
      index: true,
    },
    resource: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    readableFields: {
      type: [String],
      default: ["*"],
      set: normalizeFields,
    },
    writableFields: {
      type: [String],
      default: [],
      set: normalizeFields,
    },
    maskedFields: {
      type: [String],
      default: [],
      set: normalizeFields,
    },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

fieldAccessPolicySchema.index({ role: 1, resource: 1 }, { unique: true });

module.exports = mongoose.model("FieldAccessPolicy", fieldAccessPolicySchema);

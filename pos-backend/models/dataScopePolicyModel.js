const mongoose = require("mongoose");

const dataScopePolicySchema = new mongoose.Schema(
  {
    subjectType: {
      type: String,
      required: true,
      enum: ["USER", "ROLE"],
      index: true,
    },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    role: { type: String, enum: ["Admin", "Cashier", "Waiter"] },
    resource: { type: String, required: true, trim: true, index: true },
    allowedLocationIds: {
      type: [String],
      default: ["*"],
      set: (values = []) =>
        Array.from(new Set(values.map((value) => `${value}`.trim()).filter(Boolean))),
    },
    effect: { type: String, enum: ["allow", "deny"], default: "allow" },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

dataScopePolicySchema.index(
  { subjectType: 1, subjectId: 1, role: 1, resource: 1 },
  { unique: true }
);

module.exports = mongoose.model("DataScopePolicy", dataScopePolicySchema);

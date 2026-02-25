const mongoose = require("mongoose");

const workforceShiftSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default", index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: ["Admin", "Cashier", "Waiter"], required: true },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      enum: ["SCHEDULED", "CLOCKED_IN", "CLOCKED_OUT", "CANCELLED"],
      default: "SCHEDULED",
      index: true,
    },
    clockInAt: { type: Date },
    clockOutAt: { type: Date },
    notes: { type: String, trim: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

workforceShiftSchema.index({ locationId: 1, employeeId: 1, startAt: 1, endAt: 1 });

module.exports = mongoose.model("WorkforceShift", workforceShiftSchema);

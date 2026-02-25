const mongoose = require("mongoose");

const rolePermissionSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
      enum: ["Admin", "Cashier", "Waiter"],
      index: true,
    },
    resource: { type: String, required: true, trim: true, index: true },
    actions: {
      type: [String],
      required: true,
      default: [],
      set: (actions = []) =>
        Array.from(new Set(actions.map((action) => `${action}`.trim().toLowerCase()).filter(Boolean))),
    },
    effect: { type: String, enum: ["allow", "deny"], default: "allow" },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

rolePermissionSchema.index({ role: 1, resource: 1 }, { unique: true });

module.exports = mongoose.model("RolePermission", rolePermissionSchema);

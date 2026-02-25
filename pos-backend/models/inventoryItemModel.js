const mongoose = require("mongoose");

const inventoryItemSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default" },
    itemCode: { type: String, required: true, trim: true, lowercase: true },
    displayName: { type: String, required: true, trim: true },
    availableQuantity: { type: Number, required: true, min: 0, default: 0 },
    lowStockThreshold: { type: Number, required: true, min: 0, default: 5 },
    unit: { type: String, trim: true, default: "portion" },
    autoDisableOnOutOfStock: { type: Boolean, default: true },
    isOutOfStock: { type: Boolean, default: true },
    autoDisabledByStock: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ["active", "inactive"],
      default: "active",
    },
    lastMovementAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

inventoryItemSchema.index({ locationId: 1, itemCode: 1 }, { unique: true });
inventoryItemSchema.index({ locationId: 1, status: 1, isOutOfStock: 1 });

module.exports = mongoose.model("InventoryItem", inventoryItemSchema);

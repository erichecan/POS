const mongoose = require("mongoose");

const stationTypes = ["HOT", "COLD", "BAR", "DESSERT", "PIZZA", "EXPO", "OTHER"];

const kitchenStationSchema = new mongoose.Schema(
  {
    locationId: { type: String, required: true, trim: true, default: "default" },
    code: { type: String, required: true, trim: true, uppercase: true },
    displayName: { type: String, required: true, trim: true },
    type: { type: String, enum: stationTypes, default: "HOT", required: true },
    status: { type: String, enum: ["ACTIVE", "INACTIVE"], default: "ACTIVE" },
    displayOrder: { type: Number, default: 0, min: 0 },
    maxConcurrentTickets: { type: Number, default: 20, min: 1, max: 500 },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

kitchenStationSchema.index({ locationId: 1, code: 1 }, { unique: true });
kitchenStationSchema.index({ locationId: 1, status: 1, displayOrder: 1 });

module.exports = mongoose.model("KitchenStation", kitchenStationSchema);

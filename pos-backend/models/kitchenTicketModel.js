const mongoose = require("mongoose");

const ticketStatuses = [
  "NEW",
  "PREPARING",
  "READY",
  "EXPO_CONFIRMED",
  "SERVED",
  "CANCELLED",
];
const itemStatuses = ["NEW", "PREPARING", "READY", "CANCELLED"];

const kitchenTicketItemSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 1 },
    stationCode: { type: String, required: true, trim: true, uppercase: true },
    status: { type: String, enum: itemStatuses, default: "NEW" },
    notes: { type: String, trim: true },
    startedAt: { type: Date },
    readyAt: { type: Date },
  },
  { timestamps: true }
);

const kitchenTicketSchema = new mongoose.Schema(
  {
    orderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
      unique: true,
      index: true,
    },
    locationId: { type: String, required: true, trim: true, default: "default" },
    sourceType: { type: String, enum: ["POS", "CHANNEL"], required: true },
    fulfillmentType: {
      type: String,
      enum: ["DINE_IN", "DELIVERY", "PICKUP", "OTHER"],
      default: "DINE_IN",
    },
    status: { type: String, enum: ticketStatuses, default: "NEW" },
    priority: { type: String, enum: ["NORMAL", "RUSH"], default: "NORMAL" },
    slaMinutes: { type: Number, min: 1, default: 20 },
    targetReadyAt: { type: Date },
    lastStatusChangeAt: { type: Date },
    expediteCount: { type: Number, min: 0, default: 0 },
    lastExpediteAt: { type: Date },
    lastExpediteReason: { type: String, trim: true },
    customerName: { type: String, trim: true },
    table: { type: mongoose.Schema.Types.ObjectId, ref: "Table" },
    items: {
      type: [kitchenTicketItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "Kitchen ticket requires at least one item.",
      },
    },
    firedAt: { type: Date, default: Date.now },
    prepStartedAt: { type: Date },
    readyAt: { type: Date },
    expoConfirmedAt: { type: Date },
    servedAt: { type: Date },
    cancelledAt: { type: Date },
    metadata: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

kitchenTicketSchema.index({ locationId: 1, status: 1, createdAt: -1 });
kitchenTicketSchema.index({ locationId: 1, priority: 1, createdAt: -1 });
kitchenTicketSchema.index({ locationId: 1, "items.stationCode": 1, status: 1 });

module.exports = mongoose.model("KitchenTicket", kitchenTicketSchema);

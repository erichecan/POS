const mongoose = require("mongoose");

const kitchenEventTypes = [
  "TICKET_CREATED",
  "STATUS_UPDATED",
  "ITEM_STATUS_UPDATED",
  "PRIORITY_UPDATED",
  "EXPEDITE_REQUESTED",
  "EXPO_CONFIRMED",
  "SERVED_CONFIRMED",
];

const kitchenTicketEventSchema = new mongoose.Schema(
  {
    ticketId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "KitchenTicket",
      required: true,
      index: true,
    },
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order", index: true },
    locationId: { type: String, required: true, trim: true, default: "default" },
    eventType: { type: String, enum: kitchenEventTypes, required: true },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    actorRole: { type: String, trim: true },
    payload: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

kitchenTicketEventSchema.index({ locationId: 1, eventType: 1, createdAt: -1 });

module.exports = mongoose.model("KitchenTicketEvent", kitchenTicketEventSchema);

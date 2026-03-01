/**
 * Phase C2 排队叫号 - QueueTicket 模型
 * 2026-02-28T16:10:00+08:00
 */
const mongoose = require("mongoose");

const queueTicketSchema = new mongoose.Schema(
  {
    queueId: {
      type: String,
      required: true,
      trim: true,
      default: "default",
    },
    ticketNo: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["waiting", "called", "served", "missed", "cancelled"],
      default: "waiting",
    },
    locationId: {
      type: String,
      trim: true,
      default: "default",
    },
    calledAt: { type: Date },
    servedAt: { type: Date },
  },
  { timestamps: true }
);

queueTicketSchema.index({ queueId: 1, status: 1 });
queueTicketSchema.index({ queueId: 1, ticketNo: 1 }, { unique: true });

module.exports = mongoose.model("QueueTicket", queueTicketSchema);

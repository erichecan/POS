const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const OrderTransitionEvent = require("../models/orderTransitionEventModel");
const { logAuditEvent } = require("../utils/auditLogger");
const { ORDER_STATUSES, canTransition } = require("../utils/orderStateMachine");

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const listOrderTransitions = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.orderId) {
      query.orderId = req.query.orderId;
    }

    if (req.query.onlyConflicts === "true") {
      query["conflict.type"] = { $ne: "NONE" };
    }

    const [rows, total] = await Promise.all([
      OrderTransitionEvent.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("orderId", "orderStatus locationId sourceType")
        .populate("actorId conflict.resolvedBy", "name role"),
      OrderTransitionEvent.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: { limit, offset, total },
    });
  } catch (error) {
    return next(error);
  }
};

const resolveOrderConflict = async (req, res, next) => {
  try {
    const { eventId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(eventId)) {
      return next(createHttpError(400, "Invalid transition event id."));
    }

    const event = await OrderTransitionEvent.findById(eventId);
    if (!event) {
      return next(createHttpError(404, "Transition event not found."));
    }

    if (`${event.conflict?.type || "NONE"}` === "NONE") {
      return next(createHttpError(409, "This event is not a conflict."));
    }

    if (event.conflict?.resolved) {
      return res.status(200).json({ success: true, data: event, resolved: false });
    }

    const forceStatus = `${req.body.forceStatus || ""}`.trim();
    const resolutionNote = `${req.body.resolutionNote || ""}`.trim();

    let order = await Order.findById(event.orderId);
    if (!order) {
      return next(createHttpError(404, "Order referenced by conflict was not found."));
    }

    if (forceStatus) {
      if (!ORDER_STATUSES.includes(forceStatus)) {
        return next(createHttpError(400, "forceStatus is invalid."));
      }

      if (!canTransition(order.orderStatus, forceStatus) && order.orderStatus !== forceStatus) {
        return next(createHttpError(409, `Cannot force transition ${order.orderStatus} -> ${forceStatus}.`));
      }

      order.orderStatus = forceStatus;
      await order.save();

      await OrderTransitionEvent.create({
        orderId: order._id,
        fromStatus: event.fromStatus,
        toStatus: forceStatus,
        actorId: req.user?._id,
        actorRole: req.user?.role,
        source: "conflict_resolution",
        reason: resolutionNote || "Conflict resolved with forced transition",
        metadata: {
          conflictEventId: event._id,
        },
        conflict: {
          type: "NONE",
          detail: "",
          resolved: true,
        },
      });
    }

    event.conflict.resolved = true;
    event.conflict.resolvedBy = req.user?._id;
    event.conflict.resolvedAt = new Date();
    event.conflict.resolutionNote = resolutionNote;
    await event.save();

    await logAuditEvent({
      req,
      action: "ORDER_CONFLICT_RESOLVED",
      resourceType: "OrderTransitionEvent",
      resourceId: event._id,
      statusCode: 200,
      metadata: {
        orderId: event.orderId,
        conflictType: event.conflict?.type,
        forceStatus,
      },
    });

    order = await Order.findById(event.orderId);

    return res.status(200).json({
      success: true,
      data: {
        event,
        order,
      },
      resolved: true,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listOrderTransitions,
  resolveOrderConflict,
};

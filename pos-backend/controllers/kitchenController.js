const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const KitchenStation = require("../models/kitchenStationModel");
const KitchenTicket = require("../models/kitchenTicketModel");
const KitchenTicketEvent = require("../models/kitchenTicketEventModel");
const { logAuditEvent } = require("../utils/auditLogger");
const {
  normalizeLocationId,
  ensureDefaultStations,
  syncOrderStatusWithKitchenTicket,
  resolveSlaMinutes,
} = require("../utils/kitchenService");
const { deriveTicketStatusFromItems } = require("../utils/kitchenRouting");

const TICKET_STATUSES = ["NEW", "PREPARING", "READY", "EXPO_CONFIRMED", "SERVED", "CANCELLED"];
const ITEM_STATUSES = ["NEW", "PREPARING", "READY", "CANCELLED"];
const OPEN_TICKET_STATUSES = new Set(["NEW", "PREPARING"]);
const KITCHEN_EVENT_TYPES = new Set([
  "TICKET_CREATED",
  "STATUS_UPDATED",
  "ITEM_STATUS_UPDATED",
  "PRIORITY_UPDATED",
  "EXPEDITE_REQUESTED",
  "EXPO_CONFIRMED",
  "SERVED_CONFIRMED",
]);

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 100);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 100,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const parseDateFilter = (rawValue, fieldName) => {
  if (!rawValue) {
    return null;
  }
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(400, `${fieldName} must be a valid datetime string.`);
  }
  return date;
};

const parseReplayEventTypes = (rawValue) => {
  if (!rawValue) {
    return [];
  }

  const values = `${rawValue}`
    .split(",")
    .map((value) => value.trim().toUpperCase())
    .filter(Boolean);

  const uniqueValues = [...new Set(values)];
  const invalidValues = uniqueValues.filter((value) => !KITCHEN_EVENT_TYPES.has(value));
  if (invalidValues.length > 0) {
    throw createHttpError(400, `Invalid eventType values: ${invalidValues.join(", ")}`);
  }

  return uniqueValues;
};

const buildReplayEventQuery = ({
  locationId,
  ticketId = "",
  orderId = "",
  eventTypes = [],
  fromDate = null,
  toDate = null,
}) => {
  const query = { locationId };

  if (ticketId) {
    if (!mongoose.Types.ObjectId.isValid(ticketId)) {
      throw createHttpError(400, "Invalid ticketId.");
    }
    query.ticketId = ticketId;
  }

  if (orderId) {
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      throw createHttpError(400, "Invalid orderId.");
    }
    query.orderId = orderId;
  }

  if (eventTypes.length > 0) {
    query.eventType = { $in: eventTypes };
  }

  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) {
      query.createdAt.$gte = fromDate;
    }
    if (toDate) {
      query.createdAt.$lte = toDate;
    }
  }

  return query;
};

const createKitchenEvent = async ({ ticket, eventType, req, payload }) => {
  if (!ticket || !eventType) {
    return;
  }

  await KitchenTicketEvent.create({
    ticketId: ticket._id,
    orderId: ticket.orderId,
    locationId: ticket.locationId,
    eventType,
    actorId: req?.user?._id,
    actorRole: req?.user?.role,
    payload,
  });
};

const toDateSafe = (value) => {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const computeTicketSla = (ticket, now = new Date()) => {
  const firedAt = toDateSafe(ticket.firedAt) || toDateSafe(ticket.createdAt) || now;
  const configuredSla = Number(ticket.slaMinutes || resolveSlaMinutes(ticket.priority));
  const slaMinutes = Number.isFinite(configuredSla) && configuredSla > 0 ? configuredSla : 20;
  const targetReadyAt =
    toDateSafe(ticket.targetReadyAt) ||
    new Date(firedAt.getTime() + slaMinutes * 60 * 1000);

  const elapsedMinutes = Math.max(0, Math.floor((now.getTime() - firedAt.getTime()) / 60000));
  const remainingMinutes = Math.ceil((targetReadyAt.getTime() - now.getTime()) / 60000);

  let alertLevel = "ON_TRACK";
  if (!OPEN_TICKET_STATUSES.has(ticket.status)) {
    alertLevel = "RESOLVED";
  } else if (remainingMinutes <= 0) {
    alertLevel = "OVERDUE";
  } else if (remainingMinutes <= Math.max(Math.ceil(slaMinutes * 0.25), 2)) {
    alertLevel = "WARNING";
  }

  return {
    slaMinutes,
    targetReadyAt,
    elapsedMinutes,
    remainingMinutes,
    alertLevel,
    isOverdue: alertLevel === "OVERDUE",
  };
};

const enrichTicket = (ticket, now = new Date()) => {
  const plain = ticket?.toObject ? ticket.toObject() : ticket;
  return {
    ...plain,
    sla: computeTicketSla(plain, now),
  };
};

const applyTicketStatusTimestamps = (ticket, status, now = new Date()) => {
  ticket.lastStatusChangeAt = now;

  if (status === "PREPARING") {
    ticket.prepStartedAt = ticket.prepStartedAt || now;
  }
  if (status === "READY") {
    ticket.readyAt = now;
  }
  if (status === "EXPO_CONFIRMED") {
    ticket.expoConfirmedAt = now;
  }
  if (status === "SERVED") {
    ticket.servedAt = now;
  }
  if (status === "CANCELLED") {
    ticket.cancelledAt = now;
  }
};

const bootstrapStations = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    await ensureDefaultStations(locationId);

    await logAuditEvent({
      req,
      action: "KITCHEN_STATIONS_BOOTSTRAPPED",
      resourceType: "KitchenStation",
      statusCode: 200,
      metadata: { locationId },
    });

    return res.status(200).json({ success: true, message: "Kitchen stations bootstrapped." });
  } catch (error) {
    return next(error);
  }
};

const upsertStation = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    const code = `${req.body.code || ""}`.trim().toUpperCase();
    const displayName = `${req.body.displayName || ""}`.trim();

    if (!code || !displayName) {
      return next(createHttpError(400, "locationId, code and displayName are required."));
    }

    const station = await KitchenStation.findOneAndUpdate(
      { locationId, code },
      {
        $set: {
          displayName,
          type: req.body.type || "HOT",
          status: req.body.status || "ACTIVE",
          displayOrder: Number(req.body.displayOrder ?? 0),
          maxConcurrentTickets: Number(req.body.maxConcurrentTickets ?? 20),
          metadata: req.body.metadata,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
    );

    await logAuditEvent({
      req,
      action: "KITCHEN_STATION_UPSERTED",
      resourceType: "KitchenStation",
      resourceId: station._id,
      statusCode: 200,
      metadata: { locationId, code },
    });

    return res.status(200).json({ success: true, data: station });
  } catch (error) {
    return next(error);
  }
};

const listStations = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.query.locationId);
    const query = { locationId };

    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    const stations = await KitchenStation.find(query).sort({ displayOrder: 1, code: 1 });
    return res.status(200).json({ success: true, data: stations });
  } catch (error) {
    return next(error);
  }
};

const listTickets = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = { locationId: normalizeLocationId(req.query.locationId) };

    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    if (req.query.priority) {
      query.priority = `${req.query.priority}`.trim().toUpperCase();
    }

    if (req.query.stationCode) {
      query["items.stationCode"] = `${req.query.stationCode}`.trim().toUpperCase();
    }

    const [tickets, total] = await Promise.all([
      KitchenTicket.find(query)
        .sort({ priority: 1, createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("orderId table"),
      KitchenTicket.countDocuments(query),
    ]);

    const now = new Date();
    const rows = tickets.map((ticket) => enrichTicket(ticket, now));

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: { limit, offset, total },
    });
  } catch (error) {
    return next(error);
  }
};

const getTicketById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid kitchen ticket id."));
    }

    const ticket = await KitchenTicket.findById(id).populate("orderId table");
    if (!ticket) {
      return next(createHttpError(404, "Kitchen ticket not found."));
    }

    const events = await KitchenTicketEvent.find({ ticketId: ticket._id })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("actorId", "name role");

    return res.status(200).json({
      success: true,
      data: {
        ...enrichTicket(ticket),
        events,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const listTicketReplayEvents = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const locationId = normalizeLocationId(req.query.locationId);
    const ticketId = `${req.query.ticketId || ""}`.trim();
    const orderId = `${req.query.orderId || ""}`.trim();
    const eventTypes = parseReplayEventTypes(req.query.eventType || req.query.eventTypes);
    const fromDate = parseDateFilter(req.query.from, "from");
    const toDate = parseDateFilter(req.query.to, "to");

    if (fromDate && toDate && fromDate.getTime() > toDate.getTime()) {
      return next(createHttpError(400, "from must be earlier than to."));
    }

    const query = buildReplayEventQuery({
      locationId,
      ticketId,
      orderId,
      eventTypes,
      fromDate,
      toDate,
    });

    const [events, total] = await Promise.all([
      KitchenTicketEvent.find(query)
        .sort({ createdAt: 1, _id: 1 })
        .skip(offset)
        .limit(limit)
        .populate("actorId", "name role"),
      KitchenTicketEvent.countDocuments(query),
    ]);

    const rows = events.map((event, index) => ({
      ...(event?.toObject ? event.toObject() : event),
      sequence: offset + index + 1,
    }));

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: { limit, offset, total },
      replay: {
        locationId,
        ticketId: ticketId || null,
        orderId: orderId || null,
        eventTypes,
        from: fromDate,
        to: toDate,
        firstEventAt: rows[0]?.createdAt || null,
        lastEventAt: rows[rows.length - 1]?.createdAt || null,
        hasMore: offset + rows.length < total,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const updateTicketStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid kitchen ticket id."));
    }

    const status = `${req.body.status || ""}`.trim().toUpperCase();
    if (!TICKET_STATUSES.includes(status)) {
      return next(createHttpError(400, "Invalid ticket status."));
    }

    const ticket = await KitchenTicket.findById(id);
    if (!ticket) {
      return next(createHttpError(404, "Kitchen ticket not found."));
    }

    const now = new Date();
    ticket.status = status;
    applyTicketStatusTimestamps(ticket, status, now);

    if (status === "PREPARING") {
      for (const item of ticket.items) {
        if (item.status === "NEW") {
          item.status = "PREPARING";
          item.startedAt = item.startedAt || now;
        }
      }
    }

    if (status === "READY") {
      for (const item of ticket.items) {
        if (item.status !== "CANCELLED") {
          item.status = "READY";
          item.readyAt = item.readyAt || now;
        }
      }
    }

    await ticket.save();
    await syncOrderStatusWithKitchenTicket(ticket);

    await createKitchenEvent({
      ticket,
      eventType: "STATUS_UPDATED",
      req,
      payload: { status },
    });

    await logAuditEvent({
      req,
      action: "KITCHEN_TICKET_STATUS_UPDATED",
      resourceType: "KitchenTicket",
      resourceId: ticket._id,
      statusCode: 200,
      metadata: { status },
    });

    return res.status(200).json({ success: true, data: enrichTicket(ticket) });
  } catch (error) {
    return next(error);
  }
};

const updateTicketPriority = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid kitchen ticket id."));
    }

    const priority = `${req.body.priority || ""}`.trim().toUpperCase();
    if (!["NORMAL", "RUSH"].includes(priority)) {
      return next(createHttpError(400, "Invalid priority."));
    }

    const ticket = await KitchenTicket.findById(id);
    if (!ticket) {
      return next(createHttpError(404, "Kitchen ticket not found."));
    }

    ticket.priority = priority;
    ticket.slaMinutes = resolveSlaMinutes(priority);
    const firedAt = toDateSafe(ticket.firedAt) || new Date();
    ticket.targetReadyAt = new Date(firedAt.getTime() + ticket.slaMinutes * 60 * 1000);
    ticket.lastStatusChangeAt = new Date();
    await ticket.save();

    await createKitchenEvent({
      ticket,
      eventType: "PRIORITY_UPDATED",
      req,
      payload: {
        priority: ticket.priority,
        slaMinutes: ticket.slaMinutes,
        targetReadyAt: ticket.targetReadyAt,
      },
    });

    await logAuditEvent({
      req,
      action: "KITCHEN_TICKET_PRIORITY_UPDATED",
      resourceType: "KitchenTicket",
      resourceId: ticket._id,
      statusCode: 200,
      metadata: { priority },
    });

    return res.status(200).json({ success: true, data: enrichTicket(ticket) });
  } catch (error) {
    return next(error);
  }
};

const updateTicketItemStatus = async (req, res, next) => {
  try {
    const { id, itemId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(itemId)) {
      return next(createHttpError(400, "Invalid ticket or item id."));
    }

    const status = `${req.body.status || ""}`.trim().toUpperCase();
    if (!ITEM_STATUSES.includes(status)) {
      return next(createHttpError(400, "Invalid item status."));
    }

    const ticket = await KitchenTicket.findById(id);
    if (!ticket) {
      return next(createHttpError(404, "Kitchen ticket not found."));
    }

    const target = ticket.items.id(itemId);
    if (!target) {
      return next(createHttpError(404, "Kitchen ticket item not found."));
    }

    const now = new Date();
    target.status = status;
    if (status === "PREPARING" && !target.startedAt) {
      target.startedAt = now;
    }
    if (status === "READY" && !target.readyAt) {
      target.readyAt = now;
    }

    const derivedTicketStatus = deriveTicketStatusFromItems(ticket.items);
    if (["NEW", "PREPARING", "READY", "CANCELLED"].includes(derivedTicketStatus)) {
      ticket.status = derivedTicketStatus;
      applyTicketStatusTimestamps(ticket, derivedTicketStatus, now);
    }

    await ticket.save();
    await syncOrderStatusWithKitchenTicket(ticket);

    await createKitchenEvent({
      ticket,
      eventType: "ITEM_STATUS_UPDATED",
      req,
      payload: {
        itemId,
        status,
      },
    });

    await logAuditEvent({
      req,
      action: "KITCHEN_TICKET_ITEM_STATUS_UPDATED",
      resourceType: "KitchenTicket",
      resourceId: ticket._id,
      statusCode: 200,
      metadata: {
        itemId,
        status,
      },
    });

    return res.status(200).json({ success: true, data: enrichTicket(ticket) });
  } catch (error) {
    return next(error);
  }
};

const requestTicketExpedite = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid kitchen ticket id."));
    }

    const reason = `${req.body.reason || ""}`.trim();
    const ticket = await KitchenTicket.findById(id);
    if (!ticket) {
      return next(createHttpError(404, "Kitchen ticket not found."));
    }

    if (!OPEN_TICKET_STATUSES.has(ticket.status)) {
      return next(createHttpError(409, "Only NEW/PREPARING tickets can be expedited."));
    }

    ticket.expediteCount += 1;
    ticket.lastExpediteAt = new Date();
    ticket.lastExpediteReason = reason || ticket.lastExpediteReason;
    ticket.priority = "RUSH";
    ticket.slaMinutes = resolveSlaMinutes("RUSH");
    const firedAt = toDateSafe(ticket.firedAt) || new Date();
    ticket.targetReadyAt = new Date(firedAt.getTime() + ticket.slaMinutes * 60 * 1000);
    ticket.lastStatusChangeAt = new Date();
    await ticket.save();

    await createKitchenEvent({
      ticket,
      eventType: "EXPEDITE_REQUESTED",
      req,
      payload: {
        reason,
        expediteCount: ticket.expediteCount,
      },
    });

    await logAuditEvent({
      req,
      action: "KITCHEN_TICKET_EXPEDITED",
      resourceType: "KitchenTicket",
      resourceId: ticket._id,
      statusCode: 200,
      metadata: {
        expediteCount: ticket.expediteCount,
        reason,
      },
    });

    return res.status(200).json({ success: true, data: enrichTicket(ticket) });
  } catch (error) {
    return next(error);
  }
};

const confirmTicketHandoff = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid kitchen ticket id."));
    }

    const stage = `${req.body.stage || ""}`.trim().toUpperCase();
    if (!["EXPO", "SERVED"].includes(stage)) {
      return next(createHttpError(400, "stage must be EXPO or SERVED."));
    }

    const ticket = await KitchenTicket.findById(id);
    if (!ticket) {
      return next(createHttpError(404, "Kitchen ticket not found."));
    }

    const now = new Date();
    if (stage === "EXPO") {
      if (!["READY", "EXPO_CONFIRMED", "SERVED"].includes(ticket.status)) {
        return next(createHttpError(409, "Ticket must be READY before expo handoff."));
      }
      ticket.status = "EXPO_CONFIRMED";
      applyTicketStatusTimestamps(ticket, "EXPO_CONFIRMED", now);
    }

    if (stage === "SERVED") {
      if (!["READY", "EXPO_CONFIRMED", "SERVED"].includes(ticket.status)) {
        return next(createHttpError(409, "Ticket must be READY/EXPO_CONFIRMED before served."));
      }
      ticket.status = "SERVED";
      applyTicketStatusTimestamps(ticket, "SERVED", now);
    }

    await ticket.save();
    await syncOrderStatusWithKitchenTicket(ticket);

    const eventType = stage === "EXPO" ? "EXPO_CONFIRMED" : "SERVED_CONFIRMED";
    await createKitchenEvent({
      ticket,
      eventType,
      req,
      payload: { stage },
    });

    await logAuditEvent({
      req,
      action: stage === "EXPO" ? "KITCHEN_TICKET_EXPO_CONFIRMED" : "KITCHEN_TICKET_SERVED_CONFIRMED",
      resourceType: "KitchenTicket",
      resourceId: ticket._id,
      statusCode: 200,
      metadata: { stage },
    });

    return res.status(200).json({ success: true, data: enrichTicket(ticket) });
  } catch (error) {
    return next(error);
  }
};

const getKitchenStats = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.query.locationId);

    const [statusRows, openTickets, queueRows, avgReadyRow, stations] = await Promise.all([
      KitchenTicket.aggregate([
        { $match: { locationId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      KitchenTicket.find(
        { locationId, status: { $in: ["NEW", "PREPARING"] } },
        "status priority slaMinutes targetReadyAt firedAt createdAt expediteCount"
      ).lean(),
      KitchenTicket.aggregate([
        {
          $match: {
            locationId,
            status: { $in: ["NEW", "PREPARING"] },
          },
        },
        { $unwind: "$items" },
        { $match: { "items.status": { $in: ["NEW", "PREPARING"] } } },
        { $group: { _id: "$items.stationCode", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      KitchenTicket.aggregate([
        {
          $match: {
            locationId,
            readyAt: { $exists: true, $ne: null },
            firedAt: { $exists: true, $ne: null },
            status: { $in: ["READY", "EXPO_CONFIRMED", "SERVED"] },
          },
        },
        {
          $project: {
            readyMinutes: {
              $divide: [{ $subtract: ["$readyAt", "$firedAt"] }, 60000],
            },
          },
        },
        { $group: { _id: null, avgReadyMinutes: { $avg: "$readyMinutes" } } },
      ]),
      KitchenStation.find({ locationId }).select("code displayName type status maxConcurrentTickets").lean(),
    ]);

    const statusCounts = statusRows.reduce((acc, row) => {
      acc[row._id] = row.count;
      return acc;
    }, {});

    const now = new Date();
    let overdueCount = 0;
    let warningCount = 0;
    let onTrackCount = 0;
    let expediteOpenCount = 0;

    for (const ticket of openTickets) {
      const sla = computeTicketSla(ticket, now);
      if (sla.alertLevel === "OVERDUE") overdueCount += 1;
      if (sla.alertLevel === "WARNING") warningCount += 1;
      if (sla.alertLevel === "ON_TRACK") onTrackCount += 1;
      if ((ticket.expediteCount || 0) > 0) expediteOpenCount += 1;
    }

    const avgReadyMinutes = Number(avgReadyRow?.[0]?.avgReadyMinutes || 0);

    const queueByStation = queueRows.map((row) => ({
      stationCode: row._id,
      count: row.count,
    }));

    const queueMap = queueByStation.reduce((acc, row) => {
      acc[row.stationCode] = row.count;
      return acc;
    }, {});

    const stationLoad = stations.map((station) => {
      const queueCount = Number(queueMap[station.code] || 0);
      const capacity = Math.max(Number(station.maxConcurrentTickets || 1), 1);
      return {
        stationCode: station.code,
        displayName: station.displayName,
        type: station.type,
        status: station.status,
        queueCount,
        maxConcurrentTickets: capacity,
        utilization: Number((queueCount / capacity).toFixed(3)),
      };
    });

    return res.status(200).json({
      success: true,
      data: {
        locationId,
        statusCounts,
        openTickets: openTickets.length,
        overdueCount,
        warningCount,
        onTrackCount,
        expediteOpenCount,
        avgReadyMinutes: Number(avgReadyMinutes.toFixed(2)),
        queueByStation,
        stationLoad,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  bootstrapStations,
  upsertStation,
  listStations,
  listTickets,
  listTicketReplayEvents,
  getTicketById,
  updateTicketStatus,
  updateTicketPriority,
  updateTicketItemStatus,
  requestTicketExpedite,
  confirmTicketHandoff,
  getKitchenStats,
  __testables: {
    parseReplayEventTypes,
    buildReplayEventQuery,
    parseDateFilter,
  },
};

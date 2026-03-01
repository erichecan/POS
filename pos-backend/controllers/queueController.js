/**
 * Phase C2 排队叫号 - API
 * 2026-02-28T16:12:00+08:00
 */
const createHttpError = require("http-errors");
const QueueTicket = require("../models/queueTicketModel");

const normalizeQueueId = (v) => `${v || ""}`.trim() || "default";

/**
 * POST /api/queue/tickets - 取号
 */
const takeNumber = async (req, res, next) => {
  try {
    const queueId = normalizeQueueId(req.body.queueId);
    const locationId = normalizeQueueId(req.body.locationId);

    const lastTicket = await QueueTicket.findOne({ queueId })
      .sort({ ticketNo: -1 })
      .select("ticketNo")
      .lean();

    const ticketNo = (lastTicket?.ticketNo || 0) + 1;

    const ticket = await QueueTicket.create({
      queueId,
      ticketNo,
      status: "waiting",
      locationId,
    });

    return res.status(201).json({
      success: true,
      data: {
        ticketId: ticket._id,
        ticketNo: ticket.ticketNo,
        queueId: ticket.queueId,
        status: ticket.status,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/queue/tickets - 获取排队列表
 */
const listTickets = async (req, res, next) => {
  try {
    const queueId = normalizeQueueId(req.query.queueId);
    const status = `${req.query.status || ""}`.trim().toLowerCase();

    const filter = { queueId };
    if (status && ["waiting", "called", "served", "missed", "cancelled"].includes(status)) {
      filter.status = status;
    }

    const tickets = await QueueTicket.find(filter)
      .sort({ ticketNo: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      data: tickets,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * PATCH /api/queue/tickets/:id - 叫号/过号/重叫
 */
const updateTicket = async (req, res, next) => {
  try {
    const id = `${req.params.id || ""}`.trim();
    const status = `${req.body.status || ""}`.trim().toLowerCase();

    if (!["called", "served", "missed"].includes(status)) {
      return next(createHttpError(400, "status must be called, served, or missed."));
    }

    const ticket = await QueueTicket.findById(id);
    if (!ticket) {
      return next(createHttpError(404, "Ticket not found."));
    }

    ticket.status = status;
    if (status === "called") {
      ticket.calledAt = new Date();
    } else if (status === "served") {
      ticket.servedAt = new Date();
    }
    await ticket.save();
    // 重叫：missed 可再改为 called

    return res.status(200).json({
      success: true,
      data: ticket,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/queue/display - 大屏数据
 */
const getDisplayData = async (req, res, next) => {
  try {
    const queueId = normalizeQueueId(req.query.queueId);

    const [currentCalled, waitingCount] = await Promise.all([
      QueueTicket.findOne({ queueId, status: "called" })
        .sort({ calledAt: -1 })
        .select("ticketNo calledAt")
        .lean(),
      QueueTicket.countDocuments({ queueId, status: "waiting" }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        currentNo: currentCalled?.ticketNo ?? null,
        calledAt: currentCalled?.calledAt ?? null,
        waitingCount,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  takeNumber,
  listTickets,
  updateTicket,
  getDisplayData,
};

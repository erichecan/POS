const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const Payment = require("../models/paymentModel");
const SettlementBatch = require("../models/settlementBatchModel");
const { logAuditEvent } = require("../utils/auditLogger");
const {
  calculateSettlementMetrics,
  toSettlementCsv,
} = require("../utils/financeSettlement");

const normalizeLocationId = (value) => `${value || ""}`.trim() || "default";

const parseDate = (value, fieldName) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `${fieldName} must be a valid datetime string.`);
  }
  return parsed;
};

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const generateSettlement = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    const startAt = parseDate(req.body.startAt, "startAt");
    const endAt = parseDate(req.body.endAt, "endAt");

    if (endAt <= startAt) {
      return next(createHttpError(400, "endAt must be later than startAt."));
    }

    const [orders, payments] = await Promise.all([
      Order.find({
        locationId,
        createdAt: { $gte: startAt, $lt: endAt },
      }).lean(),
      Payment.find({
        createdAt: { $gte: startAt, $lt: endAt },
      }).lean(),
    ]);

    const metrics = calculateSettlementMetrics({ orders, payments });

    const settlement = await SettlementBatch.findOneAndUpdate(
      { locationId, startAt, endAt },
      {
        $set: {
          locationId,
          startAt,
          endAt,
          status: "GENERATED",
          currency: `${req.body.currency || "EUR"}`.trim().toUpperCase(),
          metrics,
          generatedBy: req.user?._id,
          metadata: req.body.metadata,
        },
      },
      { upsert: true, new: true, runValidators: true }
    );

    await logAuditEvent({
      req,
      action: "SETTLEMENT_GENERATED",
      resourceType: "SettlementBatch",
      resourceId: settlement._id,
      statusCode: 200,
      metadata: {
        locationId,
        startAt,
        endAt,
      },
    });

    return res.status(200).json({ success: true, data: settlement });
  } catch (error) {
    return next(error);
  }
};

const listSettlements = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.locationId) {
      query.locationId = normalizeLocationId(req.query.locationId);
    }

    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    const [rows, total] = await Promise.all([
      SettlementBatch.find(query)
        .sort({ startAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("generatedBy", "name role"),
      SettlementBatch.countDocuments(query),
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

const exportSettlementCsv = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid settlement id."));
    }

    const settlement = await SettlementBatch.findById(id);
    if (!settlement) {
      return next(createHttpError(404, "Settlement not found."));
    }

    const csv = toSettlementCsv({ settlement });
    settlement.status = "EXPORTED";
    settlement.exportedAt = new Date();
    await settlement.save();

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=settlement_${settlement.locationId}_${settlement._id}.csv`
    );

    return res.status(200).send(csv);
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  generateSettlement,
  listSettlements,
  exportSettlementCsv,
};

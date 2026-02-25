const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const CashShift = require("../models/cashShiftModel");
const CashMovement = require("../models/cashMovementModel");
const {
  normalizeLocationId,
  findOpenShift,
  recordCashMovement,
} = require("../utils/cashShiftService");
const { logAuditEvent } = require("../utils/auditLogger");

const MOVEMENT_TYPES = ["PAID_IN", "PAID_OUT", "ADJUSTMENT"];

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const calculateClosingExpected = (shift) =>
  Number(
    (
      shift.openingFloat +
      shift.cashSalesTotal +
      shift.paidInTotal -
      shift.paidOutTotal -
      shift.cashRefundTotal
    ).toFixed(2)
  );

const openShift = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    const openingFloat = Number(req.body.openingFloat ?? 0);
    const notes = `${req.body.notes || ""}`.trim();

    if (!Number.isFinite(openingFloat) || openingFloat < 0) {
      return next(createHttpError(400, "openingFloat must be >= 0."));
    }

    const existingOpenShift = await findOpenShift(locationId);
    if (existingOpenShift) {
      return next(createHttpError(409, "A cash shift is already open for this location."));
    }

    const shift = await CashShift.create({
      locationId,
      openingFloat,
      notes,
      openedBy: req.user._id,
      openedAt: new Date(),
      status: "OPEN",
    });

    await logAuditEvent({
      req,
      action: "CASH_SHIFT_OPENED",
      resourceType: "CashShift",
      resourceId: shift._id,
      statusCode: 201,
      metadata: { locationId, openingFloat },
    });

    return res.status(201).json({ success: true, data: shift });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError(409, "A cash shift is already open for this location."));
    }
    return next(error);
  }
};

const listShifts = async (req, res, next) => {
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
      CashShift.find(query)
        .sort({ openedAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("openedBy closedBy", "name role"),
      CashShift.countDocuments(query),
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

const getShiftById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid shift id."));
    }

    const shift = await CashShift.findById(id).populate("openedBy closedBy", "name role");
    if (!shift) {
      return next(createHttpError(404, "Shift not found."));
    }

    const movements = await CashMovement.find({ shiftId: id })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate("createdBy", "name role");

    return res.status(200).json({
      success: true,
      data: {
        ...shift.toObject(),
        closingExpectedPreview: calculateClosingExpected(shift),
        movements,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const addMovement = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid shift id."));
    }

    const type = `${req.body.type || ""}`.trim().toUpperCase();
    const amount = Number(req.body.amount);
    const reason = `${req.body.reason || ""}`.trim();
    const directionInput = `${req.body.direction || ""}`.trim().toUpperCase();

    if (!MOVEMENT_TYPES.includes(type)) {
      return next(createHttpError(400, "Unsupported movement type."));
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      return next(createHttpError(400, "amount must be > 0."));
    }

    const shift = await CashShift.findById(id);
    if (!shift) {
      return next(createHttpError(404, "Shift not found."));
    }

    if (shift.status !== "OPEN") {
      return next(createHttpError(409, "Cannot add movement to a closed shift."));
    }

    let direction = "IN";
    if (type === "PAID_OUT") {
      direction = "OUT";
    } else if (type === "ADJUSTMENT") {
      if (!["IN", "OUT"].includes(directionInput)) {
        return next(createHttpError(400, "direction must be IN or OUT for ADJUSTMENT."));
      }
      direction = directionInput;
    }

    if (direction === "IN") {
      shift.paidInTotal += amount;
    } else {
      shift.paidOutTotal += amount;
    }

    await shift.save();

    const movement = await recordCashMovement({
      shiftId: shift._id,
      locationId: shift.locationId,
      type,
      direction,
      amount,
      reason,
      createdBy: req.user._id,
      metadata: req.body.metadata,
    });

    await logAuditEvent({
      req,
      action: "CASH_SHIFT_MOVEMENT_ADDED",
      resourceType: "CashShift",
      resourceId: shift._id,
      statusCode: 200,
      metadata: {
        movementType: type,
        direction,
        amount,
      },
    });

    return res.status(200).json({ success: true, data: { shift, movement } });
  } catch (error) {
    return next(error);
  }
};

const closeShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid shift id."));
    }

    const closingCounted = Number(req.body.closingCounted);
    const notes = `${req.body.notes || ""}`.trim();

    if (!Number.isFinite(closingCounted) || closingCounted < 0) {
      return next(createHttpError(400, "closingCounted must be >= 0."));
    }

    const shift = await CashShift.findById(id);
    if (!shift) {
      return next(createHttpError(404, "Shift not found."));
    }

    if (shift.status !== "OPEN") {
      return next(createHttpError(409, "Shift is already closed."));
    }

    const closingExpected = calculateClosingExpected(shift);
    const variance = Number((closingCounted - closingExpected).toFixed(2));

    shift.status = "CLOSED";
    shift.closingExpected = closingExpected;
    shift.closingCounted = closingCounted;
    shift.variance = variance;
    shift.closedBy = req.user._id;
    shift.closedAt = new Date();
    shift.notes = notes || shift.notes;
    await shift.save();

    await logAuditEvent({
      req,
      action: "CASH_SHIFT_CLOSED",
      resourceType: "CashShift",
      resourceId: shift._id,
      statusCode: 200,
      metadata: {
        locationId: shift.locationId,
        closingExpected,
        closingCounted,
        variance,
      },
    });

    return res.status(200).json({ success: true, data: shift });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  openShift,
  listShifts,
  getShiftById,
  addMovement,
  closeShift,
};

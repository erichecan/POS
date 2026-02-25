const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const WorkforceShift = require("../models/workforceShiftModel");
const User = require("../models/userModel");
const { logAuditEvent } = require("../utils/auditLogger");

const normalizeLocationId = (value) => `${value || ""}`.trim() || "default";

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const parseDate = (value, fieldName) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createHttpError(400, `${fieldName} must be a valid datetime string.`);
  }
  return date;
};

const createShift = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    const employeeId = `${req.body.employeeId || ""}`.trim();
    if (!mongoose.Types.ObjectId.isValid(employeeId)) {
      return next(createHttpError(400, "Invalid employeeId."));
    }

    const employee = await User.findById(employeeId);
    if (!employee) {
      return next(createHttpError(404, "Employee not found."));
    }

    const startAt = parseDate(req.body.startAt, "startAt");
    const endAt = parseDate(req.body.endAt, "endAt");
    if (endAt <= startAt) {
      return next(createHttpError(400, "endAt must be later than startAt."));
    }

    const shift = await WorkforceShift.create({
      locationId,
      employeeId,
      role: employee.role,
      startAt,
      endAt,
      status: "SCHEDULED",
      notes: `${req.body.notes || ""}`.trim(),
      createdBy: req.user?._id,
      metadata: req.body.metadata,
    });

    await logAuditEvent({
      req,
      action: "WORKFORCE_SHIFT_CREATED",
      resourceType: "WorkforceShift",
      resourceId: shift._id,
      statusCode: 201,
      metadata: {
        locationId,
        employeeId,
      },
    });

    return res.status(201).json({ success: true, data: shift });
  } catch (error) {
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

    if (req.query.employeeId) {
      query.employeeId = req.query.employeeId;
    }

    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    if (req.query.from || req.query.to) {
      query.startAt = {};
      if (req.query.from) query.startAt.$gte = parseDate(req.query.from, "from");
      if (req.query.to) query.startAt.$lte = parseDate(req.query.to, "to");
    }

    const [rows, total] = await Promise.all([
      WorkforceShift.find(query)
        .sort({ startAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("employeeId", "name role email phone")
        .populate("createdBy", "name role"),
      WorkforceShift.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, data: rows, pagination: { limit, offset, total } });
  } catch (error) {
    return next(error);
  }
};

const clockInShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid shift id."));
    }

    const shift = await WorkforceShift.findById(id);
    if (!shift) {
      return next(createHttpError(404, "Shift not found."));
    }

    if (!["SCHEDULED", "CLOCKED_IN"].includes(shift.status)) {
      return next(createHttpError(409, "Shift cannot be clocked in from current status."));
    }

    if (shift.status === "SCHEDULED") {
      shift.status = "CLOCKED_IN";
      shift.clockInAt = new Date();
      await shift.save();
    }

    return res.status(200).json({ success: true, data: shift });
  } catch (error) {
    return next(error);
  }
};

const clockOutShift = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid shift id."));
    }

    const shift = await WorkforceShift.findById(id);
    if (!shift) {
      return next(createHttpError(404, "Shift not found."));
    }

    if (shift.status !== "CLOCKED_IN") {
      return next(createHttpError(409, "Shift must be CLOCKED_IN before clock-out."));
    }

    shift.status = "CLOCKED_OUT";
    shift.clockOutAt = new Date();
    await shift.save();

    return res.status(200).json({ success: true, data: shift });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createShift,
  listShifts,
  clockInShift,
  clockOutShift,
};

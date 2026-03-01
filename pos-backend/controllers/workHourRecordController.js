/**
 * 工时记录 - 签到/签出、补录 - 团队管理 Phase 4
 * 2026-02-28
 */
const WorkHourRecord = require("../models/workHourRecordModel");
const User = require("../models/userModel");
const createHttpError = require("http-errors");
const mongoose = require("mongoose");

const listWorkHourRecords = async (req, res, next) => {
  try {
    const locationId = req.query.locationId || "default";
    const userId = req.query.userId;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const filter = { locationId };
    if (userId) filter.userId = userId;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    const records = await WorkHourRecord.find(filter)
      .populate("userId", "name email")
      .sort({ date: -1, clockInAt: -1 });
    return res.status(200).json({ success: true, data: records });
  } catch (error) {
    return next(error);
  }
};

const createOrUpdateWorkHourRecord = async (req, res, next) => {
  try {
    const { userId, date, clockInAt, clockOutAt, source = "MANUAL", notes } = req.body;
    const approverId = req.user?._id;
    if (!userId || !date) {
      return next(createHttpError(400, "userId and date are required."));
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(createHttpError(400, "Invalid userId."));
    }
    const user = await User.findById(userId);
    if (!user) return next(createHttpError(404, "User not found."));

    const locationId = req.body.locationId || "default";
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    let record = await WorkHourRecord.findOne({ userId, locationId, date: d });
    if (record) {
      if (clockInAt !== undefined) record.clockInAt = clockInAt ? new Date(clockInAt) : undefined;
      if (clockOutAt !== undefined) record.clockOutAt = clockOutAt ? new Date(clockOutAt) : undefined;
      if (notes !== undefined) record.notes = notes ? `${notes}`.trim() : undefined;
      if (record.clockInAt && record.clockOutAt) record.status = "CLOSED";
      if (approverId) record.approvedBy = approverId;
      await record.save();
    } else {
      record = await WorkHourRecord.create({
        userId,
        locationId,
        date: d,
        clockInAt: clockInAt ? new Date(clockInAt) : undefined,
        clockOutAt: clockOutAt ? new Date(clockOutAt) : undefined,
        source: ["MANUAL", "PUNCH_CLOCK", "APP"].includes(source) ? source : "MANUAL",
        status: clockInAt && clockOutAt ? "CLOSED" : "OPEN",
        approvedBy: approverId,
        notes: notes ? `${notes}`.trim() : undefined,
      });
    }
    await record.populate("userId", "name email");
    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    return next(error);
  }
};

const clockIn = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return next(createHttpError(401, "User not authenticated."));
    const now = new Date();
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    const locationId = req.body.locationId || "default";

    let record = await WorkHourRecord.findOne({ userId, locationId, date: d });
    if (record) {
      if (record.clockOutAt) {
        return next(createHttpError(409, "Already clocked out today. Use manual entry for new record."));
      }
      record.clockInAt = record.clockInAt || now;
      await record.save();
    } else {
      record = await WorkHourRecord.create({
        userId,
        locationId,
        date: d,
        clockInAt: now,
        source: "APP",
        status: "OPEN",
      });
    }
    await record.populate("userId", "name email");
    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    return next(error);
  }
};

const clockOut = async (req, res, next) => {
  try {
    const userId = req.user?._id;
    if (!userId) return next(createHttpError(401, "User not authenticated."));
    const now = new Date();
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    const locationId = req.body.locationId || "default";

    const record = await WorkHourRecord.findOne({ userId, locationId, date: d });
    if (!record) return next(createHttpError(404, "No clock-in record for today."));
    if (record.clockOutAt) return next(createHttpError(409, "Already clocked out."));
    record.clockOutAt = now;
    record.status = "CLOSED";
    await record.save();
    await record.populate("userId", "name email");
    return res.status(200).json({ success: true, data: record });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listWorkHourRecords,
  createOrUpdateWorkHourRecord,
  clockIn,
  clockOut,
};

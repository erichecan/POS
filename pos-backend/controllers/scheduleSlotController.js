/**
 * 排班 CRUD + 批量 - 团队管理 Phase 3
 * 2026-02-28
 */
const ScheduleSlot = require("../models/scheduleSlotModel");
const ShiftTemplate = require("../models/shiftTemplateModel");
const User = require("../models/userModel");
const createHttpError = require("http-errors");
const mongoose = require("mongoose");

const parseTimeToDate = (date, timeStr) => {
  const [h, m] = `${timeStr || "00:00"}`.trim().split(":").map(Number);
  const d = new Date(date);
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};

const listScheduleSlots = async (req, res, next) => {
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
    const slots = await ScheduleSlot.find(filter)
      .populate("userId", "name email")
      .populate("shiftTemplateId")
      .sort({ date: 1, plannedStart: 1 });
    return res.status(200).json({ success: true, data: slots });
  } catch (error) {
    return next(error);
  }
};

const createScheduleSlot = async (req, res, next) => {
  try {
    const { userId, shiftTemplateId, locationId = "default", date, plannedStart, plannedEnd, status, notes } = req.body;
    if (!userId || !date) {
      return next(createHttpError(400, "userId and date are required."));
    }
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return next(createHttpError(400, "Invalid userId."));
    }
    const user = await User.findById(userId);
    if (!user) return next(createHttpError(404, "User not found."));

    const locId = `${locationId || "default"}`.trim();
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);

    let startDt;
    let endDt;
    if (plannedStart && plannedEnd) {
      startDt = new Date(plannedStart);
      endDt = new Date(plannedEnd);
    } else if (shiftTemplateId) {
      const template = await ShiftTemplate.findById(shiftTemplateId);
      if (!template) return next(createHttpError(404, "Shift template not found."));
      startDt = parseTimeToDate(d, template.startTime);
      endDt = parseTimeToDate(d, template.endTime);
      if (Number(template.endTime?.split(":")[0]) < Number(template.startTime?.split(":")[0])) {
        endDt.setDate(endDt.getDate() + 1);
      }
    } else {
      return next(createHttpError(400, "plannedStart/plannedEnd or shiftTemplateId required."));
    }

    const slot = await ScheduleSlot.create({
      userId,
      shiftTemplateId: shiftTemplateId || undefined,
      locationId: locId,
      date: d,
      plannedStart: startDt,
      plannedEnd: endDt,
      status: status || "DRAFT",
      notes: notes ? `${notes}`.trim() : undefined,
    });
    await slot.populate("userId", "name email");
    await slot.populate("shiftTemplateId");
    return res.status(201).json({ success: true, data: slot });
  } catch (error) {
    return next(error);
  }
};

const bulkCreateScheduleSlots = async (req, res, next) => {
  try {
    const { userIds, shiftTemplateId, startDate, endDate, locationId = "default" } = req.body;
    if (!Array.isArray(userIds) || userIds.length === 0 || !shiftTemplateId || !startDate || !endDate) {
      return next(createHttpError(400, "userIds, shiftTemplateId, startDate, endDate required."));
    }
    const template = await ShiftTemplate.findById(shiftTemplateId);
    if (!template) return next(createHttpError(404, "Shift template not found."));

    const locId = `${locationId || "default"}`.trim();
    const start = new Date(startDate);
    const end = new Date(endDate);
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    const slots = [];
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateOnly = new Date(d);
      dateOnly.setHours(0, 0, 0, 0);
      const plannedStart = parseTimeToDate(dateOnly, template.startTime);
      let plannedEnd = parseTimeToDate(dateOnly, template.endTime);
      if (plannedEnd <= plannedStart) plannedEnd.setDate(plannedEnd.getDate() + 1);

      for (const uid of userIds) {
        if (!mongoose.Types.ObjectId.isValid(uid)) continue;
        const slot = await ScheduleSlot.create({
          userId: uid,
          shiftTemplateId,
          locationId: locId,
          date: dateOnly,
          plannedStart,
          plannedEnd,
          status: "DRAFT",
        });
        slots.push(slot);
      }
    }
    return res.status(201).json({ success: true, data: slots });
  } catch (error) {
    return next(error);
  }
};

const updateScheduleSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid schedule slot id."));
    }
    const slot = await ScheduleSlot.findById(id);
    if (!slot) return next(createHttpError(404, "Schedule slot not found."));
    const { userId, plannedStart, plannedEnd, status, notes } = req.body;
    if (userId !== undefined) slot.userId = userId;
    if (plannedStart !== undefined) slot.plannedStart = new Date(plannedStart);
    if (plannedEnd !== undefined) slot.plannedEnd = new Date(plannedEnd);
    if (status !== undefined) slot.status = status;
    if (notes !== undefined) slot.notes = notes ? `${notes}`.trim() : undefined;
    await slot.save();
    await slot.populate("userId", "name email");
    await slot.populate("shiftTemplateId");
    return res.status(200).json({ success: true, data: slot });
  } catch (error) {
    return next(error);
  }
};

const deleteScheduleSlot = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid schedule slot id."));
    }
    const slot = await ScheduleSlot.findByIdAndDelete(id);
    if (!slot) return next(createHttpError(404, "Schedule slot not found."));
    return res.status(200).json({ success: true, message: "Schedule slot deleted." });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listScheduleSlots,
  createScheduleSlot,
  bulkCreateScheduleSlots,
  updateScheduleSlot,
  deleteScheduleSlot,
};

/**
 * 请假申请与审批 - 团队管理 Phase 4
 * 2026-02-28
 */
const LeaveRequest = require("../models/leaveRequestModel");
const ScheduleSlot = require("../models/scheduleSlotModel");
const createHttpError = require("http-errors");
const mongoose = require("mongoose");

const listLeaveRequests = async (req, res, next) => {
  try {
    const locationId = req.query.locationId || "default";
    const userId = req.query.userId;
    const status = req.query.status;
    const filter = {};
    if (userId) filter.userId = userId;
    if (status) filter.status = status;
    const leaves = await LeaveRequest.find(filter)
      .populate("userId", "name email")
      .populate("approvedBy", "name email")
      .populate("replacementUserId", "name email")
      .sort({ startDate: -1 });
    return res.status(200).json({ success: true, data: leaves });
  } catch (error) {
    return next(error);
  }
};

const createLeaveRequest = async (req, res, next) => {
  try {
    const userId = req.user?._id || req.body.userId;
    if (!userId) return next(createHttpError(401, "User not authenticated."));
    const { type = "PERSONAL", startDate, endDate, reason } = req.body;
    if (!startDate || !endDate) {
      return next(createHttpError(400, "startDate and endDate are required."));
    }
    const s = new Date(startDate);
    const e = new Date(endDate);
    if (e < s) return next(createHttpError(400, "endDate must be >= startDate."));
    const leave = await LeaveRequest.create({
      userId,
      type: ["SICK", "PERSONAL", "OTHER"].includes(type) ? type : "PERSONAL",
      startDate: s,
      endDate: e,
      reason: reason ? `${reason}`.trim() : undefined,
      status: "PENDING",
    });
    await leave.populate("userId", "name email");
    return res.status(201).json({ success: true, data: leave });
  } catch (error) {
    return next(error);
  }
};

const approveLeaveRequest = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, replacementUserId } = req.body;
    const approverId = req.user?._id;
    if (!approverId) return next(createHttpError(401, "User not authenticated."));
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid leave request id."));
    }
    const leave = await LeaveRequest.findById(id);
    if (!leave) return next(createHttpError(404, "Leave request not found."));
    if (leave.status !== "PENDING") {
      return next(createHttpError(409, "Leave request already processed."));
    }
    const newStatus = status === "REJECTED" ? "REJECTED" : "APPROVED";
    leave.status = newStatus;
    leave.approvedBy = approverId;
    leave.approvedAt = new Date();
    if (replacementUserId && newStatus === "APPROVED") {
      leave.replacementUserId = replacementUserId;
    }
    await leave.save();

    if (newStatus === "APPROVED" && replacementUserId) {
      const slots = await ScheduleSlot.find({
        userId: leave.userId,
        status: { $in: ["DRAFT", "CONFIRMED"] },
        date: { $gte: leave.startDate, $lte: leave.endDate },
      });
      for (const slot of slots) {
        slot.userId = replacementUserId;
        await slot.save();
      }
    }
    await leave.populate("userId", "name email");
    await leave.populate("approvedBy", "name email");
    await leave.populate("replacementUserId", "name email");
    return res.status(200).json({ success: true, data: leave });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
};

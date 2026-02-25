const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const InventoryChannelSyncTask = require("../models/inventoryChannelSyncTaskModel");
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

const listInventorySyncTasks = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.locationId) {
      query.locationId = normalizeLocationId(req.query.locationId);
    }
    if (req.query.providerCode) {
      query.providerCode = `${req.query.providerCode}`.trim().toUpperCase();
    }
    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    const [rows, total] = await Promise.all([
      InventoryChannelSyncTask.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit),
      InventoryChannelSyncTask.countDocuments(query),
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

const updateInventorySyncTaskStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid sync task id."));
    }

    const task = await InventoryChannelSyncTask.findById(id);
    if (!task) {
      return next(createHttpError(404, "Sync task not found."));
    }

    const status = `${req.body.status || ""}`.trim().toUpperCase();
    if (!["PENDING", "SYNCED", "FAILED"].includes(status)) {
      return next(createHttpError(400, "status must be PENDING, SYNCED or FAILED."));
    }

    task.status = status;
    task.attempts = Number(task.attempts || 0) + 1;
    task.lastAttemptAt = new Date();
    task.lastError = status === "FAILED" ? `${req.body.error || "Unknown sync error"}`.trim() : "";
    await task.save();

    await logAuditEvent({
      req,
      action: "INVENTORY_CHANNEL_SYNC_TASK_UPDATED",
      resourceType: "InventoryChannelSyncTask",
      resourceId: task._id,
      statusCode: 200,
      metadata: {
        status,
        providerCode: task.providerCode,
        itemCode: task.itemCode,
      },
    });

    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listInventorySyncTasks,
  updateInventorySyncTaskStatus,
};

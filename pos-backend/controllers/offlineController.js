const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const OfflineOperation = require("../models/offlineOperationModel");
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

const enqueueOfflineOperation = async (req, res, next) => {
  try {
    const operationType = `${req.body.operationType || ""}`.trim();
    if (!operationType || req.body.payload === undefined) {
      return next(createHttpError(400, "operationType and payload are required."));
    }

    const operation = await OfflineOperation.create({
      locationId: normalizeLocationId(req.body.locationId),
      operationType,
      payload: req.body.payload,
      status: "PENDING",
      createdBy: req.user?._id,
    });

    await logAuditEvent({
      req,
      action: "OFFLINE_OPERATION_ENQUEUED",
      resourceType: "OfflineOperation",
      resourceId: operation._id,
      statusCode: 201,
      metadata: { operationType },
    });

    return res.status(201).json({ success: true, data: operation });
  } catch (error) {
    return next(error);
  }
};

const listOfflineOperations = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.locationId) {
      query.locationId = normalizeLocationId(req.query.locationId);
    }

    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    if (req.query.operationType) {
      query.operationType = `${req.query.operationType}`.trim();
    }

    const [rows, total] = await Promise.all([
      OfflineOperation.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit),
      OfflineOperation.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, data: rows, pagination: { limit, offset, total } });
  } catch (error) {
    return next(error);
  }
};

const replayOfflineOperation = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid operation id."));
    }

    const operation = await OfflineOperation.findById(id);
    if (!operation) {
      return next(createHttpError(404, "Offline operation not found."));
    }

    if (operation.status === "REPLAYED") {
      return res.status(200).json({ success: true, data: operation, replayed: false });
    }

    operation.attempts += 1;
    operation.status = "REPLAYED";
    operation.replayedAt = new Date();
    operation.lastError = "";
    await operation.save();

    await logAuditEvent({
      req,
      action: "OFFLINE_OPERATION_REPLAYED",
      resourceType: "OfflineOperation",
      resourceId: operation._id,
      statusCode: 200,
      metadata: {
        attempts: operation.attempts,
        operationType: operation.operationType,
      },
    });

    return res.status(200).json({ success: true, data: operation, replayed: true });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  enqueueOfflineOperation,
  listOfflineOperations,
  replayOfflineOperation,
};

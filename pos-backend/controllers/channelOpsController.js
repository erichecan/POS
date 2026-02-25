const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const ChannelDeadLetterEvent = require("../models/channelDeadLetterEventModel");
const ChannelIngressUsage = require("../models/channelIngressUsageModel");
const StoreChannelConnection = require("../models/storeChannelConnectionModel");
const { ingestChannelOrderPayload } = require("./channelIngressController");
const { logAuditEvent } = require("../utils/auditLogger");
const {
  categorizeFailureCode,
  buildRetryWindow,
  summarizeDeadLetters,
} = require("../utils/channelDlqGovernance");

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const buildConnectionKey = (locationId, providerCode) =>
  `${`${locationId || ""}`.trim()}::${`${providerCode || ""}`.trim().toUpperCase()}`;

const loadConnectionMapByRows = async (rows = []) => {
  const pairs = Array.from(
    new Set(
      rows.map((row) => buildConnectionKey(row.locationId, row.providerCode)).filter(Boolean)
    )
  );

  if (!pairs.length) {
    return new Map();
  }

  const orQuery = pairs.map((pair) => {
    const [locationId, providerCode] = pair.split("::");
    return { locationId, providerCode };
  });

  const connections = await StoreChannelConnection.find({ $or: orQuery })
    .select("locationId providerCode retryPolicy")
    .lean();

  return new Map(
    connections.map((connection) => [
      buildConnectionKey(connection.locationId, connection.providerCode),
      connection,
    ])
  );
};

const listDeadLetters = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.providerCode) {
      query.providerCode = `${req.query.providerCode}`.trim().toUpperCase();
    }
    if (req.query.locationId) {
      query.locationId = `${req.query.locationId}`.trim();
    }
    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }
    if (req.query.failureCategory) {
      query.failureCategory = `${req.query.failureCategory}`.trim().toUpperCase();
    }

    const [rows, total] = await Promise.all([
      ChannelDeadLetterEvent.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("resolvedBy", "name role"),
      ChannelDeadLetterEvent.countDocuments(query),
    ]);

    const now = new Date();
    const connectionByKey = await loadConnectionMapByRows(rows);
    const data = rows.map((row) => {
      const normalized = typeof row.toObject === "function" ? row.toObject() : row;
      const failureCategory =
        normalized.failureCategory ||
        categorizeFailureCode(normalized.failureCode, normalized.failureMessage);
      const connection = connectionByKey.get(
        buildConnectionKey(normalized.locationId, normalized.providerCode)
      );

      return {
        ...normalized,
        failureCategory,
        retryWindow: buildRetryWindow({
          deadLetter: normalized,
          retryPolicy: connection?.retryPolicy,
          now,
        }),
      };
    });

    return res.status(200).json({
      success: true,
      data,
      pagination: { limit, offset, total },
    });
  } catch (error) {
    return next(error);
  }
};

const replayDeadLetter = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid dead-letter id."));
    }

    const deadLetter = await ChannelDeadLetterEvent.findById(id);
    if (!deadLetter) {
      return next(createHttpError(404, "Dead-letter event not found."));
    }

    if (deadLetter.status === "DISCARDED") {
      return next(createHttpError(409, "Discarded dead-letter cannot be replayed."));
    }

    const connection = await StoreChannelConnection.findOne({
      locationId: deadLetter.locationId,
      providerCode: deadLetter.providerCode,
      enabled: true,
    })
      .select("retryPolicy")
      .lean();

    const retryWindow = buildRetryWindow({
      deadLetter,
      retryPolicy: connection?.retryPolicy,
      now: new Date(),
    });
    if (!retryWindow.retryable) {
      return next(createHttpError(409, "Dead-letter exceeded retry policy."));
    }
    if (!retryWindow.windowOpen) {
      return next(
        createHttpError(409, `Retry window not open yet. waitSeconds=${retryWindow.waitSeconds}`)
      );
    }

    const signature = req.headers["x-channel-signature"];
    const result = await ingestChannelOrderPayload({
      payload: deadLetter.payload,
      actorUser: req.user,
      signature,
    });

    deadLetter.status = "REPLAYED";
    deadLetter.replayCount = Number(deadLetter.replayCount || 0) + 1;
    deadLetter.lastReplayAt = new Date();
    deadLetter.resolvedBy = req.user?._id;
    deadLetter.resolvedAt = new Date();
    deadLetter.notes = `${req.body.notes || deadLetter.notes || ""}`.trim();
    await deadLetter.save();

    await logAuditEvent({
      req,
      action: "CHANNEL_DEAD_LETTER_REPLAYED",
      resourceType: "ChannelDeadLetterEvent",
      resourceId: deadLetter._id,
      statusCode: 200,
      metadata: {
        providerCode: deadLetter.providerCode,
        locationId: deadLetter.locationId,
        replayCount: deadLetter.replayCount,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        deadLetter,
        replayed: result.replayed,
        order: result.order,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const discardDeadLetter = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid dead-letter id."));
    }

    const deadLetter = await ChannelDeadLetterEvent.findById(id);
    if (!deadLetter) {
      return next(createHttpError(404, "Dead-letter event not found."));
    }

    deadLetter.status = "DISCARDED";
    deadLetter.resolvedBy = req.user?._id;
    deadLetter.resolvedAt = new Date();
    deadLetter.notes = `${req.body.notes || deadLetter.notes || ""}`.trim();
    await deadLetter.save();

    await logAuditEvent({
      req,
      action: "CHANNEL_DEAD_LETTER_DISCARDED",
      resourceType: "ChannelDeadLetterEvent",
      resourceId: deadLetter._id,
      statusCode: 200,
    });

    return res.status(200).json({ success: true, data: deadLetter });
  } catch (error) {
    return next(error);
  }
};

const getIngressUsage = async (req, res, next) => {
  try {
    const match = {};

    if (req.query.providerCode) {
      match.providerCode = `${req.query.providerCode}`.trim().toUpperCase();
    }
    if (req.query.locationId) {
      match.locationId = `${req.query.locationId}`.trim();
    }

    const rows = await ChannelIngressUsage.find(match)
      .sort({ bucketMinute: -1 })
      .limit(500)
      .lean();

    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
};

const getDeadLetterInsights = async (req, res, next) => {
  try {
    const now = new Date();
    const windowHoursRaw = Number(req.query.windowHours || 24);
    const windowHours = Number.isFinite(windowHoursRaw)
      ? Math.min(Math.max(windowHoursRaw, 1), 24 * 30)
      : 24;
    const from = new Date(now.getTime() - windowHours * 60 * 60 * 1000);

    const query = {
      createdAt: { $gte: from, $lte: now },
    };

    if (req.query.providerCode) {
      query.providerCode = `${req.query.providerCode}`.trim().toUpperCase();
    }
    if (req.query.locationId) {
      query.locationId = `${req.query.locationId}`.trim();
    }
    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    const rows = await ChannelDeadLetterEvent.find(query)
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const connectionByKey = await loadConnectionMapByRows(rows);
    const summary = summarizeDeadLetters({
      rows,
      connectionByKey,
      now,
    });

    return res.status(200).json({
      success: true,
      data: {
        windowHours,
        from,
        to: now,
        ...summary,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listDeadLetters,
  replayDeadLetter,
  discardDeadLetter,
  getIngressUsage,
  getDeadLetterInsights,
};

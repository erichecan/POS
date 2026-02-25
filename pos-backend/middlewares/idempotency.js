const crypto = require("crypto");
const createHttpError = require("http-errors");
const IdempotencyRequest = require("../models/idempotencyRequestModel");
const config = require("../config/config");

const WRITABLE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

const ttlMs = Math.max(Number(config.idempotencyTtlHours) || 24, 1) * 60 * 60 * 1000;

const getKeyFromRequest = (req) => {
  const headerKey = `${req.headers["x-idempotency-key"] || ""}`.trim();
  const bodyKey = `${req.body?.idempotency_key || ""}`.trim();
  return headerKey || bodyKey;
};

const getRequestPath = (req) => (req.originalUrl || req.url || "").split("?")[0];

const sortObject = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value && typeof value === "object" && !(value instanceof Date) && !Buffer.isBuffer(value)) {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        if (key === "idempotency_key") {
          return acc;
        }
        acc[key] = sortObject(value[key]);
        return acc;
      }, {});
  }

  return value;
};

const hashPayload = (body) => {
  const normalized = sortObject(body || {});
  const serialized = JSON.stringify(normalized);
  return crypto.createHash("sha256").update(serialized).digest("hex");
};

const replayResponse = (res, statusCode, body) => {
  res.setHeader("Idempotency-Status", "replayed");
  return res.status(statusCode || 200).json(body);
};

const bindResponseCapture = (res, recordId) => {
  const originalJson = res.json.bind(res);

  res.json = (body) => {
    if (!res.locals.__idempotencyCaptured) {
      res.locals.__idempotencyCaptured = true;
      IdempotencyRequest.findByIdAndUpdate(recordId, {
        statusCode: res.statusCode || 200,
        responseBody: body,
        inProgress: false,
        expiresAt: new Date(Date.now() + ttlMs),
      }).catch((error) => {
        console.error("Failed to persist idempotency response:", error.message);
      });
    }

    return originalJson(body);
  };
};

const markRecordAsStaleFailure = async (recordId, statusCode) => {
  try {
    await IdempotencyRequest.findByIdAndUpdate(recordId, {
      statusCode: statusCode || 500,
      responseBody: {
        success: false,
        message: "Request failed before producing a replayable response.",
      },
      inProgress: false,
      expiresAt: new Date(Date.now() + ttlMs),
    });
  } catch (error) {
    console.error("Failed to update stale idempotency record:", error.message);
  }
};

const idempotencyMiddleware = async (req, res, next) => {
  if (!WRITABLE_METHODS.has(req.method.toUpperCase())) {
    return next();
  }

  const key = getKeyFromRequest(req);
  if (!key) {
    return next();
  }

  const path = getRequestPath(req);
  const method = req.method.toUpperCase();
  const requestHash = hashPayload(req.body);
  const actor = req.user?._id;
  const actorScope = actor ? `${actor}` : `anonymous:${req.ip || "unknown"}`;

  try {
    const selector = { actorScope, key, method, path };
    const existing = await IdempotencyRequest.findOne(selector);

    if (existing) {
      if (existing.requestHash !== requestHash) {
        return next(
          createHttpError(409, "Idempotency key was already used with different payload.")
        );
      }

      if (existing.inProgress) {
        return next(
          createHttpError(409, "A request with this idempotency key is still processing.")
        );
      }

      return replayResponse(res, existing.statusCode, existing.responseBody);
    }

    let created;
    try {
      created = await IdempotencyRequest.create({
        actorScope,
        key,
        method,
        path,
        requestHash,
        actor,
        expiresAt: new Date(Date.now() + ttlMs),
      });
    } catch (error) {
      if (error?.code !== 11000) {
        throw error;
      }

      const duplicate = await IdempotencyRequest.findOne(selector);
      if (!duplicate) {
        throw error;
      }

      if (duplicate.requestHash !== requestHash) {
        return next(
          createHttpError(409, "Idempotency key was already used with different payload.")
        );
      }

      if (duplicate.inProgress) {
        return next(
          createHttpError(409, "A request with this idempotency key is still processing.")
        );
      }

      return replayResponse(res, duplicate.statusCode, duplicate.responseBody);
    }

    res.setHeader("Idempotency-Status", "created");
    bindResponseCapture(res, created._id);
    req.idempotencyRecordId = created._id;

    res.on("close", () => {
      if (res.locals.__idempotencyCaptured) {
        return;
      }

      if (req.idempotencyRecordId) {
        markRecordAsStaleFailure(req.idempotencyRecordId, res.statusCode);
      }
    });

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { idempotencyMiddleware };

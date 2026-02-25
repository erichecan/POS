const crypto = require("crypto");
const createHttpError = require("http-errors");
const ChannelIngressUsage = require("../models/channelIngressUsageModel");
const config = require("../config/config");

const normalizeCode = (value) => `${value || ""}`.trim().toUpperCase();
const normalizeLocationId = (value) => `${value || ""}`.trim() || "default";

const sortObject = (value) => {
  if (Array.isArray(value)) {
    return value.map(sortObject);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObject(value[key]);
        return acc;
      }, {});
  }

  return value;
};

const buildPayloadSignature = ({ secret, payload }) => {
  const canonical = JSON.stringify(sortObject(payload || {}));
  return crypto.createHmac("sha256", secret).update(canonical).digest("hex");
};

const verifyIngressSignature = ({ secret, payload, receivedSignature }) => {
  if (!secret) {
    return true;
  }

  const expected = buildPayloadSignature({ secret, payload });
  const normalizedReceived = `${receivedSignature || ""}`.trim();

  if (!normalizedReceived) {
    return false;
  }

  if (normalizedReceived.length !== expected.length) {
    return false;
  }

  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(normalizedReceived));
};

const resolveQuotaPerMinute = (connection) => {
  const fromMetadata = Number(connection?.metadata?.ingressQuotaPerMinute);
  if (Number.isFinite(fromMetadata) && fromMetadata > 0) {
    return Math.max(Math.floor(fromMetadata), 1);
  }

  const fromConfig = Number(config.channelIngressDefaultQuotaPerMinute || 120);
  return Number.isFinite(fromConfig) && fromConfig > 0 ? Math.max(Math.floor(fromConfig), 1) : 120;
};

const buildMinuteBucket = (date = new Date()) => {
  const safeDate = date instanceof Date ? date : new Date(date);
  return safeDate.toISOString().slice(0, 16);
};

const enforceIngressQuota = async ({ providerCode, locationId, quotaPerMinute }) => {
  const normalizedProviderCode = normalizeCode(providerCode);
  const normalizedLocationId = normalizeLocationId(locationId);
  const bucketMinute = buildMinuteBucket(new Date());

  const usage = await ChannelIngressUsage.findOneAndUpdate(
    {
      providerCode: normalizedProviderCode,
      locationId: normalizedLocationId,
      bucketMinute,
    },
    {
      $inc: { requestCount: 1 },
      $setOnInsert: {
        providerCode: normalizedProviderCode,
        locationId: normalizedLocationId,
        bucketMinute,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    },
    { upsert: true, new: true }
  );

  if (Number(usage.requestCount || 0) > quotaPerMinute) {
    throw createHttpError(429, `Channel ingress quota exceeded: ${quotaPerMinute}/min.`);
  }

  return usage;
};

module.exports = {
  normalizeCode,
  normalizeLocationId,
  buildPayloadSignature,
  verifyIngressSignature,
  resolveQuotaPerMinute,
  buildMinuteBucket,
  enforceIngressQuota,
};

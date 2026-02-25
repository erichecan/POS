const crypto = require("crypto");
const createHttpError = require("http-errors");
const DeveloperApiUsage = require("../models/developerApiUsageModel");
const config = require("../config/config");

const normalizeScope = (scope) => `${scope || ""}`.trim().toLowerCase();
const normalizeIp = (ip) => `${ip || ""}`.trim();

const generatePlainApiKey = () => `pos_live_${crypto.randomBytes(24).toString("hex")}`;
const hashApiKey = (plainKey) => crypto.createHash("sha256").update(`${plainKey || ""}`).digest("hex");
const deriveKeyPrefix = (plainKey) => `${plainKey || ""}`.slice(0, 12);

const extractIp = (req) => {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || "";
};

const parseScopes = (scopes = []) =>
  Array.from(new Set((Array.isArray(scopes) ? scopes : []).map((scope) => normalizeScope(scope)).filter(Boolean)));

const hasScope = ({ apiKeyScopes = [], requiredScope }) => {
  const required = normalizeScope(requiredScope);
  const scopes = parseScopes(apiKeyScopes);
  if (!required) {
    return true;
  }
  return scopes.includes(required) || scopes.includes("*");
};

const assertScopeAllowed = ({ apiKeyScopes, requiredScope }) => {
  if (!hasScope({ apiKeyScopes, requiredScope })) {
    throw createHttpError(403, `Developer API scope denied: ${requiredScope}`);
  }
};

const assertIpAllowed = ({ allowedIps = [], requestIp }) => {
  const normalizedIps = (Array.isArray(allowedIps) ? allowedIps : [])
    .map((ip) => normalizeIp(ip))
    .filter(Boolean);

  if (!normalizedIps.length) {
    return true;
  }

  const ip = normalizeIp(requestIp);
  if (!ip || !normalizedIps.includes(ip)) {
    throw createHttpError(403, "Developer API IP is not allowed.");
  }

  return true;
};

const buildMinuteBucket = (date = new Date()) => {
  const safeDate = date instanceof Date ? date : new Date(date);
  return safeDate.toISOString().slice(0, 16);
};

const assertRateLimit = async ({ apiKeyId, limitPerMinute }) => {
  const safeLimit = Math.max(Number(limitPerMinute || 120), 1);
  const bucketMinute = buildMinuteBucket(new Date());

  const usage = await DeveloperApiUsage.findOneAndUpdate(
    { apiKeyId, bucketMinute },
    {
      $inc: { requestCount: 1 },
      $setOnInsert: {
        apiKeyId,
        bucketMinute,
        expiresAt: new Date(Date.now() + 2 * 60 * 60 * 1000),
      },
    },
    { upsert: true, new: true }
  );

  if (Number(usage.requestCount || 0) > safeLimit) {
    throw createHttpError(429, `Developer API rate limit exceeded: ${safeLimit}/min.`);
  }

  return usage;
};

const signWebhookPayload = ({ secret, payload }) => {
  const body = JSON.stringify(payload || {});
  return crypto.createHmac("sha256", `${secret || ""}`).update(body).digest("hex");
};

const resolveWebhookCryptoKey = () =>
  crypto
    .createHash("sha256")
    .update(`${config.accessTokenSecret || "pos-default"}:developer-webhook-secret`)
    .digest();

const encryptWebhookSecret = (secret) => {
  const plainText = `${secret || ""}`;
  if (!plainText) {
    return "";
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", resolveWebhookCryptoKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
};

const decryptWebhookSecret = (cipherText) => {
  const raw = `${cipherText || ""}`.trim();
  if (!raw) {
    return "";
  }

  const [ivBase64, tagBase64, encryptedBase64] = raw.split(".");
  if (!ivBase64 || !tagBase64 || !encryptedBase64) {
    throw createHttpError(500, "Invalid webhook secret ciphertext.");
  }

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    resolveWebhookCryptoKey(),
    Buffer.from(ivBase64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagBase64, "base64"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedBase64, "base64")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
};

module.exports = {
  normalizeScope,
  normalizeIp,
  generatePlainApiKey,
  hashApiKey,
  deriveKeyPrefix,
  extractIp,
  parseScopes,
  hasScope,
  assertScopeAllowed,
  assertIpAllowed,
  buildMinuteBucket,
  assertRateLimit,
  signWebhookPayload,
  encryptWebhookSecret,
  decryptWebhookSecret,
};

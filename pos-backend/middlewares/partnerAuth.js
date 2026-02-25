const createHttpError = require("http-errors");
const DeveloperApiKey = require("../models/developerApiKeyModel");
const {
  hashApiKey,
  assertScopeAllowed,
  assertIpAllowed,
  assertRateLimit,
  extractIp,
} = require("../utils/developerAuthService");

const partnerApiAuth = (requiredScope) => async (req, res, next) => {
  try {
    const plainApiKey = `${req.headers["x-api-key"] || ""}`.trim();
    if (!plainApiKey) {
      return next(createHttpError(401, "Missing x-api-key."));
    }

    const apiKeyHash = hashApiKey(plainApiKey);
    const apiKey = await DeveloperApiKey.findOne({ keyHash: apiKeyHash });

    if (!apiKey || apiKey.status !== "ACTIVE") {
      return next(createHttpError(401, "Invalid partner API key."));
    }

    assertScopeAllowed({ apiKeyScopes: apiKey.scopes, requiredScope });
    assertIpAllowed({ allowedIps: apiKey.allowedIps, requestIp: extractIp(req) });
    await assertRateLimit({ apiKeyId: apiKey._id, limitPerMinute: apiKey.rateLimitPerMinute });

    apiKey.lastUsedAt = new Date();
    await apiKey.save();

    req.partnerApiKey = apiKey;
    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { partnerApiAuth };

const crypto = require("crypto");
const SessionSecurityEvent = require("../models/sessionSecurityEventModel");

const extractIp = (req) => {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.connection?.remoteAddress || "";
};

const extractUserAgent = (req) => `${req.headers?.["user-agent"] || ""}`.trim();

const buildSessionFingerprint = (req) => {
  const seed = `${extractIp(req)}::${extractUserAgent(req)}`;
  return crypto.createHash("sha256").update(seed).digest("hex");
};

const logSessionSecurityEvent = async ({ req, userId, type, details }) => {
  try {
    await SessionSecurityEvent.create({
      userId,
      type,
      ip: extractIp(req),
      userAgent: extractUserAgent(req),
      fingerprint: buildSessionFingerprint(req),
      details,
    });
  } catch (error) {
    console.error("Failed to log session security event:", error.message);
  }
};

module.exports = {
  extractIp,
  extractUserAgent,
  buildSessionFingerprint,
  logSessionSecurityEvent,
};

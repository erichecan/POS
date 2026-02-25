const AuditLog = require("../models/auditLogModel");

const extractIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }

  return req.ip || req.connection?.remoteAddress || "";
};

const logAuditEvent = async ({
  req,
  action,
  resourceType,
  resourceId,
  success = true,
  statusCode,
  metadata,
}) => {
  if (!req || !action) {
    return;
  }

  try {
    await AuditLog.create({
      action,
      actorId: req.user?._id,
      actorRole: req.user?.role,
      resourceType,
      resourceId: resourceId ? `${resourceId}` : undefined,
      success,
      statusCode,
      ip: extractIp(req),
      userAgent: `${req.headers["user-agent"] || ""}`,
      metadata,
    });
  } catch (error) {
    console.error("Failed to write audit log:", error.message);
  }
};

module.exports = { logAuditEvent };

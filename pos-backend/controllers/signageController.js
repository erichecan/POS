/**
 * Signage Controller - 广告屏配置管理
 * PRD 7.23.3 2026-02-28T13:00:00+08:00
 */
const SignageDevice = require("../models/signageDeviceModel");
const { logAuditEvent } = require("../utils/auditLogger");

const normalizeLocationId = (v) => `${v || ""}`.trim() || "default";

const parsePagination = (req) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  return { limit, offset };
};

const listSignageDevices = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};
    if (req.query.locationId) query.locationId = normalizeLocationId(req.query.locationId);
    if (req.query.status) query.status = `${req.query.status}`.trim().toUpperCase();

    const [rows, total] = await Promise.all([
      SignageDevice.find(query).populate("materialIds", "name mediaType mediaUrl category status").sort({ updatedAt: -1 }).skip(offset).limit(limit).lean(),
      SignageDevice.countDocuments(query),
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

const getSignageDevice = async (req, res, next) => {
  try {
    const id = req.params.id;
    const device = await SignageDevice.findById(id).populate("materialIds", "name mediaType mediaUrl category status").lean();
    if (!device) {
      return res.status(404).json({ success: false, message: "Signage device not found." });
    }
    return res.status(200).json({ success: true, data: device });
  } catch (error) {
    return next(error);
  }
};

const createSignageDevice = async (req, res, next) => {
  try {
    const body = req.body || {};
    const locationId = normalizeLocationId(body.locationId);
    const deviceCode = `${body.deviceCode || ""}`.trim();
    if (!deviceCode) {
      return res.status(400).json({ success: false, message: "deviceCode is required." });
    }

    const doc = {
      deviceCode,
      locationId,
      physicalLocation: `${body.physicalLocation || ""}`.trim().slice(0, 80),
      resolution: `${body.resolution || "1920x1080"}`.trim().slice(0, 20),
      contentType: ["MENU", "QUEUE", "AD_LOOP", "MIXED"].includes(body.contentType) ? body.contentType : "AD_LOOP",
      priority: Number(body.priority) || 1,
      materialIds: Array.isArray(body.materialIds) ? body.materialIds.filter(Boolean) : [],
      scheduleConfig: {
        businessHoursContent: body.scheduleConfig?.businessHoursContent || "AD_LOOP",
        offHoursContent: body.scheduleConfig?.offHoursContent || "STANDBY",
      },
      status: ["ACTIVE", "INACTIVE", "OFFLINE"].includes(body.status) ? body.status : "ACTIVE",
    };

    const device = await SignageDevice.create(doc);

    await logAuditEvent({
      req,
      action: "SIGNAGE_DEVICE_CREATED",
      resourceType: "SignageDevice",
      resourceId: device._id,
      statusCode: 201,
      metadata: { deviceCode, locationId },
    });

    return res.status(201).json({ success: true, message: "Signage device created.", data: device });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: "Device code already exists for this location." });
    }
    return next(error);
  }
};

const updateSignageDevice = async (req, res, next) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const update = {};
    if (body.physicalLocation !== undefined) update.physicalLocation = `${body.physicalLocation}`.trim().slice(0, 80);
    if (body.resolution !== undefined) update.resolution = `${body.resolution}`.trim().slice(0, 20);
    if (["MENU", "QUEUE", "AD_LOOP", "MIXED"].includes(body.contentType)) update.contentType = body.contentType;
    if (body.priority !== undefined) update.priority = Number(body.priority) || 1;
    if (Array.isArray(body.materialIds)) update.materialIds = body.materialIds.filter(Boolean);
    if (body.scheduleConfig) {
      update.scheduleConfig = {
        businessHoursContent: body.scheduleConfig.businessHoursContent || "AD_LOOP",
        offHoursContent: body.scheduleConfig.offHoursContent || "STANDBY",
      };
    }
    if (["ACTIVE", "INACTIVE", "OFFLINE"].includes(body.status)) update.status = body.status;

    const device = await SignageDevice.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!device) {
      return res.status(404).json({ success: false, message: "Signage device not found." });
    }

    await logAuditEvent({
      req,
      action: "SIGNAGE_DEVICE_UPDATED",
      resourceType: "SignageDevice",
      resourceId: device._id,
      statusCode: 200,
    });

    return res.status(200).json({ success: true, message: "Signage device updated.", data: device });
  } catch (error) {
    return next(error);
  }
};

const deleteSignageDevice = async (req, res, next) => {
  try {
    const id = req.params.id;
    const device = await SignageDevice.findByIdAndDelete(id);
    if (!device) {
      return res.status(404).json({ success: false, message: "Signage device not found." });
    }
    await logAuditEvent({
      req,
      action: "SIGNAGE_DEVICE_DELETED",
      resourceType: "SignageDevice",
      resourceId: id,
      statusCode: 200,
    });
    return res.status(200).json({ success: true, message: "Signage device deleted." });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listSignageDevices,
  getSignageDevice,
  createSignageDevice,
  updateSignageDevice,
  deleteSignageDevice,
};

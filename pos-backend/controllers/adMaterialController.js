/**
 * Ad Material Controller - 广告素材管理
 * PRD 7.23.4 2026-02-28T13:00:00+08:00
 */
const AdMaterial = require("../models/adMaterialModel");
const { logAuditEvent } = require("../utils/auditLogger");

const parsePagination = (req) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  return { limit, offset };
};

const listAdMaterials = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};
    if (req.query.category) query.category = req.query.category.toUpperCase();
    if (req.query.status) query.status = req.query.status.toUpperCase();
    if (req.query.locationId) {
      query.$or = [
        { locationIds: { $exists: false } },
        { locationIds: [] },
        { locationIds: req.query.locationId },
      ];
    }

    const [rows, total] = await Promise.all([
      AdMaterial.find(query).sort({ updatedAt: -1 }).skip(offset).limit(limit).lean(),
      AdMaterial.countDocuments(query),
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

const getAdMaterial = async (req, res, next) => {
  try {
    const material = await AdMaterial.findById(req.params.id).lean();
    if (!material) {
      return res.status(404).json({ success: false, message: "Ad material not found." });
    }
    return res.status(200).json({ success: true, data: material });
  } catch (error) {
    return next(error);
  }
};

const createAdMaterial = async (req, res, next) => {
  try {
    const body = req.body || {};
    const mediaUrl = `${body.mediaUrl || ""}`.trim();
    const name = `${body.name || ""}`.trim();
    if (!mediaUrl || !name) {
      return res.status(400).json({ success: false, message: "name and mediaUrl are required." });
    }
    const mediaType = ["IMAGE", "VIDEO"].includes(body.mediaType) ? body.mediaType : "IMAGE";
    const category = ["BRAND", "PROMO", "MENU", "GENERAL"].includes(body.category) ? body.category : "GENERAL";

    const doc = {
      name: name.slice(0, 120),
      mediaType,
      mediaUrl: mediaUrl.slice(0, 1024),
      category,
      tags: Array.isArray(body.tags) ? body.tags.map((t) => `${t}`.trim().slice(0, 32)).filter(Boolean) : [],
      locationIds: Array.isArray(body.locationIds) ? body.locationIds.map((l) => `${l}`.trim()).filter(Boolean) : [],
      validFrom: body.validFrom ? new Date(body.validFrom) : null,
      validTo: body.validTo ? new Date(body.validTo) : null,
      durationSeconds: Number(body.durationSeconds) || 10,
      status: ["DRAFT", "PUBLISHED", "ARCHIVED"].includes(body.status) ? body.status : "DRAFT",
    };

    const material = await AdMaterial.create(doc);

    await logAuditEvent({
      req,
      action: "AD_MATERIAL_CREATED",
      resourceType: "AdMaterial",
      resourceId: material._id,
      statusCode: 201,
    });

    return res.status(201).json({ success: true, message: "Ad material created.", data: material });
  } catch (error) {
    return next(error);
  }
};

const updateAdMaterial = async (req, res, next) => {
  try {
    const id = req.params.id;
    const body = req.body || {};
    const update = {};
    if (body.name !== undefined) update.name = `${body.name}`.trim().slice(0, 120);
    if (body.mediaUrl !== undefined) update.mediaUrl = `${body.mediaUrl}`.trim().slice(0, 1024);
    if (["IMAGE", "VIDEO"].includes(body.mediaType)) update.mediaType = body.mediaType;
    if (["BRAND", "PROMO", "MENU", "GENERAL"].includes(body.category)) update.category = body.category;
    if (Array.isArray(body.tags)) update.tags = body.tags.map((t) => `${t}`.trim().slice(0, 32)).filter(Boolean);
    if (Array.isArray(body.locationIds)) update.locationIds = body.locationIds.map((l) => `${l}`.trim()).filter(Boolean);
    if (body.validFrom !== undefined) update.validFrom = body.validFrom ? new Date(body.validFrom) : null;
    if (body.validTo !== undefined) update.validTo = body.validTo ? new Date(body.validTo) : null;
    if (body.durationSeconds !== undefined) update.durationSeconds = Number(body.durationSeconds) || 10;
    if (["DRAFT", "PUBLISHED", "ARCHIVED"].includes(body.status)) update.status = body.status;

    const material = await AdMaterial.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();
    if (!material) {
      return res.status(404).json({ success: false, message: "Ad material not found." });
    }

    await logAuditEvent({
      req,
      action: "AD_MATERIAL_UPDATED",
      resourceType: "AdMaterial",
      resourceId: id,
      statusCode: 200,
    });

    return res.status(200).json({ success: true, message: "Ad material updated.", data: material });
  } catch (error) {
    return next(error);
  }
};

const deleteAdMaterial = async (req, res, next) => {
  try {
    const material = await AdMaterial.findByIdAndDelete(req.params.id);
    if (!material) {
      return res.status(404).json({ success: false, message: "Ad material not found." });
    }
    await logAuditEvent({
      req,
      action: "AD_MATERIAL_DELETED",
      resourceType: "AdMaterial",
      resourceId: req.params.id,
      statusCode: 200,
    });
    return res.status(200).json({ success: true, message: "Ad material deleted." });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listAdMaterials,
  getAdMaterial,
  createAdMaterial,
  updateAdMaterial,
  deleteAdMaterial,
};

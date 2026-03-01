/**
 * Brand Controller - 品牌与触点管理
 * PRD 7.23 2026-02-28T13:00:00+08:00
 */
const BrandProfile = require("../models/brandProfileModel");
const { logAuditEvent } = require("../utils/auditLogger");

const normalizeLocationId = (v) => `${v || ""}`.trim() || "default";

const listBrandProfiles = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.query.locationId);
    const query = locationId ? { locationId } : {};
    const rows = await BrandProfile.find(query).sort({ updatedAt: -1 }).lean();
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
};

const getBrandProfile = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.params.locationId || req.query.locationId);
    const profile = await BrandProfile.findOne({ locationId }).lean();
    const payload = profile || {
      locationId,
      brandName: "POS Store",
      brandNameEn: "",
      slogan: "",
      primaryColor: "#1a1a1a",
      secondaryColor: "#666666",
      logoUrl: "",
      logoLightUrl: "",
      logoDarkUrl: "",
      showLogoOnReceipt: true,
      showLogoOnSignage: true,
      showLogoOnQueueDisplay: true,
    };
    return res.status(200).json({ success: true, data: payload });
  } catch (error) {
    return next(error);
  }
};

const upsertBrandProfile = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId || req.params.locationId);
    const body = req.body || {};
    const update = {
      locationId,
      brandName: `${body.brandName || ""}`.trim().slice(0, 80) || "POS Store",
      brandNameEn: `${body.brandNameEn || ""}`.trim().slice(0, 80),
      slogan: `${body.slogan || ""}`.trim().slice(0, 120),
      primaryColor: `${body.primaryColor || "#1a1a1a"}`.trim().slice(0, 20),
      secondaryColor: `${body.secondaryColor || "#666666"}`.trim().slice(0, 20),
      logoUrl: `${body.logoUrl || ""}`.trim().slice(0, 512),
      logoLightUrl: `${body.logoLightUrl || ""}`.trim().slice(0, 512),
      logoDarkUrl: `${body.logoDarkUrl || ""}`.trim().slice(0, 512),
      showLogoOnReceipt: body.showLogoOnReceipt !== false,
      showLogoOnSignage: body.showLogoOnSignage !== false,
      showLogoOnQueueDisplay: body.showLogoOnQueueDisplay !== false,
    };
    const profile = await BrandProfile.findOneAndUpdate(
      { locationId },
      { $set: update },
      { upsert: true, new: true }
    ).lean();

    await logAuditEvent({
      req,
      action: "BRAND_PROFILE_UPDATED",
      resourceType: "BrandProfile",
      resourceId: profile?._id,
      statusCode: 200,
      metadata: { locationId },
    });

    return res.status(200).json({
      success: true,
      message: "Brand profile updated.",
      data: profile,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listBrandProfiles,
  getBrandProfile,
  upsertBrandProfile,
};

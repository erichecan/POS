const createHttpError = require("http-errors");
const StoreVerticalProfile = require("../models/storeVerticalProfileModel");
const { VERTICAL_TEMPLATE_VERSION } = require("../config/verticalTemplateCatalog");
const { logAuditEvent } = require("../utils/auditLogger");
const {
  normalizeCountryCode,
  normalizeTemplateCode,
  listVerticalTemplates,
  getVerticalTemplateByCode,
  resolveVerticalTemplateConfig,
} = require("../utils/verticalTemplateService");

const normalizeLocationId = (value) => `${value || ""}`.trim() || "default";

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const listVerticalTemplateCatalog = async (req, res, next) => {
  try {
    const countryCode = normalizeCountryCode(req.query.countryCode);
    const typeGroup = `${req.query.typeGroup || ""}`.trim().toUpperCase();
    const keyword = `${req.query.keyword || ""}`.trim();

    const templates = listVerticalTemplates({
      countryCode,
      typeGroup,
      keyword,
    });

    return res.status(200).json({
      success: true,
      data: {
        catalogVersion: VERTICAL_TEMPLATE_VERSION,
        filters: { countryCode, typeGroup, keyword },
        templates,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const listStoreVerticalProfiles = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.locationId) {
      query.locationId = normalizeLocationId(req.query.locationId);
    }
    if (req.query.countryCode) {
      query.countryCode = normalizeCountryCode(req.query.countryCode);
    }
    if (req.query.templateCode) {
      query.templateCode = normalizeTemplateCode(req.query.templateCode);
    }
    if (req.query.profileStatus) {
      query.profileStatus = `${req.query.profileStatus}`.trim().toUpperCase();
    }

    const [rows, total] = await Promise.all([
      StoreVerticalProfile.find(query).sort({ updatedAt: -1 }).skip(offset).limit(limit),
      StoreVerticalProfile.countDocuments(query),
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

// 2026-02-28T12:00:00+08:00: PRD 7.22 行业模版消费端 - Profile 404 时返回 fallback 配置
const getStoreVerticalProfile = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.params.locationId);
    const includeResolved = `${req.query.includeResolved || ""}`.trim().toLowerCase() === "true";
    const profile = await StoreVerticalProfile.findOne({ locationId });

    let payload;
    if (!profile) {
      const fallbackTemplateCode = "MILK_TEA";
      payload = {
        locationId,
        countryCode: "US",
        templateCode: fallbackTemplateCode,
        profileStatus: "ACTIVE",
        overrides: {},
        isFallback: true,
      };
      if (includeResolved) {
        payload.resolvedTemplate = resolveVerticalTemplateConfig({
          templateCode: fallbackTemplateCode,
          overrides: {},
        });
      }
    } else {
      payload = { ...profile.toObject() };
      if (includeResolved) {
        payload.resolvedTemplate = resolveVerticalTemplateConfig({
          templateCode: profile.templateCode,
          overrides: profile.overrides || {},
        });
      }
    }

    return res.status(200).json({ success: true, data: payload });
  } catch (error) {
    return next(error);
  }
};

const upsertStoreVerticalProfile = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.params.locationId || req.body.locationId);
    const countryCode = normalizeCountryCode(req.body.countryCode, "US");
    const templateCode = normalizeTemplateCode(req.body.templateCode);
    const profileStatus = `${req.body.profileStatus || "ACTIVE"}`.trim().toUpperCase();
    const overrides = req.body.overrides && typeof req.body.overrides === "object" ? req.body.overrides : {};

    if (!templateCode) {
      return next(createHttpError(400, "templateCode is required."));
    }

    const matchedTemplate = getVerticalTemplateByCode(templateCode);
    if (!matchedTemplate) {
      return next(createHttpError(400, "Unknown templateCode."));
    }
    if (
      !Array.isArray(matchedTemplate.supportedCountries) ||
      !matchedTemplate.supportedCountries.includes(countryCode)
    ) {
      return next(createHttpError(400, `Template ${templateCode} is not supported in ${countryCode}.`));
    }

    const profile = await StoreVerticalProfile.findOneAndUpdate(
      { locationId },
      {
        $set: {
          locationId,
          countryCode,
          templateCode,
          templateVersion: VERTICAL_TEMPLATE_VERSION,
          profileStatus,
          overrides,
          metadata: req.body.metadata || {},
          updatedBy: req.user?._id,
        },
        $setOnInsert: {
          createdBy: req.user?._id,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    await logAuditEvent({
      req,
      action: "STORE_VERTICAL_PROFILE_UPSERTED",
      resourceType: "StoreVerticalProfile",
      resourceId: profile._id,
      statusCode: 200,
      metadata: {
        locationId,
        countryCode,
        templateCode,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        ...profile.toObject(),
        resolvedTemplate: resolveVerticalTemplateConfig({
          templateCode: profile.templateCode,
          overrides: profile.overrides || {},
        }),
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listVerticalTemplateCatalog,
  listStoreVerticalProfiles,
  getStoreVerticalProfile,
  upsertStoreVerticalProfile,
};

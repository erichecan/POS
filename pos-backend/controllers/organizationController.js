const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const Organization = require("../models/organizationModel");
const Region = require("../models/regionModel");
const Store = require("../models/storeModel");
const StoreVerticalProfile = require("../models/storeVerticalProfileModel");
const StoreHardwareProfile = require("../models/storeHardwareProfileModel");
const { logAuditEvent } = require("../utils/auditLogger");
const { resolveStoreSettings } = require("../utils/configInheritance");
const { applyActivePolicyPackToLocation } = require("../utils/compliancePolicyExecutor");
const { buildStoreProvisioningPlan } = require("../utils/storeProvisioningService");

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const createOrganization = async (req, res, next) => {
  try {
    const code = `${req.body.code || ""}`.trim().toUpperCase();
    const name = `${req.body.name || ""}`.trim();
    if (!code || !name) {
      return next(createHttpError(400, "code and name are required."));
    }

    const organization = await Organization.create({
      code,
      name,
      status: `${req.body.status || "ACTIVE"}`.trim().toUpperCase(),
      defaultSettings: req.body.defaultSettings || {},
      metadata: req.body.metadata,
    });

    await logAuditEvent({
      req,
      action: "ORGANIZATION_CREATED",
      resourceType: "Organization",
      resourceId: organization._id,
      statusCode: 201,
      metadata: { code },
    });

    return res.status(201).json({ success: true, data: organization });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError(409, "Organization code already exists."));
    }
    return next(error);
  }
};

// 2026-02-28T14:00:00+08:00: docs/plans/2026-02-28-settings-general-chain.md PATCH 更新接口
const sanitizeDefaultSettings = (obj) => {
  if (!obj || typeof obj !== "object") return {};
  const out = {};
  if (obj.timezone != null) out.timezone = `${obj.timezone}`.trim().slice(0, 64);
  if (obj.currency != null) out.currency = `${obj.currency}`.trim().toUpperCase().slice(0, 6);
  if (obj.countryCode != null) out.countryCode = `${obj.countryCode}`.trim().toUpperCase().slice(0, 4);
  if (obj.locale != null) out.locale = `${obj.locale}`.trim().slice(0, 16);
  return out;
};

const updateOrganization = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid organization id."));
    }
    const body = req.body || {};
    const update = {};
    if (body.defaultSettings && typeof body.defaultSettings === "object") {
      const org = await Organization.findById(id).lean();
      const merged = { ...(org?.defaultSettings || {}), ...sanitizeDefaultSettings(body.defaultSettings) };
      update.defaultSettings = merged;
    }
    if (Object.keys(update).length === 0) {
      return next(createHttpError(400, "No valid fields to update."));
    }
    const org = await Organization.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!org) return next(createHttpError(404, "Organization not found."));
    await logAuditEvent({
      req,
      action: "ORGANIZATION_UPDATED",
      resourceType: "Organization",
      resourceId: org._id,
      statusCode: 200,
    });
    return res.status(200).json({ success: true, data: org });
  } catch (error) {
    return next(error);
  }
};

const updateRegion = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid region id."));
    }
    const body = req.body || {};
    const update = {};
    if (body.timezone != null) update.timezone = `${body.timezone}`.trim().slice(0, 64) || "UTC";
    if (body.currency != null) update.currency = `${body.currency}`.trim().toUpperCase().slice(0, 6) || "EUR";
    if (body.countryCode != null) update.countryCode = `${body.countryCode}`.trim().toUpperCase().slice(0, 4);
    if (body.defaultSettings && typeof body.defaultSettings === "object") {
      const region = await Region.findById(id).lean();
      const merged = { ...(region?.defaultSettings || {}), ...sanitizeDefaultSettings(body.defaultSettings) };
      update.defaultSettings = merged;
    }
    if (Object.keys(update).length === 0) {
      return next(createHttpError(400, "No valid fields to update."));
    }
    const region = await Region.findByIdAndUpdate(id, { $set: update }, { new: true });
    if (!region) return next(createHttpError(404, "Region not found."));
    await logAuditEvent({
      req,
      action: "REGION_UPDATED",
      resourceType: "Region",
      resourceId: region._id,
      statusCode: 200,
    });
    return res.status(200).json({ success: true, data: region });
  } catch (error) {
    return next(error);
  }
};

const updateStore = async (req, res, next) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid store id."));
    }
    const body = req.body || {};
    const update = {};
    if (body.timezone != null) update.timezone = `${body.timezone}`.trim().slice(0, 64) || "";
    if (body.overrideSettings && typeof body.overrideSettings === "object") {
      const store = await Store.findById(id).lean();
      const merged = { ...(store?.overrideSettings || {}), ...sanitizeDefaultSettings(body.overrideSettings) };
      update.overrideSettings = merged;
    }
    if (Object.keys(update).length === 0) {
      return next(createHttpError(400, "No valid fields to update."));
    }
    const store = await Store.findByIdAndUpdate(id, { $set: update }, { new: true })
      .populate("organizationId", "code name")
      .populate("regionId", "code name countryCode timezone");
    if (!store) return next(createHttpError(404, "Store not found."));
    await logAuditEvent({
      req,
      action: "STORE_UPDATED",
      resourceType: "Store",
      resourceId: store._id,
      statusCode: 200,
    });
    return res.status(200).json({ success: true, data: store });
  } catch (error) {
    return next(error);
  }
};

const listOrganizations = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};
    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    const [rows, total] = await Promise.all([
      Organization.find(query).sort({ updatedAt: -1 }).skip(offset).limit(limit),
      Organization.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, data: rows, pagination: { limit, offset, total } });
  } catch (error) {
    return next(error);
  }
};

const createRegion = async (req, res, next) => {
  try {
    const organizationId = `${req.body.organizationId || ""}`.trim();
    if (!mongoose.Types.ObjectId.isValid(organizationId)) {
      return next(createHttpError(400, "Invalid organizationId."));
    }

    const organization = await Organization.findById(organizationId);
    if (!organization) {
      return next(createHttpError(404, "Organization not found."));
    }

    const region = await Region.create({
      organizationId,
      code: `${req.body.code || ""}`.trim().toUpperCase(),
      name: `${req.body.name || ""}`.trim(),
      countryCode: `${req.body.countryCode || ""}`.trim().toUpperCase(),
      currency: `${req.body.currency || "EUR"}`.trim().toUpperCase(),
      timezone: `${req.body.timezone || "UTC"}`.trim(),
      status: `${req.body.status || "ACTIVE"}`.trim().toUpperCase(),
      defaultSettings: req.body.defaultSettings || {},
      metadata: req.body.metadata,
    });

    return res.status(201).json({ success: true, data: region });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError(409, "Region code already exists under this organization."));
    }
    return next(error);
  }
};

const listRegions = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.organizationId) {
      query.organizationId = req.query.organizationId;
    }

    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    const [rows, total] = await Promise.all([
      Region.find(query)
        .sort({ updatedAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("organizationId", "code name"),
      Region.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, data: rows, pagination: { limit, offset, total } });
  } catch (error) {
    return next(error);
  }
};

const createStore = async (req, res, next) => {
  try {
    const organizationId = `${req.body.organizationId || ""}`.trim();
    const regionId = `${req.body.regionId || ""}`.trim();

    if (!mongoose.Types.ObjectId.isValid(organizationId) || !mongoose.Types.ObjectId.isValid(regionId)) {
      return next(createHttpError(400, "Invalid organizationId or regionId."));
    }

    const [organization, region] = await Promise.all([
      Organization.findById(organizationId),
      Region.findById(regionId),
    ]);

    if (!organization || !region) {
      return next(createHttpError(404, "Organization or region not found."));
    }

    const storeLocationId = `${req.body.locationId || ""}`.trim() || `loc-${Date.now().toString(36)}`;
    let provisioningPlan = null;
    try {
      provisioningPlan = buildStoreProvisioningPlan({
        locationId: storeLocationId,
        defaultCountryCode: region.countryCode || "US",
        provisioning: req.body.provisioning || {},
      });
    } catch (error) {
      return next(error);
    }

    const store = await Store.create({
      organizationId,
      regionId,
      locationId: storeLocationId,
      code: `${req.body.code || ""}`.trim().toUpperCase(),
      name: `${req.body.name || ""}`.trim(),
      status: `${req.body.status || "ACTIVE"}`.trim().toUpperCase(),
      timezone: `${req.body.timezone || region.timezone || "UTC"}`.trim(),
      channelSet: Array.isArray(req.body.channelSet)
        ? req.body.channelSet.map((code) => `${code}`.trim().toUpperCase()).filter(Boolean)
        : [],
      overrideSettings: req.body.overrideSettings || {},
      metadata: req.body.metadata,
    });

    let compliancePolicyPack = null;
    try {
      compliancePolicyPack = await applyActivePolicyPackToLocation({
        countryCode: region.countryCode,
        locationId: storeLocationId,
      });
    } catch (error) {
      await Store.findByIdAndDelete(store._id).catch(() => undefined);
      return next(createHttpError(500, `Failed to apply compliance policy pack: ${error.message}`));
    }

    if (compliancePolicyPack?.matched) {
      await logAuditEvent({
        req,
        action: "COMPLIANCE_POLICY_PACK_AUTO_APPLIED",
        resourceType: "Store",
        resourceId: store._id,
        statusCode: 201,
        metadata: {
          locationId: storeLocationId,
          countryCode: compliancePolicyPack.countryCode,
          policyPackId: compliancePolicyPack.policyPackId,
          policyPackVersion: compliancePolicyPack.policyPackVersion,
          appliedPolicyCodes: compliancePolicyPack.policyCodes,
        },
      });
    }

    let provisioningResult = null;
    if (provisioningPlan?.enabled) {
      try {
        let verticalProfile = null;
        let hardwareProfile = null;

        if (provisioningPlan.verticalProfileDraft) {
          verticalProfile = await StoreVerticalProfile.findOneAndUpdate(
            { locationId: storeLocationId },
            {
              $set: {
                ...provisioningPlan.verticalProfileDraft,
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
            action: "STORE_VERTICAL_PROFILE_AUTO_PROVISIONED",
            resourceType: "StoreVerticalProfile",
            resourceId: verticalProfile._id,
            statusCode: 201,
            metadata: {
              locationId: storeLocationId,
              templateCode: verticalProfile.templateCode,
              countryCode: verticalProfile.countryCode,
            },
          });
        }

        if (provisioningPlan.hardwareProfileDraft) {
          hardwareProfile = await StoreHardwareProfile.findOneAndUpdate(
            { locationId: storeLocationId },
            {
              $set: {
                ...provisioningPlan.hardwareProfileDraft,
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
            action: "STORE_HARDWARE_PROFILE_AUTO_PROVISIONED",
            resourceType: "StoreHardwareProfile",
            resourceId: hardwareProfile._id,
            statusCode: 201,
            metadata: {
              locationId: storeLocationId,
              countryCode: hardwareProfile.countryCode,
              selectedDeviceCount: (hardwareProfile.selections || []).length,
            },
          });
        }

        provisioningResult = {
          enabled: true,
          countryCode: provisioningPlan.countryCode,
          verticalProfile: verticalProfile ? verticalProfile.toObject() : null,
          hardwareProfile: hardwareProfile ? hardwareProfile.toObject() : null,
          summary: provisioningPlan.summary || null,
        };
      } catch (error) {
        await Promise.all([
          Store.findByIdAndDelete(store._id).catch(() => undefined),
          StoreVerticalProfile.findOneAndDelete({ locationId: storeLocationId }).catch(() => undefined),
          StoreHardwareProfile.findOneAndDelete({ locationId: storeLocationId }).catch(() => undefined),
        ]);
        return next(createHttpError(500, `Failed to apply store provisioning: ${error.message}`));
      }
    }

    return res.status(201).json({
      success: true,
      data: store,
      compliancePolicyPack,
      provisioning: provisioningResult,
    });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError(409, "Store code or locationId already exists."));
    }
    return next(error);
  }
};

const previewStoreProvisioning = async (req, res, next) => {
  try {
    const locationId = `${req.body.locationId || "preview-location"}`.trim() || "preview-location";
    const countryCode = `${req.body.countryCode || req.query.countryCode || "US"}`.trim().toUpperCase() || "US";
    const provisioningInput =
      req.body.provisioning && typeof req.body.provisioning === "object"
        ? req.body.provisioning
        : req.body;

    const plan = buildStoreProvisioningPlan({
      locationId,
      defaultCountryCode: countryCode,
      provisioning: provisioningInput,
    });

    return res.status(200).json({ success: true, data: plan });
  } catch (error) {
    return next(error);
  }
};

const listStores = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.organizationId) {
      query.organizationId = req.query.organizationId;
    }

    if (req.query.regionId) {
      query.regionId = req.query.regionId;
    }

    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    const [rows, total] = await Promise.all([
      Store.find(query)
        .sort({ updatedAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("organizationId", "code name")
        .populate("regionId", "code name countryCode timezone"),
      Store.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, data: rows, pagination: { limit, offset, total } });
  } catch (error) {
    return next(error);
  }
};

const getResolvedStoreSettings = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid store id."));
    }

    const store = await Store.findById(id)
      .populate("organizationId", "defaultSettings code name")
      .populate("regionId", "defaultSettings code name timezone currency countryCode");

    if (!store) {
      return next(createHttpError(404, "Store not found."));
    }

    const regionDefaults = {
      ...(store.regionId?.defaultSettings || {}),
      ...(store.regionId?.timezone && { timezone: store.regionId.timezone }),
      ...(store.regionId?.currency && { currency: store.regionId.currency }),
      ...(store.regionId?.countryCode && { countryCode: store.regionId.countryCode }),
    };
    const storeOverrides = {
      ...(store.overrideSettings || {}),
      ...(store.timezone && { timezone: store.timezone }),
    };

    const resolvedSettings = resolveStoreSettings({
      organizationDefaults: store.organizationId?.defaultSettings || {},
      regionDefaults,
      storeOverrides,
    });

    return res.status(200).json({
      success: true,
      data: {
        storeId: store._id,
        locationId: store.locationId,
        resolvedSettings,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createOrganization,
  listOrganizations,
  updateOrganization,
  createRegion,
  listRegions,
  updateRegion,
  createStore,
  updateStore,
  previewStoreProvisioning,
  listStores,
  getResolvedStoreSettings,
};

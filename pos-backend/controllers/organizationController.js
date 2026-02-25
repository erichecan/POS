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
      .populate("regionId", "defaultSettings code name");

    if (!store) {
      return next(createHttpError(404, "Store not found."));
    }

    const resolvedSettings = resolveStoreSettings({
      organizationDefaults: store.organizationId?.defaultSettings || {},
      regionDefaults: store.regionId?.defaultSettings || {},
      storeOverrides: store.overrideSettings || {},
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
  createRegion,
  listRegions,
  createStore,
  previewStoreProvisioning,
  listStores,
  getResolvedStoreSettings,
};

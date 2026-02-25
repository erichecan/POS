const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const DeviceRegistration = require("../models/deviceRegistrationModel");
const StoreHardwareProfile = require("../models/storeHardwareProfileModel");
const { HARDWARE_CATALOG_VERSION } = require("../config/hardwareCatalog");
const { logAuditEvent } = require("../utils/auditLogger");
const {
  normalizeCountryCode,
  normalizeProviderCode,
  listHardwareCatalog,
  validateHardwareSelection,
} = require("../utils/hardwareCatalogService");

const normalizeLocationId = (value) => `${value || ""}`.trim() || "default";
const normalizeDeviceCode = (value) => `${value || ""}`.trim().toUpperCase();

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const normalizeStringArray = (value = []) => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map((item) => `${item || ""}`.trim().toUpperCase()).filter(Boolean);
};

const registerDevice = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    const deviceCode = normalizeDeviceCode(req.body.deviceCode);
    const deviceType = `${req.body.deviceType || ""}`.trim().toUpperCase();

    if (!deviceCode || !deviceType) {
      return next(createHttpError(400, "deviceCode and deviceType are required."));
    }

    const device = await DeviceRegistration.findOneAndUpdate(
      { locationId, deviceCode },
      {
        $set: {
          locationId,
          deviceCode,
          deviceType,
          status: `${req.body.status || "ONLINE"}`.trim().toUpperCase(),
          firmwareVersion: `${req.body.firmwareVersion || ""}`.trim(),
          ipAddress: `${req.body.ipAddress || ""}`.trim(),
          metadata: req.body.metadata,
          lastHeartbeatAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true, runValidators: true }
    );

    await logAuditEvent({
      req,
      action: "DEVICE_REGISTERED",
      resourceType: "DeviceRegistration",
      resourceId: device._id,
      statusCode: 200,
      metadata: { locationId, deviceCode, deviceType },
    });

    return res.status(200).json({ success: true, data: device });
  } catch (error) {
    return next(error);
  }
};

const listDevices = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.locationId) {
      query.locationId = normalizeLocationId(req.query.locationId);
    }

    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    if (req.query.deviceType) {
      query.deviceType = `${req.query.deviceType}`.trim().toUpperCase();
    }

    const [rows, total] = await Promise.all([
      DeviceRegistration.find(query).sort({ lastHeartbeatAt: -1 }).skip(offset).limit(limit),
      DeviceRegistration.countDocuments(query),
    ]);

    return res.status(200).json({ success: true, data: rows, pagination: { limit, offset, total } });
  } catch (error) {
    return next(error);
  }
};

const getHardwareCatalog = async (req, res, next) => {
  try {
    const countryCode = normalizeCountryCode(req.query.countryCode);
    const providerCode = normalizeProviderCode(req.query.providerCode);
    const capability = `${req.query.capability || ""}`.trim().toUpperCase();
    const deviceClass = `${req.query.deviceClass || ""}`.trim().toUpperCase();

    const providers = listHardwareCatalog({
      countryCode,
      providerCode,
      capability,
      deviceClass,
    });

    return res.status(200).json({
      success: true,
      data: {
        catalogVersion: HARDWARE_CATALOG_VERSION,
        filters: { countryCode, providerCode, capability, deviceClass },
        providers,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const listStoreHardwareProfiles = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.locationId) {
      query.locationId = normalizeLocationId(req.query.locationId);
    }
    if (req.query.countryCode) {
      query.countryCode = normalizeCountryCode(req.query.countryCode);
    }
    if (req.query.profileStatus) {
      query.profileStatus = `${req.query.profileStatus}`.trim().toUpperCase();
    }
    if (req.query.businessType) {
      query.businessType = `${req.query.businessType}`.trim().toUpperCase();
    }

    const [rows, total] = await Promise.all([
      StoreHardwareProfile.find(query).sort({ updatedAt: -1 }).skip(offset).limit(limit),
      StoreHardwareProfile.countDocuments(query),
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

const getStoreHardwareProfile = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.params.locationId);
    const profile = await StoreHardwareProfile.findOne({ locationId });
    if (!profile) {
      return next(createHttpError(404, "Store hardware profile not found."));
    }

    return res.status(200).json({ success: true, data: profile });
  } catch (error) {
    return next(error);
  }
};

const upsertStoreHardwareProfile = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.params.locationId || req.body.locationId);
    const countryCode = normalizeCountryCode(req.body.countryCode, "US");
    const providerPriority = normalizeStringArray(req.body.providerPriority);
    const capabilityTargets = normalizeStringArray(req.body.capabilityTargets);
    const businessType = `${req.body.businessType || ""}`.trim().toUpperCase();
    const profileStatus = `${req.body.profileStatus || "ACTIVE"}`.trim().toUpperCase();
    const selectionsInput = Array.isArray(req.body.selections) ? req.body.selections : [];

    const validation = validateHardwareSelection({
      countryCode,
      selections: selectionsInput,
    });

    if (validation.errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid hardware profile selections.",
        details: validation.errors,
      });
    }

    const profile = await StoreHardwareProfile.findOneAndUpdate(
      { locationId },
      {
        $set: {
          locationId,
          countryCode,
          businessType,
          profileStatus,
          providerPriority,
          capabilityTargets,
          selections: validation.resolvedSelections,
          validationWarnings: validation.warnings,
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
      action: "STORE_HARDWARE_PROFILE_UPSERTED",
      resourceType: "StoreHardwareProfile",
      resourceId: profile._id,
      statusCode: 200,
      metadata: {
        locationId,
        countryCode,
        businessType,
        selectedDeviceCount: validation.resolvedSelections.length,
      },
    });

    return res.status(200).json({
      success: true,
      data: profile,
      validation: {
        warnings: validation.warnings,
        coveredCapabilities: validation.coveredCapabilities,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const heartbeatDevice = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid device id."));
    }

    const device = await DeviceRegistration.findById(id);
    if (!device) {
      return next(createHttpError(404, "Device not found."));
    }

    device.lastHeartbeatAt = new Date();
    if (req.body.status) {
      device.status = `${req.body.status}`.trim().toUpperCase();
    }
    if (req.body.ipAddress !== undefined) {
      device.ipAddress = `${req.body.ipAddress || ""}`.trim();
    }
    await device.save();

    return res.status(200).json({ success: true, data: device });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  registerDevice,
  listDevices,
  heartbeatDevice,
  getHardwareCatalog,
  listStoreHardwareProfiles,
  getStoreHardwareProfile,
  upsertStoreHardwareProfile,
};

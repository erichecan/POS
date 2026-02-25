const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const ChannelProvider = require("../models/channelProviderModel");
const MarketProfile = require("../models/marketProfileModel");
const StoreChannelConnection = require("../models/storeChannelConnectionModel");
const ChannelMappingRule = require("../models/channelMappingRuleModel");
const { logAuditEvent } = require("../utils/auditLogger");

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const normalizeCode = (value) => `${value || ""}`.trim().toUpperCase();

const pickDefined = (source, keys) =>
  keys.reduce((acc, key) => {
    if (source[key] !== undefined) {
      acc[key] = source[key];
    }
    return acc;
  }, {});

const ensureObjectId = (id) => {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw createHttpError(400, "Invalid id.");
  }
};

const createProvider = async (req, res, next) => {
  try {
    const payload = pickDefined(req.body, [
      "providerCode",
      "displayName",
      "channelType",
      "authType",
      "capabilities",
      "regionSupport",
      "status",
      "metadata",
    ]);

    payload.providerCode = normalizeCode(payload.providerCode);

    if (!payload.providerCode || !payload.displayName) {
      return next(createHttpError(400, "providerCode and displayName are required."));
    }

    const created = await ChannelProvider.create(payload);

    await logAuditEvent({
      req,
      action: "CHANNEL_PROVIDER_CREATED",
      resourceType: "ChannelProvider",
      resourceId: created._id,
      statusCode: 201,
      metadata: { providerCode: created.providerCode },
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError(409, "Provider code already exists."));
    }
    return next(error);
  }
};

const listProviders = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.providerCode) {
      query.providerCode = normalizeCode(req.query.providerCode);
    }

    const [rows, total] = await Promise.all([
      ChannelProvider.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit),
      ChannelProvider.countDocuments(query),
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

const updateProvider = async (req, res, next) => {
  try {
    ensureObjectId(req.params.id);

    const updates = pickDefined(req.body, [
      "providerCode",
      "displayName",
      "channelType",
      "authType",
      "capabilities",
      "regionSupport",
      "status",
      "metadata",
    ]);

    if (updates.providerCode !== undefined) {
      updates.providerCode = normalizeCode(updates.providerCode);
    }

    const updated = await ChannelProvider.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return next(createHttpError(404, "Channel provider not found."));
    }

    await logAuditEvent({
      req,
      action: "CHANNEL_PROVIDER_UPDATED",
      resourceType: "ChannelProvider",
      resourceId: updated._id,
      statusCode: 200,
      metadata: { providerCode: updated.providerCode },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError(409, "Provider code already exists."));
    }
    return next(error);
  }
};

const createMarketProfile = async (req, res, next) => {
  try {
    const payload = pickDefined(req.body, [
      "countryCode",
      "name",
      "currency",
      "timezone",
      "defaultTaxPolicy",
      "defaultDeliveryMode",
      "defaultChannelSet",
      "status",
      "metadata",
    ]);

    payload.countryCode = normalizeCode(payload.countryCode);
    payload.currency = normalizeCode(payload.currency);

    if (!payload.countryCode || !payload.name || !payload.currency || !payload.timezone) {
      return next(
        createHttpError(400, "countryCode, name, currency and timezone are required.")
      );
    }

    const created = await MarketProfile.create(payload);

    await logAuditEvent({
      req,
      action: "MARKET_PROFILE_CREATED",
      resourceType: "MarketProfile",
      resourceId: created._id,
      statusCode: 201,
      metadata: { countryCode: created.countryCode },
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError(409, "Market profile for this country already exists."));
    }
    return next(error);
  }
};

const listMarketProfiles = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.status) {
      query.status = req.query.status;
    }

    if (req.query.countryCode) {
      query.countryCode = normalizeCode(req.query.countryCode);
    }

    const [rows, total] = await Promise.all([
      MarketProfile.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit),
      MarketProfile.countDocuments(query),
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

const updateMarketProfile = async (req, res, next) => {
  try {
    ensureObjectId(req.params.id);

    const updates = pickDefined(req.body, [
      "countryCode",
      "name",
      "currency",
      "timezone",
      "defaultTaxPolicy",
      "defaultDeliveryMode",
      "defaultChannelSet",
      "status",
      "metadata",
    ]);

    if (updates.countryCode !== undefined) {
      updates.countryCode = normalizeCode(updates.countryCode);
    }
    if (updates.currency !== undefined) {
      updates.currency = normalizeCode(updates.currency);
    }

    const updated = await MarketProfile.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return next(createHttpError(404, "Market profile not found."));
    }

    await logAuditEvent({
      req,
      action: "MARKET_PROFILE_UPDATED",
      resourceType: "MarketProfile",
      resourceId: updated._id,
      statusCode: 200,
      metadata: { countryCode: updated.countryCode },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError(409, "Market profile for this country already exists."));
    }
    return next(error);
  }
};

const createStoreConnection = async (req, res, next) => {
  try {
    const payload = pickDefined(req.body, [
      "locationId",
      "providerCode",
      "externalStoreId",
      "credentialRef",
      "menuMappingPolicy",
      "statusMappingPolicy",
      "enabled",
      "syncMode",
      "retryPolicy",
      "metadata",
    ]);

    payload.providerCode = normalizeCode(payload.providerCode);

    if (
      !payload.locationId ||
      !payload.providerCode ||
      !payload.externalStoreId ||
      !payload.credentialRef
    ) {
      return next(
        createHttpError(
          400,
          "locationId, providerCode, externalStoreId and credentialRef are required."
        )
      );
    }

    const providerExists = await ChannelProvider.exists({
      providerCode: payload.providerCode,
      status: "active",
    });
    if (!providerExists) {
      return next(createHttpError(400, "Active provider not found for providerCode."));
    }

    const created = await StoreChannelConnection.create(payload);

    await logAuditEvent({
      req,
      action: "STORE_CHANNEL_CONNECTION_CREATED",
      resourceType: "StoreChannelConnection",
      resourceId: created._id,
      statusCode: 201,
      metadata: {
        locationId: created.locationId,
        providerCode: created.providerCode,
      },
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error?.code === 11000) {
      return next(
        createHttpError(409, "Store connection already exists for location/provider/externalStore.")
      );
    }
    return next(error);
  }
};

const listStoreConnections = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.locationId) {
      query.locationId = `${req.query.locationId}`.trim();
    }
    if (req.query.providerCode) {
      query.providerCode = normalizeCode(req.query.providerCode);
    }
    if (req.query.enabled !== undefined) {
      query.enabled = `${req.query.enabled}` === "true";
    }

    const [rows, total] = await Promise.all([
      StoreChannelConnection.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit),
      StoreChannelConnection.countDocuments(query),
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

const updateStoreConnection = async (req, res, next) => {
  try {
    ensureObjectId(req.params.id);

    const updates = pickDefined(req.body, [
      "locationId",
      "providerCode",
      "externalStoreId",
      "credentialRef",
      "menuMappingPolicy",
      "statusMappingPolicy",
      "enabled",
      "syncMode",
      "retryPolicy",
      "metadata",
    ]);

    if (updates.providerCode !== undefined) {
      updates.providerCode = normalizeCode(updates.providerCode);
      const providerExists = await ChannelProvider.exists({
        providerCode: updates.providerCode,
        status: "active",
      });
      if (!providerExists) {
        return next(createHttpError(400, "Active provider not found for providerCode."));
      }
    }

    const updated = await StoreChannelConnection.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return next(createHttpError(404, "Store channel connection not found."));
    }

    await logAuditEvent({
      req,
      action: "STORE_CHANNEL_CONNECTION_UPDATED",
      resourceType: "StoreChannelConnection",
      resourceId: updated._id,
      statusCode: 200,
      metadata: {
        locationId: updated.locationId,
        providerCode: updated.providerCode,
      },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error?.code === 11000) {
      return next(
        createHttpError(409, "Store connection already exists for location/provider/externalStore.")
      );
    }
    return next(error);
  }
};

const createMappingRule = async (req, res, next) => {
  try {
    const payload = pickDefined(req.body, [
      "locationId",
      "providerCode",
      "entityType",
      "internalCode",
      "externalCode",
      "mappingData",
      "active",
    ]);
    payload.providerCode = normalizeCode(payload.providerCode);

    if (
      !payload.locationId ||
      !payload.providerCode ||
      !payload.entityType ||
      !payload.internalCode ||
      !payload.externalCode
    ) {
      return next(
        createHttpError(
          400,
          "locationId, providerCode, entityType, internalCode and externalCode are required."
        )
      );
    }

    const created = await ChannelMappingRule.create(payload);

    await logAuditEvent({
      req,
      action: "CHANNEL_MAPPING_RULE_CREATED",
      resourceType: "ChannelMappingRule",
      resourceId: created._id,
      statusCode: 201,
      metadata: {
        locationId: created.locationId,
        providerCode: created.providerCode,
        entityType: created.entityType,
      },
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError(409, "Mapping rule already exists for this entity."));
    }
    return next(error);
  }
};

const listMappingRules = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.locationId) {
      query.locationId = `${req.query.locationId}`.trim();
    }
    if (req.query.providerCode) {
      query.providerCode = normalizeCode(req.query.providerCode);
    }
    if (req.query.entityType) {
      query.entityType = `${req.query.entityType}`.trim();
    }
    if (req.query.active !== undefined) {
      query.active = `${req.query.active}` === "true";
    }

    const [rows, total] = await Promise.all([
      ChannelMappingRule.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit),
      ChannelMappingRule.countDocuments(query),
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

const updateMappingRule = async (req, res, next) => {
  try {
    ensureObjectId(req.params.id);

    const updates = pickDefined(req.body, [
      "locationId",
      "providerCode",
      "entityType",
      "internalCode",
      "externalCode",
      "mappingData",
      "active",
    ]);

    if (updates.providerCode !== undefined) {
      updates.providerCode = normalizeCode(updates.providerCode);
    }

    const updated = await ChannelMappingRule.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    });

    if (!updated) {
      return next(createHttpError(404, "Channel mapping rule not found."));
    }

    await logAuditEvent({
      req,
      action: "CHANNEL_MAPPING_RULE_UPDATED",
      resourceType: "ChannelMappingRule",
      resourceId: updated._id,
      statusCode: 200,
      metadata: {
        locationId: updated.locationId,
        providerCode: updated.providerCode,
        entityType: updated.entityType,
      },
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError(409, "Mapping rule already exists for this entity."));
    }
    return next(error);
  }
};

module.exports = {
  createProvider,
  listProviders,
  updateProvider,
  createMarketProfile,
  listMarketProfiles,
  updateMarketProfile,
  createStoreConnection,
  listStoreConnections,
  updateStoreConnection,
  createMappingRule,
  listMappingRules,
  updateMappingRule,
};

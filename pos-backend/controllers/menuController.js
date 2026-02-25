const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const MenuCatalogItem = require("../models/menuCatalogItemModel");
const MenuVersion = require("../models/menuVersionModel");
const { logAuditEvent } = require("../utils/auditLogger");

const normalizeLocationId = (locationId) => `${locationId || ""}`.trim() || "default";
const normalizeChannelCode = (channelCode) => `${channelCode || "ALL"}`.trim().toUpperCase() || "ALL";
const normalizeVersionTag = (versionTag) => `${versionTag || "v1"}`.trim() || "v1";

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const parseDayParts = (dayParts) => {
  if (dayParts === undefined) {
    return undefined;
  }

  if (!Array.isArray(dayParts)) {
    throw createHttpError(400, "dayParts must be an array.");
  }

  return dayParts.map((entry, index) => {
    const startMinute = Number(entry?.startMinute);
    const endMinute = Number(entry?.endMinute);
    const price = Number(entry?.price);
    const daysOfWeek = Array.isArray(entry?.daysOfWeek)
      ? entry.daysOfWeek.map((day) => Number(day))
      : [];

    if (!Number.isInteger(startMinute) || startMinute < 0 || startMinute > 1439) {
      throw createHttpError(400, `dayParts[${index}].startMinute must be 0..1439.`);
    }

    if (!Number.isInteger(endMinute) || endMinute < 1 || endMinute > 1440) {
      throw createHttpError(400, `dayParts[${index}].endMinute must be 1..1440.`);
    }

    if (startMinute === endMinute) {
      throw createHttpError(400, `dayParts[${index}] cannot have identical startMinute/endMinute.`);
    }

    if (!Number.isFinite(price) || price < 0) {
      throw createHttpError(400, `dayParts[${index}].price must be >= 0.`);
    }

    if (!daysOfWeek.every((day) => Number.isInteger(day) && day >= 0 && day <= 6)) {
      throw createHttpError(400, `dayParts[${index}].daysOfWeek must be in 0..6.`);
    }

    return { startMinute, endMinute, price, daysOfWeek };
  });
};

const parseDateMaybe = (value, fieldName) => {
  if (value === undefined || value === null || `${value}`.trim() === "") {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `${fieldName} must be a valid datetime string.`);
  }

  return parsed;
};

const upsertMenuItem = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    const channelCode = normalizeChannelCode(req.body.channelCode);
    const versionTag = normalizeVersionTag(req.body.versionTag);
    const name = `${req.body.name || ""}`.trim();
    const category = `${req.body.category || "Uncategorized"}`.trim() || "Uncategorized";
    const basePrice = Number(req.body.basePrice);

    if (!name) {
      return next(createHttpError(400, "name is required."));
    }

    if (!Number.isFinite(basePrice) || basePrice < 0) {
      return next(createHttpError(400, "basePrice must be >= 0."));
    }

    const dayParts = parseDayParts(req.body.dayParts);
    const validFrom = parseDateMaybe(req.body.validFrom, "validFrom");
    const validTo = parseDateMaybe(req.body.validTo, "validTo");

    if (validFrom && validTo && validTo <= validFrom) {
      return next(createHttpError(400, "validTo must be later than validFrom."));
    }

    const updates = {
      locationId,
      channelCode,
      versionTag,
      category,
      name,
      normalizedName: name.toLowerCase(),
      basePrice,
      status: `${req.body.status || "DRAFT"}`.trim().toUpperCase(),
      metadata: req.body.metadata,
    };

    if (dayParts !== undefined) {
      updates.dayParts = dayParts;
    }

    if (validFrom !== undefined) {
      updates.validFrom = validFrom;
    }

    if (validTo !== undefined) {
      updates.validTo = validTo;
    }

    const item = await MenuCatalogItem.findOneAndUpdate(
      {
        locationId,
        channelCode,
        versionTag,
        normalizedName: updates.normalizedName,
      },
      { $set: updates },
      {
        upsert: true,
        new: true,
        setDefaultsOnInsert: true,
        runValidators: true,
      }
    );

    await MenuVersion.updateOne(
      { locationId, versionTag },
      {
        $setOnInsert: {
          locationId,
          versionTag,
          status: "DRAFT",
        },
      },
      { upsert: true }
    );

    await logAuditEvent({
      req,
      action: "MENU_ITEM_UPSERTED",
      resourceType: "MenuCatalogItem",
      resourceId: item._id,
      statusCode: 200,
      metadata: {
        locationId,
        channelCode,
        versionTag,
        normalizedName: item.normalizedName,
      },
    });

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError(409, "Menu item already exists for this location/channel/version."));
    }
    return next(error);
  }
};

const listMenuItems = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.locationId) {
      query.locationId = normalizeLocationId(req.query.locationId);
    }

    if (req.query.channelCode) {
      query.channelCode = normalizeChannelCode(req.query.channelCode);
    }

    if (req.query.versionTag) {
      query.versionTag = normalizeVersionTag(req.query.versionTag);
    }

    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    if (req.query.search) {
      const escaped = `${req.query.search}`.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { normalizedName: { $regex: escaped, $options: "i" } },
      ];
    }

    const [rows, total] = await Promise.all([
      MenuCatalogItem.find(query).sort({ updatedAt: -1 }).skip(offset).limit(limit),
      MenuCatalogItem.countDocuments(query),
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

const publishMenuVersion = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    const versionTag = normalizeVersionTag(req.body.versionTag);
    const effectiveFrom = parseDateMaybe(req.body.effectiveFrom, "effectiveFrom") || new Date();
    const notes = `${req.body.notes || ""}`.trim();

    const count = await MenuCatalogItem.countDocuments({ locationId, versionTag });
    if (count <= 0) {
      return next(createHttpError(400, "No menu items found for target version."));
    }

    await MenuCatalogItem.updateMany(
      { locationId, status: "ACTIVE", versionTag: { $ne: versionTag } },
      { $set: { status: "INACTIVE" } }
    );

    await MenuCatalogItem.updateMany(
      { locationId, versionTag },
      {
        $set: {
          status: "ACTIVE",
          validFrom: effectiveFrom,
        },
      }
    );

    const version = await MenuVersion.findOneAndUpdate(
      { locationId, versionTag },
      {
        $set: {
          locationId,
          versionTag,
          status: "PUBLISHED",
          effectiveFrom,
          publishedAt: new Date(),
          publishedBy: req.user?._id,
          notes,
        },
      },
      {
        upsert: true,
        new: true,
        runValidators: true,
      }
    );

    await logAuditEvent({
      req,
      action: "MENU_VERSION_PUBLISHED",
      resourceType: "MenuVersion",
      resourceId: version._id,
      statusCode: 200,
      metadata: {
        locationId,
        versionTag,
        effectiveFrom,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Menu version published.",
      data: version,
      affectedItems: count,
    });
  } catch (error) {
    return next(error);
  }
};

const listMenuVersions = async (req, res, next) => {
  try {
    const query = {};
    if (req.query.locationId) {
      query.locationId = normalizeLocationId(req.query.locationId);
    }

    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    const rows = await MenuVersion.find(query).sort({ updatedAt: -1 }).limit(200);
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
};

const markMenuItemSyncStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid menu item id."));
    }

    const providerCode = normalizeChannelCode(req.body.providerCode || req.body.channelCode);
    const status = `${req.body.status || ""}`.trim().toUpperCase();
    const message = `${req.body.message || ""}`.trim();

    if (!providerCode) {
      return next(createHttpError(400, "providerCode is required."));
    }

    if (!["PENDING", "SYNCED", "FAILED"].includes(status)) {
      return next(createHttpError(400, "status must be PENDING, SYNCED, or FAILED."));
    }

    const item = await MenuCatalogItem.findById(id);
    if (!item) {
      return next(createHttpError(404, "Menu item not found."));
    }

    item.syncStatus.set(providerCode, {
      status,
      message,
      lastSyncAt: new Date(),
    });
    await item.save();

    await logAuditEvent({
      req,
      action: "MENU_ITEM_SYNC_STATUS_UPDATED",
      resourceType: "MenuCatalogItem",
      resourceId: item._id,
      statusCode: 200,
      metadata: {
        providerCode,
        status,
      },
    });

    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  upsertMenuItem,
  listMenuItems,
  publishMenuVersion,
  listMenuVersions,
  markMenuItemSyncStatus,
};

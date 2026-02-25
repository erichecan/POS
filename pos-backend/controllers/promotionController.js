const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const PromotionRule = require("../models/promotionRuleModel");
const PromotionCoupon = require("../models/promotionCouponModel");
const { logAuditEvent } = require("../utils/auditLogger");
const {
  normalizePromoCode,
  normalizeLocationId,
  normalizeChannelCode,
} = require("../utils/promotionEngine");
const {
  resolveEligiblePromotions,
  normalizePromotionCodes,
} = require("../utils/promotionService");

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const parseDate = (value, fieldName) => {
  if (value === undefined || value === null || `${value}`.trim() === "") {
    return undefined;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `${fieldName} must be a valid datetime string.`);
  }

  return parsed;
};

const createPromotionRule = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    const code = normalizePromoCode(req.body.code);
    const name = `${req.body.name || ""}`.trim();
    const discountType = `${req.body.discountType || ""}`.trim().toUpperCase();
    const discountValue = Number(req.body.discountValue);

    if (!code || !name || !discountType || !Number.isFinite(discountValue) || discountValue <= 0) {
      return next(createHttpError(400, "code, name, discountType and discountValue are required."));
    }

    if (!["PERCENT", "FIXED"].includes(discountType)) {
      return next(createHttpError(400, "discountType must be PERCENT or FIXED."));
    }

    const startAt = parseDate(req.body.startAt, "startAt");
    const endAt = parseDate(req.body.endAt, "endAt");
    if (startAt && endAt && endAt <= startAt) {
      return next(createHttpError(400, "endAt must be later than startAt."));
    }

    const rule = await PromotionRule.create({
      locationId,
      code,
      name,
      status: `${req.body.status || "ACTIVE"}`.trim().toUpperCase(),
      discountType,
      discountValue,
      minOrderAmount: Number(req.body.minOrderAmount || 0),
      maxDiscountAmount:
        req.body.maxDiscountAmount === undefined ? undefined : Number(req.body.maxDiscountAmount),
      stackable: Boolean(req.body.stackable),
      autoApply: Boolean(req.body.autoApply),
      appliesToChannels: Array.isArray(req.body.appliesToChannels)
        ? req.body.appliesToChannels.map((codeValue) => normalizeChannelCode(codeValue))
        : ["ALL"],
      startAt,
      endAt,
      usageLimit: req.body.usageLimit === undefined ? undefined : Number(req.body.usageLimit),
      metadata: req.body.metadata,
    });

    await logAuditEvent({
      req,
      action: "PROMOTION_RULE_CREATED",
      resourceType: "PromotionRule",
      resourceId: rule._id,
      statusCode: 201,
      metadata: {
        locationId,
        code,
      },
    });

    return res.status(201).json({ success: true, data: rule });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError(409, "Promotion code already exists."));
    }
    return next(error);
  }
};

const listPromotionRules = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.locationId) {
      query.locationId = normalizeLocationId(req.query.locationId);
    }

    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    if (req.query.search) {
      const escaped = `${req.query.search}`.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { code: { $regex: escaped, $options: "i" } },
        { name: { $regex: escaped, $options: "i" } },
      ];
    }

    const [rows, total] = await Promise.all([
      PromotionRule.find(query).sort({ updatedAt: -1 }).skip(offset).limit(limit),
      PromotionRule.countDocuments(query),
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

const createPromotionCoupon = async (req, res, next) => {
  try {
    const code = normalizePromoCode(req.body.code);
    const promotionId = `${req.body.promotionId || ""}`.trim();

    if (!code || !mongoose.Types.ObjectId.isValid(promotionId)) {
      return next(createHttpError(400, "Valid code and promotionId are required."));
    }

    const rule = await PromotionRule.findById(promotionId);
    if (!rule) {
      return next(createHttpError(404, "Promotion rule not found."));
    }

    const coupon = await PromotionCoupon.create({
      code,
      promotionId: rule._id,
      memberId: req.body.memberId,
      status: `${req.body.status || "ACTIVE"}`.trim().toUpperCase(),
      usageLimit: Number(req.body.usageLimit || 1),
      expiresAt: parseDate(req.body.expiresAt, "expiresAt"),
      metadata: req.body.metadata,
    });

    await logAuditEvent({
      req,
      action: "PROMOTION_COUPON_CREATED",
      resourceType: "PromotionCoupon",
      resourceId: coupon._id,
      statusCode: 201,
      metadata: {
        code,
        promotionId,
      },
    });

    return res.status(201).json({ success: true, data: coupon });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError(409, "Coupon code already exists."));
    }
    return next(error);
  }
};

const listPromotionCoupons = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    if (req.query.promotionId) {
      query.promotionId = req.query.promotionId;
    }

    if (req.query.search) {
      const escaped = `${req.query.search}`.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.code = { $regex: escaped, $options: "i" };
    }

    const [rows, total] = await Promise.all([
      PromotionCoupon.find(query)
        .sort({ updatedAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("promotionId", "code name discountType discountValue"),
      PromotionCoupon.countDocuments(query),
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

const previewPromotionApplication = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    const channelCode = normalizeChannelCode(req.body.channelCode || "ALL");
    const subtotal = Number(req.body.subtotal);

    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return next(createHttpError(400, "subtotal must be >= 0."));
    }

    const promotionCodes = normalizePromotionCodes(req.body.promotionCodes || []);

    const result = await resolveEligiblePromotions({
      locationId,
      channelCode,
      subtotal,
      promotionCodes,
    });

    return res.status(200).json({
      success: true,
      data: {
        subtotal,
        promotionCodes,
        discountTotal: result.discountTotal,
        subtotalAfterDiscount: result.subtotalAfterDiscount,
        appliedPromotions: result.appliedPromotions,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createPromotionRule,
  listPromotionRules,
  createPromotionCoupon,
  listPromotionCoupons,
  previewPromotionApplication,
};

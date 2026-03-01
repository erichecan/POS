/**
 * Public Member API - Phase D1 会员端 H5 公开接口
 * 2026-02-28T18:00:00+08:00: 会员码+手机号校验，无需员工登录
 */
const createHttpError = require("http-errors");
const MemberAccount = require("../models/memberAccountModel");
const PromotionCoupon = require("../models/promotionCouponModel");
const Order = require("../models/orderModel");
const { isCouponUsable } = require("../utils/promotionService");

const normalizeLocationId = (v) => `${v || ""}`.trim() || "default";

const buildPhoneMatch = (phone) => {
  const p = `${phone || ""}`.trim().replace(/\s/g, "");
  const digits = p.replace(/\D/g, "");
  const variants = [...new Set([p, p.replace(/^\+/, ""), digits, digits.replace(/^86/, "")])].filter(Boolean);
  return { $or: variants.map((v) => ({ phone: v })) };
};

const validateMemberCodePhone = (memberCode, phone) => {
  const code = `${memberCode || ""}`.trim().toUpperCase();
  const ph = `${phone || ""}`.trim().replace(/\s/g, "");
  if (!code || !ph) {
    throw createHttpError(400, "memberCode and phone are required.");
  }
  if (!/^\+?[0-9]{6,15}$/.test(ph)) {
    throw createHttpError(400, "phone must be 6 to 15 digits.");
  }
  return { memberCode: code, phone: ph };
};

/**
 * POST /api/public/member/bind
 * Body: { memberCode, phone, locationId? }
 * 验证会员码+手机号，返回会员信息（积分、储值等）
 */
const bindMember = async (req, res, next) => {
  try {
    const { memberCode, phone } = validateMemberCodePhone(req.body.memberCode, req.body.phone);
    const locationId = normalizeLocationId(req.body.locationId);

    const member = await MemberAccount.findOne({
      memberCode,
      locationId,
      ...buildPhoneMatch(phone),
    }).lean();

    if (!member) {
      return next(createHttpError(404, "Member not found. Check member code and phone."));
    }

    if (member.status !== "ACTIVE") {
      return next(createHttpError(409, "Member account is inactive."));
    }

    const safeMember = {
      _id: member._id,
      memberCode: member.memberCode,
      name: member.name,
      tier: member.tier,
      pointsBalance: Number(member.pointsBalance || 0),
      walletBalance: Number(member.walletBalance || 0),
      lifetimeSpend: Number(member.lifetimeSpend || 0),
    };

    return res.status(200).json({
      success: true,
      data: safeMember,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/public/member/:memberCode/profile
 * Query: phone, locationId?
 * 校验后返回会员简要信息
 */
const getMemberProfile = async (req, res, next) => {
  try {
    const memberCode = `${req.params.memberCode || ""}`.trim().toUpperCase();
    const phone = `${req.query.phone || ""}`.trim().replace(/\s/g, "");
    if (!memberCode || !phone) {
      return next(createHttpError(400, "memberCode and phone are required."));
    }
    const locationId = normalizeLocationId(req.query.locationId);

    const member = await MemberAccount.findOne({
      memberCode,
      locationId,
      ...buildPhoneMatch(phone),
    }).lean();

    if (!member || member.status !== "ACTIVE") {
      return next(createHttpError(404, "Member not found."));
    }

    return res.status(200).json({
      success: true,
      data: {
        _id: member._id,
        memberCode: member.memberCode,
        name: member.name,
        tier: member.tier,
        pointsBalance: Number(member.pointsBalance || 0),
        walletBalance: Number(member.walletBalance || 0),
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/public/member/:memberCode/orders
 * Query: phone, locationId?, limit?
 */
const listMemberOrders = async (req, res, next) => {
  try {
    const memberCode = `${req.params.memberCode || ""}`.trim().toUpperCase();
    const phone = `${req.query.phone || ""}`.trim().replace(/\s/g, "");
    if (!memberCode || !phone) {
      return next(createHttpError(400, "memberCode and phone are required."));
    }
    const locationId = normalizeLocationId(req.query.locationId);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);

    const member = await MemberAccount.findOne({
      memberCode,
      locationId,
      ...buildPhoneMatch(phone),
    });

    if (!member || member.status !== "ACTIVE") {
      return next(createHttpError(404, "Member not found."));
    }

    const orders = await Order.find({ memberId: member._id })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select("orderStatus orderDate items customerDetails bills.totalWithTax bills.discountTotal")
      .lean();

    const safeOrders = orders.map((o) => ({
      _id: o._id,
      orderStatus: o.orderStatus,
      orderDate: o.orderDate,
      totalWithTax: o.bills?.totalWithTax,
      discountTotal: o.bills?.discountTotal || 0,
      itemCount: Array.isArray(o.items) ? o.items.reduce((s, i) => s + (i.quantity || 1), 0) : 0,
    }));

    return res.status(200).json({
      success: true,
      data: safeOrders,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/public/member/:memberCode/coupons
 * Query: phone, locationId?
 * 返回该会员的优惠券列表（含券码供核销）
 */
const listMemberCoupons = async (req, res, next) => {
  try {
    const memberCode = `${req.params.memberCode || ""}`.trim().toUpperCase();
    const phone = `${req.query.phone || ""}`.trim().replace(/\s/g, "");
    if (!memberCode || !phone) {
      return next(createHttpError(400, "memberCode and phone are required."));
    }
    const locationId = normalizeLocationId(req.query.locationId);

    const member = await MemberAccount.findOne({
      memberCode,
      locationId,
      ...buildPhoneMatch(phone),
    });

    if (!member || member.status !== "ACTIVE") {
      return next(createHttpError(404, "Member not found."));
    }

    const coupons = await PromotionCoupon.find({
      $or: [{ memberId: member._id }, { memberId: null }],
    })
      .populate("promotionId", "code name discountType discountValue promoType minOrderAmount")
      .sort({ createdAt: -1 })
      .lean();

    const now = new Date();
    const safeCoupons = coupons.map((c) => {
      const rule = c.promotionId || {};
      const usable = isCouponUsable(c, now);
      return {
        _id: c._id,
        code: c.code,
        name: rule.name || c.code,
        discountType: rule.discountType,
        discountValue: rule.discountValue,
        minOrderAmount: rule.minOrderAmount,
        expiresAt: c.expiresAt,
        usageCount: c.usageCount || 0,
        usageLimit: c.usageLimit || 1,
        usable,
        status: c.status,
      };
    });

    return res.status(200).json({
      success: true,
      data: safeCoupons,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  bindMember,
  getMemberProfile,
  listMemberOrders,
  listMemberCoupons,
};

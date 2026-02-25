const PromotionRule = require("../models/promotionRuleModel");
const PromotionCoupon = require("../models/promotionCouponModel");
const {
  normalizePromoCode,
  normalizeLocationId,
  normalizeChannelCode,
  resolvePromotionApplication,
} = require("./promotionEngine");

const normalizePromotionCodes = (promotionCodes = []) => {
  if (!Array.isArray(promotionCodes)) {
    return [];
  }

  return Array.from(
    new Set(
      promotionCodes
        .map((code) => normalizePromoCode(code))
        .filter(Boolean)
    )
  );
};

const isCouponUsable = (coupon, now = new Date()) => {
  if (!coupon || `${coupon.status || ""}` !== "ACTIVE") {
    return false;
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt).getTime() <= now.getTime()) {
    return false;
  }

  const usageLimit = Number(coupon.usageLimit || 1);
  const usageCount = Number(coupon.usageCount || 0);
  return usageCount < usageLimit;
};

const resolveEligiblePromotions = async ({
  locationId,
  channelCode,
  subtotal,
  promotionCodes = [],
}) => {
  const normalizedLocationId = normalizeLocationId(locationId);
  const normalizedChannelCode = normalizeChannelCode(channelCode || "ALL");
  const normalizedCodes = normalizePromotionCodes(promotionCodes);

  const [directRules, autoRules, coupons] = await Promise.all([
    normalizedCodes.length > 0
      ? PromotionRule.find({
          locationId: normalizedLocationId,
          code: { $in: normalizedCodes },
        }).lean()
      : [],
    PromotionRule.find({
      locationId: normalizedLocationId,
      autoApply: true,
      status: "ACTIVE",
    }).lean(),
    normalizedCodes.length > 0
      ? PromotionCoupon.find({ code: { $in: normalizedCodes } }).lean()
      : [],
  ]);

  const now = new Date();
  const couponMap = new Map();
  coupons.filter((coupon) => isCouponUsable(coupon, now)).forEach((coupon) => {
    couponMap.set(`${coupon.promotionId}`, coupon);
  });

  const couponPromotionIds = Array.from(new Set(Array.from(couponMap.keys())));
  const couponRules = couponPromotionIds.length > 0
    ? await PromotionRule.find({
        _id: { $in: couponPromotionIds },
        locationId: normalizedLocationId,
      }).lean()
    : [];

  const allRules = [...directRules, ...autoRules, ...couponRules];
  const dedup = new Map();
  allRules.forEach((rule) => {
    dedup.set(`${rule._id}`, rule);
  });

  const rules = Array.from(dedup.values());
  const result = resolvePromotionApplication({
    rules,
    subtotal,
    locationId: normalizedLocationId,
    channelCode: normalizedChannelCode,
  });

  const appliedPromotions = result.applied.map((entry) => {
    const coupon = couponMap.get(`${entry.promotionId}`);
    return {
      ...entry,
      sourceCode: coupon?.code || entry.code,
      sourceType: coupon ? "COUPON" : "RULE",
      couponId: coupon?._id,
    };
  });

  return {
    ...result,
    appliedPromotions,
    normalizedCodes,
  };
};

const consumePromotionUsage = async ({ appliedPromotions = [] }) => {
  const promotionUsageMap = new Map();
  const couponUsageMap = new Map();

  for (const promotion of appliedPromotions) {
    const promotionId = `${promotion.promotionId || ""}`;
    if (promotionId) {
      promotionUsageMap.set(promotionId, (promotionUsageMap.get(promotionId) || 0) + 1);
    }

    const couponId = `${promotion.couponId || ""}`;
    if (couponId) {
      couponUsageMap.set(couponId, (couponUsageMap.get(couponId) || 0) + 1);
    }
  }

  await Promise.all([
    ...Array.from(promotionUsageMap.entries()).map(([promotionId, count]) =>
      PromotionRule.updateOne({ _id: promotionId }, { $inc: { usageCount: count } })
    ),
    ...Array.from(couponUsageMap.entries()).map(([couponId, count]) =>
      PromotionCoupon.updateOne({ _id: couponId }, { $inc: { usageCount: count } })
    ),
  ]);
};

module.exports = {
  normalizePromotionCodes,
  isCouponUsable,
  resolveEligiblePromotions,
  consumePromotionUsage,
};

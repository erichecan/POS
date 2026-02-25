const createHttpError = require("http-errors");

const roundToTwo = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizePromoCode = (value = "") => `${value}`.trim().toUpperCase();
const normalizeLocationId = (value = "") => `${value}`.trim() || "default";
const normalizeChannelCode = (value = "") => `${value || "ALL"}`.trim().toUpperCase() || "ALL";

const isPromotionActive = (rule, now = new Date()) => {
  if (!rule || `${rule.status || ""}` !== "ACTIVE") {
    return false;
  }

  const current = now instanceof Date ? now : new Date(now);
  if (Number.isNaN(current.getTime())) {
    return false;
  }

  if (rule.startAt && new Date(rule.startAt).getTime() > current.getTime()) {
    return false;
  }

  if (rule.endAt && new Date(rule.endAt).getTime() <= current.getTime()) {
    return false;
  }

  if (Number.isFinite(rule.usageLimit) && rule.usageLimit > 0) {
    const usageCount = Number(rule.usageCount || 0);
    if (usageCount >= Number(rule.usageLimit)) {
      return false;
    }
  }

  return true;
};

const supportsChannel = (rule, channelCode = "ALL") => {
  const allowedChannels = Array.isArray(rule?.appliesToChannels) ? rule.appliesToChannels : ["ALL"];
  if (allowedChannels.includes("ALL")) {
    return true;
  }

  return allowedChannels.includes(channelCode);
};

const computePromotionDiscount = ({ rule, subtotal }) => {
  const safeSubtotal = Number(subtotal || 0);
  if (!Number.isFinite(safeSubtotal) || safeSubtotal <= 0) {
    return 0;
  }

  const minOrderAmount = Number(rule?.minOrderAmount || 0);
  if (safeSubtotal < minOrderAmount) {
    return 0;
  }

  const discountType = `${rule?.discountType || ""}`.toUpperCase();
  const discountValue = Number(rule?.discountValue || 0);

  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return 0;
  }

  let discount = 0;
  if (discountType === "PERCENT") {
    discount = roundToTwo((safeSubtotal * discountValue) / 100);
  } else if (discountType === "FIXED") {
    discount = roundToTwo(discountValue);
  } else {
    return 0;
  }

  const maxDiscountAmount = Number(rule?.maxDiscountAmount);
  if (Number.isFinite(maxDiscountAmount) && maxDiscountAmount > 0) {
    discount = Math.min(discount, roundToTwo(maxDiscountAmount));
  }

  return Math.min(discount, safeSubtotal);
};

const resolvePromotionApplication = ({ rules = [], subtotal, locationId, channelCode }) => {
  const normalizedLocationId = normalizeLocationId(locationId);
  const normalizedChannelCode = normalizeChannelCode(channelCode);
  const now = new Date();
  const safeSubtotal = Number(subtotal || 0);

  if (!Number.isFinite(safeSubtotal) || safeSubtotal < 0) {
    throw createHttpError(400, "subtotal must be >= 0.");
  }

  const eligible = (rules || [])
    .filter((rule) => `${rule.locationId || "default"}` === normalizedLocationId)
    .filter((rule) => isPromotionActive(rule, now))
    .filter((rule) => supportsChannel(rule, normalizedChannelCode))
    .map((rule) => {
      const discount = computePromotionDiscount({ rule, subtotal: safeSubtotal });
      return {
        rule,
        discount,
      };
    })
    .filter((entry) => entry.discount > 0)
    .sort((a, b) => {
      if (a.discount !== b.discount) return b.discount - a.discount;
      const aStackable = Boolean(a.rule?.stackable);
      const bStackable = Boolean(b.rule?.stackable);
      if (aStackable !== bStackable) return Number(bStackable) - Number(aStackable);
      return new Date(a.rule?.updatedAt || 0).getTime() - new Date(b.rule?.updatedAt || 0).getTime();
    });

  if (eligible.length === 0) {
    return {
      discountTotal: 0,
      applied: [],
      subtotalAfterDiscount: safeSubtotal,
    };
  }

  const best = eligible[0];
  const applied = [
    {
      promotionId: best.rule?._id,
      code: best.rule?.code,
      name: best.rule?.name,
      discountAmount: roundToTwo(best.discount),
      discountType: best.rule?.discountType,
    },
  ];

  if (best.rule?.stackable) {
    for (const candidate of eligible.slice(1)) {
      if (!candidate.rule?.stackable) {
        continue;
      }

      const runningDiscount = applied.reduce((sum, entry) => sum + Number(entry.discountAmount || 0), 0);
      if (runningDiscount >= safeSubtotal) {
        break;
      }

      const remaining = Math.max(roundToTwo(safeSubtotal - runningDiscount), 0);
      const candidateDiscount = Math.min(candidate.discount, remaining);
      if (candidateDiscount <= 0) {
        continue;
      }

      applied.push({
        promotionId: candidate.rule?._id,
        code: candidate.rule?.code,
        name: candidate.rule?.name,
        discountAmount: roundToTwo(candidateDiscount),
        discountType: candidate.rule?.discountType,
      });
    }
  }

  const discountTotal = roundToTwo(
    Math.min(
      safeSubtotal,
      applied.reduce((sum, entry) => sum + Number(entry.discountAmount || 0), 0)
    )
  );

  return {
    discountTotal,
    applied,
    subtotalAfterDiscount: roundToTwo(Math.max(safeSubtotal - discountTotal, 0)),
  };
};

module.exports = {
  roundToTwo,
  normalizePromoCode,
  normalizeLocationId,
  normalizeChannelCode,
  isPromotionActive,
  supportsChannel,
  computePromotionDiscount,
  resolvePromotionApplication,
};

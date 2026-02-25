const createHttpError = require("http-errors");
const config = require("../config/config");

const normalizeLocationId = (value) => `${value || ""}`.trim() || "default";

const roundToTwo = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const generateMemberCode = (locationId = "default") => {
  const prefix = normalizeLocationId(locationId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase() || "MEM";
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${stamp}-${rand}`;
};

const deriveMemberTier = ({ lifetimeSpend = 0, pointsBalance = 0 }) => {
  const spend = Number(lifetimeSpend || 0);
  const points = Number(pointsBalance || 0);

  if (spend >= 5000 || points >= 5000) {
    return "PLATINUM";
  }
  if (spend >= 2000 || points >= 2000) {
    return "GOLD";
  }
  if (spend >= 800 || points >= 800) {
    return "SILVER";
  }
  return "BRONZE";
};

const assertMemberIsActive = (member) => {
  if (!member) {
    throw createHttpError(404, "Member not found.");
  }
  if (member.status !== "ACTIVE") {
    throw createHttpError(409, "Member account is inactive.");
  }
};

const parseAdjustment = ({ pointsDelta, walletDelta }) => {
  const parsedPointsDelta = Number(pointsDelta || 0);
  const parsedWalletDelta = Number(walletDelta || 0);

  if (!Number.isFinite(parsedPointsDelta) || !Number.isFinite(parsedWalletDelta)) {
    throw createHttpError(400, "pointsDelta and walletDelta must be numeric.");
  }

  return {
    pointsDelta: parsedPointsDelta,
    walletDelta: roundToTwo(parsedWalletDelta),
  };
};

const applyMemberBalanceDelta = ({ member, pointsDelta = 0, walletDelta = 0 }) => {
  const nextPoints = Number(member.pointsBalance || 0) + Number(pointsDelta || 0);
  const nextWallet = roundToTwo(Number(member.walletBalance || 0) + Number(walletDelta || 0));

  if (nextPoints < 0) {
    throw createHttpError(409, "Insufficient points balance.");
  }

  if (nextWallet < 0) {
    throw createHttpError(409, "Insufficient wallet balance.");
  }

  member.pointsBalance = nextPoints;
  member.walletBalance = nextWallet;
  member.tier = deriveMemberTier({
    lifetimeSpend: member.lifetimeSpend,
    pointsBalance: member.pointsBalance,
  });

  return member;
};

const calculatePointsEarned = (orderAmount) => {
  const safeOrderAmount = Number(orderAmount || 0);
  if (!Number.isFinite(safeOrderAmount) || safeOrderAmount <= 0) {
    return 0;
  }

  const pointsPerCurrency = Number(config.memberPointsPerCurrency || 1);
  if (!Number.isFinite(pointsPerCurrency) || pointsPerCurrency <= 0) {
    return 0;
  }

  return Math.max(Math.floor(safeOrderAmount * pointsPerCurrency), 0);
};

const calculateWalletDiscountFromPoints = (pointsToRedeem) => {
  const points = Number(pointsToRedeem || 0);
  if (!Number.isFinite(points) || points <= 0) {
    throw createHttpError(400, "pointsToRedeem must be > 0.");
  }

  const pointsPerCurrency = Number(config.memberPointsRedeemRate || 100);
  if (!Number.isFinite(pointsPerCurrency) || pointsPerCurrency <= 0) {
    throw createHttpError(500, "Invalid member redeem rate configuration.");
  }

  return roundToTwo(points / pointsPerCurrency);
};

module.exports = {
  normalizeLocationId,
  roundToTwo,
  generateMemberCode,
  deriveMemberTier,
  assertMemberIsActive,
  parseAdjustment,
  applyMemberBalanceDelta,
  calculatePointsEarned,
  calculateWalletDiscountFromPoints,
  __testables: {
    deriveMemberTier,
    parseAdjustment,
    applyMemberBalanceDelta,
    calculatePointsEarned,
    calculateWalletDiscountFromPoints,
  },
};

const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const MemberAccount = require("../models/memberAccountModel");
const MemberLedgerEntry = require("../models/memberLedgerEntryModel");
const { logAuditEvent } = require("../utils/auditLogger");
const {
  normalizeLocationId,
  generateMemberCode,
  parseAdjustment,
  assertMemberIsActive,
  applyMemberBalanceDelta,
  calculatePointsEarned,
  calculateWalletDiscountFromPoints,
  roundToTwo,
} = require("../utils/memberService");
const {
  resolveFieldPolicy,
  sanitizeRowsByFieldPolicy,
  applyReadFieldPolicy,
  assertWritableFields,
} = require("../utils/fieldAccessService");

const MEMBER_RESOURCE = "member";

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const sanitizeMemberPayload = (body = {}) => {
  const name = `${body.name || ""}`.trim();
  const phone = `${body.phone || ""}`.trim();
  const email = `${body.email || ""}`.trim().toLowerCase();
  const locationId = normalizeLocationId(body.locationId);

  if (!name) {
    throw createHttpError(400, "name is required.");
  }

  if (!phone && !email) {
    throw createHttpError(400, "Either phone or email is required.");
  }

  if (phone && !/^\+?[0-9]{6,15}$/.test(phone)) {
    throw createHttpError(400, "phone must be 6 to 15 digits.");
  }

  if (email && !/^\S+@\S+\.\S+$/.test(email)) {
    throw createHttpError(400, "email must be a valid email address.");
  }

  return {
    locationId,
    name,
    phone,
    email,
    status: `${body.status || "ACTIVE"}`.trim().toUpperCase(),
    metadata: body.metadata,
    tags: Array.isArray(body.tags)
      ? body.tags.map((tag) => `${tag}`.trim()).filter(Boolean)
      : [],
  };
};

const createLedgerEntry = async ({ member, type, pointsDelta, walletDelta, orderId, reference, reason, req, metadata }) =>
  MemberLedgerEntry.create({
    memberId: member._id,
    locationId: member.locationId,
    type,
    pointsDelta: Number(pointsDelta || 0),
    walletDelta: roundToTwo(walletDelta || 0),
    orderId,
    reference,
    reason,
    createdBy: req.user?._id,
    metadata,
  });

const resolveMemberFieldPolicy = (req) =>
  resolveFieldPolicy({
    role: req.user?.role,
    resource: MEMBER_RESOURCE,
  });

const enforceMemberWritePolicy = async (req) => {
  const policy = await resolveMemberFieldPolicy(req);
  assertWritableFields({
    payload: req.body,
    policy,
  });
  return policy;
};

const createMember = async (req, res, next) => {
  try {
    const fieldPolicy = await enforceMemberWritePolicy(req);
    const payload = sanitizeMemberPayload(req.body);
    const memberCode = `${req.body.memberCode || generateMemberCode(payload.locationId)}`
      .trim()
      .toUpperCase();

    const member = await MemberAccount.create({
      ...payload,
      memberCode,
    });

    await logAuditEvent({
      req,
      action: "MEMBER_CREATED",
      resourceType: "MemberAccount",
      resourceId: member._id,
      statusCode: 201,
      metadata: {
        locationId: member.locationId,
        memberCode: member.memberCode,
      },
    });

    return res.status(201).json({
      success: true,
      data: applyReadFieldPolicy({ document: member, policy: fieldPolicy }),
    });
  } catch (error) {
    if (error?.code === 11000) {
      return next(createHttpError(409, "memberCode, phone, or email already exists."));
    }
    return next(error);
  }
};

const listMembers = async (req, res, next) => {
  try {
    const fieldPolicy = await resolveMemberFieldPolicy(req);
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.locationId) {
      query.locationId = normalizeLocationId(req.query.locationId);
    }

    if (req.query.status) {
      query.status = `${req.query.status}`.trim().toUpperCase();
    }

    if (req.query.tier) {
      query.tier = `${req.query.tier}`.trim().toUpperCase();
    }

    if (req.query.search) {
      const escaped = `${req.query.search}`.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      query.$or = [
        { name: { $regex: escaped, $options: "i" } },
        { phone: { $regex: escaped, $options: "i" } },
        { email: { $regex: escaped, $options: "i" } },
        { memberCode: { $regex: escaped, $options: "i" } },
      ];
    }

    const [rows, total] = await Promise.all([
      MemberAccount.find(query).sort({ updatedAt: -1 }).skip(offset).limit(limit),
      MemberAccount.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: sanitizeRowsByFieldPolicy({ rows, policy: fieldPolicy }),
      pagination: { limit, offset, total },
    });
  } catch (error) {
    return next(error);
  }
};

const getMemberById = async (req, res, next) => {
  try {
    const fieldPolicy = await resolveMemberFieldPolicy(req);
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid member id."));
    }

    const member = await MemberAccount.findById(id);
    if (!member) {
      return next(createHttpError(404, "Member not found."));
    }

    return res.status(200).json({
      success: true,
      data: applyReadFieldPolicy({ document: member, policy: fieldPolicy }),
    });
  } catch (error) {
    return next(error);
  }
};

const adjustMemberBalance = async (req, res, next) => {
  try {
    const fieldPolicy = await enforceMemberWritePolicy(req);
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid member id."));
    }

    const member = await MemberAccount.findById(id);
    assertMemberIsActive(member);

    const type = `${req.body.type || "ADJUSTMENT"}`.trim().toUpperCase();
    if (!["POINT_EARN", "POINT_REDEEM", "WALLET_TOPUP", "WALLET_DEBIT", "ADJUSTMENT"].includes(type)) {
      return next(createHttpError(400, "Unsupported adjustment type."));
    }

    const { pointsDelta, walletDelta } = parseAdjustment(req.body);
    applyMemberBalanceDelta({ member, pointsDelta, walletDelta });

    if (Number(req.body.lifetimeSpendDelta || 0) > 0) {
      member.lifetimeSpend = roundToTwo(
        Number(member.lifetimeSpend || 0) + Number(req.body.lifetimeSpendDelta || 0)
      );
    }

    await member.save();

    const ledger = await createLedgerEntry({
      member,
      type,
      pointsDelta,
      walletDelta,
      reference: `${req.body.reference || ""}`.trim(),
      reason: `${req.body.reason || ""}`.trim(),
      req,
      metadata: req.body.metadata,
    });

    await logAuditEvent({
      req,
      action: "MEMBER_BALANCE_ADJUSTED",
      resourceType: "MemberAccount",
      resourceId: member._id,
      statusCode: 200,
      metadata: {
        type,
        pointsDelta,
        walletDelta,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        member: applyReadFieldPolicy({ document: member, policy: fieldPolicy }),
        ledger,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const accruePointsFromOrder = async (req, res, next) => {
  try {
    const fieldPolicy = await enforceMemberWritePolicy(req);
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid member id."));
    }

    const member = await MemberAccount.findById(id);
    assertMemberIsActive(member);

    const orderAmount = Number(req.body.orderAmount);
    if (!Number.isFinite(orderAmount) || orderAmount <= 0) {
      return next(createHttpError(400, "orderAmount must be > 0."));
    }

    const earned = calculatePointsEarned(orderAmount);
    applyMemberBalanceDelta({ member, pointsDelta: earned, walletDelta: 0 });
    member.lifetimeSpend = roundToTwo(Number(member.lifetimeSpend || 0) + orderAmount);
    await member.save();

    const ledger = await createLedgerEntry({
      member,
      type: "POINT_EARN",
      pointsDelta: earned,
      walletDelta: 0,
      orderId: req.body.orderId,
      reference: `${req.body.reference || "ORDER_POINTS"}`.trim(),
      reason: `${req.body.reason || "Order points accrual"}`.trim(),
      req,
      metadata: {
        orderAmount,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        pointsEarned: earned,
        member: applyReadFieldPolicy({ document: member, policy: fieldPolicy }),
        ledger,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const redeemPoints = async (req, res, next) => {
  try {
    const fieldPolicy = await enforceMemberWritePolicy(req);
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid member id."));
    }

    const member = await MemberAccount.findById(id);
    assertMemberIsActive(member);

    const pointsToRedeem = Number(req.body.pointsToRedeem);
    if (!Number.isFinite(pointsToRedeem) || pointsToRedeem <= 0 || !Number.isInteger(pointsToRedeem)) {
      return next(createHttpError(400, "pointsToRedeem must be a positive integer."));
    }

    const walletCredit = calculateWalletDiscountFromPoints(pointsToRedeem);
    applyMemberBalanceDelta({
      member,
      pointsDelta: -pointsToRedeem,
      walletDelta: walletCredit,
    });
    await member.save();

    const ledger = await createLedgerEntry({
      member,
      type: "POINT_REDEEM",
      pointsDelta: -pointsToRedeem,
      walletDelta: walletCredit,
      reference: `${req.body.reference || "POINT_REDEEM"}`.trim(),
      reason: `${req.body.reason || "Points redeemed to wallet"}`.trim(),
      req,
    });

    return res.status(200).json({
      success: true,
      data: {
        pointsRedeemed: pointsToRedeem,
        walletCredit,
        member: applyReadFieldPolicy({ document: member, policy: fieldPolicy }),
        ledger,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const listMemberLedger = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid member id."));
    }

    const { limit, offset } = parsePagination(req);
    const query = { memberId: id };

    if (req.query.type) {
      query.type = `${req.query.type}`.trim().toUpperCase();
    }

    const [rows, total] = await Promise.all([
      MemberLedgerEntry.find(query)
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit)
        .populate("createdBy", "name role"),
      MemberLedgerEntry.countDocuments(query),
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

module.exports = {
  createMember,
  listMembers,
  getMemberById,
  adjustMemberBalance,
  accruePointsFromOrder,
  redeemPoints,
  listMemberLedger,
};

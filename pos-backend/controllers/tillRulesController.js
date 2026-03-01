/**
 * Till Rules Controller - PRD 7.24 M22 收银与费用配置
 * 2026-02-28T15:00:00+08:00
 */
const TillRules = require("../models/tillRulesModel");
const { logAuditEvent } = require("../utils/auditLogger");

const normalizeLocationId = (v) => `${v || ""}`.trim() || "default";

const sanitizeTipOptions = (arr) => {
  if (!Array.isArray(arr)) return undefined;
  return arr
    .map((n) => Number(n))
    .filter((n) => Number.isFinite(n) && n >= 0 && n <= 100)
    .slice(0, 20);
};

const listTillRules = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.query.locationId);
    const query = locationId ? { locationId } : {};
    const rows = await TillRules.find(query).sort({ updatedAt: -1 }).lean();
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return next(error);
  }
};

const getTillRules = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.params.locationId);
    const rules = await TillRules.findOne({ locationId }).lean();
    const payload = rules || {
      locationId,
      tipOptions: [0, 10, 15, 18, 20, 25],
      tipCustomAllowed: true,
      tipCalcBase: "SUBTOTAL",
      tipRoundRule: "ROUND",
      tipShowOnReceipt: true,
      tipShowNoTipOption: true,
      ccServiceFeeRate: 0,
      ccServiceFeeFixed: 0,
      debitServiceFeeRate: 0,
      otherPaymentFeeRate: 0,
      showServiceFeeSeparately: false,
      ccMinOrderAmount: 0,
      defaultTaxRate: 0,
      taxRates: {},
      taxInclusive: false,
      deliveryFeeBase: 0,
      packagingFee: 0,
    };
    return res.status(200).json({ success: true, data: payload });
  } catch (error) {
    return next(error);
  }
};

const upsertTillRules = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId || req.params.locationId);
    const body = req.body || {};
    const update = { locationId };

    if (body.tipOptions !== undefined) {
      const sanitized = sanitizeTipOptions(body.tipOptions);
      if (sanitized) update.tipOptions = sanitized;
    }
    if (typeof body.tipCustomAllowed === "boolean") update.tipCustomAllowed = body.tipCustomAllowed;
    if (["SUBTOTAL", "AFTER_TAX"].includes(body.tipCalcBase)) update.tipCalcBase = body.tipCalcBase;
    if (["FLOOR", "CEIL", "ROUND"].includes(body.tipRoundRule)) update.tipRoundRule = body.tipRoundRule;
    if (typeof body.tipShowOnReceipt === "boolean") update.tipShowOnReceipt = body.tipShowOnReceipt;
    if (typeof body.tipShowNoTipOption === "boolean") update.tipShowNoTipOption = body.tipShowNoTipOption;
    if (body.ccServiceFeeRate !== undefined) update.ccServiceFeeRate = Math.max(0, Math.min(100, Number(body.ccServiceFeeRate) || 0));
    if (body.ccServiceFeeFixed !== undefined) update.ccServiceFeeFixed = Math.max(0, Number(body.ccServiceFeeFixed) || 0);
    if (body.debitServiceFeeRate !== undefined) update.debitServiceFeeRate = Math.max(0, Math.min(100, Number(body.debitServiceFeeRate) || 0));
    if (body.otherPaymentFeeRate !== undefined) update.otherPaymentFeeRate = Math.max(0, Math.min(100, Number(body.otherPaymentFeeRate) || 0));
    if (typeof body.showServiceFeeSeparately === "boolean") update.showServiceFeeSeparately = body.showServiceFeeSeparately;
    if (body.ccMinOrderAmount !== undefined) update.ccMinOrderAmount = Math.max(0, Number(body.ccMinOrderAmount) || 0);
    if (body.defaultTaxRate !== undefined) update.defaultTaxRate = Math.max(0, Math.min(100, Number(body.defaultTaxRate) || 0));
    if (body.taxRates && typeof body.taxRates === "object") update.taxRates = body.taxRates;
    if (typeof body.taxInclusive === "boolean") update.taxInclusive = body.taxInclusive;
    if (body.deliveryFeeBase !== undefined) update.deliveryFeeBase = Math.max(0, Number(body.deliveryFeeBase) || 0);
    if (body.packagingFee !== undefined) update.packagingFee = Math.max(0, Number(body.packagingFee) || 0);

    const rules = await TillRules.findOneAndUpdate(
      { locationId },
      { $set: update },
      { upsert: true, new: true }
    ).lean();

    await logAuditEvent({
      req,
      action: "TILL_RULES_UPDATED",
      resourceType: "TillRules",
      resourceId: rules?._id,
      statusCode: 200,
      metadata: { locationId },
    });

    return res.status(200).json({
      success: true,
      message: "Till rules updated.",
      data: rules,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listTillRules,
  getTillRules,
  upsertTillRules,
};

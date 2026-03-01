/**
 * 工资规则 + 工资计算 - 团队管理 Phase 5
 * 2026-02-28
 */
const WageRule = require("../models/wageRuleModel");
const { calculateWageForPeriod } = require("../services/wageCalculationService");
const createHttpError = require("http-errors");
const mongoose = require("mongoose");

const listWageRules = async (req, res, next) => {
  try {
    const locationId = req.query.locationId || "default";
    const userId = req.query.userId;
    const filter = { locationId };
    if (userId) filter.userId = userId;
    const rules = await WageRule.find(filter)
      .populate("positionId")
      .populate("userId", "name email")
      .sort({ effectiveFrom: -1 });
    return res.status(200).json({ success: true, data: rules });
  } catch (error) {
    return next(error);
  }
};

const createWageRule = async (req, res, next) => {
  try {
    const { positionId, userId, locationId = "default", effectiveFrom, effectiveTo, baseHourlyRate, overtimeMultiplier } =
      req.body;
    if (!effectiveFrom || baseHourlyRate === undefined) {
      return next(createHttpError(400, "effectiveFrom and baseHourlyRate are required."));
    }
    if (!positionId && !userId) {
      return next(createHttpError(400, "positionId or userId required."));
    }
    const rule = await WageRule.create({
      positionId: positionId || undefined,
      userId: userId || undefined,
      locationId: `${locationId || "default"}`.trim(),
      effectiveFrom: new Date(effectiveFrom),
      effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
      baseHourlyRate: Number(baseHourlyRate) || 0,
      overtimeMultiplier: Number(overtimeMultiplier) || 1.5,
    });
    await rule.populate("positionId");
    await rule.populate("userId", "name email");
    return res.status(201).json({ success: true, data: rule });
  } catch (error) {
    return next(error);
  }
};

const calculateWage = async (req, res, next) => {
  try {
    const { locationId = "default", startDate, endDate } = req.body;
    if (!startDate || !endDate) {
      return next(createHttpError(400, "startDate and endDate are required."));
    }
    const results = await calculateWageForPeriod(locationId, startDate, endDate);
    return res.status(200).json({
      success: true,
      data: {
        startDate,
        endDate,
        locationId,
        summary: results,
        totalWage: results.reduce((s, r) => s + r.totalWage, 0),
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listWageRules,
  createWageRule,
  calculateWage,
};

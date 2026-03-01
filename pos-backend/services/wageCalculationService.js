/**
 * 工资计算服务 - 团队管理 Phase 5
 * 2026-02-28: 基于 WorkHourRecord + WageRule 计算周期工资
 */
const WorkHourRecord = require("../models/workHourRecordModel");
const WageRule = require("../models/wageRuleModel");
const User = require("../models/userModel");
const EmployeeProfile = require("../models/employeeProfileModel");
const Position = require("../models/positionModel");

const DEFAULT_OVERTIME_MULTIPLIER = 1.5;
const NORMAL_HOURS_PER_DAY = 8;

const getEffectiveWageRule = async (userId, positionId, locationId, date) => {
  const rules = await WageRule.find({
    locationId,
    effectiveFrom: { $lte: date },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: date } }],
    $or: [{ userId }, { positionId }],
  })
    .sort({ userId: -1, effectiveFrom: -1 })
    .limit(1)
    .populate("positionId");
  const rule = rules[0];
  if (rule) {
    return {
      baseHourlyRate: Number(rule.baseHourlyRate) || 0,
      overtimeMultiplier: Number(rule.overtimeMultiplier) || DEFAULT_OVERTIME_MULTIPLIER,
    };
  }
  if (positionId) {
    const position = await Position.findById(positionId);
    if (position) {
      return {
        baseHourlyRate: Number(position.defaultHourlyRate) || 0,
        overtimeMultiplier: DEFAULT_OVERTIME_MULTIPLIER,
      };
    }
  }
  return { baseHourlyRate: 0, overtimeMultiplier: DEFAULT_OVERTIME_MULTIPLIER };
};

const calculateHours = (clockInAt, clockOutAt) => {
  if (!clockInAt || !clockOutAt) return 0;
  const ms = new Date(clockOutAt) - new Date(clockInAt);
  return Math.max(0, ms / (1000 * 60 * 60));
};

const calculateWageForRecord = async (record, locationId) => {
  const userId = record.userId?._id || record.userId;
  const profile = await EmployeeProfile.findOne({ userId, locationId });
  const positionId = profile?.positionId;
  const date = record.date instanceof Date ? record.date : new Date(record.date);
  const { baseHourlyRate, overtimeMultiplier } = await getEffectiveWageRule(
    userId,
    positionId,
    locationId,
    date
  );
  const hours = calculateHours(record.clockInAt, record.clockOutAt);
  const normalHours = Math.min(hours, NORMAL_HOURS_PER_DAY);
  const overtimeHours = Math.max(0, hours - NORMAL_HOURS_PER_DAY);
  const wage =
    normalHours * baseHourlyRate + overtimeHours * baseHourlyRate * overtimeMultiplier;
  return {
    userId,
    userName: record.userId?.name,
    date,
    hours: Math.round(hours * 100) / 100,
    normalHours,
    overtimeHours,
    baseHourlyRate,
    wage: Math.round(wage * 100) / 100,
  };
};

const calculateWageForPeriod = async (locationId, startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const records = await WorkHourRecord.find({
    locationId,
    date: { $gte: start, $lte: end },
    status: "CLOSED",
    clockInAt: { $ne: null },
    clockOutAt: { $ne: null },
  }).populate("userId", "name email");

  const byUser = new Map();
  for (const r of records) {
    const row = await calculateWageForRecord(r, locationId);
    const k = `${row.userId}`;
    if (!byUser.has(k)) {
      byUser.set(k, {
        userId: row.userId,
        userName: row.userName,
        totalHours: 0,
        totalWage: 0,
        details: [],
      });
    }
    const agg = byUser.get(k);
    agg.totalHours += row.hours;
    agg.totalWage += row.wage;
    agg.details.push(row);
  }
  return Array.from(byUser.values()).map((a) => ({
    ...a,
    totalHours: Math.round(a.totalHours * 100) / 100,
    totalWage: Math.round(a.totalWage * 100) / 100,
  }));
};

module.exports = {
  getEffectiveWageRule,
  calculateHours,
  calculateWageForRecord,
  calculateWageForPeriod,
};

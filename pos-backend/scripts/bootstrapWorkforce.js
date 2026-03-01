/**
 * 团队管理 Phase 1 - 岗位与班次模板初始化
 * 2026-02-28: 预设岗位（服务员、Runner、帮炒、外卖打包员、吧台、收银、店长）与班次模板
 */
const mongoose = require("mongoose");
const Position = require("../models/positionModel");
const ShiftTemplate = require("../models/shiftTemplateModel");
const config = require("../config/config");
const { resolveMongoUri } = require("../utils/resolveMongoUri");

const LOCATION_ID = "default";

const DEFAULT_POSITIONS = [
  { name: "服务员", code: "WAITER", scopeType: "TABLES", scopeConfig: {}, defaultHourlyRate: 0 },
  { name: "Runner/传菜", code: "RUNNER", scopeType: "RUNNER", scopeConfig: {}, defaultHourlyRate: 0 },
  { name: "帮炒", code: "WOK", scopeType: "KITCHEN", scopeConfig: { stationCode: "WOK" }, defaultHourlyRate: 0 },
  { name: "外卖打包员", code: "PACKER", scopeType: "TAKEOUT", scopeConfig: { stationCode: "PACK" }, defaultHourlyRate: 0 },
  { name: "吧台", code: "BAR", scopeType: "BAR", scopeConfig: { stationCode: "BAR" }, defaultHourlyRate: 0 },
  { name: "收银", code: "CASHIER", scopeType: "CASHIER", scopeConfig: {}, defaultHourlyRate: 0 },
  { name: "店长", code: "MANAGER", scopeType: "MANAGER", scopeConfig: {}, defaultHourlyRate: 0 },
];

const DEFAULT_SHIFT_TEMPLATES = [
  { name: "早班", code: "MORNING", startTime: "09:00", endTime: "14:00", breakMinutes: 30 },
  { name: "午班", code: "AFTERNOON", startTime: "14:00", endTime: "18:00", breakMinutes: 0 },
  { name: "晚班", code: "EVENING", startTime: "18:00", endTime: "22:00", breakMinutes: 30 },
  { name: "全天", code: "FULL", startTime: "09:00", endTime: "22:00", breakMinutes: 60 },
];

const bootstrap = async () => {
  for (const p of DEFAULT_POSITIONS) {
    await Position.findOneAndUpdate(
      { locationId: LOCATION_ID, code: p.code },
      { ...p, locationId: LOCATION_ID },
      { upsert: true, new: true }
    );
  }
  console.log(`Bootstrapped ${DEFAULT_POSITIONS.length} positions.`);

  for (const t of DEFAULT_SHIFT_TEMPLATES) {
    await ShiftTemplate.findOneAndUpdate(
      { locationId: LOCATION_ID, code: t.code },
      { ...t, locationId: LOCATION_ID },
      { upsert: true, new: true }
    );
  }
  console.log(`Bootstrapped ${DEFAULT_SHIFT_TEMPLATES.length} shift templates.`);
};

const run = async () => {
  try {
    const uri = process.env.MONGODB_SEED_URI || config.databaseURI;
    const normalizedUri = await resolveMongoUri(uri);
    await mongoose.connect(normalizedUri);
    await bootstrap();
  } catch (err) {
    console.error("Bootstrap failed:", err.message);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
  }
};

run();

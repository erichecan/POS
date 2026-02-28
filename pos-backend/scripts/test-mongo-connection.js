#!/usr/bin/env node
/**
 * 2026-02-28: MongoDB Atlas 连接诊断
 * 帮助定位 bad auth / 连接失败 的根因
 * 用法: node scripts/test-mongo-connection.js
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const mongoose = require("mongoose");

const uri = process.env.MONGODB_URI || process.env.MONGODB_SEED_URI;

function sanitize(connStr) {
  if (!connStr || typeof connStr !== "string") return "(未配置)";
  return connStr.replace(/:[^:@]+@/, ":****@");
}

async function main() {
  console.log("MongoDB 连接诊断\n");
  console.log("1. MONGODB_URI:", sanitize(uri));
  if (!uri) {
    console.log("   ❌ 未设置 MONGODB_URI，请在 .env 中配置");
    process.exit(1);
  }
  const isSrv = uri.startsWith("mongodb+srv://");
  console.log("2. 连接类型:", isSrv ? "mongodb+srv (Atlas)" : "mongodb");
  const hostMatch = uri.match(/@([^/]+)/);
  const host = hostMatch ? hostMatch[1] : "?";
  console.log("3. 目标主机:", host);

  console.log('\n--- 常见 "bad auth" 根因 ---');
  console.log("A. IP 白名单: Atlas → Network Access → 添加当前 IP 或 0.0.0.0/0（仅测试）");
  console.log("B. 用户权限: Atlas → Database Access → 用户需 Read and write to any database");
  console.log("C. 集群状态: M0 免费集群 30 天无连接会自动暂停，需在 Atlas 控制台恢复");
  console.log("D. 密码特殊字符: @/:!#% 等需 URL 编码（@→%40）\n");

  console.log("尝试连接...");
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
    console.log("✅ 连接成功！");
    const db = mongoose.connection.db;
    console.log("   数据库:", db.databaseName);
    const cols = await db.listCollections().toArray();
    console.log("   集合数:", cols.length);
    await mongoose.connection.close();
  } catch (err) {
    console.log("❌ 连接失败:", err.message || err);
    if (err.code === 8000 || err.codeName === "AtlasError") {
      console.log("\n→ 请优先检查 Atlas Network Access：当前机器 IP 是否在白名单中");
    }
    process.exit(1);
  }
}

main();

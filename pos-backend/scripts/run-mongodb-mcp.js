#!/usr/bin/env node
/**
 * 2026-02-28: MongoDB MCP Server 启动器
 * 从 pos-backend/.env 读取 MONGODB_URI，注入 MDB_MCP_CONNECTION_STRING 后启动 mongodb-mcp-server
 * 用法: node scripts/run-mongodb-mcp.js
 * Cursor MCP 配置中 command 指向此脚本即可，无需在配置里写密码
 */
const path = require("path");
const { spawn } = require("child_process");

const envPath = path.resolve(__dirname, "../.env");
require("dotenv").config({ path: envPath });

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error("MONGODB_URI 未配置，请检查 pos-backend/.env");
  process.exit(1);
}

process.env.MDB_MCP_CONNECTION_STRING = uri;
process.env.MDB_MCP_READ_ONLY = process.env.MDB_MCP_READ_ONLY || "false";

const child = spawn("npx", ["-y", "mongodb-mcp-server@latest"], {
  stdio: "inherit",
  env: process.env,
  cwd: path.resolve(__dirname, ".."),
});

child.on("exit", (code) => process.exit(code || 0));

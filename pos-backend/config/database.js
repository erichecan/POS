// 2026-02-24: DB 连接失败不再 process.exit，避免 Cloud Run 返回无 CORS 的 503
// 2026-02-28: 空数据库时自动执行 seed，GCP 部署后首次启动即有演示数据
const mongoose = require("mongoose");
const path = require("path");
const { spawn } = require("child_process");
const config = require("./config");
const { resolveMongoUri } = require("../utils/resolveMongoUri");

const connectDB = async () => {
    try {
        const normalizedUri = await resolveMongoUri(config.databaseURI);
        const conn = await mongoose.connect(normalizedUri);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);

        // 2026-02-28: 检测空数据库时后台自动 seed，无需人工操作
        const User = require("../models/userModel");
        const userCount = await User.countDocuments();
        if (userCount === 0) {
            console.log("📦 Database empty, auto-seeding demo data in background...");
            const seedPath = path.resolve(__dirname, "../scripts/seed.js");
            const child = spawn(process.execPath, [seedPath], {
                cwd: path.resolve(__dirname, ".."),
                env: process.env, // 继承 MONGODB_URI（GCP 控制台配置）
                stdio: "pipe",
            });
            child.stdout.on("data", (d) => process.stdout.write(d));
            child.stderr.on("data", (d) => process.stderr.write(d));
            child.on("exit", (code) => {
                if (code === 0) console.log("✅ Auto-seed completed.");
                else console.warn("⚠️ Auto-seed exited with code", code);
            });
        }
    } catch (error) {
        console.error(`❌ Database connection failed: ${error.message}`);
        // 不退出进程，保证 Express 监听并返回带 CORS 的 503
    }
};

const isDbConnected = () => mongoose.connection.readyState === 1;

module.exports = connectDB;
module.exports.isDbConnected = isDbConnected;

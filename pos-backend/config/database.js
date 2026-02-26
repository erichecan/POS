// 2026-02-24: DB 连接失败不再 process.exit，避免 Cloud Run 返回无 CORS 的 503
const mongoose = require("mongoose");
const config = require("./config");
const { resolveMongoUri } = require("../utils/resolveMongoUri");

const connectDB = async () => {
    try {
        const normalizedUri = await resolveMongoUri(config.databaseURI);
        const conn = await mongoose.connect(normalizedUri);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.error(`❌ Database connection failed: ${error.message}`);
        // 不退出进程，保证 Express 监听并返回带 CORS 的 503
    }
};

const isDbConnected = () => mongoose.connection.readyState === 1;

module.exports = connectDB;
module.exports.isDbConnected = isDbConnected;

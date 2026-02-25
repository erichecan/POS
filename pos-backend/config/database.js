const mongoose = require("mongoose");
const config = require("./config");
const { resolveMongoUri } = require("../utils/resolveMongoUri");

const connectDB = async () => {
    try {
        const normalizedUri = await resolveMongoUri(config.databaseURI);
        const conn = await mongoose.connect(normalizedUri);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    } catch (error) {
        console.log(`❌ Database connection failed: ${error.message}`);
        process.exit();
    }
}

module.exports = connectDB;

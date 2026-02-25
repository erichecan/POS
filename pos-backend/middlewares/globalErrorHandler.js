const config = require("../config/config");

// 2026-02-24 22:18:00 生产环境 5xx 不返回内部错误原文（CODE_REVIEW S5）
const sanitizeMessage = (message, statusCode) => {
    if (config.nodeEnv === "development") return message;
    if (statusCode >= 500) return "Internal Server Error";
    return message;
};

const globalErrorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const response = {
        status: statusCode,
        message: sanitizeMessage(err.message || "", statusCode),
        errorStack: config.nodeEnv === "development" ? err.stack : ""
    };

    if (err.code !== undefined) {
        response.code = err.code;
    }
    if (err.detail !== undefined && config.nodeEnv === "development") {
        response.detail = err.detail;
    }
    if (err.conflictEventId !== undefined) {
        response.conflictEventId = err.conflictEventId;
    }

    return res.status(statusCode).json(response);
};

module.exports = globalErrorHandler;

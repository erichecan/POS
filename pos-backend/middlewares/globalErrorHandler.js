const config = require("../config/config");

const globalErrorHandler = (err, req, res, next) => {
    const statusCode = err.statusCode || 500;
    const response = {
        status: statusCode,
        message: err.message,
        errorStack: config.nodeEnv === "development" ? err.stack : ""
    };

    if (err.code !== undefined) {
        response.code = err.code;
    }
    if (err.detail !== undefined) {
        response.detail = err.detail;
    }
    if (err.conflictEventId !== undefined) {
        response.conflictEventId = err.conflictEventId;
    }

    return res.status(statusCode).json(response)
}

module.exports = globalErrorHandler;

const express = require("express");
const connectDB = require("./config/database");
const config = require("./config/config");
const globalErrorHandler = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const app = express();

const PORT = config.port;
connectDB();

// 2026-02-24: CORS 支持多 origin + 生产环境 *.run.app 回退，避免 Cloud Run 前端被拒
app.use(cors({
    credentials: true,
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (config.isOriginAllowed(origin)) return cb(null, true);
        return cb(null, false);
    },
}));
app.use("/api/payment/webhook-verification", express.raw({ type: "application/json" }));
app.use(express.json());
app.use(cookieParser());

// 2026-02-24: OPTIONS 预检必须 2xx+CORS，否则浏览器报 CORS；503 时也显式带 CORS
app.use("/api", (req, res, next) => {
    const setCors = () => {
        const origin = req.get("Origin");
        const allowOrigin = (origin && config.isOriginAllowed(origin)) ? origin : config.frontendUrl;
        res.setHeader("Access-Control-Allow-Origin", allowOrigin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
    };
    if (req.method === "OPTIONS") {
        setCors();
        res.setHeader("Access-Control-Allow-Methods", "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type,Authorization");
        return res.status(204).end();
    }
    if (!connectDB.isDbConnected()) {
        setCors();
        return res.status(503).json({ success: false, message: "Service temporarily unavailable (database)" });
    }
    next();
});


// Root Endpoint
app.get("/", (req,res) => {
    res.json({message : "Hello from POS Server!"});
})

// Other Endpoints
app.use("/api/user", require("./routes/userRoute"));
app.use("/api/order", require("./routes/orderRoute"));
app.use("/api/table", require("./routes/tableRoute"));
app.use("/api/payment", require("./routes/paymentRoute"));
app.use("/api/access-control", require("./routes/accessControlRoute"));
app.use("/api/channel-config", require("./routes/channelConfigRoute"));
// 2026-02-26T19:56:00+08:00: Menu category management (must be before /api/menu to match first)
app.use("/api/menu/categories", require("./routes/menuCategoryRoute"));
app.use("/api/menu", require("./routes/menuRoute"));
app.use("/api/member", require("./routes/memberRoute"));
app.use("/api/promotion", require("./routes/promotionRoute"));
app.use("/api/finance", require("./routes/financeRoute"));
app.use("/api/organization", require("./routes/organizationRoute"));
app.use("/api/workforce/positions", require("./routes/workforcePositionRoute"));
app.use("/api/workforce/employees", require("./routes/workforceEmployeeRoute"));
app.use("/api/workforce/shift-templates", require("./routes/workforceShiftTemplateRoute"));
app.use("/api/workforce/schedule", require("./routes/workforceScheduleRoute"));
app.use("/api/workforce/leave", require("./routes/workforceLeaveRoute"));
app.use("/api/workforce/work-hours", require("./routes/workforceWorkHoursRoute"));
app.use("/api/workforce/wage", require("./routes/workforceWageRoute"));
app.use("/api/workforce", require("./routes/workforceRoute"));
app.use("/api/analytics", require("./routes/analyticsRoute"));
app.use("/api/inventory", require("./routes/inventoryRoute"));
app.use("/api/cash", require("./routes/cashRoute"));
app.use("/api/kitchen", require("./routes/kitchenRoute"));
app.use("/api/ops", require("./routes/opsRoute"));
app.use("/api/offline", require("./routes/offlineRoute"));
app.use("/api/device", require("./routes/deviceRoute"));
app.use("/api/self-order", require("./routes/selfOrderRoute"));
app.use("/api/compliance", require("./routes/complianceRoute"));
app.use("/api/partner", require("./routes/partnerRoute"));

// Global Error Handler
app.use(globalErrorHandler);


// Server
app.listen(PORT, () => {
    console.log(`☑️  POS Server is listening on port ${PORT}`);
})

const express = require("express");
const connectDB = require("./config/database");
const config = require("./config/config");
const globalErrorHandler = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const app = express();


const PORT = config.port;
connectDB();

// Middlewares
app.use(cors({
    credentials: true,
    origin: ['http://localhost:5173']
}))
app.use("/api/payment/webhook-verification", express.raw({ type: "application/json" }));
app.use(express.json()); // parse incoming request in json format
app.use(cookieParser())


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
app.use("/api/menu", require("./routes/menuRoute"));
app.use("/api/member", require("./routes/memberRoute"));
app.use("/api/promotion", require("./routes/promotionRoute"));
app.use("/api/finance", require("./routes/financeRoute"));
app.use("/api/organization", require("./routes/organizationRoute"));
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

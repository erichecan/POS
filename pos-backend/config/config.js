const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");

const envPath = path.resolve(__dirname, "../.env");
const envLocalPath = path.resolve(__dirname, "../.env.local");

if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

if (fs.existsSync(envLocalPath)) {
    dotenv.config({ path: envLocalPath, override: true });
}

const requiredEnvKeys = ["JWT_SECRET"];
const missingRequiredKeys = requiredEnvKeys.filter((key) => !process.env[key]);

if (missingRequiredKeys.length > 0) {
    throw new Error(`Missing required environment variables: ${missingRequiredKeys.join(", ")}`);
}

const config = Object.freeze({
    toBoolean: (value, defaultValue = false) => {
        if (value === undefined || value === null || value === "") {
            return defaultValue;
        }

        const normalized = `${value}`.trim().toLowerCase();
        return ["1", "true", "yes", "on"].includes(normalized);
    },
    // 2026-02-24 22:15:00 与 README/E2E 一致，默认 8000（CODE_REVIEW C1）
    port: process.env.PORT || 8000,
    databaseURI: process.env.MONGODB_URI || "mongodb://localhost:27017/pos-db",
    nodeEnv: process.env.NODE_ENV || "development",
    // 2026-02-24: 支持逗号分隔多 origin；生产环境未配置时允许 *.run.app 避免 CORS 报错
    frontendUrl: (() => {
        const raw = process.env.FRONTEND_URL || "http://localhost:5173";
        return raw.split(",")[0].trim();
    })(),
    frontendUrls: (() => {
        const raw = process.env.FRONTEND_URL || "http://localhost:5173";
        return raw.split(",").map((s) => s.trim()).filter(Boolean);
    })(),
    // 2026-02-24: *.run.app 始终允许，避免 Cloud Run 未设 NODE_ENV=production 时 CORS 拒掉
    isOriginAllowed(origin) {
        if (!origin) return false;
        if (this.frontendUrls.includes(origin)) return true;
        if (/^https:\/\/[a-z0-9.-]+\.run\.app$/.test(origin)) return true;
        return false;
    },
    accessTokenSecret: process.env.JWT_SECRET,
    stripeSecretKey: process.env.STRIPE_SECRET_KEY,
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    paymentGatewayOrder: `${process.env.PAYMENT_GATEWAY_ORDER || "STRIPE,MOCK_STRIPE"}`,
    paymentGatewayFailoverEnabled: ["1", "true", "yes", "on"].includes(
      `${process.env.PAYMENT_GATEWAY_FAILOVER_ENABLED || "true"}`.trim().toLowerCase()
    ),
    paymentMockEnabled: ["1", "true", "yes", "on"].includes(
      `${process.env.PAYMENT_MOCK_ENABLED || "true"}`.trim().toLowerCase()
    ),
    paymentRefundApprovalEnabled: ["1", "true", "yes", "on"].includes(
      `${process.env.PAYMENT_REFUND_APPROVAL_ENABLED || "true"}`.trim().toLowerCase()
    ),
    paymentRefundApprovalThresholdAmount: Number(
      process.env.PAYMENT_REFUND_APPROVAL_THRESHOLD_AMOUNT || 100
    ),
    paymentRefundApprovalRequiredCount: Math.max(
      1,
      Number(process.env.PAYMENT_REFUND_APPROVAL_REQUIRED_COUNT || 2)
    ),
    highRiskApprovalEnforced: ["1", "true", "yes", "on"].includes(
      `${process.env.HIGH_RISK_APPROVAL_ENFORCED || "true"}`.trim().toLowerCase()
    ),
    highRiskApprovalMaxAgeMinutes: Math.max(
      1,
      Number(process.env.HIGH_RISK_APPROVAL_MAX_AGE_MINUTES || 1440)
    ),
    memberPointsPerCurrency: Number(process.env.MEMBER_POINTS_PER_CURRENCY || 1),
    memberPointsRedeemRate: Number(process.env.MEMBER_POINTS_REDEEM_RATE || 100),
    taxRatePercent: Number(process.env.TAX_RATE_PERCENT || 5.25),
    idempotencyTtlHours: Number(process.env.IDEMPOTENCY_TTL_HOURS || 24),
    menuCatalogStrict: ["1", "true", "yes", "on"].includes(
        `${process.env.MENU_CATALOG_STRICT || "false"}`.trim().toLowerCase()
    ),
    channelIngressDefaultQuotaPerMinute: Number(
        process.env.CHANNEL_INGRESS_DEFAULT_QUOTA_PER_MINUTE || 120
    ),
    channelIngressRequireSignature: ["1", "true", "yes", "on"].includes(
        `${process.env.CHANNEL_INGRESS_REQUIRE_SIGNATURE || "false"}`.trim().toLowerCase()
    ),
    inventoryEnforced: ["1", "true", "yes", "on"].includes(
        `${process.env.INVENTORY_ENFORCED || "false"}`.trim().toLowerCase()
    ),
    cashShiftStrict: ["1", "true", "yes", "on"].includes(
        `${process.env.CASH_SHIFT_STRICT || "false"}`.trim().toLowerCase()
    ),
    kitchenSlaNormalMinutes: Number(process.env.KITCHEN_SLA_NORMAL_MINUTES || 20),
    kitchenSlaRushMinutes: Number(process.env.KITCHEN_SLA_RUSH_MINUTES || 12),
    opsSloInventoryLowRateWarnPercent: Number(
        process.env.OPS_SLO_INVENTORY_LOW_RATE_WARN_PERCENT || 20
    ),
    opsSloInventoryOutOfStockWarnCount: Number(
        process.env.OPS_SLO_INVENTORY_OUT_OF_STOCK_WARN_COUNT || 1
    ),
    opsSloKitchenOverdueWarnCount: Number(
        process.env.OPS_SLO_KITCHEN_OVERDUE_WARN_COUNT || 3
    ),
    opsSloKitchenAvgReadyWarnMinutes: Number(
        process.env.OPS_SLO_KITCHEN_AVG_READY_WARN_MINUTES || 25
    ),
    opsSloPaymentFailureRateWarnPercent: Number(
        process.env.OPS_SLO_PAYMENT_FAILURE_RATE_WARN_PERCENT || 5
    ),
    opsSloPaymentUnverifiedWarnCount: Number(
        process.env.OPS_SLO_PAYMENT_UNVERIFIED_WARN_COUNT || 3
    ),
    opsSloPaymentUnverifiedGraceMinutes: Number(
        process.env.OPS_SLO_PAYMENT_UNVERIFIED_GRACE_MINUTES || 15
    ),
    opsSloPendingRefundApprovalWarnCount: Number(
        process.env.OPS_SLO_PENDING_REFUND_APPROVAL_WARN_COUNT || 5
    ),
    opsSloCashVarianceWarnCount: Number(
        process.env.OPS_SLO_CASH_VARIANCE_WARN_COUNT || 1
    ),
    opsSloCashVarianceWarnAmount: Number(
        process.env.OPS_SLO_CASH_VARIANCE_WARN_AMOUNT || 20
    ),
    opsEscalationLevel2Minutes: Number(
        process.env.OPS_ESCALATION_LEVEL2_MINUTES || 15
    ),
    opsEscalationLevel3Minutes: Number(
        process.env.OPS_ESCALATION_LEVEL3_MINUTES || 30
    ),
    opsEscalationLevel1Role: process.env.OPS_ESCALATION_LEVEL1_ROLE || "Cashier",
    opsEscalationLevel2Role: process.env.OPS_ESCALATION_LEVEL2_ROLE || "Admin",
    opsEscalationLevel3Role: process.env.OPS_ESCALATION_LEVEL3_ROLE || "Admin",
});

module.exports = config;

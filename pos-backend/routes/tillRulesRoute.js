/**
 * Till Rules routes - PRD 7.24 M22 2026-02-28T15:00:00+08:00
 */
const express = require("express");
const { listTillRules, getTillRules, upsertTillRules } = require("../controllers/tillRulesController");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");

const router = express.Router();

router.get("/", isVerifiedUser, requireRoles("Admin", "Cashier", "Waiter"), requirePermission("orders", "read"), listTillRules);
router.get("/:locationId", isVerifiedUser, requireRoles("Admin", "Cashier", "Waiter"), requirePermission("orders", "read"), getTillRules);
router.put("/:locationId", isVerifiedUser, requireRoles("Admin"), requirePermission("orders", "write"), idempotencyMiddleware, upsertTillRules);

module.exports = router;

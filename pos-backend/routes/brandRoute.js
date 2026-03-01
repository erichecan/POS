/**
 * Brand routes - PRD 7.23 2026-02-28T13:00:00+08:00
 */
const express = require("express");
const { listBrandProfiles, getBrandProfile, upsertBrandProfile } = require("../controllers/brandController");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");

const router = express.Router();

router.get("/", isVerifiedUser, requireRoles("Admin", "Waiter", "Cashier"), requirePermission("orders", "read"), listBrandProfiles);
router.get("/:locationId", isVerifiedUser, requireRoles("Admin", "Waiter", "Cashier"), requirePermission("orders", "read"), getBrandProfile);
router.put("/:locationId", isVerifiedUser, requireRoles("Admin"), requirePermission("orders", "write"), idempotencyMiddleware, upsertBrandProfile);

module.exports = router;

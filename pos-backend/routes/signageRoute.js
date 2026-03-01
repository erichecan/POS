/**
 * Signage routes - PRD 7.23.3 2026-02-28T13:00:00+08:00
 */
const express = require("express");
const {
  listSignageDevices,
  getSignageDevice,
  createSignageDevice,
  updateSignageDevice,
  deleteSignageDevice,
} = require("../controllers/signageController");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");

const router = express.Router();

router.get("/", isVerifiedUser, requireRoles("Admin"), requirePermission("orders", "read"), listSignageDevices);
router.get("/:id", isVerifiedUser, requireRoles("Admin"), requirePermission("orders", "read"), getSignageDevice);
router.post("/", isVerifiedUser, requireRoles("Admin"), requirePermission("orders", "write"), idempotencyMiddleware, createSignageDevice);
router.put("/:id", isVerifiedUser, requireRoles("Admin"), requirePermission("orders", "write"), idempotencyMiddleware, updateSignageDevice);
router.delete("/:id", isVerifiedUser, requireRoles("Admin"), requirePermission("orders", "write"), deleteSignageDevice);

module.exports = router;

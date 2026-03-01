/**
 * Ad Material routes - PRD 7.23.4 2026-02-28T13:00:00+08:00
 */
const express = require("express");
const {
  listAdMaterials,
  getAdMaterial,
  createAdMaterial,
  updateAdMaterial,
  deleteAdMaterial,
} = require("../controllers/adMaterialController");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");

const router = express.Router();

router.get("/", isVerifiedUser, requireRoles("Admin"), requirePermission("orders", "read"), listAdMaterials);
router.get("/:id", isVerifiedUser, requireRoles("Admin"), requirePermission("orders", "read"), getAdMaterial);
router.post("/", isVerifiedUser, requireRoles("Admin"), requirePermission("orders", "write"), idempotencyMiddleware, createAdMaterial);
router.put("/:id", isVerifiedUser, requireRoles("Admin"), requirePermission("orders", "write"), idempotencyMiddleware, updateAdMaterial);
router.delete("/:id", isVerifiedUser, requireRoles("Admin"), requirePermission("orders", "write"), deleteAdMaterial);

module.exports = router;

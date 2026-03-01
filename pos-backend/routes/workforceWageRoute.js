/**
 * 工资规则与计算 API - 团队管理 Phase 5
 */
const express = require("express");
const {
  listWageRules,
  createWageRule,
  calculateWage,
} = require("../controllers/wageRuleController");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");

const router = express.Router();

router.get(
  "/rules",
  isVerifiedUser,
  requireRoles("Admin"),
  requirePermission("workforce", "read"),
  listWageRules
);

router.post(
  "/rules",
  isVerifiedUser,
  requireRoles("Admin"),
  requirePermission("workforce", "write"),
  idempotencyMiddleware,
  createWageRule
);

router.post(
  "/calculate",
  isVerifiedUser,
  requireRoles("Admin"),
  requirePermission("workforce", "read"),
  calculateWage
);

module.exports = router;

/**
 * 员工工作范围 API - 团队管理 Phase 2
 * 2026-02-28
 */
const express = require("express");
const {
  listEmployeesWithScopes,
  getWorkScope,
  upsertWorkScope,
} = require("../controllers/employeeWorkScopeController");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");

const router = express.Router();

router.get(
  "/",
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("workforce", "read"),
  listEmployeesWithScopes
);

router.get(
  "/:userId/work-scope",
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("workforce", "read"),
  getWorkScope
);

router.put(
  "/:userId/work-scope",
  isVerifiedUser,
  requireRoles("Admin"),
  requirePermission("workforce", "write"),
  idempotencyMiddleware,
  upsertWorkScope
);

module.exports = router;

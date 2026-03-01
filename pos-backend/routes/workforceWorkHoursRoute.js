/**
 * 工时记录 API - 团队管理 Phase 4
 */
const express = require("express");
const {
  listWorkHourRecords,
  createOrUpdateWorkHourRecord,
  clockIn,
  clockOut,
} = require("../controllers/workHourRecordController");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");

const router = express.Router();

router.get(
  "/",
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("workforce", "read"),
  listWorkHourRecords
);

router.post(
  "/",
  isVerifiedUser,
  requireRoles("Admin"),
  requirePermission("workforce", "write"),
  idempotencyMiddleware,
  createOrUpdateWorkHourRecord
);

router.post(
  "/clock-in",
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("workforce", "write"),
  idempotencyMiddleware,
  clockIn
);

router.post(
  "/clock-out",
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("workforce", "write"),
  idempotencyMiddleware,
  clockOut
);

module.exports = router;

/**
 * 请假 API - 团队管理 Phase 4
 */
const express = require("express");
const {
  listLeaveRequests,
  createLeaveRequest,
  approveLeaveRequest,
} = require("../controllers/leaveRequestController");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");

const router = express.Router();

router
  .route("/")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Waiter", "Cashier"),
    requirePermission("workforce", "read"),
    listLeaveRequests
  )
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Waiter", "Cashier"),
    requirePermission("workforce", "write"),
    idempotencyMiddleware,
    createLeaveRequest
  );

router.post(
  "/:id/approve",
  isVerifiedUser,
  requireRoles("Admin"),
  requirePermission("workforce", "write"),
  idempotencyMiddleware,
  approveLeaveRequest
);

module.exports = router;

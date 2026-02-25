const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const {
  createMember,
  listMembers,
  getMemberById,
  adjustMemberBalance,
  accruePointsFromOrder,
  redeemPoints,
  listMemberLedger,
} = require("../controllers/memberController");

const router = express.Router();

router
  .route("/accounts")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("member", "write"),
    idempotencyMiddleware,
    createMember
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("member", "read"),
    listMembers
  );

router
  .route("/accounts/:id")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("member", "read"),
    getMemberById
  );

router
  .route("/accounts/:id/adjust")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("member", "write"),
    idempotencyMiddleware,
    adjustMemberBalance
  );

router
  .route("/accounts/:id/accrue-order")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("member", "write"),
    idempotencyMiddleware,
    accruePointsFromOrder
  );

router
  .route("/accounts/:id/redeem-points")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("member", "write"),
    idempotencyMiddleware,
    redeemPoints
  );

router
  .route("/accounts/:id/ledger")
  .get(isVerifiedUser, requireRoles("Admin", "Cashier"), requirePermission("member", "read"), listMemberLedger);

module.exports = router;

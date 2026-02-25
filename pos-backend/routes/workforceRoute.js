const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const {
  createShift,
  listShifts,
  clockInShift,
  clockOutShift,
} = require("../controllers/workforceController");

const router = express.Router();

router
  .route("/shifts")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("workforce", "write"),
    idempotencyMiddleware,
    createShift
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("workforce", "read"),
    listShifts
  );

router
  .route("/shifts/:id/clock-in")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("workforce", "write"),
    idempotencyMiddleware,
    clockInShift
  );

router
  .route("/shifts/:id/clock-out")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("workforce", "write"),
    idempotencyMiddleware,
    clockOutShift
  );

module.exports = router;

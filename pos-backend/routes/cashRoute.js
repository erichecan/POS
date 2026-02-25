const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const {
  openShift,
  listShifts,
  getShiftById,
  addMovement,
  closeShift,
} = require("../controllers/cashController");

const router = express.Router();

router
  .route("/shifts")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("cash", "write"),
    idempotencyMiddleware,
    openShift
  )
  .get(isVerifiedUser, requireRoles("Admin", "Cashier"), requirePermission("cash", "read"), listShifts);

router
  .route("/shifts/:id")
  .get(isVerifiedUser, requireRoles("Admin", "Cashier"), requirePermission("cash", "read"), getShiftById);

router
  .route("/shifts/:id/movements")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("cash", "write"),
    idempotencyMiddleware,
    addMovement
  );

router
  .route("/shifts/:id/close")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("cash", "write"),
    idempotencyMiddleware,
    closeShift
  );

module.exports = router;

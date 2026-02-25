const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const {
  generateSettlement,
  listSettlements,
  exportSettlementCsv,
} = require("../controllers/financeController");

const router = express.Router();

router
  .route("/settlements/generate")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("finance", "write"),
    idempotencyMiddleware,
    generateSettlement
  );

router
  .route("/settlements")
  .get(isVerifiedUser, requireRoles("Admin", "Cashier"), requirePermission("finance", "read"), listSettlements);

router
  .route("/settlements/:id/export.csv")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("finance", "export"),
    exportSettlementCsv
  );

module.exports = router;

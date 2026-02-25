const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const {
  getOverview,
  getSalesByItem,
  exportOrdersCsv,
} = require("../controllers/analyticsController");

const router = express.Router();

router
  .route("/overview")
  .get(isVerifiedUser, requireRoles("Admin", "Cashier"), requirePermission("analytics", "read"), getOverview);

router
  .route("/sales-by-item")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("analytics", "read"),
    getSalesByItem
  );

router
  .route("/export/orders.csv")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("analytics", "export"),
    exportOrdersCsv
  );

module.exports = router;

const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const {
  getOverview,
  getSalesByItem,
  exportOrdersCsv,
  getPromotionEffects,
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

// 2026-02-28T18:12:00+08:00 Phase D2 活动效果概览
router
  .route("/promotion-effects")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("analytics", "read"),
    getPromotionEffects
  );

module.exports = router;

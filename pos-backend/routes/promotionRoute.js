const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const {
  createPromotionRule,
  listPromotionRules,
  createPromotionCoupon,
  listPromotionCoupons,
  previewPromotionApplication,
} = require("../controllers/promotionController");

const router = express.Router();

router
  .route("/rules")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("promotion", "write"),
    idempotencyMiddleware,
    createPromotionRule
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("promotion", "read"),
    listPromotionRules
  );

router
  .route("/coupons")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("promotion", "write"),
    idempotencyMiddleware,
    createPromotionCoupon
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("promotion", "read"),
    listPromotionCoupons
  );

router
  .route("/apply/preview")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("promotion", "preview"),
    previewPromotionApplication
  );

module.exports = router;

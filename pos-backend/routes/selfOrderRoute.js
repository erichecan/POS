const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const {
  generateTableQrSession,
  getPublicMenuByToken,
  createSelfOrderByToken,
} = require("../controllers/selfOrderController");

const router = express.Router();

router
  .route("/sessions")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("self_order", "write"),
    idempotencyMiddleware,
    generateTableQrSession
  );

router
  .route("/public/menu/:token")
  .get(getPublicMenuByToken);

router
  .route("/public/orders")
  .post(idempotencyMiddleware, createSelfOrderByToken);

module.exports = router;

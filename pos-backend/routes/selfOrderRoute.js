const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const {
  generateTableQrSession,
  getPublicMenuByToken,
  createSelfOrderByToken,
  resolveTableByTokenForStaff, // 2026-02-28T15:32:00+08:00 Phase E1.2
  getKioskMenu,
  createKioskOrder, // 2026-02-28T18:33:00+08:00 Phase B1 Kiosk
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
  .route("/staff/resolve-table/:token")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    resolveTableByTokenForStaff
  );

// 2026-02-28T18:32:00+08:00 Phase B1 - Kiosk 菜单（必须排在 :token 之前）
router
  .route("/public/menu/kiosk")
  .get(getKioskMenu);

router
  .route("/public/menu/:token")
  .get(getPublicMenuByToken);

router
  .route("/public/orders")
  .post(idempotencyMiddleware, createSelfOrderByToken);

// 2026-02-28T18:34:00+08:00 Phase B1 - Kiosk 下单
router
  .route("/public/kiosk/orders")
  .post(idempotencyMiddleware, createKioskOrder);

module.exports = router;

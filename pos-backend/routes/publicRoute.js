/**
 * 公开路由 - Phase C1 在线订餐
 * 2026-02-28T16:08:00+08:00 无需登录
 */
const express = require("express");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const {
  getPublicMenu,
  createPublicOrder,
  getOrderStatus,
} = require("../controllers/publicOrderController");
const {
  createCheckoutForOrder,
  verifyPublicPayment,
} = require("../controllers/publicPaymentController");

const router = express.Router();

router.get("/menu", getPublicMenu);
router.post("/orders", idempotencyMiddleware, createPublicOrder);
router.get("/orders/:id/status", getOrderStatus);

router.post("/payment/create-checkout", createCheckoutForOrder);
router.post("/payment/verify", verifyPublicPayment);

module.exports = router;

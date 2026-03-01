/**
 * Phase C2 排队叫号 - 路由
 * 2026-02-28T16:14:00+08:00
 * 取号、大屏为公开接口；管理（叫号/过号）需登录
 */
const express = require("express");
const { isVerifiedUser, requireRoles } = require("../middlewares/tokenVerification");
const { takeNumber, listTickets, updateTicket, getDisplayData } = require("../controllers/queueController");

const router = express.Router();

// 公开接口
router.post("/tickets", takeNumber);
router.get("/display", getDisplayData);

// 管理接口（需登录）
router.get(
  "/tickets",
  isVerifiedUser,
  requireRoles("Admin", "Cashier", "Waiter"),
  listTickets
);
router.patch(
  "/tickets/:id",
  isVerifiedUser,
  requireRoles("Admin", "Cashier", "Waiter"),
  updateTicket
);

module.exports = router;

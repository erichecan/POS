/**
 * Phase D1 会员端 H5 公开路由 - 2026-02-28T18:05:00+08:00
 * 无需员工登录，会员码+手机号校验
 */
const express = require("express");
const {
  bindMember,
  getMemberProfile,
  listMemberOrders,
  listMemberCoupons,
} = require("../controllers/publicMemberController");

const router = express.Router();

router.post("/bind", bindMember);
router.get("/:memberCode/profile", getMemberProfile);
router.get("/:memberCode/orders", listMemberOrders);
router.get("/:memberCode/coupons", listMemberCoupons);

module.exports = router;

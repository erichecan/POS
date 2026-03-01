/**
 * 排班 API - 团队管理 Phase 3
 */
const express = require("express");
const {
  listScheduleSlots,
  createScheduleSlot,
  bulkCreateScheduleSlots,
  updateScheduleSlot,
  deleteScheduleSlot,
} = require("../controllers/scheduleSlotController");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");

const router = express.Router();

router
  .route("/")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Waiter", "Cashier"),
    requirePermission("workforce", "read"),
    listScheduleSlots
  )
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("workforce", "write"),
    idempotencyMiddleware,
    createScheduleSlot
  );

router.post(
  "/bulk",
  isVerifiedUser,
  requireRoles("Admin"),
  requirePermission("workforce", "write"),
  idempotencyMiddleware,
  bulkCreateScheduleSlots
);

router
  .route("/:id")
  .put(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("workforce", "write"),
    idempotencyMiddleware,
    updateScheduleSlot
  )
  .delete(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("workforce", "write"),
    deleteScheduleSlot
  );

module.exports = router;

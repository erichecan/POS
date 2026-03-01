/**
 * 岗位 API - 团队管理 Phase 2
 * 2026-02-28
 */
const express = require("express");
const {
  listPositions,
  getPositionById,
  createPosition,
  updatePosition,
  deletePosition,
} = require("../controllers/positionController");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");

const router = express.Router();

router
  .route("/")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Waiter", "Cashier"),
    requirePermission("workforce", "read"),
    listPositions
  )
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("workforce", "write"),
    idempotencyMiddleware,
    createPosition
  );

router
  .route("/:id")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Waiter", "Cashier"),
    requirePermission("workforce", "read"),
    getPositionById
  )
  .put(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("workforce", "write"),
    idempotencyMiddleware,
    updatePosition
  )
  .delete(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("workforce", "write"),
    deletePosition
  );

module.exports = router;

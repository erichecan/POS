/**
 * 班次模板 API - 团队管理 Phase 3
 */
const express = require("express");
const {
  listShiftTemplates,
  getShiftTemplateById,
  createShiftTemplate,
  updateShiftTemplate,
  deleteShiftTemplate,
} = require("../controllers/shiftTemplateController");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");

const router = express.Router();

router
  .route("/")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Waiter", "Cashier"),
    requirePermission("workforce", "read"),
    listShiftTemplates
  )
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("workforce", "write"),
    idempotencyMiddleware,
    createShiftTemplate
  );

router
  .route("/:id")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Waiter", "Cashier"),
    requirePermission("workforce", "read"),
    getShiftTemplateById
  )
  .put(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("workforce", "write"),
    idempotencyMiddleware,
    updateShiftTemplate
  )
  .delete(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("workforce", "write"),
    deleteShiftTemplate
  );

module.exports = router;

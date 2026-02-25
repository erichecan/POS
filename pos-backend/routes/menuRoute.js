const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const {
  upsertMenuItem,
  listMenuItems,
  publishMenuVersion,
  listMenuVersions,
  markMenuItemSyncStatus,
} = require("../controllers/menuController");

const router = express.Router();

router
  .route("/items")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("menu", "write"),
    idempotencyMiddleware,
    upsertMenuItem
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("menu", "read"),
    listMenuItems
  );

router
  .route("/items/:id/sync-status")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("menu", "write"),
    idempotencyMiddleware,
    markMenuItemSyncStatus
  );

router
  .route("/versions")
  .get(isVerifiedUser, requireRoles("Admin", "Cashier"), requirePermission("menu", "read"), listMenuVersions);

router
  .route("/versions/publish")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("menu", "write"),
    idempotencyMiddleware,
    publishMenuVersion
  );

module.exports = router;

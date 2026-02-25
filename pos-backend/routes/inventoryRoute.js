const express = require("express");
const {
  isVerifiedUser,
  requireRoles,
  requirePermission,
  requireDataScope,
} = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const {
  upsertInventoryItem,
  listInventoryItems,
  adjustInventoryItem,
  bootstrapInventoryFromMenu,
} = require("../controllers/inventoryController");
const {
  listInventorySyncTasks,
  updateInventorySyncTaskStatus,
} = require("../controllers/inventorySyncController");

const router = express.Router();

router
  .route("/items")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("inventory", "write"),
    requireDataScope("inventory"),
    idempotencyMiddleware,
    upsertInventoryItem
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("inventory", "read"),
    requireDataScope("inventory"),
    listInventoryItems
  );

router
  .route("/items/:id/adjust")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("inventory", "write"),
    requireDataScope("inventory"),
    idempotencyMiddleware,
    adjustInventoryItem
  );

router
  .route("/bootstrap")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("inventory", "write"),
    idempotencyMiddleware,
    bootstrapInventoryFromMenu
  );

router
  .route("/sync-tasks")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("inventory", "read"),
    listInventorySyncTasks
  );

router
  .route("/sync-tasks/:id/status")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("inventory", "write"),
    idempotencyMiddleware,
    updateInventorySyncTaskStatus
  );

module.exports = router;

const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const {
  enqueueOfflineOperation,
  listOfflineOperations,
  replayOfflineOperation,
} = require("../controllers/offlineController");

const router = express.Router();

router
  .route("/operations")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("offline", "write"),
    idempotencyMiddleware,
    enqueueOfflineOperation
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("offline", "read"),
    listOfflineOperations
  );

router
  .route("/operations/:id/replay")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("offline", "write"),
    idempotencyMiddleware,
    replayOfflineOperation
  );

module.exports = router;

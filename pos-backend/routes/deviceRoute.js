const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const {
  registerDevice,
  listDevices,
  heartbeatDevice,
  getHardwareCatalog,
  listStoreHardwareProfiles,
  getStoreHardwareProfile,
  upsertStoreHardwareProfile,
} = require("../controllers/deviceController");

const router = express.Router();

router.route("/catalog").get(
  isVerifiedUser,
  requireRoles("Admin", "Cashier", "Waiter"),
  requirePermission("device", "read"),
  getHardwareCatalog
);

router.route("/profiles").get(
  isVerifiedUser,
  requireRoles("Admin", "Cashier", "Waiter"),
  requirePermission("device", "read"),
  listStoreHardwareProfiles
);

router
  .route("/profiles/:locationId")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("device", "read"),
    getStoreHardwareProfile
  )
  .put(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("device", "write"),
    idempotencyMiddleware,
    upsertStoreHardwareProfile
  );

router
  .route("/")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("device", "write"),
    idempotencyMiddleware,
    registerDevice
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("device", "read"),
    listDevices
  );

router
  .route("/:id/heartbeat")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("device", "write"),
    idempotencyMiddleware,
    heartbeatDevice
  );

module.exports = router;

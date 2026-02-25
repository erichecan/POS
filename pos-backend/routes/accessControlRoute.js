const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const {
  upsertRolePermission,
  listRolePermissions,
  upsertDataScopePolicy,
  listDataScopePolicies,
  listSessionSecurityEvents,
  upsertFieldAccessPolicy,
  listFieldAccessPolicies,
} = require("../controllers/accessControlController");

const router = express.Router();

router
  .route("/permissions")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("access_control", "write"),
    idempotencyMiddleware,
    upsertRolePermission
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("access_control", "read"),
    listRolePermissions
  );

router
  .route("/scopes")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("access_control", "write"),
    idempotencyMiddleware,
    upsertDataScopePolicy
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("access_control", "read"),
    listDataScopePolicies
  );

router
  .route("/session-events")
  .get(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("access_control", "read"),
    listSessionSecurityEvents
  );

router
  .route("/field-policies")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("access_control", "write"),
    idempotencyMiddleware,
    upsertFieldAccessPolicy
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("access_control", "read"),
    listFieldAccessPolicies
  );

module.exports = router;

const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const { requireHighRiskApproval } = require("../middlewares/highRiskApprovalGuard");
const {
  createOrganization,
  listOrganizations,
  updateOrganization,
  createRegion,
  listRegions,
  updateRegion,
  createStore,
  updateStore,
  previewStoreProvisioning,
  listStores,
  getResolvedStoreSettings,
} = require("../controllers/organizationController");
const {
  listVerticalTemplateCatalog,
  listStoreVerticalProfiles,
  getStoreVerticalProfile,
  upsertStoreVerticalProfile,
} = require("../controllers/verticalTemplateController");

const router = express.Router();

router
  .route("/orgs")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("organization", "write"),
    idempotencyMiddleware,
    requireHighRiskApproval({
      actionType: "ORG_STRUCTURE_MUTATION",
      policyCode: "ORG_STRUCTURE_MUTATION",
      requirePolicy: true,
      resourceType: "Organization",
      resourceIdResolver: (req) => req.body?.code,
    }),
    createOrganization
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("organization", "read"),
    listOrganizations
  );

router
  .route("/orgs/:id")
  .patch(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("organization", "write"),
    idempotencyMiddleware,
    updateOrganization
  );

router
  .route("/regions")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("organization", "write"),
    idempotencyMiddleware,
    requireHighRiskApproval({
      actionType: "ORG_STRUCTURE_MUTATION",
      policyCode: "ORG_STRUCTURE_MUTATION",
      requirePolicy: true,
      resourceType: "Region",
      resourceIdResolver: (req) => req.body?.code,
    }),
    createRegion
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("organization", "read"),
    listRegions
  );

router
  .route("/regions/:id")
  .patch(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("organization", "write"),
    idempotencyMiddleware,
    updateRegion
  );

router
  .route("/stores")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("organization", "write"),
    idempotencyMiddleware,
    requireHighRiskApproval({
      actionType: "ORG_STRUCTURE_MUTATION",
      policyCode: "ORG_STRUCTURE_MUTATION",
      requirePolicy: true,
      resourceType: "Store",
      resourceIdResolver: (req) => req.body?.locationId || req.body?.code,
    }),
    createStore
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("organization", "read"),
    listStores
  );

router
  .route("/stores/provisioning-preview")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("organization", "read"),
    previewStoreProvisioning
  );

router
  .route("/stores/:id/resolved-settings")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("organization", "read"),
    getResolvedStoreSettings
  );

router
  .route("/stores/:id")
  .patch(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("organization", "write"),
    idempotencyMiddleware,
    updateStore
  );

router
  .route("/vertical-templates/catalog")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("organization", "read"),
    listVerticalTemplateCatalog
  );

router
  .route("/vertical-templates/profiles")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("organization", "read"),
    listStoreVerticalProfiles
  );

router
  .route("/vertical-templates/profiles/:locationId")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("organization", "read"),
    getStoreVerticalProfile
  )
  .put(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("organization", "write"),
    idempotencyMiddleware,
    upsertStoreVerticalProfile
  );

module.exports = router;

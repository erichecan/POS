const express = require("express");
const {
  isVerifiedUser,
  requireRoles,
  requirePermission,
  requireDataScope,
} = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const { requireHighRiskApproval } = require("../middlewares/highRiskApprovalGuard");
const {
  listAuditLogs,
  createComplianceExportRequest,
  listComplianceExportRequests,
  updateComplianceExportRequestStatus,
  getMaskedMemberProfile,
  upsertHighRiskApprovalPolicy,
  listHighRiskApprovalPolicies,
  createHighRiskApprovalRequest,
  listHighRiskApprovalRequests,
  approveHighRiskApprovalRequest,
  rejectHighRiskApprovalRequest,
  upsertCompliancePolicyPack,
  listCompliancePolicyPacks,
  executeCompliancePolicyPack,
} = require("../controllers/complianceController");

const router = express.Router();

router
  .route("/audit-logs")
  .get(isVerifiedUser, requireRoles("Admin"), requirePermission("compliance", "read"), listAuditLogs);

router
  .route("/export-requests")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("compliance", "write"),
    requireDataScope("compliance"),
    idempotencyMiddleware,
    requireHighRiskApproval({
      actionType: "COMPLIANCE_EXPORT_REQUEST",
      policyCode: "COMPLIANCE_EXPORT_REQUEST",
      requirePolicy: true,
      resourceType: "ComplianceExportRequest",
      resourceIdResolver: (req) => req.body?.subjectId,
    }),
    createComplianceExportRequest
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("compliance", "read"),
    requireDataScope("compliance"),
    listComplianceExportRequests
  );

router
  .route("/export-requests/:id/status")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("compliance", "write"),
    requireDataScope("compliance"),
    idempotencyMiddleware,
    updateComplianceExportRequestStatus
  );

router
  .route("/members/:id/masked")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("compliance", "read"),
    getMaskedMemberProfile
  );

router
  .route("/high-risk/policies")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("high_risk", "write"),
    idempotencyMiddleware,
    upsertHighRiskApprovalPolicy
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("high_risk", "read"),
    listHighRiskApprovalPolicies
  );

router
  .route("/high-risk/requests")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("high_risk", "write"),
    requireDataScope("high_risk"),
    idempotencyMiddleware,
    createHighRiskApprovalRequest
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("high_risk", "read"),
    requireDataScope("high_risk"),
    listHighRiskApprovalRequests
  );

router
  .route("/high-risk/requests/:id/approve")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("high_risk", "write"),
    idempotencyMiddleware,
    approveHighRiskApprovalRequest
  );

router
  .route("/high-risk/requests/:id/reject")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("high_risk", "write"),
    idempotencyMiddleware,
    rejectHighRiskApprovalRequest
  );

router
  .route("/policy-packs")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("compliance", "write"),
    idempotencyMiddleware,
    upsertCompliancePolicyPack
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("compliance", "read"),
    listCompliancePolicyPacks
  );

router
  .route("/policy-packs/:id/execute")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("compliance", "write"),
    idempotencyMiddleware,
    executeCompliancePolicyPack
  );

module.exports = router;

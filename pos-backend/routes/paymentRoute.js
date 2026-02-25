const express = require("express");
const router = express.Router();
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { requireHighRiskApproval } = require("../middlewares/highRiskApprovalGuard");
const {
  createOrder,
  verifyPayment,
  retryVerifyPayment,
  refundPayment,
  listRefundApprovals,
  approveRefundApproval,
  rejectRefundApproval,
  listPayments,
  listPaymentReconciliationGaps,
  repairOrderPaymentLink,
  getPaymentStats,
  webHookVerification,
} = require("../controllers/paymentController");
const { idempotencyMiddleware } = require("../middlewares/idempotency");

router.route("/").get(
  isVerifiedUser,
  requireRoles("Admin", "Cashier"),
  requirePermission("payments", "read"),
  listPayments
);
router.route("/stats").get(
  isVerifiedUser,
  requireRoles("Admin", "Cashier"),
  requirePermission("payments", "stats"),
  getPaymentStats
);
router.route("/reconciliation/gaps").get(
  isVerifiedUser,
  requireRoles("Admin", "Cashier"),
  requirePermission("payments", "reconcile"),
  listPaymentReconciliationGaps
);
router.route("/reconciliation/repair-order").post(
  isVerifiedUser,
  requireRoles("Admin", "Cashier"),
  requirePermission("payments", "reconcile"),
  idempotencyMiddleware,
  repairOrderPaymentLink
);
router.route("/create-order").post(
  isVerifiedUser,
  requireRoles("Admin", "Cashier"),
  requirePermission("payments", "write"),
  idempotencyMiddleware,
  createOrder
);
router.route("/verify-payment").post(
  isVerifiedUser,
  requireRoles("Admin", "Cashier"),
  requirePermission("payments", "verify"),
  idempotencyMiddleware,
  verifyPayment
);
router.route("/retry-verify").post(
  isVerifiedUser,
  requireRoles("Admin", "Cashier"),
  requirePermission("payments", "verify"),
  idempotencyMiddleware,
  retryVerifyPayment
);
router.route("/refunds").post(
  isVerifiedUser,
  requireRoles("Admin", "Cashier"),
  requirePermission("payments", "refund"),
  idempotencyMiddleware,
  refundPayment
);
router.route("/refunds/approvals").get(
  isVerifiedUser,
  requireRoles("Admin", "Cashier"),
  requirePermission("payments", "refund"),
  listRefundApprovals
);
router.route("/refunds/approvals/:approvalId/approve").post(
  isVerifiedUser,
  requireRoles("Admin", "Cashier"),
  requirePermission("payments", "refund"),
  idempotencyMiddleware,
  requireHighRiskApproval({
    actionType: "PAYMENT_REFUND_EXECUTE",
    policyCode: "PAYMENT_REFUND_EXECUTE",
    requirePolicy: true,
    resourceType: "PaymentRefundApproval",
    resourceIdResolver: (req) => req.params?.approvalId,
    requireApprovalWhenAmountUnknown: true,
  }),
  approveRefundApproval
);
router.route("/refunds/approvals/:approvalId/reject").post(
  isVerifiedUser,
  requireRoles("Admin", "Cashier"),
  requirePermission("payments", "refund"),
  idempotencyMiddleware,
  rejectRefundApproval
);
router.route("/webhook-verification").post(webHookVerification);

module.exports = router;

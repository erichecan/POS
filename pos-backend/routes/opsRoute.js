const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const {
  getSloSnapshot,
  runEscalationSweep,
  listIncidents,
  acknowledgeIncident,
  resolveIncident,
} = require("../controllers/opsController");

const router = express.Router();

router
  .route("/slo")
  .get(isVerifiedUser, requireRoles("Admin", "Cashier"), requirePermission("ops", "read"), getSloSnapshot);

router
  .route("/escalations/run")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("ops", "write"),
    idempotencyMiddleware,
    runEscalationSweep
  );

router
  .route("/incidents")
  .get(isVerifiedUser, requireRoles("Admin", "Cashier"), requirePermission("ops", "read"), listIncidents);

router
  .route("/incidents/:id/ack")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("ops", "write"),
    idempotencyMiddleware,
    acknowledgeIncident
  );

router
  .route("/incidents/:id/resolve")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier"),
    requirePermission("ops", "write"),
    idempotencyMiddleware,
    resolveIncident
  );

module.exports = router;

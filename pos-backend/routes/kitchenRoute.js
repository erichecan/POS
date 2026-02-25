const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const {
  bootstrapStations,
  upsertStation,
  listStations,
  listTickets,
  listTicketReplayEvents,
  getTicketById,
  updateTicketStatus,
  updateTicketPriority,
  updateTicketItemStatus,
  requestTicketExpedite,
  confirmTicketHandoff,
  getKitchenStats,
} = require("../controllers/kitchenController");

const router = express.Router();

router
  .route("/stations/bootstrap")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("kitchen", "write"),
    idempotencyMiddleware,
    bootstrapStations
  );

router
  .route("/stations")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("kitchen", "write"),
    idempotencyMiddleware,
    upsertStation
  )
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("kitchen", "read"),
    listStations
  );

router
  .route("/tickets")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("kitchen", "read"),
    listTickets
  );

router
  .route("/events/replay")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("kitchen", "read"),
    listTicketReplayEvents
  );

router
  .route("/stats")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("kitchen", "read"),
    getKitchenStats
  );

router
  .route("/tickets/:id")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("kitchen", "read"),
    getTicketById
  );

router
  .route("/tickets/:id/status")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("kitchen", "write"),
    idempotencyMiddleware,
    updateTicketStatus
  );

router
  .route("/tickets/:id/priority")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("kitchen", "write"),
    idempotencyMiddleware,
    updateTicketPriority
  );

router
  .route("/tickets/:id/items/:itemId/status")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("kitchen", "write"),
    idempotencyMiddleware,
    updateTicketItemStatus
  );

router
  .route("/tickets/:id/expedite")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("kitchen", "write"),
    idempotencyMiddleware,
    requestTicketExpedite
  );

router
  .route("/tickets/:id/handoff")
  .post(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("kitchen", "write"),
    idempotencyMiddleware,
    confirmTicketHandoff
  );

module.exports = router;

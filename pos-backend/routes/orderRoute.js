const express = require("express");
const {
  addOrder,
  getOrders,
  getOrderById,
  updateOrder,
  updateOrderItems,
  settleOrder,
  getReceiptTemplate,
  upsertReceiptTemplate,
} = require("../controllers/orderController");
const {
  listOrderTransitions,
  resolveOrderConflict,
} = require("../controllers/orderWorkflowController");
const {
  isVerifiedUser,
  requireRoles,
  requirePermission,
  requireDataScope,
} = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const router = express.Router();


router.route("/").post(
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("orders", "write"),
  requireDataScope("orders"),
  idempotencyMiddleware,
  addOrder
);
router.route("/").get(
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("orders", "read"),
  requireDataScope("orders"),
  getOrders
);
router.route("/workflow/transitions").get(
  isVerifiedUser,
  requireRoles("Admin", "Cashier"),
  requirePermission("order_workflow", "read"),
  listOrderTransitions
);
router.route("/workflow/conflicts/:eventId/resolve").post(
  isVerifiedUser,
  requireRoles("Admin", "Cashier"),
  requirePermission("order_workflow", "write"),
  idempotencyMiddleware,
  resolveOrderConflict
);
router.route("/receipt-template").get(
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("orders", "read"),
  requireDataScope("orders"),
  getReceiptTemplate
);
router.route("/receipt-template").put(
  isVerifiedUser,
  requireRoles("Admin", "Cashier"),
  requirePermission("orders", "write"),
  requireDataScope("orders"),
  idempotencyMiddleware,
  upsertReceiptTemplate
);
router.route("/:id").get(
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("orders", "read"),
  getOrderById
);
router.route("/:id").put(
  isVerifiedUser,
  requireRoles("Admin", "Cashier"),
  requirePermission("orders", "write"),
  idempotencyMiddleware,
  updateOrder
);
router.route("/:id/items").put(
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("orders", "write"),
  requireDataScope("orders"),
  idempotencyMiddleware,
  updateOrderItems
);
router.route("/:id/settle").post(
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("orders", "write"),
  requireDataScope("orders"),
  idempotencyMiddleware,
  settleOrder
);

module.exports = router;

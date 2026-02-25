const express = require("express");
const {
  addTable,
  getTables,
  updateTable,
  transferTableOrder,
  mergeTableOrders,
  splitTableOrder,
  splitTableOrderBySeat,
  unmergeTableOrders,
} = require("../controllers/tableController");
const router = express.Router();
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification")
const { idempotencyMiddleware } = require("../middlewares/idempotency");
 
router.route("/").post(
  isVerifiedUser,
  requireRoles("Admin"),
  requirePermission("tables", "write"),
  idempotencyMiddleware,
  addTable
);
router.route("/").get(
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("tables", "read"),
  getTables
);
router.route("/:id").put(
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("tables", "write"),
  idempotencyMiddleware,
  updateTable
);
router.route("/transfer").post(
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("tables", "write"),
  idempotencyMiddleware,
  transferTableOrder
);
router.route("/merge").post(
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("tables", "write"),
  idempotencyMiddleware,
  mergeTableOrders
);
router.route("/split").post(
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("tables", "write"),
  idempotencyMiddleware,
  splitTableOrder
);
router.route("/split-by-seat").post(
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("tables", "write"),
  idempotencyMiddleware,
  splitTableOrderBySeat
);
router.route("/unmerge").post(
  isVerifiedUser,
  requireRoles("Admin", "Waiter", "Cashier"),
  requirePermission("tables", "write"),
  idempotencyMiddleware,
  unmergeTableOrders
);

module.exports = router;

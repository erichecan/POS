// 2026-02-26T19:55:00+08:00: Routes for menu category CRUD
const express = require("express");
const { isVerifiedUser, requireRoles, requirePermission } = require("../middlewares/tokenVerification");
const {
  createCategory,
  listCategories,
  updateCategory,
  deleteCategory,
  reorderCategories,
} = require("../controllers/menuCategoryController");

const router = express.Router();

router
  .route("/")
  .get(
    isVerifiedUser,
    requireRoles("Admin", "Cashier", "Waiter"),
    requirePermission("menu", "read"),
    listCategories
  )
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("menu", "write"),
    createCategory
  );

router
  .route("/reorder")
  .post(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("menu", "write"),
    reorderCategories
  );

router
  .route("/:id")
  .put(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("menu", "write"),
    updateCategory
  )
  .delete(
    isVerifiedUser,
    requireRoles("Admin"),
    requirePermission("menu", "write"),
    deleteCategory
  );

module.exports = router;

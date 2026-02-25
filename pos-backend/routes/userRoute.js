const express = require("express");
const { register, login, getUserData, logout } = require("../controllers/userController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { idempotencyMiddleware } = require("../middlewares/idempotency");
const router = express.Router();


// Authentication Routes
router.route("/register").post(idempotencyMiddleware, register);
router.route("/login").post(login);
router.route("/logout").post(isVerifiedUser, idempotencyMiddleware, logout)

router.route("/").get(isVerifiedUser , getUserData);

module.exports = router;

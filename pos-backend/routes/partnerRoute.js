const express = require("express");
const { partnerApiAuth } = require("../middlewares/partnerAuth");
const { listPartnerOrders } = require("../controllers/partnerController");

const router = express.Router();

router
  .route("/orders")
  .get(partnerApiAuth("orders:read"), listPartnerOrders);

module.exports = router;

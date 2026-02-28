const controller = require("../controllers/PhonePayGateway");
const express = require("express");
const router = express.Router();

router.post("/PhonePayGateway", controller.PhonePayGateway);
router.post("/initiate-sdk", controller.initiateSdkPayment);
router.post("/PhonePayGatewayStatus", controller.PhonePayGatewayStatus);
router.get(
  "/PhonePayGatewayCheckStatus",
  controller.PhonePayGatewayCheckStatus,
);

module.exports = router;

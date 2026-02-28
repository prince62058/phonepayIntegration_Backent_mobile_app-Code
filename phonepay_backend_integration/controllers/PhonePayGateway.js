const {
  StandardCheckoutClient,
  Env,
  CreateSdkOrderRequest,
  StandardCheckoutPayRequest,
  MetaInfo,
} = require("pg-sdk-node");
const { randomUUID } = require("crypto");
const logger = require("../../tmp/logger");
const orderModel = require("../models/orderModel");
const eCommerceOrderModel = require("../models/ecommerce/orderModel");

// ========== PhonePe v2 SDK Client (singleton) ==========
let _client = null;

function getClient() {
  if (_client) return _client;

  const clientId = process.env.CLIENT_ID;
  const clientSecret = process.env.CLIENT_SECRET;
  const clientVersion = 1; // from PhonePe dashboard (Client Version column)
  const env = Env.PRODUCTION;

  _client = StandardCheckoutClient.getInstance(
    clientId,
    clientSecret,
    clientVersion,
    env,
  );
  console.log("[PhonePe] SDK client initialized");
  return _client;
}

// ========== PhonePe Checkout (WebView / redirect flow) ==========
// Used by: orderDetail and Booking screens via OpenPhonepayApi
exports.PhonePayGateway = async (req, res) => {
  try {
    const { orderId, userId, amount, mobileNumber } = req.body;

    if (!orderId)
      return res
        .status(400)
        .json({ success: false, message: "orderId is required" });
    if (!amount)
      return res
        .status(400)
        .json({ success: false, message: "amount is required" });
    if (!userId)
      return res
        .status(400)
        .json({ success: false, message: "userId is required" });

    const client = getClient();
    // Use a unique ID for each attempt to avoid PhonePe "Invalid transaction id" (duplicate) errors
    const merchantOrderId = `${orderId}_${Date.now()}`;
    const amountInPaise = Math.round(Number(amount) * 100);

    // Save this unique ID to the order so we can look it up during status check
    await Promise.all([
      orderModel.findByIdAndUpdate(orderId, {
        transactionRef: merchantOrderId,
      }),
      eCommerceOrderModel.findByIdAndUpdate(orderId, {
        transactionRef: merchantOrderId,
      }),
    ]);

    const metaInfo = MetaInfo.builder()
      .udf1(orderId)
      .udf2(userId)
      .udf3(String(mobileNumber || ""))
      .build();

    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amountInPaise)
      .metaInfo(metaInfo)
      .redirectUrl(
        `https://essindiaonline.com/paymentstauspage?merchantOrderId=${merchantOrderId}&orderId=${orderId}`,
      )
      .build();

    logger.info(
      `[PhonePe] Initiating pay (redirect flow): ${merchantOrderId} for Order: ${orderId}`,
    );
    const response = await client.pay(request);
    logger.info(`[PhonePe] Pay response: ${JSON.stringify(response)}`);

    return res.status(200).json({
      success: true,
      data: {
        success: true,
        data: {
          merchantTransactionId: merchantOrderId,
          instrumentResponse: {
            redirectInfo: { url: response.redirectUrl },
          },
        },
      },
    });
  } catch (error) {
    console.error("[PhonePe] PhonePayGateway Error:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: error?.message || "Payment initiation failed",
    });
  }
};

// ========== Create SDK Order (for React Native native SDK flow) ==========
// Used by: Payment and bookingDetail screens via PhonepeCheckout()
exports.initiateSdkPayment = async (req, res) => {
  try {
    const { amount, mobileNumber, orderId: appOrderId, userId } = req.body;

    if (!amount)
      return res
        .status(400)
        .json({ success: false, message: "amount is required" });

    const client = getClient();
    // Use a unique ID for each attempt to avoid PhonePe "Invalid transaction id" (duplicate) errors
    const merchantOrderId = `${appOrderId}_${Date.now()}`;
    const amountInPaise = Math.round(Number(amount) * 100);

    // Save this unique ID to the order so we can look it up during status check
    await Promise.all([
      orderModel.findByIdAndUpdate(appOrderId, {
        transactionRef: merchantOrderId,
      }),
      eCommerceOrderModel.findByIdAndUpdate(appOrderId, {
        transactionRef: merchantOrderId,
      }),
    ]);

    const request = CreateSdkOrderRequest.StandardCheckoutBuilder()
      .merchantOrderId(merchantOrderId)
      .amount(amountInPaise)
      .redirectUrl(
        `https://essindiaonline.com/paymentstauspage?merchantOrderId=${merchantOrderId}&orderId=${
          appOrderId || ""
        }`,
      )
      .build();

    console.log("[PhonePe SDK] Creating SDK order:", merchantOrderId);
    const response = await client.createSdkOrder(request);
    console.log(
      "[PhonePe SDK] createSdkOrder response:",
      JSON.stringify(response),
    );

    // response.token is the orderToken needed by the mobile SDK
    if (!response.token) {
      console.error("[PhonePe SDK] No token in response:", response);
      return res.status(500).json({
        success: false,
        message: "PhonePe did not return a token. Check your credentials.",
      });
    }

    return res.status(200).json({
      success: true,
      token: response.token,
      orderId: response.orderId || merchantOrderId,
      merchantOrderId,
      merchantId: process.env.CLIENT_ID || process.env.MERCHANT_ID,
    });
  } catch (error) {
    console.error(
      "[PhonePe SDK] initiateSdkPayment Error:",
      error?.message || error,
    );
    return res.status(500).json({
      success: false,
      message: error?.message || "SDK payment initiation failed",
    });
  }
};

// ========== Payment Status Callback (redirect from PhonePe) ==========
exports.PhonePayGatewayStatus = async (req, res) => {
  const { merchantTransactionId, orderId, merchantOrderId } = req.query;
  const id = merchantOrderId || merchantTransactionId;
  res.redirect(
    `https://essindiaonline.com/paymentstauspage?merchantOrderId=${id}&orderId=${orderId}`,
  );
};

// ========== Check Order Status ==========
exports.PhonePayGatewayCheckStatus = async (req, res) => {
  const { merchantTransactionId } = req.query;
  if (!merchantTransactionId) {
    return res.status(400).json({
      success: false,
      message: "merchantTransactionId is required",
    });
  }

  try {
    const client = getClient();

    // Look up the order to find the actual unique merchantTransactionId (transactionRef)
    // The incoming merchantTransactionId is the app's orderId
    const [order, eOrder] = await Promise.all([
      orderModel.findById(merchantTransactionId),
      eCommerceOrderModel.findById(merchantTransactionId),
    ]);

    const actualLookupId =
      order?.transactionRef || eOrder?.transactionRef || merchantTransactionId;

    const response = await client.getOrderStatus(actualLookupId);
    logger.info(
      `[PhonePe] Order status for ${merchantTransactionId} (Ref: ${actualLookupId}): ${JSON.stringify(
        response,
      )}`,
    );

    return res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    logger.error(
      `[PhonePe] CheckStatus Error for ${merchantTransactionId}: ${
        error?.message || error
      }`,
    );
    return res.status(500).json({
      success: false,
      message: error?.message || "Failed to check payment status",
    });
  }
};

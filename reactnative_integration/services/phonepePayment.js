import {Alert} from 'react-native';
import http from './api';
import PhonePePaymentSDK from 'react-native-phonepe-pg';

const MERCHANT_ID = 'M22Q3CHJHEYP0';

/**
 * PhonePe v2 SDK Checkout (Native SDK flow)
 *
 * Flow:
 * 1. Call backend /initiate-sdk → get { token, orderId, merchantId }
 * 2. Init PhonePe SDK with PRODUCTION env + merchantId
 * 3. Build request payload: { orderId, merchantId, token, paymentMode: { type: 'PAY_PAGE' } }
 * 4. Call startTransaction(JSON.stringify(payload), null)
 * 5. Handle result: status = SUCCESS | FAILURE | INTERRUPTED
 */
export const PhonepeCheckout = async (body, responseCallBack) => {
  try {
    console.log('[PhonePe] Initiating SDK payment for orderId:', body.orderId);

    // Step 1: Get token from backend
    const response = await http.post('initiate-sdk', {
      amount: body.amount,
      mobileNumber: body.mobileNumber || '',
      userId: body.userId || '',
      orderId: body.orderId,
    });

    console.log('[PhonePe] Backend response:', JSON.stringify(response.data));

    if (!response.data.success || !response.data.token) {
      const errMsg = response.data.message || 'Failed to create payment order';
      Alert.alert('Payment Error', errMsg);
      responseCallBack({funcStatus: false, error: errMsg});
      return;
    }

    const {token, orderId: phonepeOrderId, merchantId} = response.data;
    // Use merchantId from backend (from env), fallback to hardcoded
    const resolvedMerchantId = merchantId || MERCHANT_ID;

    // Step 2: Init SDK
    // flowId: any alphanumeric string for tracking (use userId or orderId)
    const flowId =
      (body.userId || body.orderId || 'flow')
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 20) || 'essflow';
    console.log('[PhonePe] Initializing SDK...');

    await PhonePePaymentSDK.init(
      'PRODUCTION',
      resolvedMerchantId,
      flowId,
      true,
    );
    console.log('[PhonePe] SDK initialized');

    // Step 3: Build payload as JSON STRING (not base64)
    const payload = {
      orderId: phonepeOrderId,
      merchantId: resolvedMerchantId,
      token: token,
      paymentMode: {
        type: 'PAY_PAGE',
      },
    };

    const requestBody = JSON.stringify(payload);
    console.log('[PhonePe] startTransaction payload:', requestBody);

    // Step 4: Start transaction
    const result = await PhonePePaymentSDK.startTransaction(requestBody, null);
    console.log('[PhonePe] Transaction result:', JSON.stringify(result));

    // Step 5: Handle result
    const status = (result?.status || '').toUpperCase();

    if (status === 'SUCCESS') {
      responseCallBack({
        funcStatus: true,
        status: 'SUCCESS',
        merchantTransactionId: phonepeOrderId,
      });
    } else if (status === 'INTERRUPTED') {
      responseCallBack({
        funcStatus: false,
        status: 'INTERRUPTED',
        error: 'Payment was interrupted or cancelled',
      });
    } else {
      responseCallBack({
        funcStatus: false,
        status: 'FAILURE',
        error: result?.error || 'Payment failed',
      });
    }
  } catch (error) {
    console.error('[PhonePe] Error:', error?.response?.data || error.message);
    const errMsg =
      error?.response?.data?.message ||
      error?.message ||
      'Payment initiation failed';
    Alert.alert('Payment Error', errMsg);
    responseCallBack({funcStatus: false, error: errMsg});
  }
};

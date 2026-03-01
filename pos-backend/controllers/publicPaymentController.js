/**
 * 公开支付 API - Phase C1 在线订餐 Stripe 支付
 * 2026-02-28T16:05:00+08:00 消费者无需登录即可创建 checkout、验证支付
 */
const createHttpError = require("http-errors");
const Stripe = require("stripe");
const config = require("../config/config");
const Order = require("../models/orderModel");
const { verifySessionWithGateway } = require("../utils/paymentGatewayRouter");

const normalizeGatewayCodeLocal = (code) => `${code || "STRIPE"}`.trim().toUpperCase();

const resolveAppOrigin = (req) => {
  const headerOrigin = `${req.headers.origin || ""}`.trim();
  const fallbackOrigin = `${config.frontendUrl || "http://localhost:5173"}`.trim();
  return (headerOrigin || fallbackOrigin).replace(/\/$/, "");
};

/**
 * POST /api/public/payment/create-checkout
 * 为已有订单创建 Stripe checkout session
 * body: { orderId, successUrl?, cancelUrl? }
 */
const createCheckoutForOrder = async (req, res, next) => {
  try {
    const orderId = `${req.body.orderId || ""}`.trim();
    if (!orderId) {
      return next(createHttpError(400, "orderId is required."));
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return next(createHttpError(404, "Order not found."));
    }

    if (order.paymentMethod === "Online") {
      return next(createHttpError(409, "Order is already paid."));
    }

    const amountMinor = Math.round(Number(order.bills?.totalWithTax || 0) * 100);
    if (amountMinor < 50) {
      return next(createHttpError(400, "Order amount too small for payment."));
    }

    const appOrigin = resolveAppOrigin(req);
    const successUrl = req.body.successUrl || `${appOrigin}/order/status/${orderId}?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = req.body.cancelUrl || `${appOrigin}/order?cancelled=1`;

    // 使用 paymentGatewayRouter 需支持自定义 success/cancel url，检查其接口
    const stripe = new Stripe(config.stripeSecretKey);
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "eur",
            unit_amount: amountMinor,
            product_data: {
              name: "Online Order Payment",
              description: `Order #${orderId}`,
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        orderId: String(orderId),
        sourceType: "ONLINE_ORDER",
        locationId: `${order.locationId || "default"}`.trim(),
      },
    });

    return res.status(200).json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * POST /api/public/payment/verify
 * 验证 Stripe 支付并更新订单
 * body: { session_id }
 */
const verifyPublicPayment = async (req, res, next) => {
  try {
    const sessionId = `${req.body?.session_id || req.body?.stripe_session_id || ""}`.trim();
    if (!sessionId) {
      return next(createHttpError(400, "session_id is required."));
    }

    const verificationResult = await verifySessionWithGateway({
      sessionId,
      gatewayCode: normalizeGatewayCodeLocal(req.body?.gatewayCode),
    });

    const orderId =
      verificationResult.raw?.session?.metadata?.orderId || `${req.body.orderId || ""}`.trim();
    if (!orderId) {
      return next(createHttpError(400, "orderId is required (from metadata or body)."));
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return next(createHttpError(404, "Order not found."));
    }

    order.paymentMethod = "Online";
    order.paymentData = {
      ...(order.paymentData || {}),
      stripe_session_id: sessionId,
      stripe_payment_intent_id: verificationResult.paymentId,
      stripe_charge_id: verificationResult.chargeId,
    };
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully.",
      data: {
        orderId: order._id,
        orderStatus: order.orderStatus,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createCheckoutForOrder,
  verifyPublicPayment,
};

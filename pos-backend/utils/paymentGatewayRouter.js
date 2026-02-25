const createHttpError = require("http-errors");
const Stripe = require("stripe");
const crypto = require("crypto");
const config = require("../config/config");

const SUPPORTED_GATEWAYS = ["STRIPE", "MOCK_STRIPE"];

const normalizeGatewayCode = (gatewayCode) => `${gatewayCode || ""}`.trim().toUpperCase();

const parseGatewayOrder = (rawOrder) => {
  const list = `${rawOrder || ""}`
    .split(",")
    .map((item) => normalizeGatewayCode(item))
    .filter(Boolean);
  const deduped = Array.from(new Set(list));
  return deduped.filter((code) => SUPPORTED_GATEWAYS.includes(code));
};

const resolveGatewaySequence = (preferredGatewayCode) => {
  const preferred = normalizeGatewayCode(preferredGatewayCode);
  const configured = parseGatewayOrder(config.paymentGatewayOrder);
  const ordered = configured.length > 0 ? configured : ["STRIPE", "MOCK_STRIPE"];

  if (preferred && SUPPORTED_GATEWAYS.includes(preferred)) {
    const withoutPreferred = ordered.filter((code) => code !== preferred);
    return [preferred, ...withoutPreferred];
  }

  return ordered;
};

const createStripeClient = () => {
  if (!config.stripeSecretKey) {
    throw createHttpError(500, "Stripe secret key is not configured.");
  }
  return new Stripe(config.stripeSecretKey);
};

const toUpperCurrency = (currency) => `${currency || "eur"}`.trim().toUpperCase();
const toAmount = (amountMinor) => Number((Number(amountMinor || 0) / 100).toFixed(2));

const createStripeCheckout = async ({ amountMinor, currency, appOrigin, metadata }) => {
  const stripe = createStripeClient();
  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency,
          unit_amount: amountMinor,
          product_data: {
            name: "POS Order Payment",
            description: "Secure payment for order checkout",
          },
        },
      },
    ],
    success_url: `${appOrigin}/menu?stripe_status=success&session_id={CHECKOUT_SESSION_ID}&gateway=STRIPE`,
    cancel_url: `${appOrigin}/menu?stripe_status=cancelled&gateway=STRIPE`,
    metadata,
  });

  return {
    gatewayCode: "STRIPE",
    sessionId: session.id,
    checkoutUrl: session.url,
    amountMinor,
    currency: toUpperCurrency(currency),
  };
};

const verifyStripeSession = async ({ stripeSessionId }) => {
  const stripe = createStripeClient();
  const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
  if (!session) {
    throw createHttpError(404, "Stripe checkout session not found.");
  }

  if (`${session.payment_status || ""}`.toLowerCase() !== "paid") {
    throw createHttpError(400, "Stripe checkout session is not paid.");
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  if (!paymentIntentId) {
    throw createHttpError(400, "Missing payment_intent on Stripe session.");
  }

  const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
    expand: ["latest_charge"],
  });

  const latestCharge = paymentIntent?.latest_charge;
  const chargeId = typeof latestCharge === "string" ? latestCharge : latestCharge?.id;

  return {
    gatewayCode: "STRIPE",
    sessionId: session.id,
    paymentId: paymentIntent.id,
    chargeId,
    amount: toAmount(paymentIntent.amount_received || paymentIntent.amount || 0),
    currency: toUpperCurrency(paymentIntent.currency || session.currency || "eur"),
    status: `${paymentIntent.status || ""}`.trim().toLowerCase() || "pending",
    method:
      paymentIntent.payment_method_types?.[0] ||
      (typeof paymentIntent.payment_method === "string" ? paymentIntent.payment_method : "card"),
    email: session.customer_details?.email || paymentIntent.receipt_email,
    contact: session.customer_details?.phone,
    paymentCapturedAt: paymentIntent.created ? new Date(paymentIntent.created * 1000) : undefined,
    verified: true,
    raw: { session, paymentIntent },
  };
};

const createMockCheckout = async ({ amountMinor, currency, appOrigin }) => {
  if (!config.paymentMockEnabled) {
    throw createHttpError(503, "Mock payment gateway is disabled.");
  }

  const seed = `${Date.now()}_${Math.random()}`.replace(".", "");
  const sessionId = `cs_mock_${toUpperCurrency(currency)}_${amountMinor}_${seed}`;
  const checkoutUrl = `${appOrigin}/menu?stripe_status=success&session_id=${encodeURIComponent(
    sessionId
  )}&gateway=MOCK_STRIPE`;

  return {
    gatewayCode: "MOCK_STRIPE",
    sessionId,
    checkoutUrl,
    amountMinor,
    currency: toUpperCurrency(currency),
  };
};

const verifyMockSession = async ({ sessionId }) => {
  if (!config.paymentMockEnabled) {
    throw createHttpError(503, "Mock payment gateway is disabled.");
  }

  if (!sessionId || !sessionId.startsWith("cs_mock_")) {
    throw createHttpError(404, "Mock session not found.");
  }

  const match = /^cs_mock_([A-Z]{3})_(\d+)_/.exec(sessionId);
  const currency = match?.[1] || "EUR";
  const amountMinor = Number(match?.[2] || 0);
  const hash = crypto.createHash("sha256").update(sessionId).digest("hex").slice(0, 18);
  const paymentId = `pi_mock_${hash}`;
  const chargeId = `ch_mock_${hash}`;

  return {
    gatewayCode: "MOCK_STRIPE",
    sessionId,
    paymentId,
    chargeId,
    amount: toAmount(amountMinor),
    currency: toUpperCurrency(currency),
    status: "succeeded",
    method: "mock_card",
    email: "mock@example.com",
    contact: "",
    paymentCapturedAt: new Date(),
    verified: true,
    raw: {},
  };
};

const detectGatewayFromSessionId = (sessionId, fallbackGatewayCode = "STRIPE") => {
  const normalized = `${sessionId || ""}`;
  if (normalized.startsWith("cs_mock_")) {
    return "MOCK_STRIPE";
  }
  return normalizeGatewayCode(fallbackGatewayCode) || "STRIPE";
};

const createCheckoutSessionWithFailover = async ({
  preferredGatewayCode,
  amountMinor,
  currency,
  appOrigin,
  metadata,
}) => {
  const sequence = resolveGatewaySequence(preferredGatewayCode);
  const attempts = [];
  const failoverEnabled = Boolean(config.paymentGatewayFailoverEnabled);

  for (let i = 0; i < sequence.length; i += 1) {
    const gatewayCode = sequence[i];
    try {
      if (gatewayCode === "STRIPE") {
        const result = await createStripeCheckout({ amountMinor, currency, appOrigin, metadata });
        return { ...result, attempts };
      }

      if (gatewayCode === "MOCK_STRIPE") {
        const result = await createMockCheckout({ amountMinor, currency, appOrigin, metadata });
        return { ...result, attempts };
      }
    } catch (error) {
      attempts.push({
        gatewayCode,
        message: error.message,
      });
      if (!failoverEnabled) {
        throw error;
      }
    }
  }

  throw createHttpError(
    502,
    `All payment gateways failed${attempts.length ? `: ${attempts.map((a) => a.gatewayCode).join(", ")}` : "."}`
  );
};

const verifySessionWithGateway = async ({ sessionId, gatewayCode }) => {
  const resolvedGateway = normalizeGatewayCode(gatewayCode) || detectGatewayFromSessionId(sessionId);

  if (resolvedGateway === "STRIPE") {
    return verifyStripeSession({ stripeSessionId: sessionId });
  }
  if (resolvedGateway === "MOCK_STRIPE") {
    return verifyMockSession({ sessionId });
  }

  throw createHttpError(400, `Unsupported gateway: ${resolvedGateway}`);
};

const refundWithGateway = async ({ paymentId, gatewayCode, amount, reason }) => {
  const resolvedGateway = normalizeGatewayCode(gatewayCode);

  if (resolvedGateway === "STRIPE") {
    const stripe = createStripeClient();
    const payload = {
      payment_intent: paymentId,
      amount: Math.round(amount * 100),
    };
    const normalizedReason = `${reason || ""}`.trim().toLowerCase();
    if (["duplicate", "fraudulent", "requested_by_customer"].includes(normalizedReason)) {
      payload.reason = normalizedReason;
    }
    if (reason) {
      payload.metadata = { reason };
    }
    const refund = await stripe.refunds.create(payload);
    return {
      refundId: refund.id,
      status: `${refund.status || "pending"}`.toLowerCase(),
      currency: toUpperCurrency(refund.currency || "eur"),
    };
  }

  if (resolvedGateway === "MOCK_STRIPE") {
    const hash = crypto
      .createHash("sha256")
      .update(`${paymentId}_${Date.now()}`)
      .digest("hex")
      .slice(0, 16);
    return {
      refundId: `rf_mock_${hash}`,
      status: "succeeded",
      currency: "EUR",
    };
  }

  throw createHttpError(400, `Unsupported gateway for refund: ${resolvedGateway}`);
};

module.exports = {
  SUPPORTED_GATEWAYS,
  normalizeGatewayCode,
  parseGatewayOrder,
  resolveGatewaySequence,
  detectGatewayFromSessionId,
  createCheckoutSessionWithFailover,
  verifySessionWithGateway,
  refundWithGateway,
};

const createHttpError = require("http-errors");
const Stripe = require("stripe");
const config = require("../config/config");
const Payment = require("../models/paymentModel");
const Order = require("../models/orderModel");
const { calculateOrderSummary } = require("../utils/orderPricing");
const { logAuditEvent } = require("../utils/auditLogger");
const {
  createCheckoutSessionWithFailover,
  verifySessionWithGateway,
  refundWithGateway,
  detectGatewayFromSessionId,
  normalizeGatewayCode,
} = require("../utils/paymentGatewayRouter");

const SUCCESSFUL_PAYMENT_STATUSES = new Set(["succeeded", "requires_capture"]);

const getStripeClient = () => {
  if (!config.stripeSecretKey) {
    throw createHttpError(500, "Stripe secret key is not configured.");
  }

  return new Stripe(config.stripeSecretKey);
};

const normalizeCurrency = (currency) => {
  const normalized = `${currency || "EUR"}`.trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(normalized)) {
    throw createHttpError(400, "currency must be a valid ISO 4217 code.");
  }
  return normalized;
};

const toUpperCurrency = (currency) => `${currency || "eur"}`.trim().toUpperCase();

const toAmount = (amountMinor) => Number((Number(amountMinor || 0) / 100).toFixed(2));

const resolveAppOrigin = (req) => {
  const headerOrigin = `${req.headers.origin || ""}`.trim();
  const fallbackOrigin = `${config.frontendUrl || "http://localhost:5173"}`.trim();
  return (headerOrigin || fallbackOrigin).replace(/\/$/, "");
};

const upsertPaymentFromGatewayResult = async ({ verificationResult, source }) => {
  const paymentStatus = `${verificationResult?.status || ""}`.trim().toLowerCase();
  const gatewayCode = normalizeGatewayCode(verificationResult?.gatewayCode || "STRIPE");
  const isPaid = Boolean(verificationResult?.verified) || SUCCESSFUL_PAYMENT_STATUSES.has(paymentStatus);
  return Payment.findOneAndUpdate(
    { paymentId: verificationResult.paymentId },
    {
      paymentId: verificationResult.paymentId,
      orderId: verificationResult.sessionId,
      chargeId: verificationResult.chargeId,
      gatewayCode,
      amount: Number(verificationResult.amount || 0),
      currency: toUpperCurrency(verificationResult.currency || "eur"),
      status: paymentStatus || "pending",
      method: verificationResult.method || "card",
      email: verificationResult.email,
      contact: verificationResult.contact,
      paymentCapturedAt: verificationResult.paymentCapturedAt,
      verified: isPaid,
      source,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
};

const createOrder = async (req, res, next) => {
  try {
    const { items } = req.body;
    const { totalInMinorUnit, bills } = calculateOrderSummary(items);
    const currency = normalizeCurrency(req.body.currency);
    const appOrigin = resolveAppOrigin(req);
    const gatewayResult = await createCheckoutSessionWithFailover({
      preferredGatewayCode: req.body.gatewayCode,
      amountMinor: totalInMinorUnit,
      currency,
      appOrigin,
      metadata: {
        sourceType: `${req.body.sourceType || "POS"}`.toUpperCase(),
        locationId: `${req.body.locationId || "default"}`.trim(),
      },
    });

    await logAuditEvent({
      req,
      action: "PAYMENT_ORDER_CREATED",
      resourceType: "PaymentGatewayOrder",
      resourceId: gatewayResult.sessionId,
      statusCode: 200,
      metadata: {
        amount: toAmount(totalInMinorUnit),
        currency: toUpperCurrency(currency),
        gatewayCode: gatewayResult.gatewayCode,
        attempts: gatewayResult.attempts,
      },
    });

    res.status(200).json({
      success: true,
      order: {
        id: gatewayResult.sessionId,
        amount: totalInMinorUnit,
        currency: toUpperCurrency(currency),
      },
      checkoutUrl: gatewayResult.checkoutUrl,
      sessionId: gatewayResult.sessionId,
      gatewayCode: gatewayResult.gatewayCode,
      gatewayAttempts: gatewayResult.attempts,
      bills,
    });
  } catch (error) {
    next(error);
  }
};

const verifyPayment = async (req, res, next) => {
  try {
    const sessionId = `${req.body?.stripe_session_id || req.body?.session_id || ""}`.trim();
    const gatewayCode = normalizeGatewayCode(
      req.body?.gatewayCode || detectGatewayFromSessionId(sessionId, "STRIPE")
    );

    if (!sessionId) {
      return next(createHttpError(400, "Missing stripe_session_id."));
    }

    const verificationResult = await verifySessionWithGateway({
      sessionId,
      gatewayCode,
    });

    const paymentRecord = await upsertPaymentFromGatewayResult({
      verificationResult,
      source: "verify_endpoint",
    });

    await logAuditEvent({
      req,
      action: "PAYMENT_VERIFIED",
      resourceType: "Payment",
      resourceId: paymentRecord._id,
      statusCode: 200,
      metadata: {
        paymentId: paymentRecord.paymentId,
        providerOrderId: paymentRecord.orderId,
        amount: paymentRecord.amount,
        currency: paymentRecord.currency,
        gatewayCode: paymentRecord.gatewayCode,
      },
    });

    res.json({
      success: true,
      message: "Payment verified successfully!",
      data: {
        stripe_session_id: paymentRecord.orderId,
        stripe_payment_intent_id: paymentRecord.paymentId,
        stripe_charge_id: paymentRecord.chargeId,
        gatewayCode: paymentRecord.gatewayCode,
      },
    });
  } catch (error) {
    next(error);
  }
};

const mapRefundReason = (reason) => {
  const normalized = `${reason || ""}`.trim().toLowerCase();
  if (["duplicate", "fraudulent", "requested_by_customer"].includes(normalized)) {
    return normalized;
  }
  return undefined;
};

const refreshRefundStatus = (payment) => {
  const refunded = Number(payment.refundAmountTotal || 0);
  const amount = Number(payment.amount || 0);
  if (refunded <= 0) {
    payment.refundStatus = "NONE";
    return;
  }
  payment.refundStatus = refunded + 0.0001 >= amount ? "FULL" : "PARTIAL";
};

const REFUND_APPROVAL_STATUSES = new Set([
  "PENDING",
  "APPROVED_EXECUTED",
  "REJECTED",
  "CANCELLED",
]);

const buildRefundApprovalId = () =>
  `rfa_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;

const getRefundRemaining = (payment) =>
  Number((Number(payment.amount || 0) - Number(payment.refundAmountTotal || 0)).toFixed(2));

const resolveRequestedRefundAmount = (payment, requestedAmountInput) => {
  const remaining = getRefundRemaining(payment);
  if (remaining <= 0) {
    throw createHttpError(409, "Payment is already fully refunded.");
  }

  const requestedAmount =
    requestedAmountInput === undefined ? remaining : Number(requestedAmountInput);
  if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
    throw createHttpError(400, "amount must be greater than 0.");
  }
  if (requestedAmount - remaining > 0.0001) {
    throw createHttpError(400, "Refund amount exceeds remaining refundable balance.");
  }

  return requestedAmount;
};

const shouldRequireRefundApproval = (requestedAmount) => {
  if (!config.paymentRefundApprovalEnabled) {
    return false;
  }
  const threshold = Number(config.paymentRefundApprovalThresholdAmount || 0);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return false;
  }
  return requestedAmount + 0.0001 >= threshold;
};

const toRefundApprovalSummary = (payment, approval) => ({
  paymentId: payment.paymentId,
  approvalId: approval.approvalId,
  status: approval.status,
  amount: Number(approval.amount || 0),
  currency: approval.currency || payment.currency,
  reason: approval.reason || "",
  requiredApprovals: Number(approval.requiredApprovals || 2),
  approvedCount: Array.isArray(approval.approvals) ? approval.approvals.length : 0,
  requestedAt: approval.requestedAt || null,
  requestedById: approval.requestedById || null,
  requestedByRole: approval.requestedByRole || "",
  rejectedAt: approval.rejectedAt || null,
  rejectedReason: approval.rejectedReason || "",
  executedRefundId: approval.executedRefundId || "",
  executedAt: approval.executedAt || null,
});

const executeRefundAndApply = async ({ payment, requestedAmount, reason }) => {
  const validatedAmount = resolveRequestedRefundAmount(payment, requestedAmount);
  const alreadyRefunded = Number(payment.refundAmountTotal || 0);
  const refund = await refundWithGateway({
    paymentId: payment.paymentId,
    gatewayCode: payment.gatewayCode || "STRIPE",
    amount: validatedAmount,
    reason,
  });

  payment.refunds.push({
    refundId: refund.refundId,
    amount: validatedAmount,
    currency: toUpperCurrency(refund.currency || payment.currency),
    status: `${refund.status || "pending"}`.toLowerCase(),
    reason,
    createdAt: new Date(),
  });
  payment.refundAmountTotal = Number((alreadyRefunded + validatedAmount).toFixed(2));
  refreshRefundStatus(payment);
  if (payment.refundStatus === "FULL") {
    payment.status = "refunded";
  }

  return { refund, refundedAmount: validatedAmount };
};

const findRefundApprovalEntry = (payment, approvalId) => {
  if (!payment || !approvalId) {
    return null;
  }
  return payment.refundApprovals?.find(
    (entry) => `${entry.approvalId || ""}`.trim() === `${approvalId}`.trim()
  );
};

const refundPayment = async (req, res, next) => {
  try {
    const paymentId = `${req.body.paymentId || req.body.stripe_payment_intent_id || ""}`.trim();
    const reason = `${req.body.reason || ""}`.trim();

    if (!paymentId) {
      return next(createHttpError(400, "paymentId is required."));
    }

    const payment = await Payment.findOne({ paymentId });
    if (!payment) {
      return next(createHttpError(404, "Payment record not found."));
    }

    if (!payment.verified) {
      return next(createHttpError(409, "Only verified payments can be refunded."));
    }

    const requestedAmount = resolveRequestedRefundAmount(payment, req.body.amount);
    const remainingBeforeRefund = getRefundRemaining(payment);

    if (shouldRequireRefundApproval(requestedAmount)) {
      const approval = {
        approvalId: buildRefundApprovalId(),
        amount: requestedAmount,
        currency: toUpperCurrency(payment.currency),
        reason,
        status: "PENDING",
        requiredApprovals: Math.max(1, Number(config.paymentRefundApprovalRequiredCount || 2)),
        requestedById: req.user?._id,
        requestedByRole: req.user?.role,
        requestedAt: new Date(),
        approvals: [],
      };
      payment.refundApprovals.push(approval);
      await payment.save();

      await logAuditEvent({
        req,
        action: "PAYMENT_REFUND_APPROVAL_REQUESTED",
        resourceType: "Payment",
        resourceId: payment._id,
        statusCode: 202,
        metadata: {
          paymentId: payment.paymentId,
          approvalId: approval.approvalId,
          refundAmount: requestedAmount,
          requiredApprovals: approval.requiredApprovals,
          gatewayCode: payment.gatewayCode,
        },
      });

      return res.status(202).json({
        success: true,
        message: "Refund approval required before execution.",
        data: {
          approvalRequired: true,
          approval: toRefundApprovalSummary(payment, approval),
          remainingAmount: remainingBeforeRefund,
        },
      });
    }

    const { refund, refundedAmount } = await executeRefundAndApply({
      payment,
      requestedAmount,
      reason,
    });
    await payment.save();

    await logAuditEvent({
      req,
      action: "PAYMENT_REFUNDED",
      resourceType: "Payment",
      resourceId: payment._id,
      statusCode: 200,
      metadata: {
        paymentId: payment.paymentId,
        refundId: refund.refundId,
        refundAmount: refundedAmount,
        refundStatus: payment.refundStatus,
        gatewayCode: payment.gatewayCode,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        approvalRequired: false,
        paymentId: payment.paymentId,
        refundId: refund.refundId,
        refundAmount: refundedAmount,
        refundStatus: payment.refundStatus,
        remainingAmount: Number((payment.amount - payment.refundAmountTotal).toFixed(2)),
      },
    });
  } catch (error) {
    next(error);
  }
};

const listRefundApprovals = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const status = `${req.query.status || "PENDING"}`.trim().toUpperCase();
    const paymentId = `${req.query.paymentId || ""}`.trim();

    if (status && !REFUND_APPROVAL_STATUSES.has(status)) {
      return next(createHttpError(400, "Invalid refund approval status."));
    }

    const baseMatch = {};
    if (paymentId) {
      baseMatch.paymentId = { $regex: new RegExp(escapeRegex(paymentId), "i") };
    }

    const basePipeline = [];
    if (Object.keys(baseMatch).length > 0) {
      basePipeline.push({ $match: baseMatch });
    }
    basePipeline.push({ $unwind: "$refundApprovals" });
    if (status) {
      basePipeline.push({ $match: { "refundApprovals.status": status } });
    }

    const [rows, countRows] = await Promise.all([
      Payment.aggregate([
        ...basePipeline,
        { $sort: { "refundApprovals.requestedAt": -1, createdAt: -1 } },
        {
          $project: {
            _id: 0,
            paymentId: "$paymentId",
            gatewayCode: "$gatewayCode",
            paymentStatus: "$status",
            paymentAmount: "$amount",
            paymentCurrency: "$currency",
            approval: "$refundApprovals",
          },
        },
        { $skip: offset },
        { $limit: limit },
      ]),
      Payment.aggregate([...basePipeline, { $count: "total" }]),
    ]);

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: { limit, offset, total: Number(countRows?.[0]?.total || 0) },
    });
  } catch (error) {
    return next(error);
  }
};

const approveRefundApproval = async (req, res, next) => {
  try {
    const approvalId = `${req.params.approvalId || ""}`.trim();
    const paymentId = `${req.body.paymentId || req.query.paymentId || ""}`.trim();

    if (!approvalId) {
      return next(createHttpError(400, "approvalId is required."));
    }

    const query = { "refundApprovals.approvalId": approvalId };
    if (paymentId) {
      query.paymentId = paymentId;
    }

    const payment = await Payment.findOne(query);
    if (!payment) {
      return next(createHttpError(404, "Refund approval not found."));
    }

    const approval = findRefundApprovalEntry(payment, approvalId);
    if (!approval) {
      return next(createHttpError(404, "Refund approval not found."));
    }

    if (approval.status === "APPROVED_EXECUTED") {
      return res.status(200).json({
        success: true,
        message: "Refund approval already executed.",
        data: {
          approval: toRefundApprovalSummary(payment, approval),
          alreadyExecuted: true,
          remainingAmount: getRefundRemaining(payment),
        },
      });
    }

    if (approval.status !== "PENDING") {
      return next(createHttpError(409, "Only PENDING approvals can be approved."));
    }

    const actorId = `${req.user?._id || ""}`;
    const requesterId = `${approval.requestedById || ""}`;
    if (requesterId && actorId && requesterId === actorId) {
      return next(createHttpError(409, "Requester cannot approve their own refund request."));
    }

    const alreadyApproved = (approval.approvals || []).some(
      (entry) => `${entry.approverId || ""}` === actorId
    );
    if (alreadyApproved) {
      return next(createHttpError(409, "Current user already approved this request."));
    }

    approval.approvals.push({
      approverId: req.user?._id,
      approverRole: req.user?.role,
      approvedAt: new Date(),
    });

    const requiredApprovals = Math.max(
      1,
      Number(approval.requiredApprovals || config.paymentRefundApprovalRequiredCount || 2)
    );

    if (approval.approvals.length < requiredApprovals) {
      await payment.save();

      await logAuditEvent({
        req,
        action: "PAYMENT_REFUND_APPROVAL_APPROVED",
        resourceType: "Payment",
        resourceId: payment._id,
        statusCode: 200,
        metadata: {
          paymentId: payment.paymentId,
          approvalId,
          approvedCount: approval.approvals.length,
          requiredApprovals,
        },
      });

      return res.status(200).json({
        success: true,
        data: {
          approval: toRefundApprovalSummary(payment, approval),
          executed: false,
          remainingAmount: getRefundRemaining(payment),
        },
      });
    }

    const { refund, refundedAmount } = await executeRefundAndApply({
      payment,
      requestedAmount: Number(approval.amount || 0),
      reason: approval.reason || "",
    });

    approval.status = "APPROVED_EXECUTED";
    approval.executedRefundId = refund.refundId;
    approval.executedAt = new Date();
    await payment.save();

    await logAuditEvent({
      req,
      action: "PAYMENT_REFUND_APPROVAL_EXECUTED",
      resourceType: "Payment",
      resourceId: payment._id,
      statusCode: 200,
      metadata: {
        paymentId: payment.paymentId,
        approvalId,
        refundId: refund.refundId,
        refundAmount: refundedAmount,
        gatewayCode: payment.gatewayCode,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        approval: toRefundApprovalSummary(payment, approval),
        executed: true,
        refundId: refund.refundId,
        refundStatus: payment.refundStatus,
        remainingAmount: getRefundRemaining(payment),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const rejectRefundApproval = async (req, res, next) => {
  try {
    const approvalId = `${req.params.approvalId || ""}`.trim();
    const paymentId = `${req.body.paymentId || req.query.paymentId || ""}`.trim();
    const rejectedReason = `${req.body.reason || ""}`.trim();

    if (!approvalId) {
      return next(createHttpError(400, "approvalId is required."));
    }

    const query = { "refundApprovals.approvalId": approvalId };
    if (paymentId) {
      query.paymentId = paymentId;
    }

    const payment = await Payment.findOne(query);
    if (!payment) {
      return next(createHttpError(404, "Refund approval not found."));
    }

    const approval = findRefundApprovalEntry(payment, approvalId);
    if (!approval) {
      return next(createHttpError(404, "Refund approval not found."));
    }

    if (approval.status !== "PENDING") {
      return next(createHttpError(409, "Only PENDING approvals can be rejected."));
    }

    const actorId = `${req.user?._id || ""}`;
    const requesterId = `${approval.requestedById || ""}`;
    if (requesterId && actorId && requesterId === actorId) {
      return next(createHttpError(409, "Requester cannot reject their own refund request."));
    }

    approval.status = "REJECTED";
    approval.rejectedById = req.user?._id;
    approval.rejectedByRole = req.user?.role;
    approval.rejectedAt = new Date();
    approval.rejectedReason = rejectedReason;
    await payment.save();

    await logAuditEvent({
      req,
      action: "PAYMENT_REFUND_APPROVAL_REJECTED",
      resourceType: "Payment",
      resourceId: payment._id,
      statusCode: 200,
      metadata: {
        paymentId: payment.paymentId,
        approvalId,
        reason: rejectedReason,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        approval: toRefundApprovalSummary(payment, approval),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);
  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 200) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const REFUND_STATUSES = new Set(["NONE", "PARTIAL", "FULL"]);

const escapeRegex = (value) => `${value}`.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parseBoolean = (rawValue) => {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return null;
  }

  const normalized = `${rawValue}`.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "0", "no", "off"].includes(normalized)) {
    return false;
  }

  return null;
};

const parseDate = (rawValue) => {
  if (!rawValue) {
    return null;
  }

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date;
};

const buildPaymentQuery = (queryParams) => {
  const query = {};
  const status = `${queryParams.status || ""}`.trim().toLowerCase();
  const source = `${queryParams.source || ""}`.trim();
  const gatewayCode = normalizeGatewayCode(queryParams.gatewayCode || "");
  const refundStatus = `${queryParams.refundStatus || ""}`.trim().toUpperCase();
  const paymentId = `${queryParams.paymentId || ""}`.trim();
  const orderId = `${queryParams.orderId || ""}`.trim();

  if (status) {
    query.status = status;
  }

  if (source) {
    query.source = source;
  }

  if (gatewayCode) {
    query.gatewayCode = gatewayCode;
  }

  if (REFUND_STATUSES.has(refundStatus)) {
    query.refundStatus = refundStatus;
  }

  if (paymentId) {
    query.paymentId = { $regex: new RegExp(escapeRegex(paymentId), "i") };
  }

  if (orderId) {
    query.orderId = { $regex: new RegExp(escapeRegex(orderId), "i") };
  }

  const verified = parseBoolean(queryParams.verified);
  if (verified !== null) {
    query.verified = verified;
  }

  const hasRefund = parseBoolean(queryParams.hasRefund);
  if (hasRefund === true) {
    query.refundAmountTotal = { $gt: 0 };
  }
  if (hasRefund === false) {
    query.refundAmountTotal = { $lte: 0 };
  }

  const minAmount = Number(queryParams.minAmount);
  const maxAmount = Number(queryParams.maxAmount);
  if (Number.isFinite(minAmount) || Number.isFinite(maxAmount)) {
    query.amount = {};
    if (Number.isFinite(minAmount)) {
      query.amount.$gte = minAmount;
    }
    if (Number.isFinite(maxAmount)) {
      query.amount.$lte = maxAmount;
    }
  }

  const fromDate = parseDate(queryParams.from);
  const toDate = parseDate(queryParams.to);
  if (fromDate || toDate) {
    query.createdAt = {};
    if (fromDate) {
      query.createdAt.$gte = fromDate;
    }
    if (toDate) {
      query.createdAt.$lte = toDate;
    }
  }

  return query;
};

const listPayments = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = buildPaymentQuery(req.query || {});

    const [rows, total] = await Promise.all([
      Payment.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit),
      Payment.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: { limit, offset, total },
    });
  } catch (error) {
    return next(error);
  }
};

const listPaymentReconciliationGaps = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);

    const [unlinkedPayments, onlineOrders] = await Promise.all([
      Payment.find({ verified: true, usedForOrder: false }).sort({ createdAt: -1 }).limit(limit),
      Order.find({ paymentMethod: "Online" })
        .select("_id orderStatus paymentMethod paymentData createdAt")
        .sort({ createdAt: -1 })
        .limit(limit),
    ]);

    const paymentIntentIds = onlineOrders
      .map((order) => order.paymentData?.stripe_payment_intent_id)
      .filter(Boolean);

    const paymentByIntent = new Map();
    if (paymentIntentIds.length > 0) {
      const matchedPayments = await Payment.find({
        paymentId: { $in: paymentIntentIds },
      }).select("paymentId orderId verified usedForOrder orderDbId status");

      matchedPayments.forEach((payment) => {
        paymentByIntent.set(payment.paymentId, payment);
      });
    }

    const orderIssues = [];
    onlineOrders.forEach((order) => {
      const stripePaymentIntentId = order.paymentData?.stripe_payment_intent_id;
      const stripeSessionId = order.paymentData?.stripe_session_id;

      if (!stripePaymentIntentId || !stripeSessionId) {
        orderIssues.push({
          orderId: order._id,
          issue: "MISSING_PAYMENT_FIELDS",
          detail: "Order is online but missing stripe payment identifiers.",
        });
        return;
      }

      const payment = paymentByIntent.get(stripePaymentIntentId);
      if (!payment) {
        orderIssues.push({
          orderId: order._id,
          issue: "MISSING_PAYMENT_RECORD",
          paymentIntentId: stripePaymentIntentId,
          sessionId: stripeSessionId,
        });
        return;
      }

      if (!payment.verified) {
        orderIssues.push({
          orderId: order._id,
          issue: "PAYMENT_NOT_VERIFIED",
          paymentIntentId: stripePaymentIntentId,
          paymentStatus: payment.status,
        });
        return;
      }

      if (!payment.usedForOrder || `${payment.orderDbId || ""}` !== `${order._id}`) {
        orderIssues.push({
          orderId: order._id,
          issue: "PAYMENT_LINK_MISMATCH",
          paymentIntentId: stripePaymentIntentId,
          usedForOrder: payment.usedForOrder,
          linkedOrderId: payment.orderDbId || null,
        });
      }
    });

    return res.status(200).json({
      success: true,
      data: {
        summary: {
          unlinkedPayments: unlinkedPayments.length,
          orderIssues: orderIssues.length,
        },
        unlinkedPayments,
        orderIssues,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const repairOrderPaymentLink = async (req, res, next) => {
  try {
    const orderId = `${req.body.orderId || ""}`.trim();
    if (!orderId) {
      return next(createHttpError(400, "orderId is required."));
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return next(createHttpError(404, "Order not found."));
    }

    if (order.paymentMethod !== "Online") {
      return next(createHttpError(409, "Only online orders can repair payment link."));
    }

    const stripePaymentIntentId = `${order.paymentData?.stripe_payment_intent_id || ""}`.trim();
    const stripeSessionId = `${order.paymentData?.stripe_session_id || ""}`.trim();
    if (!stripePaymentIntentId || !stripeSessionId) {
      return next(createHttpError(409, "Order has incomplete stripe payment identifiers."));
    }

    const payment = await Payment.findOne({
      paymentId: stripePaymentIntentId,
      orderId: stripeSessionId,
    });
    if (!payment) {
      return next(createHttpError(404, "Payment record not found for order identifiers."));
    }

    if (!payment.verified) {
      return next(createHttpError(409, "Payment record is not verified."));
    }

    if (payment.usedForOrder && `${payment.orderDbId || ""}` !== `${order._id}`) {
      return next(createHttpError(409, "Payment is already linked to another order."));
    }

    payment.usedForOrder = true;
    payment.orderDbId = order._id;
    await payment.save();

    await logAuditEvent({
      req,
      action: "PAYMENT_LINK_REPAIRED",
      resourceType: "Payment",
      resourceId: payment._id,
      statusCode: 200,
      metadata: {
        orderId: order._id,
        paymentId: payment.paymentId,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        paymentId: payment.paymentId,
        usedForOrder: payment.usedForOrder,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const retryVerifyPayment = async (req, res, next) => {
  try {
    const sessionId = `${req.body?.stripe_session_id || req.body?.session_id || ""}`.trim();
    if (!sessionId) {
      return next(createHttpError(400, "Missing stripe_session_id."));
    }
    const gatewayCode = normalizeGatewayCode(
      req.body?.gatewayCode || detectGatewayFromSessionId(sessionId, "STRIPE")
    );

    const verificationResult = await verifySessionWithGateway({
      sessionId,
      gatewayCode,
    });
    const paymentRecord = await upsertPaymentFromGatewayResult({
      verificationResult,
      source: "verify_endpoint",
    });

    await logAuditEvent({
      req,
      action: "PAYMENT_VERIFY_RETRIED",
      resourceType: "Payment",
      resourceId: paymentRecord._id,
      statusCode: 200,
      metadata: {
        sessionId,
        paymentId: paymentRecord.paymentId,
        verified: paymentRecord.verified,
        gatewayCode: paymentRecord.gatewayCode,
      },
    });

    return res.status(200).json({
      success: true,
      data: {
        stripe_session_id: paymentRecord.orderId,
        stripe_payment_intent_id: paymentRecord.paymentId,
        stripe_charge_id: paymentRecord.chargeId,
        verified: paymentRecord.verified,
        status: paymentRecord.status,
        gatewayCode: paymentRecord.gatewayCode,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getPaymentStats = async (req, res, next) => {
  try {
    const query = buildPaymentQuery(req.query || {});

    const [
      totalPayments,
      verifiedPayments,
      refundPayments,
      pendingRefundApprovals,
      amountSummary,
      statusBreakdown,
      sourceBreakdown,
      gatewayBreakdown,
    ] =
      await Promise.all([
        Payment.countDocuments(query),
        Payment.countDocuments({ ...query, verified: true }),
        Payment.countDocuments({ ...query, refundAmountTotal: { $gt: 0 } }),
        Payment.aggregate([
          { $match: query },
          { $unwind: "$refundApprovals" },
          { $match: { "refundApprovals.status": "PENDING" } },
          { $count: "count" },
        ]),
        Payment.aggregate([
          { $match: query },
          {
            $group: {
              _id: null,
              grossAmount: { $sum: "$amount" },
              refundedAmount: { $sum: "$refundAmountTotal" },
            },
          },
        ]),
        Payment.aggregate([
          { $match: query },
          { $group: { _id: "$status", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Payment.aggregate([
          { $match: query },
          { $group: { _id: "$source", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Payment.aggregate([
          { $match: query },
          { $group: { _id: "$gatewayCode", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
      ]);

    const totals = amountSummary[0] || { grossAmount: 0, refundedAmount: 0 };
    const grossAmount = Number((totals.grossAmount || 0).toFixed(2));
    const refundedAmount = Number((totals.refundedAmount || 0).toFixed(2));
    const netAmount = Number((grossAmount - refundedAmount).toFixed(2));

    return res.status(200).json({
      success: true,
      data: {
        totalPayments,
        verifiedPayments,
        refundPayments,
        pendingRefundApprovals: Number(pendingRefundApprovals?.[0]?.count || 0),
        grossAmount,
        refundedAmount,
        netAmount,
        verificationRate:
          totalPayments > 0 ? Number(((verifiedPayments / totalPayments) * 100).toFixed(2)) : 0,
        refundRate:
          totalPayments > 0 ? Number(((refundPayments / totalPayments) * 100).toFixed(2)) : 0,
        statusBreakdown: statusBreakdown.map((row) => ({
          status: row._id || "unknown",
          count: row.count,
        })),
        sourceBreakdown: sourceBreakdown.map((row) => ({
          source: row._id || "unknown",
          count: row.count,
        })),
        gatewayBreakdown: gatewayBreakdown.map((row) => ({
          gatewayCode: row._id || "unknown",
          count: row.count,
        })),
      },
    });
  } catch (error) {
    return next(error);
  }
};

const webHookVerification = async (req, res, next) => {
  try {
    const secret = config.stripeWebhookSecret;
    const signature = req.headers["stripe-signature"];
    const rawBody = req.body;

    if (!secret) {
      return next(createHttpError(500, "Stripe webhook secret is not configured."));
    }

    if (!signature) {
      return next(createHttpError(400, "Missing stripe-signature header."));
    }

    if (!Buffer.isBuffer(rawBody)) {
      return next(createHttpError(400, "Webhook payload must be raw JSON."));
    }

    const stripe = getStripeClient();
    let event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, secret);
    } catch (error) {
      return next(createHttpError(400, `Invalid webhook signature: ${error.message}`));
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      if (`${session.payment_status || ""}`.toLowerCase() === "paid") {
        const paymentIntentId =
          typeof session.payment_intent === "string"
            ? session.payment_intent
            : session.payment_intent?.id;
        if (paymentIntentId) {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
            expand: ["latest_charge"],
          });

          const latestCharge = paymentIntent?.latest_charge;
          const chargeId = typeof latestCharge === "string" ? latestCharge : latestCharge?.id;
          const verificationResult = {
            gatewayCode: "STRIPE",
            sessionId: session.id,
            paymentId: paymentIntent.id,
            chargeId,
            amount: toAmount(paymentIntent.amount_received || paymentIntent.amount || 0),
            currency: toUpperCurrency(paymentIntent.currency || session.currency || "eur"),
            status: `${paymentIntent.status || ""}`.trim().toLowerCase() || "pending",
            method:
              paymentIntent.payment_method_types?.[0] ||
              (typeof paymentIntent.payment_method === "string"
                ? paymentIntent.payment_method
                : "card"),
            email: session.customer_details?.email || paymentIntent.receipt_email,
            contact: session.customer_details?.phone,
            paymentCapturedAt: paymentIntent.created
              ? new Date(paymentIntent.created * 1000)
              : undefined,
            verified: true,
          };

          const paymentRecord = await upsertPaymentFromGatewayResult({
            verificationResult,
            source: "webhook",
          });

          await logAuditEvent({
            req,
            action: "PAYMENT_WEBHOOK_CAPTURED",
            resourceType: "Payment",
            resourceId: paymentRecord._id,
            statusCode: 200,
            metadata: {
              paymentId: paymentRecord.paymentId,
              providerOrderId: paymentRecord.orderId,
              event: event.type,
              source: paymentRecord.source,
            },
          });
        }
      }
    }

    if (event.type === "charge.refunded") {
      const charge = event.data.object;
      const payment = await Payment.findOne({ chargeId: charge.id });
      if (payment) {
        const refundedAmount = toAmount(charge.amount_refunded || 0);
        payment.refundAmountTotal = refundedAmount;
        refreshRefundStatus(payment);
        if (payment.refundStatus === "FULL") {
          payment.status = "refunded";
        }
        await payment.save();
      }
    }

    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createOrder,
  verifyPayment,
  retryVerifyPayment,
  refundPayment,
  listRefundApprovals,
  approveRefundApproval,
  rejectRefundApproval,
  listPayments,
  listPaymentReconciliationGaps,
  repairOrderPaymentLink,
  getPaymentStats,
  webHookVerification,
  __testables: {
    parseBoolean,
    parseDate,
    buildPaymentQuery,
    mapRefundReason,
    refreshRefundStatus,
    shouldRequireRefundApproval,
    resolveRequestedRefundAmount,
    buildRefundApprovalId,
  },
};

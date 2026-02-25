const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const config = require("../config/config");
const { __testables } = require("../controllers/paymentController");

const {
  parseBoolean,
  parseDate,
  buildPaymentQuery,
  mapRefundReason,
  refreshRefundStatus,
  shouldRequireRefundApproval,
  resolveRequestedRefundAmount,
} = __testables;

test("payment helpers: parseBoolean supports common truthy/falsey values", () => {
  assert.equal(parseBoolean("true"), true);
  assert.equal(parseBoolean("1"), true);
  assert.equal(parseBoolean("yes"), true);
  assert.equal(parseBoolean("false"), false);
  assert.equal(parseBoolean("0"), false);
  assert.equal(parseBoolean("off"), false);
  assert.equal(parseBoolean("invalid"), null);
  assert.equal(parseBoolean(undefined), null);
});

test("payment helpers: parseDate returns null for invalid date", () => {
  assert.equal(parseDate("not-a-date"), null);
  const parsed = parseDate("2026-02-20T10:00:00.000Z");
  assert.ok(parsed instanceof Date);
});

test("payment helpers: buildPaymentQuery builds expected filters", () => {
  const query = buildPaymentQuery({
    status: "succeeded",
    source: "webhook",
    refundStatus: "partial",
    paymentId: "pi_abc",
    orderId: "cs_xyz",
    verified: "true",
    hasRefund: "true",
    minAmount: "10",
    maxAmount: "500",
    from: "2026-02-01T00:00:00.000Z",
    to: "2026-02-20T23:59:59.999Z",
  });

  assert.equal(query.status, "succeeded");
  assert.equal(query.source, "webhook");
  assert.equal(query.refundStatus, "PARTIAL");
  assert.equal(query.verified, true);
  assert.deepEqual(query.refundAmountTotal, { $gt: 0 });
  assert.deepEqual(query.amount, { $gte: 10, $lte: 500 });
  assert.ok(query.createdAt.$gte instanceof Date);
  assert.ok(query.createdAt.$lte instanceof Date);
  assert.ok(query.paymentId.$regex instanceof RegExp);
  assert.ok(query.orderId.$regex instanceof RegExp);
});

test("payment helpers: mapRefundReason keeps only Stripe-supported reasons", () => {
  assert.equal(mapRefundReason("duplicate"), "duplicate");
  assert.equal(mapRefundReason("fraudulent"), "fraudulent");
  assert.equal(mapRefundReason("requested_by_customer"), "requested_by_customer");
  assert.equal(mapRefundReason("other"), undefined);
});

test("payment helpers: refreshRefundStatus derives NONE/PARTIAL/FULL", () => {
  const payment = { amount: 100, refundAmountTotal: 0, refundStatus: "NONE" };
  refreshRefundStatus(payment);
  assert.equal(payment.refundStatus, "NONE");

  payment.refundAmountTotal = 40;
  refreshRefundStatus(payment);
  assert.equal(payment.refundStatus, "PARTIAL");

  payment.refundAmountTotal = 100;
  refreshRefundStatus(payment);
  assert.equal(payment.refundStatus, "FULL");
});

test("payment helpers: shouldRequireRefundApproval follows configured threshold", () => {
  const threshold = Number(config.paymentRefundApprovalThresholdAmount || 100);
  assert.equal(shouldRequireRefundApproval(Math.max(threshold - 0.01, 0)), false);
  assert.equal(shouldRequireRefundApproval(threshold), true);
  assert.equal(shouldRequireRefundApproval(threshold + 10), true);
});

test("payment helpers: resolveRequestedRefundAmount validates remaining balance", () => {
  const payment = { amount: 100, refundAmountTotal: 30 };
  assert.equal(resolveRequestedRefundAmount(payment, undefined), 70);
  assert.equal(resolveRequestedRefundAmount(payment, 20), 20);
  assert.throws(
    () => resolveRequestedRefundAmount(payment, 80),
    (error) => /exceeds remaining refundable balance/i.test(error.message)
  );
});

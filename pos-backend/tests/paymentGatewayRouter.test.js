const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const {
  normalizeGatewayCode,
  parseGatewayOrder,
  resolveGatewaySequence,
  detectGatewayFromSessionId,
} = require("../utils/paymentGatewayRouter");

test("payment gateway router: normalize and parse gateway order", () => {
  assert.equal(normalizeGatewayCode(" stripe "), "STRIPE");
  assert.deepEqual(parseGatewayOrder("stripe,mock_stripe,unknown,STRIPE"), [
    "STRIPE",
    "MOCK_STRIPE",
  ]);
});

test("payment gateway router: resolveGatewaySequence prioritizes preferred gateway", () => {
  const sequence = resolveGatewaySequence("mock_stripe");
  assert.equal(sequence[0], "MOCK_STRIPE");
  assert.ok(sequence.includes("STRIPE"));
});

test("payment gateway router: detect gateway by session id prefix", () => {
  assert.equal(detectGatewayFromSessionId("cs_mock_123"), "MOCK_STRIPE");
  assert.equal(detectGatewayFromSessionId("cs_live_123"), "STRIPE");
});

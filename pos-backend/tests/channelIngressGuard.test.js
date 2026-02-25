const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const {
  buildPayloadSignature,
  verifyIngressSignature,
  resolveQuotaPerMinute,
  buildMinuteBucket,
} = require("../utils/channelIngressGuard");

test("channel ingress guard: signature build/verify", () => {
  const payload = { b: 2, a: { z: 1, y: 2 } };
  const secret = "abc123";
  const signature = buildPayloadSignature({ secret, payload });

  assert.equal(verifyIngressSignature({ secret, payload, receivedSignature: signature }), true);
  assert.equal(verifyIngressSignature({ secret, payload, receivedSignature: "bad" }), false);
});

test("channel ingress guard: quota resolution and bucket", () => {
  assert.equal(resolveQuotaPerMinute({ metadata: { ingressQuotaPerMinute: 33 } }), 33);
  const bucket = buildMinuteBucket(new Date("2026-02-21T10:15:22.000Z"));
  assert.equal(bucket, "2026-02-21T10:15");
});

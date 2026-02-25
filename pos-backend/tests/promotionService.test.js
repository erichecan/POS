const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { normalizePromotionCodes, isCouponUsable } = require("../utils/promotionService");

test("promotion service: normalizePromotionCodes deduplicates and uppercases", () => {
  const codes = normalizePromotionCodes([" abc ", "ABC", "", "f20"]);
  assert.deepEqual(codes, ["ABC", "F20"]);
});

test("promotion service: isCouponUsable validates status, expiry, and usage limit", () => {
  const now = new Date("2026-02-21T10:00:00.000Z");
  assert.equal(
    isCouponUsable(
      { status: "ACTIVE", usageLimit: 2, usageCount: 1, expiresAt: new Date("2026-02-22") },
      now
    ),
    true
  );
  assert.equal(
    isCouponUsable({ status: "DISABLED", usageLimit: 2, usageCount: 1 }, now),
    false
  );
  assert.equal(
    isCouponUsable({ status: "ACTIVE", usageLimit: 1, usageCount: 1 }, now),
    false
  );
  assert.equal(
    isCouponUsable({ status: "ACTIVE", usageLimit: 2, usageCount: 0, expiresAt: new Date("2026-02-20") }, now),
    false
  );
});

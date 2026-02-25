const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const {
  isPromotionActive,
  supportsChannel,
  computePromotionDiscount,
  resolvePromotionApplication,
} = require("../utils/promotionEngine");

test("promotion engine: active window and usage checks", () => {
  const now = new Date("2026-02-21T10:00:00.000Z");

  const activeRule = {
    status: "ACTIVE",
    startAt: new Date("2026-02-20T00:00:00.000Z"),
    endAt: new Date("2026-02-22T00:00:00.000Z"),
    usageLimit: 10,
    usageCount: 1,
  };

  assert.equal(isPromotionActive(activeRule, now), true);

  assert.equal(
    isPromotionActive({ ...activeRule, status: "INACTIVE" }, now),
    false
  );
  assert.equal(
    isPromotionActive({ ...activeRule, usageCount: 10 }, now),
    false
  );
});

test("promotion engine: channel checks and discount computation", () => {
  const rulePercent = {
    status: "ACTIVE",
    discountType: "PERCENT",
    discountValue: 10,
    minOrderAmount: 100,
    maxDiscountAmount: 50,
    appliesToChannels: ["UBER"],
  };

  assert.equal(supportsChannel(rulePercent, "UBER"), true);
  assert.equal(supportsChannel(rulePercent, "ALL"), false);

  assert.equal(computePromotionDiscount({ rule: rulePercent, subtotal: 90 }), 0);
  assert.equal(computePromotionDiscount({ rule: rulePercent, subtotal: 300 }), 30);

  const fixed = {
    status: "ACTIVE",
    discountType: "FIXED",
    discountValue: 80,
    minOrderAmount: 0,
  };
  assert.equal(computePromotionDiscount({ rule: fixed, subtotal: 50 }), 50);
});

test("promotion engine: resolvePromotionApplication picks best and stacks stackable rules", () => {
  const rules = [
    {
      _id: "r1",
      code: "A10",
      name: "A10",
      locationId: "default",
      status: "ACTIVE",
      discountType: "PERCENT",
      discountValue: 10,
      stackable: true,
      appliesToChannels: ["ALL"],
      minOrderAmount: 0,
    },
    {
      _id: "r2",
      code: "F20",
      name: "F20",
      locationId: "default",
      status: "ACTIVE",
      discountType: "FIXED",
      discountValue: 20,
      stackable: true,
      appliesToChannels: ["ALL"],
      minOrderAmount: 0,
    },
  ];

  const result = resolvePromotionApplication({
    rules,
    subtotal: 100,
    locationId: "default",
    channelCode: "ALL",
  });

  assert.equal(result.discountTotal >= 20, true);
  assert.equal(result.subtotalAfterDiscount, 100 - result.discountTotal);
  assert.equal(result.applied.length >= 1, true);
});

const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";
process.env.MEMBER_POINTS_PER_CURRENCY = "2";
process.env.MEMBER_POINTS_REDEEM_RATE = "100";

const { __testables } = require("../utils/memberService");

const {
  deriveMemberTier,
  parseAdjustment,
  applyMemberBalanceDelta,
  calculatePointsEarned,
  calculateWalletDiscountFromPoints,
} = __testables;

test("member service: deriveMemberTier follows configured thresholds", () => {
  assert.equal(deriveMemberTier({ lifetimeSpend: 100, pointsBalance: 120 }), "BRONZE");
  assert.equal(deriveMemberTier({ lifetimeSpend: 900, pointsBalance: 100 }), "SILVER");
  assert.equal(deriveMemberTier({ lifetimeSpend: 2200, pointsBalance: 100 }), "GOLD");
  assert.equal(deriveMemberTier({ lifetimeSpend: 5100, pointsBalance: 100 }), "PLATINUM");
});

test("member service: parseAdjustment normalizes numeric deltas", () => {
  const parsed = parseAdjustment({ pointsDelta: "10", walletDelta: "20.567" });
  assert.equal(parsed.pointsDelta, 10);
  assert.equal(parsed.walletDelta, 20.57);

  assert.throws(
    () => parseAdjustment({ pointsDelta: "abc", walletDelta: 1 }),
    (error) => /must be numeric/i.test(error.message)
  );
});

test("member service: applyMemberBalanceDelta enforces non-negative balances", () => {
  const member = {
    pointsBalance: 100,
    walletBalance: 20,
    lifetimeSpend: 100,
    tier: "BRONZE",
  };

  applyMemberBalanceDelta({ member, pointsDelta: -30, walletDelta: 10 });
  assert.equal(member.pointsBalance, 70);
  assert.equal(member.walletBalance, 30);

  assert.throws(
    () => applyMemberBalanceDelta({ member, pointsDelta: -1000, walletDelta: 0 }),
    (error) => /insufficient points balance/i.test(error.message)
  );
});

test("member service: calculate points and wallet discount", () => {
  assert.equal(calculatePointsEarned(10), 20);
  assert.equal(calculatePointsEarned(0), 0);
  assert.equal(calculateWalletDiscountFromPoints(250), 2.5);
});

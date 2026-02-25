const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const {
  evaluatePermissionRows,
  mergeAllowedLocations,
  isLocationAllowed,
  extractCandidateLocationId,
  hasLegacyPermission,
} = require("../utils/accessControlService");

test("access control: evaluatePermissionRows handles allow/deny precedence", () => {
  const rows = [
    { actions: ["read"], effect: "allow" },
    { actions: ["write"], effect: "allow" },
  ];

  assert.equal(evaluatePermissionRows({ rows, action: "read" }), true);
  assert.equal(evaluatePermissionRows({ rows, action: "delete" }), false);

  const denied = [
    { actions: ["read"], effect: "allow" },
    { actions: ["read"], effect: "deny" },
  ];
  assert.equal(evaluatePermissionRows({ rows: denied, action: "read" }), false);
});

test("access control: mergeAllowedLocations + isLocationAllowed", () => {
  const { allowed, denied } = mergeAllowedLocations([
    { allowedLocationIds: ["store-a", "store-b"], effect: "allow" },
    { allowedLocationIds: ["store-b"], effect: "deny" },
  ]);

  assert.equal(isLocationAllowed({ locationId: "store-a", allowedSet: allowed, deniedSet: denied }), true);
  assert.equal(isLocationAllowed({ locationId: "store-b", allowedSet: allowed, deniedSet: denied }), false);
});

test("access control: extractCandidateLocationId reads body/query/params fallback", () => {
  const req = {
    body: { locationId: " body-loc " },
    query: {},
    params: {},
  };
  assert.equal(extractCandidateLocationId(req), "body-loc");

  const req2 = {
    body: {},
    query: { locationId: " query-loc " },
    params: {},
  };
  assert.equal(extractCandidateLocationId(req2), "query-loc");
});

test("access control: legacy permission matrix keeps cashier/waiter compatibility", () => {
  assert.equal(
    hasLegacyPermission({ role: "Cashier", resource: "payments", action: "refund" }),
    true
  );
  assert.equal(
    hasLegacyPermission({ role: "Waiter", resource: "payments", action: "read" }),
    false
  );
  assert.equal(
    hasLegacyPermission({ role: "Waiter", resource: "orders", action: "write" }),
    true
  );
});

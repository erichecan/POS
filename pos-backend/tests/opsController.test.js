const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { __testables } = require("../controllers/opsController");

const {
  normalizeLocationId,
  parseWindowMinutes,
  safeRate,
  computeKitchenSlaBuckets,
  buildSloAlerts,
  deriveOpsHealthStatus,
  resolveEscalationPolicy,
  deriveEscalationLevel,
  resolveEscalationTargetRole,
  parseIncidentStatuses,
} = __testables;

test("ops helpers: normalizeLocationId defaults and trims", () => {
  assert.equal(normalizeLocationId(undefined), "default");
  assert.equal(normalizeLocationId("  loc-1 "), "loc-1");
});

test("ops helpers: parseWindowMinutes clamps in range", () => {
  assert.equal(parseWindowMinutes(1), 5);
  assert.equal(parseWindowMinutes(30), 30);
  assert.equal(parseWindowMinutes(2000), 1440);
});

test("ops helpers: safeRate returns percentage with 2 decimals", () => {
  assert.equal(safeRate(1, 3), 33.33);
  assert.equal(safeRate(0, 0), 0);
});

test("ops helpers: computeKitchenSlaBuckets derives overdue/warn/on-track", () => {
  const now = new Date("2026-02-21T10:00:00.000Z");
  const rows = [
    {
      firedAt: new Date("2026-02-21T09:20:00.000Z"),
      targetReadyAt: new Date("2026-02-21T09:50:00.000Z"),
      slaMinutes: 30,
    },
    {
      firedAt: new Date("2026-02-21T09:40:00.000Z"),
      targetReadyAt: new Date("2026-02-21T10:02:00.000Z"),
      slaMinutes: 22,
    },
    {
      firedAt: new Date("2026-02-21T09:55:00.000Z"),
      targetReadyAt: new Date("2026-02-21T10:20:00.000Z"),
      slaMinutes: 25,
    },
  ];

  const result = computeKitchenSlaBuckets(rows, now);
  assert.equal(result.openTickets, 3);
  assert.equal(result.overdueCount, 1);
  assert.equal(result.warningCount, 1);
  assert.equal(result.onTrackCount, 1);
});

test("ops helpers: buildSloAlerts and deriveOpsHealthStatus", () => {
  const alerts = buildSloAlerts({
    inventory: { outOfStockCount: 2, lowStockRate: 25 },
    kitchen: { overdueCount: 4, avgReadyMinutes: 30 },
    payment: { failureRate: 6, unverifiedAgingCount: 4, pendingRefundApprovals: 6 },
    cash: { highVarianceShiftCount: 2 },
    thresholds: {
      inventoryLowRateWarnPercent: 20,
      inventoryOutOfStockWarnCount: 1,
      kitchenOverdueWarnCount: 3,
      kitchenAvgReadyWarnMinutes: 25,
      paymentFailureRateWarnPercent: 5,
      paymentUnverifiedWarnCount: 3,
      pendingRefundApprovalWarnCount: 5,
      cashVarianceWarnCount: 1,
    },
  });

  assert.ok(alerts.length >= 5);
  assert.equal(deriveOpsHealthStatus(alerts), "CRITICAL");
});

test("ops helpers: escalation policy and target role are resolved", () => {
  const policy = resolveEscalationPolicy();
  assert.equal(policy.level2Minutes >= 1, true);
  assert.equal(policy.level3Minutes > policy.level2Minutes, true);
  assert.equal(["Admin", "Cashier", "Waiter"].includes(resolveEscalationTargetRole(policy, 1)), true);
  assert.equal(["Admin", "Cashier", "Waiter"].includes(resolveEscalationTargetRole(policy, 2)), true);
  assert.equal(["Admin", "Cashier", "Waiter"].includes(resolveEscalationTargetRole(policy, 3)), true);
});

test("ops helpers: deriveEscalationLevel escalates faster for CRITICAL", () => {
  const policy = { level2Minutes: 10, level3Minutes: 20, levelRoles: { 1: "Cashier", 2: "Admin", 3: "Admin" } };
  assert.equal(deriveEscalationLevel({ openMinutes: 5, severity: "WARN", policy }), 1);
  assert.equal(deriveEscalationLevel({ openMinutes: 10, severity: "WARN", policy }), 2);
  assert.equal(deriveEscalationLevel({ openMinutes: 20, severity: "WARN", policy }), 3);

  assert.equal(deriveEscalationLevel({ openMinutes: 5, severity: "CRITICAL", policy }), 2);
  assert.equal(deriveEscalationLevel({ openMinutes: 10, severity: "CRITICAL", policy }), 3);
});

test("ops helpers: parseIncidentStatuses validates input and defaults", () => {
  assert.deepEqual(parseIncidentStatuses(undefined), ["OPEN", "ACKED"]);
  assert.deepEqual(parseIncidentStatuses("OPEN,RESOLVED"), ["OPEN", "RESOLVED"]);
  assert.throws(
    () => parseIncidentStatuses("OPEN,INVALID"),
    (error) => /invalid incident status/i.test(error.message)
  );
});

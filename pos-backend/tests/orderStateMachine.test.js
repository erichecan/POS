const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const {
  ORDER_TRANSITIONS,
  isFinalStatus,
  canTransition,
  resolveTransitionConflict,
} = require("../utils/orderStateMachine");

test("order state machine: transitions map and finals", () => {
  assert.deepEqual(ORDER_TRANSITIONS["In Progress"], ["Ready", "Cancelled"]);
  assert.equal(isFinalStatus("Completed"), true);
  assert.equal(isFinalStatus("Cancelled"), true);
  assert.equal(isFinalStatus("Ready"), false);
});

test("order state machine: canTransition enforces flow", () => {
  assert.equal(canTransition("In Progress", "Ready"), true);
  assert.equal(canTransition("Ready", "Completed"), true);
  assert.equal(canTransition("Completed", "Ready"), false);
  assert.equal(canTransition("Cancelled", "In Progress"), false);
});

test("order state machine: resolveTransitionConflict returns precise conflict types", () => {
  const versionConflict = resolveTransitionConflict({
    fromStatus: "In Progress",
    toStatus: "Ready",
    expectedVersion: 1,
    actualVersion: 2,
  });
  assert.equal(versionConflict.type, "VERSION_MISMATCH");

  const finalConflict = resolveTransitionConflict({
    fromStatus: "Completed",
    toStatus: "Ready",
  });
  assert.equal(finalConflict.type, "ALREADY_FINAL");

  const invalidConflict = resolveTransitionConflict({
    fromStatus: "In Progress",
    toStatus: "Completed",
  });
  assert.equal(invalidConflict.type, "INVALID_TRANSITION");

  const ok = resolveTransitionConflict({
    fromStatus: "Ready",
    toStatus: "Completed",
  });
  assert.equal(ok.type, "NONE");
});

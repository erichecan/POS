const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const {
  categorizeFailureCode,
  buildRetryWindow,
  summarizeDeadLetters,
} = require("../utils/channelDlqGovernance");

test("channel dlq governance: categorizeFailureCode identifies common buckets", () => {
  assert.equal(categorizeFailureCode("401", "token invalid"), "AUTH");
  assert.equal(categorizeFailureCode("429", "quota exceeded"), "THROTTLE");
  assert.equal(categorizeFailureCode("INGEST_FAILED", "mapping missing"), "MAPPING");
  assert.equal(categorizeFailureCode("X", "something else"), "UNKNOWN");
});

test("channel dlq governance: buildRetryWindow calculates next retry with exponential backoff", () => {
  const now = new Date("2026-02-21T12:00:00.000Z");
  const deadLetter = {
    status: "OPEN",
    replayCount: 2,
    createdAt: new Date("2026-02-21T11:59:00.000Z"),
  };
  const retryWindow = buildRetryWindow({
    deadLetter,
    retryPolicy: {
      maxRetries: 5,
      baseDelayMs: 1000,
    },
    now,
  });

  assert.equal(retryWindow.retryable, true);
  assert.equal(retryWindow.maxRetries, 5);
  assert.equal(retryWindow.attemptsRemaining, 3);
  assert.ok(retryWindow.nextRetryAt instanceof Date);
});

test("channel dlq governance: summarizeDeadLetters returns grouped counters", () => {
  const rows = [
    {
      providerCode: "UBER",
      locationId: "loc-1",
      status: "OPEN",
      failureCode: "401",
      failureMessage: "token invalid",
      replayCount: 0,
      createdAt: new Date(),
    },
    {
      providerCode: "UBER",
      locationId: "loc-1",
      status: "OPEN",
      failureCode: "429",
      failureMessage: "quota",
      replayCount: 0,
      createdAt: new Date(),
    },
  ];
  const summary = summarizeDeadLetters({
    rows,
    connectionByKey: new Map(),
    now: new Date(),
  });

  assert.equal(summary.total, 2);
  assert.equal(summary.byProvider.UBER, 2);
  assert.equal(summary.byStatus.OPEN, 2);
  assert.equal(summary.byCategory.AUTH, 1);
  assert.equal(summary.byCategory.THROTTLE, 1);
});

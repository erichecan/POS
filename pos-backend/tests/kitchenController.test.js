const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { __testables } = require("../controllers/kitchenController");

const { parseReplayEventTypes, buildReplayEventQuery, parseDateFilter } = __testables;

test("kitchen replay helpers: parseReplayEventTypes normalizes and deduplicates", () => {
  const values = parseReplayEventTypes("status_updated, STATUS_UPDATED , expedite_requested");
  assert.deepEqual(values, ["STATUS_UPDATED", "EXPEDITE_REQUESTED"]);
});

test("kitchen replay helpers: parseReplayEventTypes rejects invalid types", () => {
  assert.throws(
    () => parseReplayEventTypes("STATUS_UPDATED,UNKNOWN_EVENT"),
    (error) => /invalid eventtype/i.test(error.message)
  );
});

test("kitchen replay helpers: buildReplayEventQuery builds query from filters", () => {
  const fromDate = new Date("2026-02-20T00:00:00.000Z");
  const toDate = new Date("2026-02-20T23:59:59.000Z");
  const query = buildReplayEventQuery({
    locationId: "default",
    ticketId: "507f191e810c19729de860ea",
    orderId: "507f1f77bcf86cd799439011",
    eventTypes: ["STATUS_UPDATED"],
    fromDate,
    toDate,
  });

  assert.equal(query.locationId, "default");
  assert.equal(query.ticketId, "507f191e810c19729de860ea");
  assert.equal(query.orderId, "507f1f77bcf86cd799439011");
  assert.deepEqual(query.eventType, { $in: ["STATUS_UPDATED"] });
  assert.equal(query.createdAt.$gte, fromDate);
  assert.equal(query.createdAt.$lte, toDate);
});

test("kitchen replay helpers: buildReplayEventQuery validates ids", () => {
  assert.throws(
    () =>
      buildReplayEventQuery({
        locationId: "default",
        ticketId: "bad-id",
      }),
    (error) => /invalid ticketid/i.test(error.message)
  );
});

test("kitchen replay helpers: parseDateFilter validates datetime format", () => {
  assert.equal(parseDateFilter(undefined, "from"), null);
  assert.throws(
    () => parseDateFilter("not-a-date", "from"),
    (error) => /from must be a valid datetime string/i.test(error.message)
  );
});

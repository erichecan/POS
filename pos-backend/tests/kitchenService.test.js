const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { __testables } = require("../utils/kitchenService");

const { routeCodeToStationType, chooseLeastLoadedStation, assignKitchenStationsByLoad } = __testables;

test("kitchen service: routeCodeToStationType maps route codes", () => {
  assert.equal(routeCodeToStationType("HOT_LINE"), "HOT");
  assert.equal(routeCodeToStationType("BAR"), "BAR");
  assert.equal(routeCodeToStationType("DESSERT"), "DESSERT");
  assert.equal(routeCodeToStationType("UNKNOWN"), "HOT");
});

test("kitchen service: chooseLeastLoadedStation picks lowest utilization", () => {
  const candidates = [
    { code: "HOT_A", maxConcurrentTickets: 4, displayOrder: 2 },
    { code: "HOT_B", maxConcurrentTickets: 10, displayOrder: 1 },
  ];
  const loadMap = { HOT_A: 1, HOT_B: 3 };

  const chosen = chooseLeastLoadedStation(candidates, loadMap);
  assert.equal(chosen.code, "HOT_A");
});

test("kitchen service: assignKitchenStationsByLoad balances by station type and load", () => {
  const stations = [
    { code: "HOT_A", status: "ACTIVE", type: "HOT", maxConcurrentTickets: 5, displayOrder: 1 },
    { code: "HOT_B", status: "ACTIVE", type: "HOT", maxConcurrentTickets: 5, displayOrder: 2 },
    { code: "BAR_A", status: "ACTIVE", type: "BAR", maxConcurrentTickets: 3, displayOrder: 1 },
  ];

  const items = [
    { name: "Paneer Butter Masala", quantity: 2, stationCode: "HOT_LINE", status: "NEW" },
    { name: "Masala Chai", quantity: 1, stationCode: "BAR", status: "NEW" },
  ];

  const assigned = assignKitchenStationsByLoad({
    items,
    stations,
    baseLoadMap: { HOT_A: 4, HOT_B: 1, BAR_A: 0 },
  });

  assert.equal(assigned[0].stationCode, "HOT_B");
  assert.equal(assigned[1].stationCode, "BAR_A");
  assert.equal(assigned[0].metadata.loadBalanced, true);
});

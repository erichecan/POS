const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { __testables } = require("../utils/orderPricing");

const {
  isWithinDayPartWindow,
  resolveDayPartPrice,
  pickBestCatalogCandidate,
  scoreCatalogCandidate,
  validateOrderItemsInput,
  normalizeItemModifiersByRule,
} = __testables;

test("orderPricing helpers: daypart window handles same-day and cross-midnight ranges", () => {
  assert.equal(isWithinDayPartWindow(660, 600, 720), true);
  assert.equal(isWithinDayPartWindow(740, 600, 720), false);

  assert.equal(isWithinDayPartWindow(30, 1320, 120), true);
  assert.equal(isWithinDayPartWindow(1400, 1320, 120), true);
  assert.equal(isWithinDayPartWindow(300, 1320, 120), false);
});

test("orderPricing helpers: resolveDayPartPrice applies matching daypart price", () => {
  const menuItem = {
    basePrice: 100,
    dayParts: [
      { startMinute: 600, endMinute: 900, daysOfWeek: [1, 2, 3, 4, 5], price: 80 },
      { startMinute: 900, endMinute: 1320, daysOfWeek: [], price: 120 },
    ],
  };

  const weekdayLunch = new Date("2026-02-23T11:30:00");
  const weekdayDinner = new Date("2026-02-23T19:30:00");
  const weekendLunch = new Date("2026-02-22T11:30:00");

  assert.equal(resolveDayPartPrice(menuItem, weekdayLunch), 80);
  assert.equal(resolveDayPartPrice(menuItem, weekdayDinner), 120);
  assert.equal(resolveDayPartPrice(menuItem, weekendLunch), 100);
});

test("orderPricing helpers: candidate scoring and selection prioritize location/channel/version", () => {
  const target = {
    _id: "b",
    locationId: "store-1",
    channelCode: "UBER",
    versionTag: "v2",
    status: "ACTIVE",
    updatedAt: new Date("2026-02-21T10:00:00.000Z"),
  };

  const fallback = {
    _id: "a",
    locationId: "default",
    channelCode: "ALL",
    versionTag: "v1",
    status: "ACTIVE",
    updatedAt: new Date("2026-02-21T11:00:00.000Z"),
  };

  assert.equal(
    scoreCatalogCandidate({
      candidate: target,
      locationId: "store-1",
      channelCode: "UBER",
      versionTag: "v2",
    }) >
      scoreCatalogCandidate({
        candidate: fallback,
        locationId: "store-1",
        channelCode: "UBER",
        versionTag: "v2",
      }),
    true
  );

  const selected = pickBestCatalogCandidate({
    candidates: [fallback, target],
    locationId: "store-1",
    channelCode: "UBER",
    versionTag: "v2",
  });
  assert.equal(selected._id, "b");
});

test("orderPricing helpers: validateOrderItemsInput sanitizes and validates seatNo", () => {
  const rows = validateOrderItemsInput([
    { name: " Paneer Tikka ", quantity: 2, seatNo: "4" },
    { name: "Masala Chai", quantity: 1 },
  ]);

  assert.equal(rows.length, 2);
  assert.equal(rows[0].normalizedName, "paneer tikka");
  assert.equal(rows[0].seatNo, 4);
  assert.equal(rows[1].seatNo, undefined);

  assert.throws(
    () => validateOrderItemsInput([{ name: "Paneer", quantity: 1, seatNo: 88 }]),
    (error) => /invalid seatno/i.test(error.message)
  );
});

test("orderPricing helpers: rule-based modifiers are canonicalized and tamper-resistant", () => {
  const rows = validateOrderItemsInput([
    {
      name: "Paneer Tikka",
      quantity: 1,
      modifiers: [
        { groupId: "portion_size", optionId: "size_large", priceDelta: 999, name: "HACK" },
        { groupId: "spice_level", optionId: "spice_medium" },
        { groupName: "加料", name: "加蛋", priceDelta: 0 },
      ],
    },
  ]);

  assert.equal(rows.length, 1);
  const sizeModifier = rows[0].modifiers.find((row) => row.groupId === "portion_size");
  assert.ok(sizeModifier);
  assert.equal(sizeModifier.optionId, "size_large");
  assert.equal(sizeModifier.name, "大份");
  assert.equal(sizeModifier.priceDelta, 35);

  const addOnModifier = rows[0].modifiers.find((row) => row.groupId === "add_on");
  assert.ok(addOnModifier);
  assert.equal(addOnModifier.optionId, "addon_egg");
  assert.equal(addOnModifier.priceDelta, 20);
});

test("orderPricing helpers: required modifier group auto-fills default option", () => {
  const rows = validateOrderItemsInput([
    {
      name: "Butter Chicken",
      quantity: 1,
      modifiers: [{ groupId: "spice_level", optionId: "spice_hot" }],
    },
  ]);

  const requiredPortion = rows[0].modifiers.find((row) => row.groupId === "portion_size");
  assert.ok(requiredPortion);
  assert.equal(requiredPortion.optionId, "size_regular");
  assert.equal(requiredPortion.priceDelta, 0);
});

test("orderPricing helpers: rule-based validation rejects illegal option combinations", () => {
  assert.throws(
    () =>
      normalizeItemModifiersByRule({
        itemName: "Paneer Tikka",
        rule: {
          optionGroups: [
            {
              id: "spice_level",
              name: "辣度",
              type: "single",
              required: false,
              options: [
                { id: "spice_none", name: "不辣", priceDelta: 0 },
                { id: "spice_hot", name: "重辣", priceDelta: 0 },
              ],
            },
          ],
        },
        rawModifiers: [
          { groupId: "spice_level", optionId: "spice_none" },
          { groupId: "spice_level", optionId: "spice_hot" },
        ],
      }),
    (error) => /single selection/i.test(error.message)
  );
});

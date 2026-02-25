const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { __testables } = require("../controllers/tableController");

const {
  buildMergedOrderItems,
  buildBillsFromItems,
  normalizeSplitItems,
  buildOrderItemKey,
  normalizeSeatNos,
  splitItemsBySeatNos,
  deductSnapshotItemsFromTarget,
  findMergeHistoryEntry,
} = __testables;

const sourceItems = [
  { name: "Paneer Tikka", quantity: 3, pricePerQuantity: 250, price: 750 },
  { name: "Masala Chai", quantity: 2, pricePerQuantity: 50, price: 100 },
];

test("table helpers: buildOrderItemKey normalizes case, price and seat", () => {
  assert.equal(buildOrderItemKey("Paneer Tikka", 250), "paneer tikka::250::*");
  assert.equal(buildOrderItemKey("  PANEER TIKKA ", 250, 2), "paneer tikka::250::2");
});

test("table helpers: buildMergedOrderItems merges identical lines", () => {
  const merged = buildMergedOrderItems(
    [{ name: "Paneer Tikka", quantity: 1, pricePerQuantity: 250, price: 250, seatNo: 1 }],
    [{ name: "Paneer Tikka", quantity: 2, pricePerQuantity: 250, price: 500, seatNo: 1 }]
  );

  assert.equal(merged.length, 1);
  assert.equal(merged[0].quantity, 3);
  assert.equal(merged[0].price, 750);
  assert.equal(merged[0].seatNo, 1);
});

test("table helpers: buildBillsFromItems calculates tax and total", () => {
  const bills = buildBillsFromItems(sourceItems);
  assert.equal(bills.total, 850);
  assert.equal(bills.tax, 44.63);
  assert.equal(bills.totalWithTax, 894.63);
});

test("table helpers: normalizeSplitItems returns split and remaining lines", () => {
  const { splitItems, remainingItems } = normalizeSplitItems(
    [
      { name: "Paneer Tikka", quantity: 1, seatNo: 1, pricePerQuantity: 250 },
      { name: "Masala Chai", quantity: 1 },
    ],
    [
      { name: "Paneer Tikka", quantity: 3, pricePerQuantity: 250, price: 750, seatNo: 1 },
      { name: "Masala Chai", quantity: 2, pricePerQuantity: 50, price: 100 },
    ]
  );

  assert.equal(splitItems.length, 2);
  assert.equal(remainingItems.length, 2);
  assert.equal(splitItems.find((x) => x.name === "Paneer Tikka").quantity, 1);
  assert.equal(remainingItems.find((x) => x.name === "Paneer Tikka").quantity, 2);
});

test("table helpers: normalizeSeatNos deduplicates and sorts", () => {
  assert.deepEqual(normalizeSeatNos([3, "1", 3, 2]), [1, 2, 3]);
});

test("table helpers: splitItemsBySeatNos splits tagged seat items", () => {
  const { splitItems, remainingItems } = splitItemsBySeatNos(
    [
      { name: "Paneer Tikka", quantity: 1, pricePerQuantity: 250, price: 250, seatNo: 1 },
      { name: "Paneer Tikka", quantity: 1, pricePerQuantity: 250, price: 250, seatNo: 2 },
      { name: "Masala Chai", quantity: 1, pricePerQuantity: 50, price: 50, seatNo: 3 },
    ],
    [1, 2]
  );

  assert.equal(splitItems.length, 2);
  assert.equal(remainingItems.length, 1);
  assert.deepEqual(splitItems.map((item) => item.seatNo).sort(), [1, 2]);
});

test("table helpers: deductSnapshotItemsFromTarget removes merged snapshot quantities", () => {
  const updated = deductSnapshotItemsFromTarget(
    [
      { name: "Paneer Tikka", quantity: 3, pricePerQuantity: 250, price: 750, seatNo: 1 },
      { name: "Masala Chai", quantity: 2, pricePerQuantity: 50, price: 100 },
    ],
    [{ name: "Paneer Tikka", quantity: 1, pricePerQuantity: 250, price: 250, seatNo: 1 }]
  );

  const paneer = updated.find((item) => item.name === "Paneer Tikka");
  assert.equal(paneer.quantity, 2);
  assert.equal(paneer.price, 500);
});

test("table helpers: findMergeHistoryEntry returns latest active when sourceOrderId absent", () => {
  const entry = findMergeHistoryEntry(
    {
      mergeHistory: [
        { sourceOrderId: "s1", unmergedAt: new Date("2026-01-01") },
        { sourceOrderId: "s2" },
      ],
    },
    ""
  );
  assert.equal(`${entry.sourceOrderId}`, "s2");
});

test("table helpers: findMergeHistoryEntry resolves by sourceOrderId", () => {
  const entry = findMergeHistoryEntry(
    {
      mergeHistory: [
        { sourceOrderId: "s1" },
        { sourceOrderId: "s2" },
      ],
    },
    "s1"
  );
  assert.equal(`${entry.sourceOrderId}`, "s1");
});

test("table helpers: normalizeSplitItems rejects ambiguous price lines", () => {
  assert.throws(
    () =>
      normalizeSplitItems(
        [{ name: "Paneer Tikka", quantity: 1 }],
        [
          { name: "Paneer Tikka", quantity: 1, pricePerQuantity: 200, price: 200 },
          { name: "Paneer Tikka", quantity: 1, pricePerQuantity: 250, price: 250 },
        ]
      ),
    (error) => /multiple prices/i.test(error.message)
  );
});

test("table helpers: normalizeSplitItems rejects full split", () => {
  assert.throws(
    () =>
      normalizeSplitItems(
        [{ name: "Paneer Tikka", quantity: 3 }, { name: "Masala Chai", quantity: 2 }],
        sourceItems
      ),
    (error) => /cannot move all items/i.test(error.message)
  );
});

test("table helpers: normalizeSplitItems rejects over-quantity", () => {
  assert.throws(
    () =>
      normalizeSplitItems([{ name: "Paneer Tikka", quantity: 9 }], sourceItems),
    (error) => /exceeds source quantity/i.test(error.message)
  );
});

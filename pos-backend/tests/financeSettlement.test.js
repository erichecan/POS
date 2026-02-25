const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { calculateSettlementMetrics, toSettlementCsv } = require("../utils/financeSettlement");

test("finance settlement: calculates metrics and reconciliation gaps", () => {
  const order1 = {
    _id: "o1",
    paymentMethod: "Cash",
    bills: {
      subtotalBeforeDiscount: 100,
      discountTotal: 10,
      tax: 4.73,
      totalWithTax: 94.73,
    },
  };
  const order2 = {
    _id: "o2",
    paymentMethod: "Online",
    bills: {
      subtotalBeforeDiscount: 200,
      discountTotal: 0,
      tax: 10.5,
      totalWithTax: 210.5,
    },
  };

  const payment1 = {
    orderDbId: "o2",
    amount: 210.5,
    verified: true,
    refundAmountTotal: 10,
  };

  const metrics = calculateSettlementMetrics({ orders: [order1, order2], payments: [payment1] });

  assert.equal(metrics.orderCount, 2);
  assert.equal(metrics.paymentCount, 1);
  assert.equal(metrics.grossSales, 300);
  assert.equal(metrics.discountTotal, 10);
  assert.equal(metrics.netSales, 305.23);
  assert.equal(metrics.cashSales, 94.73);
  assert.equal(metrics.refundTotal, 10);
  assert.equal(metrics.reconciliationGapCount, 0);
});

test("finance settlement: toSettlementCsv exports expected fields", () => {
  const csv = toSettlementCsv({
    settlement: {
      _id: "s1",
      locationId: "default",
      startAt: new Date("2026-02-21T00:00:00.000Z"),
      endAt: new Date("2026-02-22T00:00:00.000Z"),
      currency: "EUR",
      status: "GENERATED",
      metrics: { orderCount: 2, netSales: 100 },
    },
  });

  assert.equal(csv.includes("\"settlementId\""), true);
  assert.equal(csv.includes("\"netSales\",\"100\""), true);
});

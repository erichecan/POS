const roundToTwo = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const calculateSettlementMetrics = ({ orders = [], payments = [] }) => {
  const safeOrders = Array.isArray(orders) ? orders : [];
  const safePayments = Array.isArray(payments) ? payments : [];

  const grossSales = roundToTwo(
    safeOrders.reduce((sum, order) => sum + Number(order?.bills?.subtotalBeforeDiscount || order?.bills?.total || 0), 0)
  );
  const discountTotal = roundToTwo(
    safeOrders.reduce((sum, order) => sum + Number(order?.bills?.discountTotal || 0), 0)
  );
  const taxTotal = roundToTwo(
    safeOrders.reduce((sum, order) => sum + Number(order?.bills?.tax || 0), 0)
  );
  const netSales = roundToTwo(
    safeOrders.reduce((sum, order) => sum + Number(order?.bills?.totalWithTax || 0), 0)
  );

  const cashSales = roundToTwo(
    safeOrders
      .filter((order) => `${order?.paymentMethod || ""}` === "Cash")
      .reduce((sum, order) => sum + Number(order?.bills?.totalWithTax || 0), 0)
  );

  const onlineSales = roundToTwo(Math.max(netSales - cashSales, 0));

  const refundTotal = roundToTwo(
    safePayments.reduce((sum, payment) => sum + Number(payment?.refundAmountTotal || 0), 0)
  );

  const paymentByOrderDbId = new Map(
    safePayments
      .filter((payment) => payment?.orderDbId)
      .map((payment) => [`${payment.orderDbId}`, payment])
  );

  const reconciliationGapCount = safeOrders.reduce((sum, order) => {
    if (`${order?.paymentMethod || ""}` !== "Online") {
      return sum;
    }

    const payment = paymentByOrderDbId.get(`${order?._id}`);
    if (!payment || !payment.verified) {
      return sum + 1;
    }

    const delta = Math.abs(Number(payment.amount || 0) - Number(order?.bills?.totalWithTax || 0));
    return delta > 0.01 ? sum + 1 : sum;
  }, 0);

  return {
    orderCount: safeOrders.length,
    paymentCount: safePayments.length,
    grossSales,
    discountTotal,
    taxTotal,
    netSales,
    cashSales,
    onlineSales,
    refundTotal,
    reconciliationGapCount,
  };
};

const toSettlementCsv = ({ settlement }) => {
  const metrics = settlement?.metrics || {};
  const rows = [
    ["settlementId", settlement?._id || ""],
    ["locationId", settlement?.locationId || ""],
    ["startAt", settlement?.startAt ? new Date(settlement.startAt).toISOString() : ""],
    ["endAt", settlement?.endAt ? new Date(settlement.endAt).toISOString() : ""],
    ["currency", settlement?.currency || ""],
    ["status", settlement?.status || ""],
    ["orderCount", metrics.orderCount || 0],
    ["paymentCount", metrics.paymentCount || 0],
    ["grossSales", metrics.grossSales || 0],
    ["discountTotal", metrics.discountTotal || 0],
    ["taxTotal", metrics.taxTotal || 0],
    ["netSales", metrics.netSales || 0],
    ["cashSales", metrics.cashSales || 0],
    ["onlineSales", metrics.onlineSales || 0],
    ["refundTotal", metrics.refundTotal || 0],
    ["reconciliationGapCount", metrics.reconciliationGapCount || 0],
  ];

  return rows.map((row) => row.map((value) => `"${`${value}`.replace(/"/g, '""')}"`).join(",")).join("\n");
};

module.exports = {
  roundToTwo,
  calculateSettlementMetrics,
  toSettlementCsv,
};

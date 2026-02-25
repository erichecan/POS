const createHttpError = require("http-errors");
const Order = require("../models/orderModel");
const Payment = require("../models/paymentModel");
const KitchenTicket = require("../models/kitchenTicketModel");

const normalizeLocationId = (value) => `${value || ""}`.trim() || "default";

const parseDateRange = (from, to) => {
  const now = new Date();
  const fromDate = from ? new Date(from) : new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const toDate = to ? new Date(to) : now;

  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw createHttpError(400, "from/to must be valid datetime strings.");
  }

  if (toDate <= fromDate) {
    throw createHttpError(400, "to must be later than from.");
  }

  return { fromDate, toDate };
};

const roundToTwo = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const getOverview = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.query.locationId);
    const { fromDate, toDate } = parseDateRange(req.query.from, req.query.to);

    const orderQuery = { locationId, createdAt: { $gte: fromDate, $lt: toDate } };
    const paymentQuery = { createdAt: { $gte: fromDate, $lt: toDate } };
    const kitchenQuery = { locationId, createdAt: { $gte: fromDate, $lt: toDate } };

    const [orders, payments, kitchenTickets] = await Promise.all([
      Order.find(orderQuery).lean(),
      Payment.find(paymentQuery).lean(),
      KitchenTicket.find(kitchenQuery).lean(),
    ]);

    const sales = roundToTwo(orders.reduce((sum, order) => sum + Number(order?.bills?.totalWithTax || 0), 0));
    const discounts = roundToTwo(orders.reduce((sum, order) => sum + Number(order?.bills?.discountTotal || 0), 0));
    const avgTicket = orders.length ? roundToTwo(sales / orders.length) : 0;
    const paymentFailures = payments.filter((payment) => !payment.verified).length;
    const paymentFailureRate = payments.length
      ? roundToTwo((paymentFailures / payments.length) * 100)
      : 0;

    const readyDurations = kitchenTickets
      .filter((ticket) => ticket.readyAt && ticket.firedAt)
      .map((ticket) => Math.max((new Date(ticket.readyAt).getTime() - new Date(ticket.firedAt).getTime()) / 60000, 0));

    const kitchenAvgReadyMinutes = readyDurations.length
      ? roundToTwo(readyDurations.reduce((sum, value) => sum + value, 0) / readyDurations.length)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        locationId,
        from: fromDate,
        to: toDate,
        orderCount: orders.length,
        sales,
        discounts,
        avgTicket,
        paymentCount: payments.length,
        paymentFailureRate,
        kitchenTicketCount: kitchenTickets.length,
        kitchenAvgReadyMinutes,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getSalesByItem = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.query.locationId);
    const { fromDate, toDate } = parseDateRange(req.query.from, req.query.to);

    const rows = await Order.aggregate([
      {
        $match: {
          locationId,
          createdAt: { $gte: fromDate, $lt: toDate },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          quantity: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.price" },
        },
      },
      { $sort: { revenue: -1, quantity: -1 } },
      { $limit: 100 },
    ]);

    return res.status(200).json({
      success: true,
      data: rows.map((row) => ({
        itemName: row._id,
        quantity: row.quantity,
        revenue: roundToTwo(row.revenue),
      })),
    });
  } catch (error) {
    return next(error);
  }
};

const exportOrdersCsv = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.query.locationId);
    const { fromDate, toDate } = parseDateRange(req.query.from, req.query.to);

    const orders = await Order.find({
      locationId,
      createdAt: { $gte: fromDate, $lt: toDate },
    })
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    const header = [
      "orderId",
      "createdAt",
      "status",
      "paymentMethod",
      "subtotalBeforeDiscount",
      "discountTotal",
      "tax",
      "totalWithTax",
      "sourceType",
      "memberId",
    ];

    const lines = [header.join(",")];
    for (const order of orders) {
      lines.push(
        [
          order._id,
          new Date(order.createdAt).toISOString(),
          order.orderStatus,
          order.paymentMethod,
          Number(order?.bills?.subtotalBeforeDiscount || order?.bills?.total || 0),
          Number(order?.bills?.discountTotal || 0),
          Number(order?.bills?.tax || 0),
          Number(order?.bills?.totalWithTax || 0),
          order.sourceType,
          order.memberId || "",
        ]
          .map((value) => `"${`${value}`.replace(/"/g, '""')}"`)
          .join(",")
      );
    }

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=analytics_orders_${locationId}_${Date.now()}.csv`
    );

    return res.status(200).send(lines.join("\n"));
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getOverview,
  getSalesByItem,
  exportOrdersCsv,
};

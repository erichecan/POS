const KitchenStation = require("../models/kitchenStationModel");
const KitchenTicket = require("../models/kitchenTicketModel");
const KitchenTicketEvent = require("../models/kitchenTicketEventModel");
const Order = require("../models/orderModel");
const { routeItemToStationCode } = require("./kitchenRouting");
const config = require("../config/config");

const DEFAULT_STATIONS = [
  { code: "HOT_LINE", displayName: "Hot Line", type: "HOT", displayOrder: 1 },
  { code: "COLD", displayName: "Cold/Garde Manger", type: "COLD", displayOrder: 2 },
  { code: "BAR", displayName: "Bar/Drinks", type: "BAR", displayOrder: 3 },
  { code: "PIZZA", displayName: "Pizza Station", type: "PIZZA", displayOrder: 4 },
  { code: "DESSERT", displayName: "Dessert", type: "DESSERT", displayOrder: 5 },
  { code: "EXPO", displayName: "Expo", type: "EXPO", displayOrder: 6 },
];

const normalizeLocationId = (locationId) => `${locationId || ""}`.trim() || "default";

const OPEN_ITEM_STATUSES = new Set(["NEW", "PREPARING"]);

const routeCodeToStationType = (routeCode) => {
  const normalized = `${routeCode || ""}`.trim().toUpperCase();
  if (normalized === "HOT_LINE") return "HOT";
  if (normalized === "COLD") return "COLD";
  if (normalized === "BAR") return "BAR";
  if (normalized === "PIZZA") return "PIZZA";
  if (normalized === "DESSERT") return "DESSERT";
  if (normalized === "EXPO") return "EXPO";
  return "HOT";
};

const resolveSlaMinutes = (priority = "NORMAL") => {
  const rushSla = Number(config.kitchenSlaRushMinutes || 12);
  const normalSla = Number(config.kitchenSlaNormalMinutes || 20);
  return priority === "RUSH" ? Math.max(rushSla, 1) : Math.max(normalSla, 1);
};

const ensureDefaultStations = async (locationId) => {
  const normalizedLocationId = normalizeLocationId(locationId);
  await Promise.all(
    DEFAULT_STATIONS.map((station) =>
      KitchenStation.updateOne(
        { locationId: normalizedLocationId, code: station.code },
        {
          $setOnInsert: {
            locationId: normalizedLocationId,
            ...station,
            status: "ACTIVE",
            maxConcurrentTickets: 20,
          },
        },
        { upsert: true }
      )
    )
  );
};

const buildKitchenItems = (orderItems = []) =>
  orderItems.map((item) => ({
    name: item.name,
    quantity: item.quantity,
    stationCode: routeItemToStationCode(item.name),
    status: "NEW",
  }));

const getStationOpenLoadMap = async (locationId) => {
  const rows = await KitchenTicket.aggregate([
    {
      $match: {
        locationId,
        status: { $in: ["NEW", "PREPARING"] },
      },
    },
    { $unwind: "$items" },
    { $match: { "items.status": { $in: ["NEW", "PREPARING"] } } },
    {
      $group: {
        _id: "$items.stationCode",
        count: { $sum: "$items.quantity" },
      },
    },
  ]);

  return rows.reduce((acc, row) => {
    acc[row._id] = row.count;
    return acc;
  }, {});
};

const chooseLeastLoadedStation = (candidates, loadMap = {}) => {
  if (!Array.isArray(candidates) || candidates.length === 0) {
    return null;
  }

  const enriched = candidates.map((station) => {
    const load = Number(loadMap[station.code] || 0);
    const capacity = Math.max(Number(station.maxConcurrentTickets || 1), 1);
    const utilization = load / capacity;
    return {
      station,
      load,
      capacity,
      utilization,
    };
  });

  enriched.sort((a, b) => {
    if (a.utilization !== b.utilization) return a.utilization - b.utilization;
    if (a.load !== b.load) return a.load - b.load;
    if (a.station.displayOrder !== b.station.displayOrder) {
      return a.station.displayOrder - b.station.displayOrder;
    }
    return `${a.station.code}`.localeCompare(`${b.station.code}`);
  });

  return enriched[0].station;
};

const assignKitchenStationsByLoad = ({ items, stations, baseLoadMap = {} }) => {
  const safeItems = Array.isArray(items) ? items : [];
  const safeStations = Array.isArray(stations) ? stations : [];
  const mutableLoad = { ...baseLoadMap };

  return safeItems.map((item) => {
    const routeCode = `${item.stationCode || ""}`.trim().toUpperCase();
    const routeType = routeCodeToStationType(routeCode);
    const candidatesByType = safeStations.filter(
      (station) => station.status === "ACTIVE" && station.type === routeType
    );

    let targetStation = chooseLeastLoadedStation(candidatesByType, mutableLoad);
    if (!targetStation) {
      const directCodeMatch = safeStations.find(
        (station) => station.status === "ACTIVE" && station.code === routeCode
      );
      targetStation = directCodeMatch || null;
    }

    if (!targetStation) {
      return item;
    }

    const quantity = Math.max(Number(item.quantity || 1), 1);
    mutableLoad[targetStation.code] = Number(mutableLoad[targetStation.code] || 0) + quantity;

    return {
      ...item,
      stationCode: targetStation.code,
      metadata: {
        ...(item.metadata || {}),
        stationType: targetStation.type,
        loadBalanced: true,
      },
    };
  });
};

const createKitchenTicketForOrder = async (order, actor = null) => {
  if (!order) {
    return null;
  }

  const existing = await KitchenTicket.findOne({ orderId: order._id });
  if (existing) {
    return existing;
  }

  const locationId = normalizeLocationId(order.locationId);
  await ensureDefaultStations(locationId);
  const [activeStations, stationLoadMap] = await Promise.all([
    KitchenStation.find({ locationId, status: "ACTIVE" })
      .sort({ displayOrder: 1, code: 1 })
      .lean(),
    getStationOpenLoadMap(locationId),
  ]);
  const priority = "NORMAL";
  const slaMinutes = resolveSlaMinutes(priority);
  const now = new Date();
  const baseItems = buildKitchenItems(order.items);
  const routedItems = assignKitchenStationsByLoad({
    items: baseItems,
    stations: activeStations,
    baseLoadMap: stationLoadMap,
  });

  const ticket = await KitchenTicket.create({
    orderId: order._id,
    locationId,
    sourceType: order.sourceType,
    fulfillmentType: order.fulfillmentType,
    status: order.orderStatus === "Cancelled" ? "CANCELLED" : "NEW",
    priority,
    slaMinutes,
    targetReadyAt: new Date(now.getTime() + slaMinutes * 60 * 1000),
    lastStatusChangeAt: now,
    customerName: order.customerDetails?.name,
    table: order.table || undefined,
    items: routedItems,
    firedAt: now,
  });

  await KitchenTicketEvent.create({
    ticketId: ticket._id,
    orderId: ticket.orderId,
    locationId: ticket.locationId,
    eventType: "TICKET_CREATED",
    actorId: actor?._id,
    actorRole: actor?.role,
    payload: {
      sourceType: ticket.sourceType,
      fulfillmentType: ticket.fulfillmentType,
      priority: ticket.priority,
      slaMinutes: ticket.slaMinutes,
      targetReadyAt: ticket.targetReadyAt,
    },
  });

  return ticket;
};

const syncOrderStatusWithKitchenTicket = async (ticket) => {
  if (!ticket?.orderId) {
    return null;
  }

  const order = await Order.findById(ticket.orderId);
  if (!order) {
    return null;
  }

  let desiredStatus = null;

  if (ticket.status === "CANCELLED") {
    desiredStatus = "Cancelled";
  } else if (ticket.status === "READY" || ticket.status === "EXPO_CONFIRMED") {
    desiredStatus = "Ready";
  } else if (ticket.status === "NEW" || ticket.status === "PREPARING") {
    desiredStatus = "In Progress";
  }

  if (desiredStatus && order.orderStatus !== desiredStatus) {
    order.orderStatus = desiredStatus;
    await order.save();
  }

  return order;
};

module.exports = {
  normalizeLocationId,
  ensureDefaultStations,
  createKitchenTicketForOrder,
  syncOrderStatusWithKitchenTicket,
  resolveSlaMinutes,
  __testables: {
    routeCodeToStationType,
    chooseLeastLoadedStation,
    assignKitchenStationsByLoad,
  },
};

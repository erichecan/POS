const Table = require("../models/tableModel");
const Order = require("../models/orderModel");
const createHttpError = require("http-errors");
const mongoose = require("mongoose")
const { logAuditEvent } = require("../utils/auditLogger");
const { TAX_RATE } = require("../utils/orderPricing");

const ALLOWED_TABLE_STATUSES = ["Available", "Booked"];

const addTable = async (req, res, next) => {
  try {
    const { tableNo, seats } = req.body;
    const parsedTableNo = Number(tableNo);
    const parsedSeats = Number(seats);

    if (!Number.isInteger(parsedTableNo) || parsedTableNo < 1) {
      const error = createHttpError(400, "Please provide table No!");
      return next(error);
    }

    if (!Number.isInteger(parsedSeats) || parsedSeats < 1 || parsedSeats > 20) {
      const error = createHttpError(400, "Seats must be between 1 and 20.");
      return next(error);
    }

    const isTablePresent = await Table.findOne({ tableNo: parsedTableNo });

    if (isTablePresent) {
      const error = createHttpError(400, "Table already exist!");
      return next(error);
    }

    const newTable = new Table({ tableNo: parsedTableNo, seats: parsedSeats });
    await newTable.save();

    await logAuditEvent({
      req,
      action: "TABLE_CREATED",
      resourceType: "Table",
      resourceId: newTable._id,
      statusCode: 201,
      metadata: {
        tableNo: newTable.tableNo,
        seats: newTable.seats,
      },
    });

    res
      .status(201)
      .json({ success: true, message: "Table added!", data: newTable });
  } catch (error) {
    next(error);
  }
};

const getTables = async (req, res, next) => {
  try {
    // 2026-02-24T12:00:00Z: include mergeHistory for unmerge UI in Tables page
    const tables = await Table.find().populate({
      path: "currentOrder",
      select: "customerDetails orderDate orderStatus paymentMethod items bills sourceType mergeHistory"
    });
    res.status(200).json({ success: true, data: tables });
  } catch (error) {
    next(error);
  }
};

const updateTable = async (req, res, next) => {
  try {
    const { status, orderId } = req.body;

    const { id } = req.params;

    if(!mongoose.Types.ObjectId.isValid(id)){
        const error = createHttpError(404, "Invalid id!");
        return next(error);
    }

    if (!ALLOWED_TABLE_STATUSES.includes(status)) {
      return next(createHttpError(400, "Invalid table status."));
    }

    let currentOrder = null;
    if (status === "Booked") {
      if (!orderId || !mongoose.Types.ObjectId.isValid(orderId)) {
        return next(createHttpError(400, "A valid order id is required for booked tables."));
      }
      currentOrder = orderId;
    }

    const table = await Table.findByIdAndUpdate(id, { status, currentOrder }, { new: true });

    if (!table) {
      const error = createHttpError(404, "Table not found!");
      return next(error);
    }

    await logAuditEvent({
      req,
      action: "TABLE_UPDATED",
      resourceType: "Table",
      resourceId: table._id,
      statusCode: 200,
      metadata: {
        status: table.status,
        currentOrder: table.currentOrder,
      },
    });

    res.status(200).json({success: true, message: "Table updated!", data: table});

  } catch (error) {
    next(error);
  }
};

const transferTableOrder = async (req, res, next) => {
  try {
    const fromTableId = `${req.body.fromTableId || ""}`.trim();
    const toTableId = `${req.body.toTableId || ""}`.trim();

    if (!mongoose.Types.ObjectId.isValid(fromTableId) || !mongoose.Types.ObjectId.isValid(toTableId)) {
      return next(createHttpError(400, "fromTableId and toTableId must be valid ids."));
    }

    if (fromTableId === toTableId) {
      return next(createHttpError(400, "Source and destination tables must be different."));
    }

    const [fromTable, toTable] = await Promise.all([
      Table.findById(fromTableId),
      Table.findById(toTableId),
    ]);

    if (!fromTable || !toTable) {
      return next(createHttpError(404, "One or both tables not found."));
    }

    if (fromTable.status !== "Booked" || !fromTable.currentOrder) {
      return next(createHttpError(409, "Source table does not have an active order."));
    }

    if (toTable.status !== "Available" || toTable.currentOrder) {
      return next(createHttpError(409, "Destination table is not available."));
    }

    const order = await Order.findById(fromTable.currentOrder);
    if (!order) {
      return next(createHttpError(404, "Active order linked to source table not found."));
    }

    if (order.fulfillmentType !== "DINE_IN") {
      return next(createHttpError(409, "Only dine-in orders can be transferred between tables."));
    }

    if (["Completed", "Cancelled"].includes(order.orderStatus)) {
      return next(createHttpError(409, "Completed/cancelled orders cannot be transferred."));
    }

    order.table = toTable._id;
    await order.save();

    fromTable.status = "Available";
    fromTable.currentOrder = null;
    toTable.status = "Booked";
    toTable.currentOrder = order._id;

    await Promise.all([fromTable.save(), toTable.save()]);

    await logAuditEvent({
      req,
      action: "TABLE_ORDER_TRANSFERRED",
      resourceType: "Order",
      resourceId: order._id,
      statusCode: 200,
      metadata: {
        fromTableId,
        toTableId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Order transferred successfully.",
      data: {
        order,
        fromTable,
        toTable,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const roundToTwo = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

const normalizeModifierSnapshot = (modifiers = []) => {
  if (!Array.isArray(modifiers) || modifiers.length === 0) {
    return [];
  }
  return modifiers.map((modifier) => ({
    groupId: `${modifier?.groupId || ""}`.trim(),
    groupName: `${modifier?.groupName || ""}`.trim(),
    optionId: `${modifier?.optionId || ""}`.trim(),
    name: `${modifier?.name || ""}`.trim(),
    priceDelta: Number(modifier?.priceDelta || 0),
  }));
};

const serializeModifiersKey = (modifiers = []) => {
  const normalized = normalizeModifierSnapshot(modifiers)
    .map((modifier) => `${modifier.groupId}|${modifier.optionId}|${modifier.name}|${modifier.priceDelta}`)
    .sort();
  return normalized.join(",");
};

const buildMergedOrderItems = (targetItems = [], sourceItems = []) => {
  const itemMap = new Map();

  const upsert = (item) => {
    const key = buildOrderItemKey(
      item.name,
      item.pricePerQuantity,
      item.seatNo,
      item.note,
      item.modifiers
    );
    const prev = itemMap.get(key);
    const quantity = Number(item.quantity || 0);
    const basePrice = Number(item.basePrice || 0);
    const pricePerQuantity = Number(item.pricePerQuantity || 0);
    const seatNo = item.seatNo === undefined || item.seatNo === null ? undefined : Number(item.seatNo);
    const note = `${item.note || ""}`.trim();
    const modifiers = normalizeModifierSnapshot(item.modifiers);

    if (!prev) {
      itemMap.set(key, {
        name: `${item.name || ""}`.trim(),
        quantity,
        basePrice,
        pricePerQuantity,
        seatNo,
        note,
        modifiers,
      });
      return;
    }

    prev.quantity += quantity;
  };

  [...targetItems, ...sourceItems].forEach(upsert);

  return Array.from(itemMap.values()).map((item) => ({
    name: item.name,
    quantity: item.quantity,
    basePrice: item.basePrice,
    pricePerQuantity: item.pricePerQuantity,
    price: roundToTwo(item.quantity * item.pricePerQuantity),
    seatNo: item.seatNo,
    note: item.note,
    modifiers: item.modifiers,
  }));
};

const buildBillsFromItems = (items = []) => {
  const total = roundToTwo(items.reduce((sum, item) => sum + Number(item.price || 0), 0));
  const tax = roundToTwo((total * TAX_RATE) / 100);
  return {
    total,
    tax,
    totalWithTax: roundToTwo(total + tax),
  };
};

const assertMergeableOrder = (order, label) => {
  if (!order) {
    throw createHttpError(404, `${label} order not found.`);
  }

  if (order.fulfillmentType !== "DINE_IN") {
    throw createHttpError(409, `${label} order is not dine-in.`);
  }

  if (!["Cash", "Pending"].includes(order.paymentMethod)) {
    throw createHttpError(409, `${label} order payment method is not mergeable.`);
  }

  if (["Completed", "Cancelled"].includes(order.orderStatus)) {
    throw createHttpError(409, `${label} order is already closed.`);
  }
};

const mergeTableOrders = async (req, res, next) => {
  try {
    const fromTableId = `${req.body.fromTableId || ""}`.trim();
    const toTableId = `${req.body.toTableId || ""}`.trim();

    if (!mongoose.Types.ObjectId.isValid(fromTableId) || !mongoose.Types.ObjectId.isValid(toTableId)) {
      return next(createHttpError(400, "fromTableId and toTableId must be valid ids."));
    }

    if (fromTableId === toTableId) {
      return next(createHttpError(400, "Source and target tables must be different."));
    }

    const [fromTable, toTable] = await Promise.all([Table.findById(fromTableId), Table.findById(toTableId)]);
    if (!fromTable || !toTable) {
      return next(createHttpError(404, "One or both tables not found."));
    }

    if (fromTable.status !== "Booked" || !fromTable.currentOrder) {
      return next(createHttpError(409, "Source table does not have an active order."));
    }

    if (toTable.status !== "Booked" || !toTable.currentOrder) {
      return next(createHttpError(409, "Target table must already have an active order for merge."));
    }

    if (`${fromTable.currentOrder}` === `${toTable.currentOrder}`) {
      return next(createHttpError(409, "Both tables already point to the same order."));
    }

    const [fromOrder, toOrder] = await Promise.all([
      Order.findById(fromTable.currentOrder),
      Order.findById(toTable.currentOrder),
    ]);

    assertMergeableOrder(fromOrder, "Source");
    assertMergeableOrder(toOrder, "Target");

    const mergedItems = buildMergedOrderItems(toOrder.items, fromOrder.items);
    if (mergedItems.length === 0) {
      return next(createHttpError(409, "No order items available to merge."));
    }
    const sourceSnapshot = {
      sourceOrderId: fromOrder._id,
      sourceTableId: fromTable._id,
      mergedAt: new Date(),
      sourceCustomerDetails: {
        name: fromOrder.customerDetails?.name,
        phone: fromOrder.customerDetails?.phone,
        guests: Number(fromOrder.customerDetails?.guests || 1),
      },
      sourceBills: {
        total: Number(fromOrder.bills?.total || 0),
        tax: Number(fromOrder.bills?.tax || 0),
        totalWithTax: Number(fromOrder.bills?.totalWithTax || 0),
      },
      sourceItems: (fromOrder.items || []).map((item) => ({
        name: item.name,
        quantity: Number(item.quantity || 0),
        basePrice: Number(item.basePrice || 0),
        pricePerQuantity: Number(item.pricePerQuantity || 0),
        price: Number(item.price || 0),
        seatNo: item.seatNo === undefined || item.seatNo === null ? undefined : Number(item.seatNo),
        note: `${item.note || ""}`.trim(),
        modifiers: normalizeModifierSnapshot(item.modifiers),
      })),
    };

    toOrder.items = mergedItems;
    toOrder.bills = buildBillsFromItems(mergedItems);
    toOrder.customerDetails = {
      name: toOrder.customerDetails?.name,
      phone: toOrder.customerDetails?.phone,
      guests: Math.min(
        Number(toOrder.customerDetails?.guests || 1) + Number(fromOrder.customerDetails?.guests || 1),
        50
      ),
    };
    toOrder.mergeHistory = [...(toOrder.mergeHistory || []), sourceSnapshot];

    fromOrder.orderStatus = "Cancelled";
    fromOrder.table = null;
    fromTable.status = "Available";
    fromTable.currentOrder = null;
    toTable.status = "Booked";
    toTable.currentOrder = toOrder._id;

    await Promise.all([toOrder.save(), fromOrder.save(), fromTable.save(), toTable.save()]);

    await logAuditEvent({
      req,
      action: "TABLE_ORDERS_MERGED",
      resourceType: "Order",
      resourceId: toOrder._id,
      statusCode: 200,
      metadata: {
        fromTableId,
        toTableId,
        sourceOrderId: fromOrder._id,
        targetOrderId: toOrder._id,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Table orders merged successfully.",
      data: {
        sourceOrder: fromOrder,
        targetOrder: toOrder,
        fromTable,
        toTable,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const buildOrderItemKey = (itemName, pricePerQuantity, seatNo, note = "", modifiers = []) => {
  const seatTag =
    seatNo === undefined || seatNo === null || `${seatNo}`.trim() === ""
      ? "*"
      : Number(seatNo);
  const noteTag = `${note || ""}`.trim().toLowerCase();
  const modifierTag = serializeModifiersKey(modifiers);
  if (!noteTag && !modifierTag) {
    return `${`${itemName || ""}`.trim().toLowerCase()}::${Number(pricePerQuantity || 0)}::${seatTag}`;
  }
  return `${`${itemName || ""}`.trim().toLowerCase()}::${Number(pricePerQuantity || 0)}::${seatTag}::${noteTag}::${modifierTag}`;
};

const normalizeSplitItems = (rawItems, sourceOrderItems) => {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    throw createHttpError(400, "items must be a non-empty array.");
  }

  const sourceMap = new Map();
  const sourceNameMap = new Map();
  sourceOrderItems.forEach((item) => {
    const key = buildOrderItemKey(
      item.name,
      item.pricePerQuantity,
      item.seatNo,
      item.note,
      item.modifiers
    );
    sourceMap.set(key, {
      name: `${item.name || ""}`.trim(),
      basePrice: Number(item.basePrice || 0),
      pricePerQuantity: Number(item.pricePerQuantity || 0),
      quantity: Number(item.quantity || 0),
      seatNo: item.seatNo === undefined || item.seatNo === null ? undefined : Number(item.seatNo),
      note: `${item.note || ""}`.trim(),
      modifiers: normalizeModifierSnapshot(item.modifiers),
    });

    const nameKey = `${item.name || ""}`.trim().toLowerCase();
    const keys = sourceNameMap.get(nameKey) || [];
    keys.push(key);
    sourceNameMap.set(nameKey, keys);
  });

  const requestedMap = new Map();

  rawItems.forEach((item) => {
    const name = `${item?.name || ""}`.trim();
    const quantity = Number(item?.quantity);
    const explicitPrice = item?.pricePerQuantity;
    const explicitSeatNo = item?.seatNo;

    if (!name) {
      throw createHttpError(400, "Each split item must contain name.");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw createHttpError(400, `Invalid quantity for split item ${name}.`);
    }

    const nameKey = name.toLowerCase();
    const candidateKeys = sourceNameMap.get(nameKey) || [];
    if (candidateKeys.length === 0) {
      throw createHttpError(409, `Item ${name} does not exist in source order.`);
    }

    let key = "";
    if (explicitPrice !== undefined && explicitPrice !== null && `${explicitPrice}`.trim() !== "") {
      key = buildOrderItemKey(name, Number(explicitPrice), explicitSeatNo);
      if (!sourceMap.has(key)) {
        throw createHttpError(
          409,
          `Item ${name} with price ${explicitPrice} and seat ${
            explicitSeatNo ?? "*"
          } not found in source order.`
        );
      }
    } else if (candidateKeys.length === 1) {
      key = candidateKeys[0];
    } else {
      throw createHttpError(
        400,
        `Item ${name} appears with multiple prices; please provide pricePerQuantity.`
      );
    }

    requestedMap.set(key, (requestedMap.get(key) || 0) + quantity);
  });

  requestedMap.forEach((requestedQty, key) => {
    const source = sourceMap.get(key);
    if (!source) {
      throw createHttpError(409, "Split item mismatch with source order.");
    }
    if (requestedQty > source.quantity) {
      throw createHttpError(
        409,
        `Requested split quantity (${requestedQty}) exceeds source quantity (${source.quantity}) for ${source.name}.`
      );
    }
  });

  const splitItems = [];
  const remainingItems = [];

  sourceMap.forEach((source, key) => {
    const splitQty = requestedMap.get(key) || 0;
    const remainQty = source.quantity - splitQty;

    if (splitQty > 0) {
      splitItems.push({
        name: source.name,
        quantity: splitQty,
        basePrice: source.basePrice,
        pricePerQuantity: source.pricePerQuantity,
        price: roundToTwo(splitQty * source.pricePerQuantity),
        seatNo: source.seatNo,
        note: source.note,
        modifiers: source.modifiers,
      });
    }

    if (remainQty > 0) {
      remainingItems.push({
        name: source.name,
        quantity: remainQty,
        basePrice: source.basePrice,
        pricePerQuantity: source.pricePerQuantity,
        price: roundToTwo(remainQty * source.pricePerQuantity),
        seatNo: source.seatNo,
        note: source.note,
        modifiers: source.modifiers,
      });
    }
  });

  if (splitItems.length === 0) {
    throw createHttpError(409, "No items selected for split.");
  }

  if (remainingItems.length === 0) {
    throw createHttpError(409, "Split cannot move all items. Use transfer for full move.");
  }

  return { splitItems, remainingItems };
};

const normalizeSeatNos = (rawSeatNos) => {
  if (!Array.isArray(rawSeatNos) || rawSeatNos.length === 0) {
    throw createHttpError(400, "seatNos must be a non-empty array.");
  }

  const seatSet = new Set();
  rawSeatNos.forEach((seatNo) => {
    const parsed = Number(seatNo);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
      throw createHttpError(400, `Invalid seatNo: ${seatNo}`);
    }
    seatSet.add(parsed);
  });

  return Array.from(seatSet).sort((a, b) => a - b);
};

const splitItemsBySeatNos = (sourceOrderItems, seatNos) => {
  const normalizedSeatSet = new Set(normalizeSeatNos(seatNos));
  const splitItems = [];
  const remainingItems = [];

  for (const sourceItem of sourceOrderItems || []) {
    const seatNo = sourceItem.seatNo === undefined || sourceItem.seatNo === null
      ? undefined
      : Number(sourceItem.seatNo);

    const line = {
      name: `${sourceItem.name || ""}`.trim(),
      quantity: Number(sourceItem.quantity || 0),
      basePrice: Number(sourceItem.basePrice || 0),
      pricePerQuantity: Number(sourceItem.pricePerQuantity || 0),
      price: Number(sourceItem.price || 0),
      seatNo,
      note: `${sourceItem.note || ""}`.trim(),
      modifiers: normalizeModifierSnapshot(sourceItem.modifiers),
    };

    if (seatNo !== undefined && normalizedSeatSet.has(seatNo)) {
      splitItems.push(line);
    } else {
      remainingItems.push(line);
    }
  }

  if (splitItems.length === 0) {
    throw createHttpError(409, "No order items match provided seatNos.");
  }

  if (remainingItems.length === 0) {
    throw createHttpError(409, "Seat split cannot move all items. Use transfer for full move.");
  }

  return { splitItems, remainingItems };
};

const deductSnapshotItemsFromTarget = (targetItems = [], sourceSnapshotItems = []) => {
  const targetMap = new Map();

  targetItems.forEach((item) => {
    const key = buildOrderItemKey(
      item.name,
      item.pricePerQuantity,
      item.seatNo,
      item.note,
      item.modifiers
    );
    const prev = targetMap.get(key);
    if (!prev) {
      targetMap.set(key, {
        name: `${item.name || ""}`.trim(),
        quantity: Number(item.quantity || 0),
        basePrice: Number(item.basePrice || 0),
        pricePerQuantity: Number(item.pricePerQuantity || 0),
        seatNo: item.seatNo === undefined || item.seatNo === null ? undefined : Number(item.seatNo),
        note: `${item.note || ""}`.trim(),
        modifiers: normalizeModifierSnapshot(item.modifiers),
      });
      return;
    }
    prev.quantity += Number(item.quantity || 0);
  });

  sourceSnapshotItems.forEach((item) => {
    const key = buildOrderItemKey(
      item.name,
      item.pricePerQuantity,
      item.seatNo,
      item.note,
      item.modifiers
    );
    const qty = Number(item.quantity || 0);
    const target = targetMap.get(key);
    if (!target) {
      throw createHttpError(409, `Cannot unmerge: item ${item.name} is missing in target order.`);
    }
    if (qty > target.quantity) {
      throw createHttpError(
        409,
        `Cannot unmerge: quantity mismatch for ${item.name} (need ${qty}, have ${target.quantity}).`
      );
    }

    target.quantity -= qty;
    if (target.quantity === 0) {
      targetMap.delete(key);
    } else {
      targetMap.set(key, target);
    }
  });

  return Array.from(targetMap.values()).map((item) => ({
    name: item.name,
    quantity: item.quantity,
    basePrice: item.basePrice,
    pricePerQuantity: item.pricePerQuantity,
    price: roundToTwo(item.quantity * item.pricePerQuantity),
    seatNo: item.seatNo,
    note: item.note,
    modifiers: item.modifiers,
  }));
};

const findMergeHistoryEntry = (targetOrder, sourceOrderId) => {
  const history = Array.isArray(targetOrder?.mergeHistory) ? targetOrder.mergeHistory : [];
  const activeEntries = history.filter((entry) => !entry.unmergedAt);

  if (activeEntries.length === 0) {
    throw createHttpError(409, "Target order has no active merge history.");
  }

  if (sourceOrderId) {
    const matched = activeEntries.find(
      (entry) => `${entry.sourceOrderId || ""}` === `${sourceOrderId}`
    );
    if (!matched) {
      throw createHttpError(404, "Requested sourceOrderId is not found in merge history.");
    }
    return matched;
  }

  return activeEntries[activeEntries.length - 1];
};

const splitTableOrder = async (req, res, next) => {
  try {
    const fromTableId = `${req.body.fromTableId || ""}`.trim();
    const toTableId = `${req.body.toTableId || ""}`.trim();

    if (!mongoose.Types.ObjectId.isValid(fromTableId) || !mongoose.Types.ObjectId.isValid(toTableId)) {
      return next(createHttpError(400, "fromTableId and toTableId must be valid ids."));
    }

    if (fromTableId === toTableId) {
      return next(createHttpError(400, "Source and target tables must be different."));
    }

    const [fromTable, toTable] = await Promise.all([Table.findById(fromTableId), Table.findById(toTableId)]);
    if (!fromTable || !toTable) {
      return next(createHttpError(404, "One or both tables not found."));
    }

    if (fromTable.status !== "Booked" || !fromTable.currentOrder) {
      return next(createHttpError(409, "Source table does not have an active order."));
    }

    if (toTable.status !== "Available" || toTable.currentOrder) {
      return next(createHttpError(409, "Target table must be available for split."));
    }

    const sourceOrder = await Order.findById(fromTable.currentOrder);
    assertMergeableOrder(sourceOrder, "Source");

    const { splitItems, remainingItems } = normalizeSplitItems(req.body.items, sourceOrder.items || []);

    const sourceGuests = Number(sourceOrder.customerDetails?.guests || 1);
    let splitGuests = Number(req.body.splitGuests);
    if (!Number.isInteger(splitGuests) || splitGuests < 1 || splitGuests >= sourceGuests) {
      splitGuests = sourceGuests > 1 ? Math.floor(sourceGuests / 2) || 1 : 1;
    }
    const remainingGuests = sourceGuests > 1 ? Math.max(1, sourceGuests - splitGuests) : 1;

    const splitOrder = await Order.create({
      customerDetails: {
        name: sourceOrder.customerDetails?.name,
        phone: sourceOrder.customerDetails?.phone,
        guests: splitGuests,
      },
      orderStatus: sourceOrder.orderStatus,
      sourceType: sourceOrder.sourceType,
      channelProviderCode: sourceOrder.channelProviderCode,
      locationId: sourceOrder.locationId,
      fulfillmentType: sourceOrder.fulfillmentType,
      bills: buildBillsFromItems(splitItems),
      items: splitItems,
      table: toTable._id,
      paymentMethod: sourceOrder.paymentMethod,
    });

    sourceOrder.items = remainingItems;
    sourceOrder.bills = buildBillsFromItems(remainingItems);
    sourceOrder.customerDetails = {
      name: sourceOrder.customerDetails?.name,
      phone: sourceOrder.customerDetails?.phone,
      guests: remainingGuests,
    };
    toTable.status = "Booked";
    toTable.currentOrder = splitOrder._id;

    await Promise.all([sourceOrder.save(), toTable.save()]);

    await logAuditEvent({
      req,
      action: "TABLE_ORDER_SPLIT",
      resourceType: "Order",
      resourceId: splitOrder._id,
      statusCode: 201,
      metadata: {
        fromTableId,
        toTableId,
        sourceOrderId: sourceOrder._id,
        splitOrderId: splitOrder._id,
        splitItems: splitItems.map((item) => ({ name: item.name, quantity: item.quantity })),
      },
    });

    return res.status(201).json({
      success: true,
      message: "Table order split successfully.",
      data: {
        sourceOrder,
        splitOrder,
        fromTable,
        toTable,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const splitTableOrderBySeat = async (req, res, next) => {
  try {
    const fromTableId = `${req.body.fromTableId || ""}`.trim();
    const toTableId = `${req.body.toTableId || ""}`.trim();
    const seatNos = normalizeSeatNos(req.body.seatNos);

    if (!mongoose.Types.ObjectId.isValid(fromTableId) || !mongoose.Types.ObjectId.isValid(toTableId)) {
      return next(createHttpError(400, "fromTableId and toTableId must be valid ids."));
    }

    if (fromTableId === toTableId) {
      return next(createHttpError(400, "Source and target tables must be different."));
    }

    const [fromTable, toTable] = await Promise.all([Table.findById(fromTableId), Table.findById(toTableId)]);
    if (!fromTable || !toTable) {
      return next(createHttpError(404, "One or both tables not found."));
    }

    if (fromTable.status !== "Booked" || !fromTable.currentOrder) {
      return next(createHttpError(409, "Source table does not have an active order."));
    }

    if (toTable.status !== "Available" || toTable.currentOrder) {
      return next(createHttpError(409, "Target table must be available for split."));
    }

    const sourceOrder = await Order.findById(fromTable.currentOrder);
    assertMergeableOrder(sourceOrder, "Source");

    const { splitItems, remainingItems } = splitItemsBySeatNos(sourceOrder.items || [], seatNos);

    const sourceGuests = Number(sourceOrder.customerDetails?.guests || 1);
    const splitGuests = Math.min(Math.max(seatNos.length, 1), Math.max(sourceGuests - 1, 1));
    const remainingGuests = sourceGuests > 1 ? Math.max(1, sourceGuests - splitGuests) : 1;

    const splitOrder = await Order.create({
      customerDetails: {
        name: sourceOrder.customerDetails?.name,
        phone: sourceOrder.customerDetails?.phone,
        guests: splitGuests,
      },
      orderStatus: sourceOrder.orderStatus,
      sourceType: sourceOrder.sourceType,
      channelProviderCode: sourceOrder.channelProviderCode,
      locationId: sourceOrder.locationId,
      fulfillmentType: sourceOrder.fulfillmentType,
      bills: buildBillsFromItems(splitItems),
      items: splitItems,
      table: toTable._id,
      paymentMethod: sourceOrder.paymentMethod,
      paymentData: sourceOrder.paymentData,
    });

    sourceOrder.items = remainingItems;
    sourceOrder.bills = buildBillsFromItems(remainingItems);
    sourceOrder.customerDetails = {
      name: sourceOrder.customerDetails?.name,
      phone: sourceOrder.customerDetails?.phone,
      guests: remainingGuests,
    };
    toTable.status = "Booked";
    toTable.currentOrder = splitOrder._id;

    await Promise.all([sourceOrder.save(), toTable.save()]);

    await logAuditEvent({
      req,
      action: "TABLE_ORDER_SPLIT_BY_SEAT",
      resourceType: "Order",
      resourceId: splitOrder._id,
      statusCode: 201,
      metadata: {
        fromTableId,
        toTableId,
        seatNos,
        sourceOrderId: sourceOrder._id,
        splitOrderId: splitOrder._id,
      },
    });

    return res.status(201).json({
      success: true,
      message: "Table order split by seats successfully.",
      data: {
        sourceOrder,
        splitOrder,
        fromTable,
        toTable,
        seatNos,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const unmergeTableOrders = async (req, res, next) => {
  try {
    const targetOrderId = `${req.body.targetOrderId || ""}`.trim();
    const sourceOrderId = `${req.body.sourceOrderId || ""}`.trim();
    const restoreTableIdInput = `${req.body.restoreTableId || ""}`.trim();

    if (!mongoose.Types.ObjectId.isValid(targetOrderId)) {
      return next(createHttpError(400, "targetOrderId must be a valid id."));
    }

    const targetOrder = await Order.findById(targetOrderId);
    if (!targetOrder) {
      return next(createHttpError(404, "Target order not found."));
    }

    assertMergeableOrder(targetOrder, "Target");

    const mergeEntry = findMergeHistoryEntry(targetOrder, sourceOrderId);
    const sourceOrder = await Order.findById(mergeEntry.sourceOrderId);
    if (!sourceOrder) {
      return next(createHttpError(404, "Source order from merge history not found."));
    }

    if (sourceOrder.orderStatus !== "Cancelled" || sourceOrder.table) {
      return next(createHttpError(409, "Source order is not in merge-cancelled state."));
    }

    const restoreTableId = restoreTableIdInput || `${mergeEntry.sourceTableId || ""}`;
    if (!mongoose.Types.ObjectId.isValid(restoreTableId)) {
      return next(createHttpError(400, "restoreTableId is invalid or missing."));
    }

    const restoreTable = await Table.findById(restoreTableId);
    if (!restoreTable) {
      return next(createHttpError(404, "Restore table not found."));
    }

    if (restoreTable.status !== "Available" || restoreTable.currentOrder) {
      return next(createHttpError(409, "Restore table must be available."));
    }

    const updatedTargetItems = deductSnapshotItemsFromTarget(
      targetOrder.items || [],
      mergeEntry.sourceItems || []
    );
    if (updatedTargetItems.length === 0) {
      return next(
        createHttpError(409, "Unmerge would remove all target items. Use transfer instead.")
      );
    }

    targetOrder.items = updatedTargetItems;
    targetOrder.bills = buildBillsFromItems(updatedTargetItems);
    targetOrder.customerDetails = {
      name: targetOrder.customerDetails?.name,
      phone: targetOrder.customerDetails?.phone,
      guests: Math.max(
        1,
        Number(targetOrder.customerDetails?.guests || 1) -
          Number(mergeEntry.sourceCustomerDetails?.guests || 1)
      ),
    };
    targetOrder.mergeHistory = (targetOrder.mergeHistory || []).map((entry) => {
      if (
        !entry.unmergedAt &&
        `${entry.sourceOrderId || ""}` === `${mergeEntry.sourceOrderId || ""}`
      ) {
        return {
          ...entry.toObject?.(),
          unmergedAt: new Date(),
          unmergedBy: req.user?._id,
        };
      }
      return entry;
    });

    sourceOrder.items = (mergeEntry.sourceItems || []).map((item) => ({
      name: item.name,
      quantity: Number(item.quantity || 0),
      basePrice: Number(item.basePrice || 0),
      pricePerQuantity: Number(item.pricePerQuantity || 0),
      price: Number(item.price || 0),
      seatNo: item.seatNo === undefined || item.seatNo === null ? undefined : Number(item.seatNo),
      note: `${item.note || ""}`.trim(),
      modifiers: normalizeModifierSnapshot(item.modifiers),
    }));
    sourceOrder.bills = {
      total: Number(mergeEntry.sourceBills?.total || 0),
      tax: Number(mergeEntry.sourceBills?.tax || 0),
      totalWithTax: Number(mergeEntry.sourceBills?.totalWithTax || 0),
    };
    sourceOrder.customerDetails = {
      name: mergeEntry.sourceCustomerDetails?.name,
      phone: mergeEntry.sourceCustomerDetails?.phone,
      guests: Number(mergeEntry.sourceCustomerDetails?.guests || 1),
    };
    sourceOrder.orderStatus = targetOrder.orderStatus === "Cancelled" ? "In Progress" : targetOrder.orderStatus;
    sourceOrder.table = restoreTable._id;

    restoreTable.status = "Booked";
    restoreTable.currentOrder = sourceOrder._id;

    await Promise.all([targetOrder.save(), sourceOrder.save(), restoreTable.save()]);

    await logAuditEvent({
      req,
      action: "TABLE_ORDERS_UNMERGED",
      resourceType: "Order",
      resourceId: targetOrder._id,
      statusCode: 200,
      metadata: {
        targetOrderId: targetOrder._id,
        sourceOrderId: sourceOrder._id,
        restoreTableId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Table orders unmerged successfully.",
      data: {
        targetOrder,
        sourceOrder,
        restoreTable,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  addTable,
  getTables,
  updateTable,
  transferTableOrder,
  mergeTableOrders,
  splitTableOrder,
  splitTableOrderBySeat,
  unmergeTableOrders,
  __testables: {
    roundToTwo,
    buildMergedOrderItems,
    buildBillsFromItems,
    normalizeSplitItems,
    buildOrderItemKey,
    normalizeSeatNos,
    splitItemsBySeatNos,
    deductSnapshotItemsFromTarget,
    findMergeHistoryEntry,
  },
};

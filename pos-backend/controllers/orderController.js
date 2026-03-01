const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const Order = require("../models/orderModel");
const Payment = require("../models/paymentModel");
const Table = require("../models/tableModel");
const ReceiptTemplate = require("../models/receiptTemplateModel");
const MemberAccount = require("../models/memberAccountModel");
const MemberLedgerEntry = require("../models/memberLedgerEntryModel");
const OrderTransitionEvent = require("../models/orderTransitionEventModel");
const { calculateOrderSummaryFromCatalog, TAX_RATE } = require("../utils/orderPricing");
const { logAuditEvent } = require("../utils/auditLogger");
const {
  normalizeLocationId,
  reserveInventoryForOrder,
  releaseInventoryReservations,
} = require("../utils/inventoryService");
const { applyCashSaleToOpenShift } = require("../utils/cashShiftService");
const { createKitchenTicketForOrder } = require("../utils/kitchenService");
const { resolveEligiblePromotions, consumePromotionUsage } = require("../utils/promotionService");
const {
  assertMemberIsActive,
  applyMemberBalanceDelta,
  calculatePointsEarned,
  roundToTwo,
} = require("../utils/memberService");
const {
  ORDER_STATUSES,
  resolveTransitionConflict,
} = require("../utils/orderStateMachine");

const ALLOWED_PAYMENT_METHODS = ["Cash", "Online", "Pending"];
const SETTLE_PAYMENT_METHODS = ["Cash", "Online"];
const ONLINE_SUCCESS_PAYMENT_STATUSES = new Set(["succeeded", "requires_capture"]);
const DEFAULT_RECEIPT_TEMPLATE = Object.freeze({
  locationId: "default",
  headerTitle: "Order Receipt",
  storeName: "POS Store",
  footerMessage: "Thank you for your visit.",
  fields: {
    showOrderId: true,
    showOrderDate: true,
    showTableNo: true,
    showCustomerName: true,
    showCustomerPhone: false,
    showGuests: true,
    showItemNotes: true,
    showItemModifiers: true,
    showTaxBreakdown: true,
    showPaymentMethod: true,
  },
});

const sanitizeCustomerDetails = (customerDetails) => {
  const name = `${customerDetails?.name || ""}`.trim();
  const phone = `${customerDetails?.phone || ""}`.trim();
  const guests = Number(customerDetails?.guests);

  if (!name || !phone || !Number.isInteger(guests) || guests < 1 || guests > 50) {
    throw createHttpError(400, "Invalid customer details.");
  }

  if (!/^\+?[0-9]{6,15}$/.test(phone)) {
    throw createHttpError(400, "Customer phone must be 6 to 15 digits.");
  }

  return { name, phone, guests };
};

const normalizeLocationIdInput = (locationId) => `${locationId || ""}`.trim() || "default";

// 2026-02-28T13:00:00+08:00: PRD 7.23.2 小票模板扩展 logoUrl, brandSlogan, promoText
const sanitizeReceiptTemplateInput = (payload = {}) => {
  const allowedBooleanFields = [
    "showOrderId",
    "showOrderDate",
    "showTableNo",
    "showCustomerName",
    "showCustomerPhone",
    "showGuests",
    "showItemNotes",
    "showItemModifiers",
    "showTaxBreakdown",
    "showPaymentMethod",
  ];

  const fieldsPayload = payload.fields || {};
  const sanitizedFields = {};
  allowedBooleanFields.forEach((fieldName) => {
    if (fieldsPayload[fieldName] !== undefined) {
      sanitizedFields[fieldName] = Boolean(fieldsPayload[fieldName]);
    }
  });

  return {
    headerTitle:
      payload.headerTitle === undefined
        ? undefined
        : `${payload.headerTitle || ""}`.trim().slice(0, 80),
    storeName:
      payload.storeName === undefined
        ? undefined
        : `${payload.storeName || ""}`.trim().slice(0, 120),
    footerMessage:
      payload.footerMessage === undefined
        ? undefined
        : `${payload.footerMessage || ""}`.trim().slice(0, 200),
    logoUrl:
      payload.logoUrl === undefined
        ? undefined
        : `${payload.logoUrl || ""}`.trim().slice(0, 512),
    brandSlogan:
      payload.brandSlogan === undefined
        ? undefined
        : `${payload.brandSlogan || ""}`.trim().slice(0, 120),
    promoText:
      payload.promoText === undefined
        ? undefined
        : `${payload.promoText || ""}`.trim().slice(0, 200),
    fields: sanitizedFields,
  };
};

const mergeWithDefaultTemplate = (row) => {
  const safeRow = row || {};
  return {
    locationId: safeRow.locationId || DEFAULT_RECEIPT_TEMPLATE.locationId,
    headerTitle: safeRow.headerTitle || DEFAULT_RECEIPT_TEMPLATE.headerTitle,
    storeName: safeRow.storeName || DEFAULT_RECEIPT_TEMPLATE.storeName,
    footerMessage: safeRow.footerMessage || DEFAULT_RECEIPT_TEMPLATE.footerMessage,
    logoUrl: safeRow.logoUrl || "",
    brandSlogan: safeRow.brandSlogan || "",
    promoText: safeRow.promoText || "",
    fields: {
      ...DEFAULT_RECEIPT_TEMPLATE.fields,
      ...(safeRow.fields || {}),
    },
  };
};

const applyPromotionDiscountToBills = (bills, discountTotal) => {
  const subtotalBeforeDiscount = roundToTwo(Number(bills.total || 0));
  const safeDiscount = Math.min(roundToTwo(Number(discountTotal || 0)), subtotalBeforeDiscount);
  const discountedSubtotal = roundToTwo(subtotalBeforeDiscount - safeDiscount);
  const tax = roundToTwo((discountedSubtotal * TAX_RATE) / 100);
  const totalWithTax = roundToTwo(discountedSubtotal + tax);

  return {
    total: discountedSubtotal,
    tax,
    totalWithTax,
    discountTotal: safeDiscount,
    subtotalBeforeDiscount,
  };
};

const applyExistingDiscountToPricingBills = (pricingBills, previousBills = {}) => {
  const subtotalBeforeDiscount = roundToTwo(Number(pricingBills?.total || 0));
  const previousDiscount = roundToTwo(Number(previousBills?.discountTotal || 0));
  const safeDiscount = Math.min(previousDiscount, subtotalBeforeDiscount);
  const total = roundToTwo(subtotalBeforeDiscount - safeDiscount);
  const tax = roundToTwo((total * TAX_RATE) / 100);

  return {
    total,
    tax,
    totalWithTax: roundToTwo(total + tax),
    discountTotal: safeDiscount,
    subtotalBeforeDiscount,
  };
};

const verifyOnlinePaymentRecord = async ({ paymentData, bills, orderId = null }) => {
  const stripeSessionId = paymentData?.stripe_session_id;
  const stripePaymentIntentId = paymentData?.stripe_payment_intent_id;

  if (!stripeSessionId || !stripePaymentIntentId) {
    throw createHttpError(400, "Online payment details are required.");
  }

  const paymentRecord = await Payment.findOne({
    paymentId: stripePaymentIntentId,
    orderId: stripeSessionId,
    verified: true,
  });

  if (!paymentRecord) {
    throw createHttpError(400, "Payment is not verified on server.");
  }

  const paymentLinkedElsewhere =
    paymentRecord.usedForOrder &&
    paymentRecord.orderDbId &&
    `${paymentRecord.orderDbId}` !== `${orderId || ""}`;
  if (paymentLinkedElsewhere) {
    throw createHttpError(409, "Payment has already been used for another order.");
  }

  if (!ONLINE_SUCCESS_PAYMENT_STATUSES.has(`${paymentRecord.status || ""}`.trim().toLowerCase())) {
    throw createHttpError(400, "Payment status is not eligible for order placement.");
  }

  if (Math.abs(Number(paymentRecord.amount || 0) - Number(bills?.totalWithTax || 0)) > 0.01) {
    throw createHttpError(400, "Payment amount does not match server-calculated order total.");
  }

  return paymentRecord;
};

const assertOrderEditable = (order) => {
  if (!order) {
    throw createHttpError(404, "Order not found!");
  }

  if (["Completed", "Cancelled"].includes(order.orderStatus)) {
    throw createHttpError(409, "Completed/cancelled orders cannot be edited.");
  }
};

const resolveMemberAccount = async (memberId) => {
  if (!memberId) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(memberId)) {
    throw createHttpError(400, "Invalid memberId.");
  }

  const member = await MemberAccount.findById(memberId);
  assertMemberIsActive(member);
  return member;
};

const accrueMemberPointsForOrder = async ({ member, order, req }) => {
  if (!member || !order) {
    return null;
  }

  const pointsEarned = calculatePointsEarned(order.bills.totalWithTax);
  if (pointsEarned <= 0) {
    return null;
  }

  applyMemberBalanceDelta({ member, pointsDelta: pointsEarned, walletDelta: 0 });
  member.lifetimeSpend = roundToTwo(Number(member.lifetimeSpend || 0) + Number(order.bills.totalWithTax || 0));
  await member.save();

  return MemberLedgerEntry.create({
    memberId: member._id,
    locationId: member.locationId,
    type: "POINT_EARN",
    pointsDelta: pointsEarned,
    walletDelta: 0,
    orderId: order._id,
    reference: "ORDER_POINTS",
    reason: "Order points accrual",
    createdBy: req.user?._id,
    metadata: {
      orderTotalWithTax: order.bills.totalWithTax,
    },
  });
};

const addOrder = async (req, res, next) => {
  let inventoryReservations = [];
  let normalizedLocationId = "default";

  try {
    const { customerDetails, items, table, paymentData } = req.body;
    const paymentMethod = `${req.body.paymentMethod || "Pending"}`.trim();
    normalizedLocationId = normalizeLocationId(req.body.locationId);

    if (!mongoose.Types.ObjectId.isValid(table)) {
      return next(createHttpError(400, "Invalid table id."));
    }

    const tableExists = await Table.exists({ _id: table });
    if (!tableExists) {
      return next(createHttpError(404, "Table not found."));
    }

    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
      return next(createHttpError(400, "Invalid payment method."));
    }

    const safeCustomerDetails = sanitizeCustomerDetails(customerDetails);
    const pricing = await calculateOrderSummaryFromCatalog(items, {
      locationId: normalizedLocationId,
      channelProviderCode: "ALL",
      versionTag: req.body.menuVersion,
    });

    const promotionResult = await resolveEligiblePromotions({
      locationId: normalizedLocationId,
      channelCode: "ALL",
      subtotal: pricing.bills.total,
      promotionCodes: req.body.promotionCodes || [],
    });

    const member = await resolveMemberAccount(req.body.memberId);

    const bills = applyPromotionDiscountToBills(pricing.bills, promotionResult.discountTotal);

    const orderPayload = {
      customerDetails: safeCustomerDetails,
      orderStatus: "In Progress",
      sourceType: "POS",
      fulfillmentType: "DINE_IN",
      locationId: normalizedLocationId,
      bills,
      items: pricing.items,
      table,
      paymentMethod,
      memberId: member?._id,
      appliedPromotions: promotionResult.appliedPromotions,
    };

    let paymentRecord;

    if (paymentMethod === "Online") {
      paymentRecord = await verifyOnlinePaymentRecord({
        paymentData,
        bills,
      });
      orderPayload.paymentData = {
        stripe_session_id: paymentData?.stripe_session_id,
        stripe_payment_intent_id: paymentData?.stripe_payment_intent_id,
        stripe_charge_id: paymentData?.stripe_charge_id || paymentRecord.chargeId || "",
      };
    }

    inventoryReservations = await reserveInventoryForOrder({
      locationId: normalizedLocationId,
      items: pricing.items,
    });

    const order = new Order(orderPayload);
    await order.save();

    if (paymentRecord) {
      paymentRecord.usedForOrder = true;
      paymentRecord.orderDbId = order._id;
      await paymentRecord.save();
    }

    if (promotionResult.appliedPromotions.length > 0) {
      await consumePromotionUsage({ appliedPromotions: promotionResult.appliedPromotions });
    }

    if (member) {
      try {
        await accrueMemberPointsForOrder({ member, order, req });
      } catch (memberError) {
        console.error("Failed to accrue member points:", memberError.message);
      }
    }

    try {
      await createKitchenTicketForOrder(order, req.user || null);
    } catch (kitchenError) {
      console.error("Failed to create kitchen ticket:", kitchenError.message);
    }

    if (paymentMethod === "Cash") {
      try {
        await applyCashSaleToOpenShift({
          locationId: normalizedLocationId,
          amount: order.bills.totalWithTax,
          createdBy: req.user?._id,
          metadata: {
            orderId: order._id,
            sourceType: order.sourceType,
          },
        });
      } catch (cashError) {
        console.error("Failed to apply cash sale movement:", cashError.message);
      }
    }

    await logAuditEvent({
      req,
      action: "ORDER_CREATED",
      resourceType: "Order",
      resourceId: order._id,
      statusCode: 201,
      metadata: {
        tableId: order.table,
        paymentMethod: order.paymentMethod,
        totalWithTax: order.bills.totalWithTax,
        discountTotal: order.bills.discountTotal,
        memberId: order.memberId,
      },
    });

    res.status(201).json({ success: true, message: "Order created!", data: order });
  } catch (error) {
    if (inventoryReservations.length > 0) {
      await releaseInventoryReservations(inventoryReservations);
    }
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    const order = await Order.findById(id).populate("table memberId");
    if (!order) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    next(error);
  }
};

// 2026-02-28T16:10:00+08:00 Phase E2.3 渠道订单筛选 sourceType=CHANNEL
const getOrders = async (req, res, next) => {
  try {
    const sourceType = `${req.query.sourceType || ""}`.trim().toUpperCase();
    const match = {};
    if (sourceType === "CHANNEL" || sourceType === "POS") {
      match.sourceType = sourceType;
    }
    const orders = await Order.find(match).populate("table memberId").sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: orders });
  } catch (error) {
    next(error);
  }
};

const updateOrder = async (req, res, next) => {
  try {
    const { orderStatus } = req.body;
    const { id } = req.params;
    const expectedVersionRaw = req.body.expectedVersion;
    const expectedVersion =
      expectedVersionRaw === undefined ? undefined : Number(expectedVersionRaw);
    const transitionReason = `${req.body.reason || ""}`.trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    if (!ORDER_STATUSES.includes(orderStatus)) {
      return next(createHttpError(400, "Invalid order status."));
    }

    const order = await Order.findById(id);

    if (!order) {
      const error = createHttpError(404, "Order not found!");
      return next(error);
    }

    const conflict = resolveTransitionConflict({
      fromStatus: order.orderStatus,
      toStatus: orderStatus,
      expectedVersion,
      actualVersion: order.__v,
    });

    if (conflict.type !== "NONE") {
      const conflictEvent = await OrderTransitionEvent.create({
        orderId: order._id,
        fromStatus: order.orderStatus,
        toStatus: orderStatus,
        actorId: req.user?._id,
        actorRole: req.user?.role,
        source: "api",
        reason: transitionReason || "Order status conflict",
        metadata: {
          expectedVersion,
          actualVersion: order.__v,
        },
        conflict: {
          type: conflict.type,
          detail: conflict.detail,
          resolved: false,
        },
      });

      const conflictError = createHttpError(409, "Order transition conflict detected.");
      conflictError.code = conflict.type;
      conflictError.detail = conflict.detail;
      conflictError.conflictEventId = conflictEvent._id;
      return next(conflictError);
    }

    const fromStatus = order.orderStatus;
    order.orderStatus = orderStatus;
    await order.save();

    await OrderTransitionEvent.create({
      orderId: order._id,
      fromStatus,
      toStatus: orderStatus,
      actorId: req.user?._id,
      actorRole: req.user?.role,
      source: "api",
      reason: transitionReason || "Manual status update",
      metadata: {
        expectedVersion,
        nextVersion: order.__v,
      },
      conflict: {
        type: "NONE",
        detail: "",
        resolved: true,
      },
    });

    await logAuditEvent({
      req,
      action: "ORDER_STATUS_UPDATED",
      resourceType: "Order",
      resourceId: order._id,
      statusCode: 200,
      metadata: {
        orderStatus: order.orderStatus,
      },
    });

    res.status(200).json({ success: true, message: "Order updated", data: order });
  } catch (error) {
    next(error);
  }
};

// 2026-02-28T12:45:00+08:00: 分单 400 修复 - 显式校验 items 并保留错误信息
const updateOrderItems = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(404, "Invalid id!"));
    }

    const rawItems = req.body?.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      return next(
        createHttpError(400, "items is required and must be a non-empty array. Please ensure the cart has at least one item.")
      );
    }

    const order = await Order.findById(id);
    assertOrderEditable(order);

    if (order.fulfillmentType !== "DINE_IN") {
      return next(createHttpError(409, "Only dine-in orders can be edited from POS."));
    }

    const nextLocationId = normalizeLocationId(req.body.locationId || order.locationId);
    const pricing = await calculateOrderSummaryFromCatalog(rawItems, {
      locationId: nextLocationId,
      channelProviderCode: "ALL",
      versionTag: req.body.menuVersion,
    });

    if (!Array.isArray(pricing.items) || pricing.items.length === 0) {
      return next(createHttpError(400, "At least one order item is required."));
    }

    const safeCustomerDetails = req.body.customerDetails
      ? sanitizeCustomerDetails(req.body.customerDetails)
      : order.customerDetails;

    order.customerDetails = safeCustomerDetails;
    order.items = pricing.items;
    order.bills = applyExistingDiscountToPricingBills(pricing.bills, order.bills);
    order.locationId = nextLocationId;
    if (order.orderStatus === "Ready") {
      order.orderStatus = "In Progress";
    }
    await order.save();

    await logAuditEvent({
      req,
      action: "ORDER_ITEMS_UPDATED",
      resourceType: "Order",
      resourceId: order._id,
      statusCode: 200,
      metadata: {
        itemCount: order.items.length,
        totalWithTax: order.bills.totalWithTax,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Order items updated.",
      data: order,
    });
  } catch (error) {
    return next(error);
  }
};

const settleOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const paymentMethod = `${req.body.paymentMethod || "Cash"}`.trim();
    const transitionReason = `${req.body.reason || "Checkout settlement"}`.trim();

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(404, "Invalid id!"));
    }

    if (!SETTLE_PAYMENT_METHODS.includes(paymentMethod)) {
      return next(createHttpError(400, "Invalid payment method for settlement."));
    }

    const order = await Order.findById(id);
    if (!order) {
      return next(createHttpError(404, "Order not found!"));
    }

    if (["Completed", "Cancelled"].includes(order.orderStatus)) {
      return next(createHttpError(409, "Order is already closed."));
    }

    if (paymentMethod === "Online") {
      const paymentRecord = await verifyOnlinePaymentRecord({
        paymentData: req.body.paymentData,
        bills: order.bills,
        orderId: order._id,
      });
      paymentRecord.usedForOrder = true;
      paymentRecord.orderDbId = order._id;
      await paymentRecord.save();
      order.paymentData = {
        stripe_session_id: req.body?.paymentData?.stripe_session_id,
        stripe_payment_intent_id: req.body?.paymentData?.stripe_payment_intent_id,
        stripe_charge_id: req.body?.paymentData?.stripe_charge_id || paymentRecord.chargeId || "",
      };
    }

    if (paymentMethod === "Cash" && order.paymentMethod !== "Cash") {
      try {
        await applyCashSaleToOpenShift({
          locationId: normalizeLocationId(order.locationId),
          amount: Number(order.bills?.totalWithTax || 0),
          createdBy: req.user?._id,
          metadata: {
            orderId: order._id,
            sourceType: order.sourceType,
            settlementMode: "checkout",
          },
        });
      } catch (cashError) {
        console.error("Failed to apply cash sale movement at settlement:", cashError.message);
      }
    }

    const fromStatus = order.orderStatus;
    order.paymentMethod = paymentMethod;
    order.orderStatus = "Completed";
    await order.save();

    await Table.updateMany(
      { currentOrder: order._id },
      { $set: { status: "Available", currentOrder: null } }
    );

    await OrderTransitionEvent.create({
      orderId: order._id,
      fromStatus,
      toStatus: order.orderStatus,
      actorId: req.user?._id,
      actorRole: req.user?.role,
      source: "api",
      reason: transitionReason,
      metadata: {
        settlementPaymentMethod: paymentMethod,
      },
      conflict: {
        type: "NONE",
        detail: "",
        resolved: true,
      },
    });

    await logAuditEvent({
      req,
      action: "ORDER_SETTLED",
      resourceType: "Order",
      resourceId: order._id,
      statusCode: 200,
      metadata: {
        paymentMethod: order.paymentMethod,
        totalWithTax: order.bills?.totalWithTax,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Order settled and table released.",
      data: order,
    });
  } catch (error) {
    return next(error);
  }
};

const getReceiptTemplate = async (req, res, next) => {
  try {
    const locationId = normalizeLocationIdInput(req.query.locationId);
    const template = await ReceiptTemplate.findOne({ locationId }).lean();
    return res.status(200).json({
      success: true,
      data: mergeWithDefaultTemplate(template ? { ...template, locationId } : { locationId }),
    });
  } catch (error) {
    return next(error);
  }
};

const upsertReceiptTemplate = async (req, res, next) => {
  try {
    const locationId = normalizeLocationIdInput(req.body.locationId || req.query.locationId);
    const sanitized = sanitizeReceiptTemplateInput(req.body || {});
    const $set = {
      locationId,
    };

    if (sanitized.headerTitle !== undefined) {
      $set.headerTitle = sanitized.headerTitle || DEFAULT_RECEIPT_TEMPLATE.headerTitle;
    }
    if (sanitized.storeName !== undefined) {
      $set.storeName = sanitized.storeName || DEFAULT_RECEIPT_TEMPLATE.storeName;
    }
    if (sanitized.footerMessage !== undefined) {
      $set.footerMessage = sanitized.footerMessage || DEFAULT_RECEIPT_TEMPLATE.footerMessage;
    }
    if (sanitized.logoUrl !== undefined) $set.logoUrl = sanitized.logoUrl || "";
    if (sanitized.brandSlogan !== undefined) $set.brandSlogan = sanitized.brandSlogan || "";
    if (sanitized.promoText !== undefined) $set.promoText = sanitized.promoText || "";
    if (Object.keys(sanitized.fields || {}).length > 0) {
      Object.entries(sanitized.fields).forEach(([fieldKey, fieldValue]) => {
        $set[`fields.${fieldKey}`] = fieldValue;
      });
    }

    const template = await ReceiptTemplate.findOneAndUpdate(
      { locationId },
      { $set },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    await logAuditEvent({
      req,
      action: "RECEIPT_TEMPLATE_UPDATED",
      resourceType: "ReceiptTemplate",
      resourceId: template?._id,
      statusCode: 200,
      metadata: {
        locationId,
      },
    });

    return res.status(200).json({
      success: true,
      message: "Receipt template updated.",
      data: mergeWithDefaultTemplate(template),
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  addOrder,
  getOrderById,
  getOrders,
  updateOrder,
  updateOrderItems,
  settleOrder,
  getReceiptTemplate,
  upsertReceiptTemplate,
};

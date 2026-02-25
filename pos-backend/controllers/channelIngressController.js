const createHttpError = require("http-errors");
const mongoose = require("mongoose");
const config = require("../config/config");
const Order = require("../models/orderModel");
const Table = require("../models/tableModel");
const ChannelProvider = require("../models/channelProviderModel");
const StoreChannelConnection = require("../models/storeChannelConnectionModel");
const ChannelMappingRule = require("../models/channelMappingRuleModel");
const ChannelDeadLetterEvent = require("../models/channelDeadLetterEventModel");
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
  verifyIngressSignature,
  resolveQuotaPerMinute,
  enforceIngressQuota,
  normalizeCode,
} = require("../utils/channelIngressGuard");
const { categorizeFailureCode } = require("../utils/channelDlqGovernance");

const ALLOWED_ORDER_STATUSES = ["In Progress", "Ready", "Completed", "Cancelled"];
const ALLOWED_PAYMENT_METHODS = ["Cash", "Online"];
const ALLOWED_FULFILLMENT_TYPES = ["DINE_IN", "DELIVERY", "PICKUP", "OTHER"];

const roundToTwo = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const normalizeFulfillmentType = (value) => {
  const normalized = normalizeCode(value);
  if (ALLOWED_FULFILLMENT_TYPES.includes(normalized)) {
    return normalized;
  }
  return "DELIVERY";
};

const sanitizeCustomerDetails = (details = {}) => {
  const name = `${details.name || ""}`.trim();
  const phone = `${details.phone || ""}`.trim();
  const guestsRaw = Number(details.guests);
  const guests = Number.isInteger(guestsRaw) && guestsRaw > 0 ? guestsRaw : 1;

  if (!name) {
    throw createHttpError(400, "customerDetails.name is required.");
  }

  if (!/^\+?[0-9]{6,15}$/.test(phone)) {
    throw createHttpError(400, "customerDetails.phone must be 6 to 15 digits.");
  }

  return { name, phone, guests };
};

const resolveOrderStatus = async ({ locationId, providerCode, externalStatus }) => {
  const rawStatus = `${externalStatus || ""}`.trim();
  if (!rawStatus) {
    return "In Progress";
  }

  const mapping = await ChannelMappingRule.findOne({
    locationId,
    providerCode,
    entityType: "status",
    externalCode: rawStatus,
    active: true,
  });

  const mappedStatus = `${mapping?.internalCode || rawStatus}`.trim();
  if (ALLOWED_ORDER_STATUSES.includes(mappedStatus)) {
    return mappedStatus;
  }

  return "In Progress";
};

const resolveItems = async ({ locationId, providerCode, items }) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError(400, "At least one item is required.");
  }

  const externalCodes = items
    .map((item) => `${item?.externalCode || ""}`.trim())
    .filter(Boolean);

  const mappings = externalCodes.length
    ? await ChannelMappingRule.find({
        locationId,
        providerCode,
        entityType: "item",
        externalCode: { $in: externalCodes },
        active: true,
      })
    : [];

  const mappingMap = new Map(mappings.map((mapping) => [mapping.externalCode, mapping]));

  return items.map((item) => {
    const externalCode = `${item?.externalCode || ""}`.trim();
    const internalCode = `${item?.internalCode || ""}`.trim();
    const fallbackName = `${item?.name || ""}`.trim();
    const mapped = mappingMap.get(externalCode);
    const name = `${mapped?.internalCode || internalCode || fallbackName}`.trim();
    const quantity = Number(item?.quantity);

    if (!name) {
      throw createHttpError(
        400,
        `Item mapping is missing for externalCode: ${externalCode || "N/A"}`
      );
    }

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) {
      throw createHttpError(400, `Invalid quantity for item: ${name}`);
    }

    return { name, quantity };
  });
};

const resolveTable = async ({ table, fulfillmentType }) => {
  if (!table) {
    return null;
  }

  if (!mongoose.Types.ObjectId.isValid(table)) {
    throw createHttpError(400, "Invalid table id.");
  }

  const exists = await Table.exists({ _id: table });
  if (!exists) {
    throw createHttpError(404, "Table not found.");
  }

  if (fulfillmentType !== "DINE_IN") {
    return null;
  }

  return table;
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

const buildDeadLetterPayload = ({ payload, providerCode, locationId, externalOrderId, error }) => ({
  providerCode,
  locationId,
  externalOrderId,
  eventType: "ORDER_INGEST",
  failureCode: `${error?.code || error?.statusCode || "INGEST_FAILED"}`,
  failureCategory: categorizeFailureCode(error?.code || error?.statusCode, error?.message),
  failureMessage: `${error?.message || "Unknown ingest error"}`,
  payload,
  metadata: {
    stack: process.env.NODE_ENV === "production" ? undefined : error?.stack,
  },
});

const createDeadLetterEvent = async ({ payload, providerCode, locationId, externalOrderId, error }) => {
  try {
    return await ChannelDeadLetterEvent.create(
      buildDeadLetterPayload({ payload, providerCode, locationId, externalOrderId, error })
    );
  } catch (dlqError) {
    console.error("Failed to persist channel dead-letter event:", dlqError.message);
    return null;
  }
};

const enforceIngressGovernance = async ({ connection, providerCode, locationId, payload, signature }) => {
  const requiresSignature =
    Boolean(connection?.metadata?.webhookSecret) || config.channelIngressRequireSignature;

  if (requiresSignature) {
    const secret = `${connection?.metadata?.webhookSecret || ""}`.trim();
    if (!secret) {
      throw createHttpError(400, "Channel webhook secret is missing for signature validation.");
    }
    const validSignature = verifyIngressSignature({
      secret,
      payload,
      receivedSignature: signature,
    });

    if (!validSignature) {
      throw createHttpError(401, "Invalid channel signature.");
    }
  }

  const quotaPerMinute = resolveQuotaPerMinute(connection);
  await enforceIngressQuota({
    providerCode,
    locationId,
    quotaPerMinute,
  });
};

const ingestChannelOrderPayload = async ({ payload, actorUser, signature }) => {
  let inventoryReservations = [];
  const providerCode = normalizeCode(payload.providerCode);
  const locationId = normalizeLocationId(payload.locationId);
  const externalOrderId = `${payload.externalOrderId || ""}`.trim();

  try {
    const fulfillmentType = normalizeFulfillmentType(payload.fulfillmentType);
    const paymentMethod = `${payload.paymentMethod || "Online"}`.trim();

    if (!providerCode || !locationId || !externalOrderId) {
      throw createHttpError(400, "providerCode, locationId and externalOrderId are required.");
    }

    if (!ALLOWED_PAYMENT_METHODS.includes(paymentMethod)) {
      throw createHttpError(400, "Invalid payment method.");
    }

    const provider = await ChannelProvider.findOne({ providerCode, status: "active" });
    if (!provider) {
      throw createHttpError(400, "Active channel provider not found.");
    }

    if (!provider.capabilities?.orders) {
      throw createHttpError(400, "Provider does not support order ingestion.");
    }

    const connection = await StoreChannelConnection.findOne({
      locationId,
      providerCode,
      enabled: true,
    });

    if (!connection) {
      throw createHttpError(
        400,
        "No enabled store-channel connection found for this location/provider."
      );
    }

    await enforceIngressGovernance({
      connection,
      providerCode,
      locationId,
      payload,
      signature,
    });

    const existing = await Order.findOne({
      sourceType: "CHANNEL",
      channelProviderCode: providerCode,
      externalOrderId,
    });

    if (existing) {
      return {
        replayed: true,
        order: existing,
        providerCode,
        locationId,
        externalOrderId,
      };
    }

    const customerDetails = sanitizeCustomerDetails(payload.customerDetails);
    const resolvedItems = await resolveItems({
      locationId,
      providerCode,
      items: payload.items,
    });

    const pricing = await calculateOrderSummaryFromCatalog(resolvedItems, {
      locationId,
      channelProviderCode: providerCode,
    });

    const promotionResult = await resolveEligiblePromotions({
      locationId,
      channelCode: providerCode,
      subtotal: pricing.bills.total,
      promotionCodes: payload.promotionCodes || [],
    });

    const bills = applyPromotionDiscountToBills(pricing.bills, promotionResult.discountTotal);

    const orderStatus = await resolveOrderStatus({
      locationId,
      providerCode,
      externalStatus: payload.externalStatus,
    });

    const table = await resolveTable({
      table: payload.table,
      fulfillmentType,
    });

    inventoryReservations = await reserveInventoryForOrder({
      locationId,
      items: pricing.items,
    });

    const order = await Order.create({
      customerDetails,
      orderStatus,
      sourceType: "CHANNEL",
      channelProviderCode: providerCode,
      externalOrderId,
      locationId,
      fulfillmentType,
      bills,
      items: pricing.items,
      table,
      paymentMethod,
      appliedPromotions: promotionResult.appliedPromotions,
    });

    if (promotionResult.appliedPromotions.length > 0) {
      await consumePromotionUsage({ appliedPromotions: promotionResult.appliedPromotions });
    }

    try {
      await createKitchenTicketForOrder(order, actorUser || null);
    } catch (kitchenError) {
      console.error("Failed to create kitchen ticket:", kitchenError.message);
    }

    if (paymentMethod === "Cash") {
      try {
        await applyCashSaleToOpenShift({
          locationId,
          amount: order.bills.totalWithTax,
          createdBy: actorUser?._id,
          metadata: {
            orderId: order._id,
            sourceType: order.sourceType,
            providerCode,
          },
        });
      } catch (cashError) {
        console.error("Failed to apply cash sale movement:", cashError.message);
      }
    }

    return {
      replayed: false,
      order,
      providerCode,
      locationId,
      externalOrderId,
    };
  } catch (error) {
    if (inventoryReservations.length > 0) {
      await releaseInventoryReservations(inventoryReservations);
    }

    if (error?.code === 11000) {
      error.statusCode = 409;
      error.message = "Duplicate external order id for this provider.";
    }

    throw error;
  }
};

const ingestChannelOrder = async (req, res, next) => {
  try {
    const signature = req.headers["x-channel-signature"];

    const result = await ingestChannelOrderPayload({
      payload: req.body,
      actorUser: req.user,
      signature,
    });

    await logAuditEvent({
      req,
      action: "CHANNEL_ORDER_INGESTED",
      resourceType: "Order",
      resourceId: result.order._id,
      statusCode: result.replayed ? 200 : 201,
      metadata: {
        providerCode: result.providerCode,
        locationId: result.locationId,
        externalOrderId: result.externalOrderId,
        replayed: result.replayed,
      },
    });

    return res.status(result.replayed ? 200 : 201).json({
      success: true,
      message: result.replayed ? "Channel order already ingested." : "Channel order ingested.",
      replayed: result.replayed,
      data: result.order,
    });
  } catch (error) {
    const providerCode = normalizeCode(req.body.providerCode);
    const locationId = normalizeLocationId(req.body.locationId);
    const externalOrderId = `${req.body.externalOrderId || ""}`.trim();

    const deadLetter = await createDeadLetterEvent({
      payload: req.body,
      providerCode,
      locationId,
      externalOrderId,
      error,
    });

    if (deadLetter) {
      error.deadLetterEventId = deadLetter._id;
    }

    return next(error);
  }
};

module.exports = {
  ingestChannelOrder,
  ingestChannelOrderPayload,
  createDeadLetterEvent,
  buildDeadLetterPayload,
};

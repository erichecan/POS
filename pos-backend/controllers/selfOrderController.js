const createHttpError = require("http-errors");
const crypto = require("crypto");
const mongoose = require("mongoose");
const Table = require("../models/tableModel");
const Order = require("../models/orderModel");
const TableQrSession = require("../models/tableQrSessionModel");
const MenuCatalogItem = require("../models/menuCatalogItemModel");
const { calculateOrderSummaryFromCatalog, getMenuItemEntries, TAX_RATE } = require("../utils/orderPricing");
const { createKitchenTicketForOrder } = require("../utils/kitchenService");
const { applyCashSaleToOpenShift } = require("../utils/cashShiftService");
const { resolveEligiblePromotions, consumePromotionUsage } = require("../utils/promotionService");

const normalizeLocationId = (value) => `${value || ""}`.trim() || "default";

const roundToTwo = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const sanitizeCustomerDetails = (customerDetails = {}) => {
  const name = `${customerDetails.name || "Guest"}`.trim() || "Guest";
  const phone = `${customerDetails.phone || "000000"}`.trim();
  const guests = Number(customerDetails.guests || 1);

  if (!Number.isInteger(guests) || guests < 1 || guests > 50) {
    throw createHttpError(400, "customerDetails.guests must be 1..50.");
  }

  return { name, phone, guests };
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

// 2026-02-28T15:30:00+08:00 Phase E1.2 手持 POS - 服务员扫码解析桌台 token
const resolveTableByTokenForStaff = async (req, res, next) => {
  try {
    const token = `${req.params.token || req.query?.token || ""}`.trim();
    if (!token) {
      return next(createHttpError(400, "token is required."));
    }

    const session = await resolveActiveSessionByToken(token);

    return res.status(200).json({
      success: true,
      data: {
        tableId: session.tableId?._id,
        tableNo: session.tableId?.tableNo,
        seats: session.tableId?.seats,
        locationId: session.locationId,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const resolveActiveSessionByToken = async (token) => {
  const session = await TableQrSession.findOne({ token }).populate("tableId");
  if (!session) {
    throw createHttpError(404, "QR session not found.");
  }

  if (session.status !== "ACTIVE") {
    throw createHttpError(409, "QR session is not active.");
  }

  if (new Date(session.expiresAt).getTime() <= Date.now()) {
    session.status = "EXPIRED";
    await session.save();
    throw createHttpError(409, "QR session has expired.");
  }

  return session;
};

// 2026-02-28T18:30:00+08:00 Phase B1 - Kiosk 无 token 公开菜单接口（自助点餐机用）
const getKioskMenu = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.query.locationId);

    const items = await MenuCatalogItem.find({
      locationId,
      status: "ACTIVE",
      channelCode: "ALL",
    })
      .sort({ category: 1, name: 1 })
      .lean();

    const menuItems = items.length
      ? items.map((item) => ({
          id: item._id,
          name: item.name,
          category: item.category,
          price: item.basePrice,
          versionTag: item.versionTag,
        }))
      : getMenuItemEntries().map((item) => ({
          name: item.name,
          category: "default",
          price: item.price,
          versionTag: "static",
        }));

    return res.status(200).json({
      success: true,
      data: {
        locationId,
        menuItems,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// 2026-02-28T18:31:00+08:00 Phase B1 - Kiosk 无桌下单（取餐号场景，fulfillmentType: PICKUP）
const createKioskOrder = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);

    const pricing = await calculateOrderSummaryFromCatalog(req.body.items, {
      locationId,
      channelProviderCode: "ALL",
      versionTag: req.body.menuVersion,
    });

    const promotionResult = await resolveEligiblePromotions({
      locationId,
      channelCode: "ALL",
      subtotal: pricing.bills.total,
      promotionCodes: req.body.promotionCodes || [],
    });

    const bills = applyPromotionDiscountToBills(pricing.bills, promotionResult.discountTotal);

    const paymentMethod = `${req.body.paymentMethod || "Cash"}`.trim();
    if (!["Cash", "Online"].includes(paymentMethod)) {
      return next(createHttpError(400, "Invalid paymentMethod."));
    }

    const order = await Order.create({
      customerDetails: sanitizeCustomerDetails(req.body.customerDetails),
      orderStatus: "In Progress",
      sourceType: "POS",
      fulfillmentType: "PICKUP",
      locationId,
      bills,
      items: pricing.items,
      table: null,
      paymentMethod,
      appliedPromotions: promotionResult.appliedPromotions,
    });

    if (promotionResult.appliedPromotions.length > 0) {
      await consumePromotionUsage({ appliedPromotions: promotionResult.appliedPromotions });
    }

    try {
      await createKitchenTicketForOrder(order, null);
    } catch (error) {
      console.error("Failed to create kitchen ticket for kiosk order:", error.message);
    }

    if (paymentMethod === "Cash") {
      try {
        await applyCashSaleToOpenShift({
          locationId,
          amount: order.bills.totalWithTax,
          metadata: {
            orderId: order._id,
            sourceType: "SELF_ORDER_KIOSK",
          },
        });
      } catch (error) {
        console.error("Failed to apply cash movement for kiosk order:", error.message);
      }
    }

    return res.status(201).json({ success: true, data: order });
  } catch (error) {
    return next(error);
  }
};

const generateTableQrSession = async (req, res, next) => {
  try {
    const tableId = `${req.body.tableId || ""}`.trim();
    if (!mongoose.Types.ObjectId.isValid(tableId)) {
      return next(createHttpError(400, "Invalid tableId."));
    }

    const table = await Table.findById(tableId);
    if (!table) {
      return next(createHttpError(404, "Table not found."));
    }

    const locationId = normalizeLocationId(req.body.locationId);
    const expiresMinutes = Math.max(Number(req.body.expiresMinutes || 24 * 60), 5);
    const token = crypto.randomBytes(18).toString("base64url");

    const session = await TableQrSession.create({
      tableId: table._id,
      locationId,
      token,
      status: "ACTIVE",
      expiresAt: new Date(Date.now() + expiresMinutes * 60 * 1000),
      createdBy: req.user?._id,
      metadata: req.body.metadata,
    });

    return res.status(201).json({
      success: true,
      data: {
        sessionId: session._id,
        tableId: table._id,
        tableNo: table.tableNo,
        token: session.token,
        expiresAt: session.expiresAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const getPublicMenuByToken = async (req, res, next) => {
  try {
    const token = `${req.params.token || ""}`.trim();
    if (!token) {
      return next(createHttpError(400, "token is required."));
    }

    const session = await resolveActiveSessionByToken(token);

    const items = await MenuCatalogItem.find({
      locationId: session.locationId,
      status: "ACTIVE",
      channelCode: "ALL",
    })
      .sort({ category: 1, name: 1 })
      .lean();

    const menuItems = items.length
      ? items.map((item) => ({
          id: item._id,
          name: item.name,
          category: item.category,
          price: item.basePrice,
          versionTag: item.versionTag,
        }))
      : getMenuItemEntries().map((item) => ({
          name: item.name,
          category: "default",
          price: item.price,
          versionTag: "static",
        }));

    return res.status(200).json({
      success: true,
      data: {
        tableNo: session.tableId?.tableNo,
        locationId: session.locationId,
        menuItems,
      },
    });
  } catch (error) {
    return next(error);
  }
};

const createSelfOrderByToken = async (req, res, next) => {
  try {
    const token = `${req.body.token || ""}`.trim();
    if (!token) {
      return next(createHttpError(400, "token is required."));
    }

    const session = await resolveActiveSessionByToken(token);
    const table = session.tableId;
    if (!table) {
      return next(createHttpError(404, "Linked table not found."));
    }

    const pricing = await calculateOrderSummaryFromCatalog(req.body.items, {
      locationId: session.locationId,
      channelProviderCode: "ALL",
      versionTag: req.body.menuVersion,
    });

    const promotionResult = await resolveEligiblePromotions({
      locationId: session.locationId,
      channelCode: "ALL",
      subtotal: pricing.bills.total,
      promotionCodes: req.body.promotionCodes || [],
    });

    const bills = applyPromotionDiscountToBills(pricing.bills, promotionResult.discountTotal);

    const paymentMethod = `${req.body.paymentMethod || "Cash"}`.trim();
    if (!["Cash", "Online"].includes(paymentMethod)) {
      return next(createHttpError(400, "Invalid paymentMethod."));
    }

    const order = await Order.create({
      customerDetails: sanitizeCustomerDetails(req.body.customerDetails),
      orderStatus: "In Progress",
      sourceType: "POS",
      fulfillmentType: "DINE_IN",
      locationId: session.locationId,
      bills,
      items: pricing.items,
      table: table._id,
      paymentMethod,
      appliedPromotions: promotionResult.appliedPromotions,
    });

    if (promotionResult.appliedPromotions.length > 0) {
      await consumePromotionUsage({ appliedPromotions: promotionResult.appliedPromotions });
    }

    table.status = "Booked";
    table.currentOrder = order._id;
    await table.save();

    try {
      await createKitchenTicketForOrder(order, null);
    } catch (error) {
      console.error("Failed to create kitchen ticket for self-order:", error.message);
    }

    if (paymentMethod === "Cash") {
      try {
        await applyCashSaleToOpenShift({
          locationId: session.locationId,
          amount: order.bills.totalWithTax,
          metadata: {
            orderId: order._id,
            sourceType: "SELF_ORDER_QR",
          },
        });
      } catch (error) {
        console.error("Failed to apply cash movement for self-order:", error.message);
      }
    }

    return res.status(201).json({ success: true, data: order });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  generateTableQrSession,
  getPublicMenuByToken,
  createSelfOrderByToken,
  resolveTableByTokenForStaff, // 2026-02-28T15:32:00+08:00 Phase E1.2 手持 POS
  getKioskMenu,
  createKioskOrder,
};

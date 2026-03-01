/**
 * 公开订单 API - Phase C1 在线订餐
 * 2026-02-28T16:02:00+08:00 无需登录即可浏览菜单、下单、查状态
 */
const createHttpError = require("http-errors");
const MenuCatalogItem = require("../models/menuCatalogItemModel");
const Order = require("../models/orderModel");
const {
  calculateOrderSummaryFromCatalog,
  getMenuItemEntries,
  TAX_RATE,
} = require("../utils/orderPricing");
const { resolveEligiblePromotions, consumePromotionUsage } = require("../utils/promotionService");
const { createKitchenTicketForOrder } = require("../utils/kitchenService");

const normalizeLocationId = (v) => `${v || ""}`.trim() || "default";

const roundToTwo = (value) => Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

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

const sanitizeCustomerDetails = (customerDetails = {}) => {
  const name = `${customerDetails.name || "Guest"}`.trim() || "Guest";
  const phone = `${customerDetails.phone || "000000"}`.trim();
  const guests = Number(customerDetails.guests || 1);
  if (!Number.isInteger(guests) || guests < 1 || guests > 50) {
    throw createHttpError(400, "customerDetails.guests must be 1..50.");
  }
  return { name, phone, guests };
};

/**
 * GET /api/public/menu?locationId=xxx
 * 公开菜单，无需 token
 */
const getPublicMenu = async (req, res, next) => {
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

/**
 * POST /api/public/orders
 * 创建在线订单（外带/配送），paymentMethod 初始为 Pending
 */
const createPublicOrder = async (req, res, next) => {
  try {
    const locationId = normalizeLocationId(req.body.locationId);
    const fulfillmentType = `${req.body.fulfillmentType || "PICKUP"}`.trim().toUpperCase();
    if (!["PICKUP", "DELIVERY"].includes(fulfillmentType)) {
      return next(createHttpError(400, "fulfillmentType must be PICKUP or DELIVERY."));
    }

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

    const fulfillmentDetails = {};
    if (req.body.pickupAt) {
      const d = new Date(req.body.pickupAt);
      if (!Number.isNaN(d.getTime())) fulfillmentDetails.pickupAt = d;
    }
    if (fulfillmentType === "DELIVERY" && req.body.deliveryAddress) {
      fulfillmentDetails.deliveryAddress = `${req.body.deliveryAddress}`.trim().slice(0, 500);
    }

    const order = await Order.create({
      customerDetails: sanitizeCustomerDetails(req.body.customerDetails),
      orderStatus: "In Progress",
      sourceType: "POS",
      locationId,
      fulfillmentType,
      bills,
      items: pricing.items,
      paymentMethod: "Pending",
      appliedPromotions: promotionResult.appliedPromotions,
      fulfillmentDetails: Object.keys(fulfillmentDetails).length ? fulfillmentDetails : undefined,
    });

    if (promotionResult.appliedPromotions.length > 0) {
      await consumePromotionUsage({ appliedPromotions: promotionResult.appliedPromotions });
    }

    try {
      await createKitchenTicketForOrder(order, null);
    } catch (ktError) {
      console.error("publicOrder: createKitchenTicket failed:", ktError?.message);
    }

    return res.status(201).json({
      success: true,
      data: {
        orderId: order._id,
        orderStatus: order.orderStatus,
        fulfillmentType: order.fulfillmentType,
        totalWithTax: order.bills.totalWithTax,
        items: order.items,
      },
    });
  } catch (error) {
    return next(error);
  }
};

/**
 * GET /api/public/orders/:id/status
 * 公开订单状态，仅返回状态相关信息
 */
const getOrderStatus = async (req, res, next) => {
  try {
    const id = `${req.params.id || ""}`.trim();
    if (!id) {
      return next(createHttpError(400, "Order ID is required."));
    }

    const order = await Order.findById(id)
      .select("orderStatus fulfillmentType fulfillmentDetails orderDate bills.totalWithTax")
      .lean();

    if (!order) {
      return next(createHttpError(404, "Order not found."));
    }

    return res.status(200).json({
      success: true,
      data: {
        orderId: order._id,
        orderStatus: order.orderStatus,
        fulfillmentType: order.fulfillmentType,
        totalWithTax: order.bills?.totalWithTax,
        orderDate: order.orderDate,
        pickupAt: order.fulfillmentDetails?.pickupAt,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  getPublicMenu,
  createPublicOrder,
  getOrderStatus,
};

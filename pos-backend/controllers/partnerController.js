const Order = require("../models/orderModel");

const parsePagination = (req) => {
  const rawLimit = Number(req.query.limit || 50);
  const rawOffset = Number(req.query.offset || 0);

  return {
    limit: Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 50,
    offset: Number.isFinite(rawOffset) ? Math.max(rawOffset, 0) : 0,
  };
};

const listPartnerOrders = async (req, res, next) => {
  try {
    const { limit, offset } = parsePagination(req);
    const query = {};

    if (req.query.locationId) {
      query.locationId = `${req.query.locationId}`.trim();
    }

    if (req.query.from || req.query.to) {
      query.createdAt = {};
      if (req.query.from) {
        query.createdAt.$gte = new Date(req.query.from);
      }
      if (req.query.to) {
        query.createdAt.$lte = new Date(req.query.to);
      }
    }

    const [rows, total] = await Promise.all([
      Order.find(query).sort({ createdAt: -1 }).skip(offset).limit(limit).lean(),
      Order.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: rows,
      pagination: { limit, offset, total },
      partnerApiKey: {
        keyPrefix: req.partnerApiKey?.keyPrefix,
        scopes: req.partnerApiKey?.scopes,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listPartnerOrders,
};

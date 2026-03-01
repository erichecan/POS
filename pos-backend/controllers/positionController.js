/**
 * 岗位 CRUD - 团队管理 Phase 2
 * 2026-02-28
 */
const Position = require("../models/positionModel");
const createHttpError = require("http-errors");
const mongoose = require("mongoose");

const SCOPE_TYPES = ["TABLES", "BAR", "KITCHEN", "RUNNER", "TAKEOUT", "CASHIER", "MANAGER"];

const listPositions = async (req, res, next) => {
  try {
    const locationId = req.query.locationId || "default";
    const isActive = req.query.isActive;
    const filter = { locationId };
    if (isActive !== undefined && isActive !== "") {
      filter.isActive = String(isActive) === "true";
    }
    const positions = await Position.find(filter).sort({ code: 1 });
    return res.status(200).json({ success: true, data: positions });
  } catch (error) {
    return next(error);
  }
};

const getPositionById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid position id."));
    }
    const position = await Position.findById(id);
    if (!position) {
      return next(createHttpError(404, "Position not found."));
    }
    return res.status(200).json({ success: true, data: position });
  } catch (error) {
    return next(error);
  }
};

const createPosition = async (req, res, next) => {
  try {
    const { name, code, locationId = "default", scopeType, scopeConfig, defaultHourlyRate, isActive } = req.body;
    if (!name || !scopeType) {
      return next(createHttpError(400, "name and scopeType are required."));
    }
    if (!SCOPE_TYPES.includes(scopeType)) {
      return next(createHttpError(400, `scopeType must be one of: ${SCOPE_TYPES.join(", ")}`));
    }
    const locId = `${locationId || "default"}`.trim();
    if (code) {
      const existing = await Position.findOne({ locationId: locId, code });
      if (existing) {
        return next(createHttpError(409, "Position with this code already exists."));
      }
    }
    const position = await Position.create({
      name: `${name}`.trim(),
      code: code ? `${code}`.trim() : undefined,
      locationId: locId,
      scopeType,
      scopeConfig: scopeConfig || {},
      defaultHourlyRate: Number(defaultHourlyRate) || 0,
      isActive: isActive !== false,
    });
    return res.status(201).json({ success: true, data: position });
  } catch (error) {
    return next(error);
  }
};

const updatePosition = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid position id."));
    }
    const position = await Position.findById(id);
    if (!position) {
      return next(createHttpError(404, "Position not found."));
    }
    const { name, code, scopeType, scopeConfig, defaultHourlyRate, isActive } = req.body;
    if (name !== undefined) position.name = `${name}`.trim();
    if (code !== undefined) position.code = code ? `${code}`.trim() : undefined;
    if (scopeType !== undefined) {
      if (!SCOPE_TYPES.includes(scopeType)) {
        return next(createHttpError(400, `scopeType must be one of: ${SCOPE_TYPES.join(", ")}`));
      }
      position.scopeType = scopeType;
    }
    if (scopeConfig !== undefined) position.scopeConfig = scopeConfig || {};
    if (defaultHourlyRate !== undefined) position.defaultHourlyRate = Number(defaultHourlyRate) || 0;
    if (isActive !== undefined) position.isActive = isActive !== false;
    await position.save();
    return res.status(200).json({ success: true, data: position });
  } catch (error) {
    return next(error);
  }
};

const deletePosition = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid position id."));
    }
    const position = await Position.findByIdAndDelete(id);
    if (!position) {
      return next(createHttpError(404, "Position not found."));
    }
    return res.status(200).json({ success: true, message: "Position deleted." });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listPositions,
  getPositionById,
  createPosition,
  updatePosition,
  deletePosition,
};

/**
 * 班次模板 CRUD - 团队管理 Phase 3
 * 2026-02-28
 */
const ShiftTemplate = require("../models/shiftTemplateModel");
const createHttpError = require("http-errors");
const mongoose = require("mongoose");

const listShiftTemplates = async (req, res, next) => {
  try {
    const locationId = req.query.locationId || "default";
    const isActive = req.query.isActive;
    const filter = { locationId };
    if (isActive !== undefined && isActive !== "") {
      filter.isActive = String(isActive) === "true";
    }
    const templates = await ShiftTemplate.find(filter).sort({ code: 1 });
    return res.status(200).json({ success: true, data: templates });
  } catch (error) {
    return next(error);
  }
};

const getShiftTemplateById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid shift template id."));
    }
    const template = await ShiftTemplate.findById(id);
    if (!template) return next(createHttpError(404, "Shift template not found."));
    return res.status(200).json({ success: true, data: template });
  } catch (error) {
    return next(error);
  }
};

const createShiftTemplate = async (req, res, next) => {
  try {
    const { name, code, locationId = "default", startTime, endTime, breakMinutes, isActive } = req.body;
    if (!name || !startTime || !endTime) {
      return next(createHttpError(400, "name, startTime, endTime are required."));
    }
    const locId = `${locationId || "default"}`.trim();
    if (code) {
      const existing = await ShiftTemplate.findOne({ locationId: locId, code });
      if (existing) {
        return next(createHttpError(409, "Shift template with this code already exists."));
      }
    }
    const template = await ShiftTemplate.create({
      name: `${name}`.trim(),
      code: code ? `${code}`.trim() : undefined,
      locationId: locId,
      startTime: `${startTime}`.trim(),
      endTime: `${endTime}`.trim(),
      breakMinutes: Number(breakMinutes) || 0,
      isActive: isActive !== false,
    });
    return res.status(201).json({ success: true, data: template });
  } catch (error) {
    return next(error);
  }
};

const updateShiftTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid shift template id."));
    }
    const template = await ShiftTemplate.findById(id);
    if (!template) return next(createHttpError(404, "Shift template not found."));
    const { name, code, startTime, endTime, breakMinutes, isActive } = req.body;
    if (name !== undefined) template.name = `${name}`.trim();
    if (code !== undefined) template.code = code ? `${code}`.trim() : undefined;
    if (startTime !== undefined) template.startTime = `${startTime}`.trim();
    if (endTime !== undefined) template.endTime = `${endTime}`.trim();
    if (breakMinutes !== undefined) template.breakMinutes = Number(breakMinutes) || 0;
    if (isActive !== undefined) template.isActive = isActive !== false;
    await template.save();
    return res.status(200).json({ success: true, data: template });
  } catch (error) {
    return next(error);
  }
};

const deleteShiftTemplate = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(createHttpError(400, "Invalid shift template id."));
    }
    const template = await ShiftTemplate.findByIdAndDelete(id);
    if (!template) return next(createHttpError(404, "Shift template not found."));
    return res.status(200).json({ success: true, message: "Shift template deleted." });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  listShiftTemplates,
  getShiftTemplateById,
  createShiftTemplate,
  updateShiftTemplate,
  deleteShiftTemplate,
};
